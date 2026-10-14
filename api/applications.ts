import { configured, isOpen, response, submit } from '../server/applications.js';

export function GET() { return response({ open: isOpen(), preview: process.env.VERCEL_ENV === 'preview' && !isOpen() }); }
export async function POST(request: Request) {
  if (!configured()) return response({ code: 'closed' }, 503);
  try { return await submit(request); }
  catch { console.error('application_request_failed'); return response({ code: 'unavailable' }, 503); }
}
