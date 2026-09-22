import { describe, expect, test } from 'bun:test';
import { formatBytes, formatUptime } from './format';

describe('formatBytes', () => {
  test('returns 0 B for zero or falsy', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(undefined as unknown as number)).toBe('0 B');
  });

  test('formats base-1024 units', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10 GB');
  });

  test('respects decimals', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1536, 0)).toBe('2 KB');
  });
});

describe('formatUptime', () => {
  test('renders seconds', () => {
    expect(formatUptime(45)).toBe('45s');
  });

  test('renders minutes and hours', () => {
    expect(formatUptime(3661)).toBe('1h 1m 1s');
    expect(formatUptime(86400 + 3600)).toBe('1d 1h 0s');
  });
});
