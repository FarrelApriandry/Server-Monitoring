import type { APIRoute } from 'astro';
import {
  SESSION_COOKIE,
  createSession,
  verifySession,
  checkLoginRateLimit,
  clearLoginRateLimit,
  verifyPassword,
  sessionCookieOptions,
} from '../../lib/security';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

/** GET /api/login -> current auth status (public). */
export const GET: APIRoute = ({ cookies }) => {
  const authenticated = verifySession(cookies.get(SESSION_COOKIE)?.value);
  return json({ authenticated });
};

/** POST /api/login -> password verification, issues session cookie. */
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  let ip: string;
  try {
    ip = clientAddress ?? 'local';
  } catch {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  }

  const limit = checkLoginRateLimit(ip);
  if (!limit.allowed) {
    return json(
      { error: 'rate_limited', message: 'Too many attempts. Try again shortly.', retryAfter: limit.retryAfter },
      429
    );
  }

  let password = '';
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      password = typeof body?.password === 'string' ? body.password : '';
    } else {
      const form = await request.formData();
      const value = form.get('password');
      password = typeof value === 'string' ? value : '';
    }
  } catch {
    password = '';
  }

  if (!password || !(await verifyPassword(password))) {
    return json({ error: 'invalid_password', message: 'Invalid password.' }, 401);
  }

  clearLoginRateLimit(ip);
  const token = createSession();
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return json({ ok: true, redirect: '/' });
};
