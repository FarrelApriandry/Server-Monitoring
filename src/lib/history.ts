import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { SampleRow, ServerAlert } from '../types/metrics';

/**
 * Time-series persistence. Uses Bun's built-in `bun:sqlite` when running under
 * Bun (the supported runtime) and transparently falls back to a cap-sized
 * in-memory ring otherwise, so the dashboard keeps working under plain Node.
 *
 * Data directory: ./data/telemetry.db  (gitignored)
 */

const RETENTION_MS = (parseFloat(process.env.NEXUS_HISTORY_DAYS || '7') || 7) * 86_400_000;
const MAX_MEMORY_SAMPLES = 2000;
const MAX_MEMORY_ALERTS = 250;
const ALERT_QUERY_WINDOW_MS = 60 * 60 * 1000; // /api/alerts defaults to last hour

interface DbRow {
  ts: number;
  level: string;
  key: string;
  source: string;
  message: string;
}

type Db = {
  run: (sql: string, params?: (string | number | null)[]) => void;
  query: (sql: string, params?: (string | number | null)[]) => { all: <T>() => T[] };
  close: () => void;
};

let db: Db | null = null;
let dbInit: Promise<boolean> | null = null;
let memorySamples: SampleRow[] = [];
let memoryAlerts: ServerAlert[] = [];
let insertsSincePrune = 0;

function ensureDb(): Promise<Db | null> {
  if (db) return Promise.resolve(db);
  if (!dbInit) {
    dbInit = (async () => {
      try {
        const mod = await import('bun:sqlite');
        const Database = mod.Database;
        const dir = path.join(process.cwd(), 'data');
        await mkdir(dir, { recursive: true });
        const d = new Database(path.join(dir, 'telemetry.db'), { create: true, readwrite: true });
        d.run('PRAGMA journal_mode = WAL');
        d.run('PRAGMA synchronous = NORMAL');
        d.run('CREATE TABLE IF NOT EXISTS samples (ts INTEGER PRIMARY KEY, cpu REAL, mem REAL, swap REAL, temp REAL, rx REAL, tx REAL)');
        d.run('CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, level TEXT, key TEXT, source TEXT, message TEXT)');
        d.run('CREATE INDEX IF NOT EXISTS idx_samples_ts ON samples(ts)');
        d.run('CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts)');
        db = d as unknown as Db;
      } catch {
        db = null;
      }
      return db !== null;
    })();
  }
  return dbInit.then(() => db);
}

function prune(d: Db): void {
  const cutoff = Date.now() - RETENTION_MS;
  try {
    d.run('DELETE FROM samples WHERE ts < ?', [cutoff]);
    d.run('DELETE FROM alerts WHERE ts < ?', [cutoff]);
  } catch {
    /* keep going */
  }
}

export async function recordSample(sample: SampleRow): Promise<void> {
  memorySamples.push(sample);
  if (memorySamples.length > MAX_MEMORY_SAMPLES) {
    memorySamples = memorySamples.slice(-Math.floor(MAX_MEMORY_SAMPLES / 2));
  }
  const d = await ensureDb();
  if (!d) return;
  try {
    d.run('INSERT OR REPLACE INTO samples (ts, cpu, mem, swap, temp, rx, tx) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      sample.ts,
      sample.cpu,
      sample.mem,
      sample.swap,
      sample.temp,
      sample.rx,
      sample.tx,
    ]);
    insertsSincePrune += 1;
    if (insertsSincePrune >= 500) {
      insertsSincePrune = 0;
      prune(d);
    }
  } catch {
    /* DB hiccup; in-memory ring keeps us alive */
  }
}

export async function recordAlert(alert: ServerAlert): Promise<void> {
  memoryAlerts.push(alert);
  if (memoryAlerts.length > MAX_MEMORY_ALERTS) memoryAlerts = memoryAlerts.slice(-100);
  const d = await ensureDb();
  if (!d) return;
  try {
    d.run('INSERT INTO alerts (ts, level, key, source, message) VALUES (?, ?, ?, ?, ?)', [
      alert.timestamp,
      alert.level,
      alert.key,
      alert.source,
      alert.message,
    ]);
  } catch {
    /* ignore */
  }
}

export async function queryHistory(rangeMs: number): Promise<SampleRow[]> {
  const since = Date.now() - rangeMs;
  const d = await ensureDb();
  if (d) {
    try {
      const rows = d
        .query('SELECT ts, cpu, mem, swap, temp, rx, tx FROM samples WHERE ts >= ? ORDER BY ts ASC', [since])
        .all<SampleRow>();
      return rows.length > 0 ? rows : memorySamples.filter((s) => s.ts >= since);
    } catch {
      /* fall through to memory */
    }
  }
  return memorySamples.filter((s) => s.ts >= since);
}

export async function listAlerts(sinceMs = Date.now() - ALERT_QUERY_WINDOW_MS): Promise<ServerAlert[]> {
  const d = await ensureDb();
  if (d) {
    try {
      const rows = d
        .query('SELECT ts, level, key, source, message FROM alerts WHERE ts >= ? ORDER BY ts DESC LIMIT 200', [sinceMs])
        .all<DbRow>();
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: `${r.key}:${r.ts}`,
          timestamp: r.ts,
          level: r.level as ServerAlert['level'],
          key: r.key,
          source: r.source,
          message: r.message,
          value: 0,
          threshold: 0,
        }));
      }
    } catch {
      /* fall through to memory */
    }
  }
  return memoryAlerts.filter((a) => a.timestamp >= sinceMs).reverse();
}

/** Downsample raw rows into evenly spaced buckets (avg + max per bucket). */
export function bucketize(rows: SampleRow[], bucketMs: number): Array<SampleRow & { cpuMax: number; memMax: number }> {
  const map = new Map<number, {
    ts: number; sum: number[]; count: number;
    cpuMax: number; memMax: number;
  }>();
  for (const r of rows) {
    const b = Math.floor(r.ts / bucketMs) * bucketMs;
    let e = map.get(b);
    if (!e) {
      e = { ts: b, sum: [0, 0, 0, 0, 0, 0], count: 0, cpuMax: r.cpu, memMax: r.mem };
      map.set(b, e);
    }
    e.sum[0] += r.cpu;
    e.sum[1] += r.mem;
    e.sum[2] += r.swap;
    e.sum[3] += r.temp ?? 0;
    e.sum[4] += r.rx;
    e.sum[5] += r.tx;
    e.count += 1;
    e.cpuMax = Math.max(e.cpuMax, r.cpu);
    e.memMax = Math.max(e.memMax, r.mem);
  }
  const out = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => ({
    ts: e.ts,
    cpu: Number((e.sum[0] / e.count).toFixed(1)),
    mem: Number((e.sum[1] / e.count).toFixed(1)),
    swap: Number((e.sum[2] / e.count).toFixed(1)),
    temp: e.sum[3] > 0 ? Number((e.sum[3] / e.count).toFixed(1)) : null,
    rx: Number((e.sum[4] / e.count).toFixed(2)),
    tx: Number((e.sum[5] / e.count).toFixed(2)),
    cpuMax: e.cpuMax,
    memMax: e.memMax,
  }));
  return out;
}
