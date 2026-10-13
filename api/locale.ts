import type { Locale } from '../src/i18n/locales.ts';

// Keep the small region mapping in this entry point: Vercel emits this file as JS.
function countryLocale(country: string | null): Locale | null {
  if (!country || !/^[A-Z]{2}$/.test(country) || ['XX', 'ZZ'].includes(country)) return null;
  if (country === 'CN') return 'zh-CN';
  if (['TW', 'HK', 'MO'].includes(country)) return 'zh-Hant';
  return 'en';
}

export function GET(request: Request): Response {
  return Response.json({ locale: countryLocale(request.headers.get('x-vercel-ip-country')) }, {
    headers: {
      'Cache-Control': 'private, no-store',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
