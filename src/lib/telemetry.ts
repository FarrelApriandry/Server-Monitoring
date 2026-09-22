import type { ServerAlert, SystemMetrics, SampleRow } from '../types/metrics';
import { getSystemMetrics, withTimeout } from './system';
import { evaluateAlerts } from './alerts';
import { recordSample, recordAlert } from './history';

/**
 * Metrics broker.
 *
 * Instead of every SSE client probing the OS (N clients x full scan every
 * 1.5s), a single collector runs once per interval and broadcasts the result
 * to every subscriber. The timer only runs while at least one subscriber is
 * connected, and single-shot refreshes back any polling clients.
 */

export type BrokerMessage =
  | { kind: 'metrics'; metrics: SystemMetrics }
  | { kind: 'alert'; alert: ServerAlert }
  | { kind: 'status'; error: string | null };

export type BrokerStatus = {
  collecting: boolean;
  error: string | null;
  lastSampleAt: number | null;
};

const REFRESH_MS = Math.max(500, parseInt(process.env.NEXUS_REFRESH_MS || '1500', 10));
const COLLECT_TIMEOUT_MS = 7000;
const WEBHOOK_COOLDOWN_MS = 5 * 60_000;
const serverStartedAt = Date.now();

export function getServerStartedAt(): number {
  return serverStartedAt;
}

const listeners = new Set<(msg: BrokerMessage) => void>();
const webhookMuted = new Map<string, number>();

let latest: SystemMetrics | null = null;
let lastError: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let collecting = false;

function broadcast(msg: BrokerMessage): void {
  for (const cb of listeners) {
    try {
      cb(msg);
    } catch {
      /* a broken subscriber must not kill the loop */
    }
  }
}

function activeNet(m: SystemMetrics): { rx: number; tx: number } {
  const n = m.network.find((i) => i.operstate === 'up' && i.ip4 !== '-') || m.network[0];
  return { rx: n?.rxSec ?? 0, tx: n?.txSec ?? 0 };
}

function toSampleRow(m: SystemMetrics): SampleRow {
  const net = activeNet(m);
  return {
    ts: m.timestamp,
    cpu: m.cpu.usagePercent,
    mem: m.memory.usagePercent,
    swap: m.memory.swapPercent,
    temp: m.cpu.temperatures.main ?? m.cpu.temperatures.max,
    rx: net.rx,
    tx: net.tx,
  };
}

async function sendWebhook(alert: ServerAlert): Promise<void> {
  const url = process.env.NEXUS_WEBHOOK_URL;
  if (!url) return;
  const last = webhookMuted.get(alert.key) ?? 0;
  if (Date.now() - last < WEBHOOK_COOLDOWN_MS) return;
  webhookMuted.set(alert.key, Date.now());
  const payload = {
    type: 'nexus_alert',
    ...alert,
    hostname: latest?.os.hostname ?? 'unknown',
  };
  try {
    await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      5000
    );
  } catch {
    /* webhook failures are non-fatal */
  }
}

async function collectOnce(): Promise<void> {
  if (collecting) return;
  collecting = true;
  try {
    const metrics = await withTimeout(getSystemMetrics(), COLLECT_TIMEOUT_MS);
    if (metrics) {
      latest = metrics;
      lastError = null;
      try {
        await recordSample(toSampleRow(metrics));
      } catch {
        /* persistence must never break the stream */
      }
      const alerts = evaluateAlerts(metrics);
      for (const alert of alerts) {
        try {
          await recordAlert(alert);
        } catch {
          /* ignore */
        }
        void sendWebhook(alert);
        broadcast({ kind: 'alert', alert });
      }
      broadcast({ kind: 'metrics', metrics });
      return;
    }
    lastError = 'Metrics probe timed out or failed';
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Unknown telemetry error';
  } finally {
    collecting = false;
  }
  broadcast({ kind: 'status', error: lastError });
}

function start(): void {
  void collectOnce();
  timer = setInterval(() => void collectOnce(), REFRESH_MS);
}

function stop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Subscribe to the live broker stream. Returns an unsubscribe function. */
export function subscribe(cb: (msg: BrokerMessage) => void): () => void {
  if (listeners.size === 0) start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stop();
  };
}

export function getLatestMetrics(): SystemMetrics | null {
  return latest;
}

export function getBrokerStatus(): BrokerStatus {
  return { collecting, error: lastError, lastSampleAt: latest?.timestamp ?? null };
}

/** Polling clients: fetch cached or trigger a single-shot refresh. */
export async function getMetricsForPoll(): Promise<SystemMetrics | null> {
  if (listeners.size === 0) {
    await collectOnce();
  }
  return latest;
}

/** Testing hook. */
export function resetBrokerForTests(): void {
  listeners.clear();
  stop();
  latest = null;
  lastError = null;
}
