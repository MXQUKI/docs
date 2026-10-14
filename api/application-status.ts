import { authentic, configured, response, Store, uuid } from '../server/applications.js';

export async function GET(request: Request) {
  if (!configured()) return response({ code: 'unavailable' }, 503);
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!uuid.test(id) || !authentic(id, request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '')) return response({ code: 'not_found' }, 404);
  try {
    const row = await new Store().get(id);
    return row ? response({ id, state: row.state }) : response({ code: 'not_found' }, 404);
  } catch { return response({ code: 'unavailable' }, 503); }
}
