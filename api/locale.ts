import { countryLocale } from '../src/i18n/locales.ts';

export function GET(request: Request): Response {
  return Response.json({ locale: countryLocale(request.headers.get('x-vercel-ip-country')) }, {
    headers: {
      'Cache-Control': 'private, no-store',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
