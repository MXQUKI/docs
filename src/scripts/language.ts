import {
  browserLocale, isLocale, localizedPath, preferenceKey, preferenceLifetime,
  readPreference, sessionKey, translatedHash, type Locale,
} from '../i18n/locales';

let interacted = false;
for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
  window.addEventListener(event, () => { interacted = true; }, { once: true, passive: true });
}

const selector = document.querySelector<HTMLSelectElement>('[data-language-select]');
selector?.addEventListener('change', () => {
  const locale = selector.value;
  if (!isLocale(locale)) return;
  interacted = true;
  try {
    localStorage.setItem(preferenceKey, JSON.stringify({ locale, expiresAt: Date.now() + preferenceLifetime }));
    sessionStorage.setItem(sessionKey, '1');
  } catch { /* Navigation also works when browser storage is unavailable. */ }
  const current = selector.dataset.locale as Locale;
  const anchors = JSON.parse(selector.dataset.anchors ?? '{}') as Partial<Record<Locale, string[]>>;
  const url = new URL(location.href);
  url.pathname = localizedPath(url.pathname, locale);
  url.hash = translatedHash(url.hash, anchors[current] ?? [], anchors[locale] ?? []);
  location.assign(url.href);
});

window.addEventListener('pageshow', () => {
  if (selector) selector.value = selector.dataset.locale ?? 'zh-CN';
});

async function chooseHomeLanguage() {
  if (location.pathname !== '/' || document.documentElement.dataset.niceLanguageInteracted) return;
  // A same-site navigation is an intentional visit within the current language.
  if (document.referrer && new URL(document.referrer).origin === location.origin) return;
  let saved: Locale | null = null;
  try {
    saved = readPreference(localStorage.getItem(preferenceKey));
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
  } catch { /* The root-only redirect cannot form a loop without storage. */ }
  let locale = saved ?? browserLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
  if (!locale) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch('/api/locale', { signal: controller.signal, cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (!controller.signal.aborted && isLocale(data.locale)) locale = data.locale;
      }
    } catch { /* Leave the readable Simplified Chinese page in place. */ }
    finally { clearTimeout(timeout); }
  }
  if (interacted || document.documentElement.dataset.niceLanguageInteracted || !locale || locale === 'zh-CN') return;
  const url = new URL(location.href);
  url.pathname = localizedPath('/', locale);
  const anchors = JSON.parse(selector?.dataset.anchors ?? '{}') as Partial<Record<Locale, string[]>>;
  url.hash = translatedHash(url.hash, anchors['zh-CN'] ?? [], anchors[locale] ?? []);
  location.replace(url.href);
}

void chooseHomeLanguage();
