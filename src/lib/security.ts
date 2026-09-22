import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Minimal, dependency-free session & password layer.
 *
 * - Password: `NEXUS_PASSWORD` env var, or an auto-generated one persisted to
 *   `data/password.txt` (gitignored) so a single-user self-host stays simple.
 * - Sessions: random bearer tokens kept in an in-memory map. Restarting the
 *   server logs everyone out (acceptable for a self-hosted LAN dashboard).
 */

export const SESSION_COOKIE = 'nexus_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_PRUNE_INTERVAL_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60_000;

/* ------------------------------ sessions ------------------------- */

const sessions = new Map<string, number>();
let lastPrune = 0;

function base64Url(bytes: Buffer | Uint8Array): string {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pruneSessions(): void {
  const now = Date.now();
  if (now - lastPrune < SESSION_PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [token, exp] of sessions) {
    if (exp < now) sessions.delete(token);
  }
}

export function createSession(): string {
  pruneSessions();
  const token = base64Url(randomBytes(32));
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function verifySession(token: string | null | undefined): boolean {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string | null | undefined): void {
  if (token) sessions.delete(token);
}

export interface SessionCookieOptions {
  path: string;
  httpOnly: boolean;
  sameSite: 'strict';
  maxAge: number;
}

export function sessionCookieOptions(): SessionCookieOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/* ---------------------------- password --------------------------- */

let cachedPassword: string | null = null;
let passwordResolve: Promise<string> | null = null;

export function getAdminPassword(): Promise<string> {
  if (cachedPassword) return Promise.resolve(cachedPassword);
  if (passwordResolve) return passwordResolve;
  passwordResolve = (async () => {
    const env = process.env.NEXUS_PASSWORD;
    if (env && env.length >= 8) {
      cachedPassword = env;
      return env;
    }
    const generated = base64Url(randomBytes(12)); // ~128-bit, URL-safe
    const dir = path.join(process.cwd(), 'data');
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'password.txt'), generated + '\n', 'utf8');
    } catch {
      /* unable to persist; fall back to console only */
    }
    console.log('\n[NEXUS] No NEXUS_PASSWORD env var set. Generated a random admin password:');
    console.log(`[NEXUS]   password: ${generated}`);
    console.log('[NEXUS]   (persisted to data/password.txt - keep it secret, or set NEXUS_PASSWORD).\n');
    cachedPassword = generated;
    return generated;
  })();
  return passwordResolve;
}

/** Constant-time string comparison to avoid timing side-channels. */
export function constantTimeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const n = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < n; i++) {
    const x = aa[i % Math.max(aa.length, 1)];
    const y = bb[i % Math.max(bb.length, 1)];
    diff |= x ^ y;
  }
  return diff === 0;
}

export async function verifyPassword(input: string): Promise<boolean> {
  const expected = await getAdminPassword();
  return constantTimeEqual(input, expected);
}

/* ------------------------- login rate-limit ---------------------- */

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  rec.count += 1;
  if (rec.count > LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((rec.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function clearLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}
