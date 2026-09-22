import { describe, expect, test } from 'bun:test';
import {
  constantTimeEqual,
  createSession,
  verifySession,
  destroySession,
  checkLoginRateLimit,
  clearLoginRateLimit,
} from './security';

describe('constantTimeEqual', () => {
  test('matches equal strings', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true);
  });

  test('rejects different strings and lengths', () => {
    expect(constantTimeEqual('abc124', 'abc123')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', 'x')).toBe(false);
  });
});

describe('sessions', () => {
  test('round-trips a session token', () => {
    const token = createSession();
    expect(token).toBeString();
    expect(token.length).toBeGreaterThan(20);
    expect(verifySession(token)).toBe(true);
    destroySession(token);
    expect(verifySession(token)).toBe(false);
  });

  test('rejects unknown/invalid tokens', () => {
    expect(verifySession(null)).toBe(false);
    expect(verifySession('not-a-token')).toBe(false);
    expect(verifySession(undefined)).toBe(false);
  });
});

describe('login rate limit', () => {
  test('blocks after max attempts within the window', () => {
    clearLoginRateLimit('127.0.0.1');
    let blocked = false;
    for (let i = 0; i < 6; i++) {
      const r = checkLoginRateLimit('127.0.0.1');
      if (!r.allowed) blocked = true;
    }
    expect(blocked).toBe(true);
  });

  test('resets after window clears', () => {
    clearLoginRateLimit('10.0.0.1');
    for (let i = 0; i < 5; i++) checkLoginRateLimit('10.0.0.1');
    expect(checkLoginRateLimit('10.0.0.1').allowed).toBe(false); // 6th attempt blocked
    clearLoginRateLimit('10.0.0.1');
    expect(checkLoginRateLimit('10.0.0.1').allowed).toBe(true);
  });
});
