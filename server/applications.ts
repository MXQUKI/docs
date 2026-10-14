import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { questions, supportedLocales, validateAnswers, version } from '../src/forms/frc.js';
import type { Answers } from '../src/forms/frc.js';

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Payload = { version: string; locale: string; answers: Answers };
export type Submission = { id: string; hash: string; payload: Payload | null; state: string; record_id: string | null; attempts: number; created_at: string };
const requiredEnv = ['DATABASE_URL', 'FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BASE_TOKEN', 'FEISHU_TABLE_ID', 'FEISHU_SUBMISSION_ID_FIELD', 'RECEIPT_SIGNING_SECRET', 'CRON_SECRET'];
export function configured() { return requiredEnv.every((key) => !!process.env[key]) && (process.env.RECEIPT_SIGNING_SECRET?.length ?? 0) >= 32; }
export function isOpen(now = Date.now()) {
  const deadline = process.env.APPLICATION_DEADLINE;
  return configured() && process.env.APPLICATIONS_OPEN === 'true' && (!deadline || (Number.isFinite(Date.parse(deadline)) && now < Date.parse(deadline)));
}
export function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function receipt(id: string) {
  if (!process.env.RECEIPT_SIGNING_SECRET) throw new Error('configuration');
  return createHmac('sha256', process.env.RECEIPT_SIGNING_SECRET).update(id).digest('hex');
}
export function authentic(id: string, supplied: string) {
  if (!/^[0-9a-f]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(receipt(id)), Buffer.from(supplied));
}
export function payloadHash(payload: Payload) { return createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }

export class Store {
  sql = neon(process.env.DATABASE_URL!);
  async get(id: string): Promise<Submission | undefined> { return (await this.sql`SELECT * FROM nice_applications WHERE id=${id}`)[0] as Submission | undefined; }
  async stage(id: string, payload: Payload): Promise<Submission> {
    await this.sql`INSERT INTO nice_applications (id, hash, payload) VALUES (${id}, ${payloadHash(payload)}, ${JSON.stringify(payload)}::jsonb) ON CONFLICT (id) DO NOTHING`;
    return (await this.get(id))!;
  }
  async claim(id: string) {
    return (await this.sql`UPDATE nice_applications SET state='syncing', lease_until=now()+interval '60 seconds', attempts=attempts+1 WHERE id=${id} AND payload IS NOT NULL AND ((state='pending' AND retry_at<=now()) OR (state='syncing' AND lease_until<now())) RETURNING *`)[0] as Submission | undefined;
  }
  async done(id: string, recordId: string) { await this.sql`UPDATE nice_applications SET state='synced', record_id=${recordId}, synced_at=now(), lease_until=NULL, last_error=NULL WHERE id=${id}`; }
  async fail(id: string, code: string, blocked: boolean, attempts: number) {
    const delay = Math.min(3600, 30 * 2 ** Math.min(attempts, 7)) + Math.floor(Math.random() * 20);
    await this.sql`UPDATE nice_applications SET state=${blocked ? 'blocked' : 'pending'}, lease_until=NULL, last_error=${code}, retry_at=now()+(${delay} * interval '1 second') WHERE id=${id} AND state!='synced'`;
  }
  async due() { return await this.sql`SELECT id FROM nice_applications WHERE (state='pending' AND retry_at<=now()) OR (state='syncing' AND lease_until<now()) ORDER BY created_at LIMIT 5`; }
  async cleanup() {
    await this.sql`UPDATE nice_applications SET payload=NULL WHERE state='synced' AND synced_at<now()-interval '24 hours' AND payload IS NOT NULL`;
    await this.sql`DELETE FROM nice_application_rate WHERE bucket<floor(extract(epoch from now())/600)-2`;
  }
  async allow(ip: string) {
    const key = createHmac('sha256', process.env.RECEIPT_SIGNING_SECRET!).update(ip).digest('hex');
    const bucket = Math.floor(Date.now() / 600000);
    const rows = await this.sql`INSERT INTO nice_application_rate (key,bucket,count) VALUES (${key},${bucket},1) ON CONFLICT (key,bucket) DO UPDATE SET count=nice_application_rate.count+1 RETURNING count`;
    return Number(rows[0]?.count) <= 20;
  }
}

class UpstreamError extends Error {
  constructor(public code: string, public permanent = false) { super(code); }
}
let cachedToken: { value: string; until: number } | undefined;
async function token() {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ app_id: process.env.FEISHU_APP_ID, app_secret: process.env.FEISHU_APP_SECRET }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0 || !data.tenant_access_token) throw new UpstreamError(`auth_${data.code ?? res.status}`, res.status !== 429 && res.status < 500);
  cachedToken = { value: data.tenant_access_token, until: Date.now() + Math.max(0, data.expire - 120) * 1000 };
  return cachedToken.value;
}
async function api(path: string, init: RequestInit = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://open.feishu.cn/open-apis${path}`, { ...init, signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` } });
    const data = await res.json();
    if ([99991663, 99991668].includes(data.code) && attempt === 0) { cachedToken = undefined; continue; }
    if (!res.ok || data.code !== 0) throw new UpstreamError(`feishu_${data.code ?? res.status}`, !(res.status >= 500 || res.status === 429 || [1254290, 1254291, 1255001, 1255002, 1255040].includes(data.code)));
    return data.data;
  }
  throw new UpstreamError('auth_expired');
}
type Field = { field_id: string; field_name: string; type: number; property?: { options?: { name: string }[] } };
export function mapFields(answers: Answers, fields: Field[], id: string) {
  const result: Record<string, unknown> = {};
  for (const q of questions) {
    const value = answers[q.id];
    if (value === undefined) continue;
    const field = fields.find((f) => f.field_id === q.fieldId);
    const expected = q.type === 'radiogroup' ? 3 : q.type === 'checkbox' ? 4 : q.type === 'number' ? 2 : 1;
    if (!field || field.type !== expected) throw new UpstreamError(`schema_${q.id}`, true);
    if (expected === 3 || expected === 4) {
      const options = field.property?.options?.map((o) => o.name) ?? [];
      if ((Array.isArray(value) ? value : [value]).some((v) => !options.includes(String(v)))) throw new UpstreamError(`options_${q.id}`, true);
    }
    result[field.field_name] = q.type === 'ranking' ? (value as string[]).map((v, i) => `${i + 1}. ${v}`).join('\n') : value;
  }
  const identifier = fields.find((f) => f.field_id === process.env.FEISHU_SUBMISSION_ID_FIELD);
  if (!identifier || identifier.type !== 1 || questions.some((q) => q.fieldId === identifier.field_id)) throw new UpstreamError('submission_id_field', true);
  result[identifier.field_name] = id;
  return result;
}
async function sync(row: Submission) {
  if (!row.payload) throw new UpstreamError('missing_payload', true);
  const root = `/bitable/v1/apps/${encodeURIComponent(process.env.FEISHU_BASE_TOKEN!)}/tables/${encodeURIComponent(process.env.FEISHU_TABLE_ID!)}`;
  let page = ''; const fields: Field[] = [];
  do {
    const data = await api(`${root}/fields?page_size=100${page ? `&page_token=${encodeURIComponent(page)}` : ''}`);
    fields.push(...data.items); page = data.has_more ? data.page_token : '';
  } while (page);
  const mapped = mapFields(row.payload.answers, fields, row.id);
  // Reconcile ambiguous writes before retrying, including when a function died after Feishu accepted it.
  if (row.attempts > 1) {
    const identifierName = fields.find((f) => f.field_id === process.env.FEISHU_SUBMISSION_ID_FIELD)!.field_name;
    const found = await api(`${root}/records/search?page_size=2`, { method: 'POST', body: JSON.stringify({ filter: { conjunction: 'and', conditions: [{ field_name: identifierName, operator: 'is', value: [row.id] }] }, field_names: [identifierName] }) });
    if (found.items?.length === 1) return found.items[0].record_id as string;
    if (found.items?.length > 1 || Date.now() - Date.parse(row.created_at) > 86400000) throw new UpstreamError('manual_reconciliation', true);
  }
  const created = await api(`${root}/records?client_token=${encodeURIComponent(row.id)}`, { method: 'POST', body: JSON.stringify({ fields: mapped }) });
  if (!created.record?.record_id) throw new UpstreamError('missing_record_id');
  return created.record.record_id as string;
}
export async function processSubmission(store: Pick<Store, 'claim' | 'done' | 'fail'>, id: string, write = sync) {
  const row = await store.claim(id);
  if (!row) return;
  try { await store.done(id, await write(row)); }
  catch (error) {
    const known = error instanceof UpstreamError;
    const code = known ? error.code : 'upstream_unavailable';
    await store.fail(id, code, (known && error.permanent) || row.attempts >= 12, row.attempts);
    console.error(JSON.stringify({ event: 'application_sync_failed', id, code }));
  }
}

export async function submit(request: Request, store = new Store(), write = sync) {
  if (!configured()) return response({ code: 'closed' }, 503);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return response({ code: 'forbidden' }, 403);
  // Vercel overwrites this header; raw forwarding headers are not trusted.
  if (!(await store.allow(request.headers.get('x-vercel-forwarded-for') ?? 'local'))) return response({ code: 'rate_limited' }, 429);
  const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  if (!reader) return response({ code: 'invalid' }, 400);
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 100000) { await reader.cancel(); return response({ code: 'length' }, 413); } chunks.push(value); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return response({ code: 'invalid' }, 400); }
  if (!body || !uuid.test(body.id) || body.website_confirm || !supportedLocales.includes(body.locale)) return response({ code: 'invalid' }, 400);
  // Return an earlier receipt even after the deadline or a deployment changed the current schema.
  const old = await store.get(body.id);
  if (old) {
    if (old.hash !== payloadHash({ version: body.version, locale: body.locale, answers: body.answers })) return response({ code: 'conflict' }, 409);
    await processSubmission(store, old.id, write);
    const latest = await store.get(old.id);
    return response({ id: old.id, state: latest?.state ?? old.state, receipt: receipt(old.id) }, latest?.state === 'synced' ? 200 : 202);
  }
  if (!isOpen()) return response({ code: 'closed' }, 403);
  if (body.version !== version) return response({ code: 'stale' }, 409);
  const checked = validateAnswers(body.answers);
  if (Object.keys(checked.errors).length) return response({ code: 'invalid', errors: checked.errors }, 422);
  const payload: Payload = { version, locale: body.locale, answers: checked.answers };
  const row = await store.stage(body.id, payload);
  if (row.hash !== payloadHash(payload)) return response({ code: 'conflict' }, 409);
  await processSubmission(store, body.id, write);
  const saved = await store.get(body.id);
  return response({ id: body.id, state: saved?.state ?? 'pending', receipt: receipt(body.id) }, saved?.state === 'synced' ? 200 : 202);
}
