import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserLocale, localizedPath, readPreference, translatedHash } from '../src/i18n/locales.ts';
import { GET } from '../api/locale.ts';

test('explicit Simplified Chinese takes precedence over browser ordering', () => {
  for (const tag of ['zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN', 'zh_Hans']) {
    assert.equal(browserLocale(['en-US', tag]), 'zh-CN');
  }
  assert.equal(browserLocale(['zh-Hant', 'en', 'zh-CN']), 'zh-CN');
});
test('other supported languages follow browser order; generic Chinese defaults to Simplified', () => {
  assert.equal(browserLocale(['en-GB', 'zh-Hant']), 'en');
  for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant-HK', 'zh-Hant-CN']) assert.equal(browserLocale([tag]), 'zh-Hant');
  assert.equal(browserLocale(['fr', 'zh']), 'zh-CN');
  assert.equal(browserLocale(['de', 'ja']), null);
});
test('geolocation is only a coarse fallback', async () => {
  for (const [country, locale] of [['CN', 'zh-CN'], ['TW', 'zh-Hant'], ['HK', 'zh-Hant'], ['MO', 'zh-Hant'], ['MY', 'en'], ['US', 'en'], ['SG', 'en'], ['', null], ['unknown', null], ['XX', null], ['ZZ', null]]) {
    const headers = country ? { 'x-vercel-ip-country': country } : {};
    assert.deepEqual(await GET(new Request('https://example.test/api/locale', { headers })).json(), { locale });
  }
});
test('manual preference requires a supported locale and an unexpired timestamp', () => {
  assert.equal(readPreference(JSON.stringify({ locale: 'en', expiresAt: 101 }), 100), 'en');
  assert.equal(readPreference(JSON.stringify({ locale: 'en', expiresAt: 100 }), 100), null);
  for (const raw of ['{', '{}', 'null', '{"locale":"de","expiresAt":999}']) assert.equal(readPreference(raw, 100), null);
});
test('locale paths round-trip without double prefixes', () => {
  assert.equal(localizedPath('/zh-hant/hardware/shim/', 'en'), '/en/hardware/shim/');
  assert.equal(localizedPath('/en/', 'zh-CN'), '/');
  assert.equal(localizedPath('/en/structure/tube/', 'zh-CN'), '/structure/tube/');
  assert.equal(localizedPath('/enclosure/', 'en'), '/en/enclosure/');
});
test('translated anchors preserve the equivalent section or fall back to page top', () => {
  assert.equal(translatedHash('#%E9%BD%BF%E8%BD%AE', ['齿轮'], ['gears']), '#gears');
  assert.equal(translatedHash('#missing', ['齿轮'], ['gears']), '');
  assert.equal(translatedHash('#%broken', [], []), '');
  assert.equal(translatedHash('#_top', [], []), '#_top');
});
test('geolocation endpoint returns only locale and is never cached', async () => {
  for (const [country, locale] of [['CN', 'zh-CN'], ['TW', 'zh-Hant'], ['US', 'en'], ['MY', 'en'], ['', null]]) {
    const response = GET(new Request('https://example.test/api/locale', { headers: { 'x-vercel-ip-country': country } }));
    assert.deepEqual(await response.json(), { locale });
    for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) assert.match(response.headers.get(name), /no-store/);
  }
});
