export const locales = ['zh-CN', 'zh-Hant', 'en'] as const;
export type Locale = (typeof locales)[number];
export const labels: Record<Locale, string> = { 'zh-CN': '简体中文', 'zh-Hant': '繁體中文', en: 'English' };
export const prefixes: Record<Locale, string> = { 'zh-CN': '', 'zh-Hant': '/zh-hant', en: '/en' };
export const preferenceKey = 'nice-language';
export const sessionKey = 'nice-language-checked';
export const preferenceLifetime = 365 * 24 * 60 * 60 * 1000;

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

export function splitPath(pathname: string): { locale: Locale; path: string } {
  const match = pathname.match(/^\/(zh-hant|en)(?=\/|$)/);
  return {
    locale: match?.[1] === 'zh-hant' ? 'zh-Hant' : match ? 'en' : 'zh-CN',
    path: (match ? pathname.slice(match[0].length) : pathname) || '/',
  };
}

export function localizedPath(pathname: string, locale: Locale): string {
  return `${prefixes[locale]}${splitPath(pathname).path}`;
}

export function browserLocale(languages: readonly string[]): Locale | null {
  const tags = languages.map((language) => language.toLowerCase().replaceAll('_', '-'));
  // Explicit script wins over region; zh-Hant-CN still means Traditional Chinese.
  if (tags.some((tag) => /^zh-hans(?:-|$)/.test(tag) || /^zh-(cn|sg)(?:-|$)/.test(tag))) return 'zh-CN';
  for (const tag of tags) {
    if (/^zh-(hant|tw|hk|mo)(?:-|$)/.test(tag)) return 'zh-Hant';
    if (tag === 'zh') return 'zh-CN';
    if (/^en(?:-|$)/.test(tag)) return 'en';
  }
  return null;
}

export function readPreference(raw: string | null, now = Date.now()): Locale | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    return isLocale(value?.locale) && Number.isFinite(value?.expiresAt) && value.expiresAt > now
      ? value.locale : null;
  } catch { return null; }
}

export function translatedHash(hash: string, from: readonly string[], to: readonly string[]): string {
  if (!hash || hash === '#_top') return hash;
  try {
    const index = from.indexOf(decodeURIComponent(hash.slice(1)));
    return index >= 0 && to[index] ? `#${encodeURIComponent(to[index])}` : '';
  } catch { return ''; }
}
