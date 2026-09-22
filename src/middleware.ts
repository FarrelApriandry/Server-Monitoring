import type { MiddlewareHandler } from 'astro';
import { SESSION_COOKIE, verifySession } from './lib/security';

/**
 * Global request middleware (Astro server output):
 *  1. Session-gates every page & API route (public paths listed below).
 *  2. Applies hardening headers to every response.
 */

const PUBLIC_PATHS = new Set(['/login', '/api/login', '/api/logout', '/api/health']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_astro/')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/Nexus_')) return true;
  return false;
}

function securityHeaders(production: boolean): Record<string, string> {
  const base: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=()',
    'X-XSS-Protection': '0',
    'X-Accel-Buffering': 'no',
  };
  if (production) {
    base['Content-Security-Policy'] =
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'";
  }
  return base;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request } = context;
  const pathname = new URL(request.url).pathname;
  const production = process.env.NODE_ENV === 'production';
  const headers = securityHeaders(production);

  if (!isPublic(pathname)) {
    const token = context.cookies.get(SESSION_COOKIE)?.value;
    if (!verifySession(token)) {
      if (pathname.startsWith('/api/')) {
        return json({ error: 'unauthorized', message: 'A valid session is required. Visit /login.' }, 401);
      }
      return context.redirect('/login', 302);
    }
  }

  const response = await next();
  const outgoing = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    outgoing.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers: outgoing });
};
