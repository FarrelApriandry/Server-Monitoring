import type { APIRoute } from 'astro';
import { SESSION_COOKIE, destroySession } from '../../lib/security';

export const prerender = false;

export const POST: APIRoute = ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  destroySession(token);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
