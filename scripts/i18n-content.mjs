import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseExpressionAt } from 'acorn';
import GithubSlugger from 'github-slugger';

const root = 'src/content/docs';
const statusPath = 'src/i18n/translation-status.json';
const targetLocales = { 'zh-Hant': 'zh-hant', en: 'en' };
const status = JSON.parse(readFileSync(statusPath, 'utf8'));
const recordIds = process.argv.includes('--record') ? process.argv.slice(process.argv.indexOf('--record') + 1) : [];
const recording = (id) => recordIds.includes(id) || recordIds.includes('--all');
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const hash = (text) => createHash('sha256').update(text).digest('hex');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : path.endsWith('.mdx') ? [path] : [];
});

function headings(text) {
  const slugger = new GithubSlugger();
  return [...text.matchAll(/^(#{2,6})\s+(.+)$/gm)].map(([, depth, title]) => ({
    depth: depth.length,
    slug: slugger.slug(title.replace(/\*\*|__/g, '').replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')),
  }));
}

// Only static arrays/objects/literals are accepted: never execute MDX to inspect specifications.
function literal(node) {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map((p) => [p.key.name ?? p.key.value, literal(p.value)]));
  if (node.type === 'UnaryExpression' && node.operator === '-') return -literal(node.argument);
  throw new Error(`Unsupported specification expression: ${node.type}`);
}

function tables(text) {
  return [...text.matchAll(/<ProductTable\b[\s\S]*?\/>/g)].map(([table]) => {
    const rows = /rows=\{/.exec(table);
    if (!rows) throw new Error('ProductTable requires rows');
    return literal(parseExpressionAt(table, rows.index + rows[0].length, { ecmaVersion: 'latest' }));
  });
}

function compareCells(a, b, path) {
  if (Array.isArray(a)) {
    check(Array.isArray(b) && a.length === b.length, `${path}: row/table count differs`);
    a.forEach((value, i) => compareCells(value, b?.[i], `${path}/${i}`));
  } else if (a && typeof a === 'object') {
    check(JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b ?? {})), `${path}: cell keys differ`);
    for (const key of Object.keys(a)) {
      if (key === 'href') check(a[key] === b?.[key], `${path}: resource URL changed`);
      else compareCells(a[key], b?.[key], `${path}/${key}`);
    }
  } else if (typeof a === 'string') {
    const numbers = (s) => String(s).match(/[+-]?\d+(?:\.\d+)?|[½⅓]/g) ?? [];
    check(JSON.stringify(numbers(a)) === JSON.stringify(numbers(b)), `${path}: numeric specification changed (${a} → ${b})`);
    if (!/\p{Script=Han}/u.test(a) && /\d/.test(a)) check(a === b, `${path}: dimension, SKU or formula changed (${a} → ${b})`);
  } else check(a === b, `${path}: value changed`);
}

const sourceFiles = walk(root).filter((file) => !/^(en|zh-hant)\//.test(relative(root, file)));
const ids = sourceFiles.map((file) => relative(root, file).replace(/\.mdx$/, ''));
for (const id of ids) {
  const source = readFileSync(join(root, `${id}.mdx`), 'utf8');
  const sourceHeadings = headings(source);
  const next = { sourceHash: hash(source), translationHashes: {}, anchors: { 'zh-CN': sourceHeadings.map((h) => h.slug) } };
  for (const [locale, directory] of Object.entries(targetLocales)) {
    const file = join(root, directory, `${id}.mdx`);
    if (!existsSync(file)) { check(false, `${file}: missing translation`); continue; }
    const content = readFileSync(file, 'utf8');
    const translated = headings(content);
    next.translationHashes[locale] = hash(content);
    next.anchors[locale] = translated.map((h) => h.slug);
    check(JSON.stringify(sourceHeadings.map((h) => h.depth)) === JSON.stringify(translated.map((h) => h.depth)), `${file}: heading structure differs`);
    check(!/^description:.*\.\.\./m.test(content), `${file}: truncated description`);
    if (locale === 'en') check(!/\p{Script=Han}/u.test(content), `${file}: untranslated Chinese`);
    compareCells(tables(source), tables(content), file);
    const immutableRefs = (text) => [...text.matchAll(/(?:src|image|href)[:=]\s*"([^"]+)"/g)]
      .map((m) => m[1]).filter((url) => /^(https?:|\/assets\/|\/downloads\/)/.test(url));
    check(JSON.stringify(immutableRefs(source)) === JSON.stringify(immutableRefs(content)), `${file}: image, download or external URL differs`);
    for (const marker of ['note', 'tip', 'caution', 'danger']) {
      check((source.match(new RegExp(`^:::${marker}`, 'gm')) ?? []).length === (content.match(new RegExp(`^:::${marker}`, 'gm')) ?? []).length,
        `${file}: ${marker} callout missing`);
    }
  }
  if (recording(id)) status[id] = next;
  else check(JSON.stringify(status[id]) === JSON.stringify(next), `${id}: missing/stale translation review; review both translations, then run npm run i18n:record -- ${id}`);
}
for (const directory of Object.values(targetLocales)) {
  for (const file of walk(join(root, directory))) {
    check(ids.includes(relative(join(root, directory), file).replace(/\.mdx$/, '')), `${file}: orphan translation`);
  }
}
check(Object.keys(status).every((id) => ids.includes(id)), 'Translation status contains removed source pages');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
if (recordIds.length) writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
console.log(`i18n checks passed: ${sourceFiles.length} source pages, ${sourceFiles.length * 2} translations; specs, resources, headings and review hashes match.`);
