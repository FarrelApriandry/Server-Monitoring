/**
 * Minimal type bridges for Bun-only modules.
 *
 * The project depends on `@types/bun`, which only contains a pointer to the
 * `bun-types` package; that package is not wired into this tsconfig, so these
 * local declarations keep `tsc --noEmit`, `bun test` and the runtime happy.
 * They intentionally cover only what this codebase imports.
 */

declare module 'bun:test' {
  export interface Expectation {
    toBe(expected: unknown): void;
    toBeString(): void;
    toEqual(expected: unknown): void;
    toHaveLength(expected: number): void;
    toContain(expected: unknown): void;
    toBeTrue(): void;
    toBeFalse(): void;
    toBeGreaterThan(expected: number): void;
  }
  export function expect<T = unknown>(value: T): Expectation;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function describe(name: string, fn: () => void): void;
  export function beforeEach(fn: () => void): void;
  export function beforeAll(fn: () => void): void;
}

declare module 'bun:sqlite' {
  export class Database {
    constructor(
      filename: string,
      options?: { create?: boolean; readwrite?: boolean; readOnly?: boolean }
    );
    query<T = unknown>(
      sql: string,
      params?: (string | number | null)[]
    ): {
      all: <R = T>() => R[];
      get: <R = T>() => R | undefined;
    };
    run(sql: string, params?: (string | number | null)[]): void;
    close(): void;
  }
}
