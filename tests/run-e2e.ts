/**
 * NEXUS — End-to-End QA Verification Suite
 *
 * Spawns a fresh production server (with known password + local webhook
 * capture) and verifies every feature added in the hardening/features sweep:
 *
 *   Security   : auth guard, login/logout, rate-limit, security headers
 *   Telemetry  : /api/metrics schema, SSE fan-out (2 clients), broker status
 *   Features   : history bucketing, alerts API, system/hardware identity,
 *                liveness, static assets
 *   Alerting   : webhook delivery + SSE alert event (when thresholds fire)
 *
 * Run:  bun run build && bun run test:e2e
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { rm } from 'node:fs/promises';
import path from 'node:path';

/* ----------------------------- harness ----------------------------- */

const PASSWORD = 'qa-pass-123456';
const PORT = 4587;
const BASE = `http://127.0.0.1:${PORT}`;

let passes = 0;
let failures = 0;
let skips = 0;

const ok = (name: string, detail = '') => {
  passes++;
  console.log(`  \u001b[32m✔\u001b[0m ${name}${detail ? ` — ${detail}` : ''}`);
};
const bad = (name: string, detail = '') => {
  failures++;
  console.log(`  \u001b[31m✘ ${name}${detail ? ` — ${detail}` : ''}\u001b[0m`);
};
const skip = (name: string, detail = '') => {
  skips++;
  console.log(`  \u001b[33m↷ ${name} [SKIPPED]${detail ? ` — ${detail}` : ''}\u001b[0m`);
};

function section(title: string) {
  console.log(`\n\u001b[36m▸ ${title}\u001b[0m`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(pathName: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${pathName}`, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, headers: res.headers, body };
}

function asyncIterable<T>(s: unknown): AsyncIterable<T> {
  return s as AsyncIterable<T>;
}

/* ------------------------- webhook capture ------------------------- */

let webhookPosts: Record<string, unknown>[] = [];

const webhookServer = createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk: Buffer) => {
    raw += chunk.toString('utf8');
    if (raw.length > 1_000_000) req.destroy();
  });
  req.on('end', () => {
    if (req.method === 'POST') {
      try {
        webhookPosts.push(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        /* ignore malformed */
      }
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  req.on('error', () => {
    /* ignore */
  });
});

await new Promise<void>((r) => webhookServer.listen(0, '127.0.0.1', () => r()));
const webhookPort = (webhookServer.address() as AddressInfo).port;
const webhookUrl = `http://127.0.0.1:${webhookPort}/hook`;

/* ---------------------------- server ------------------------------- */

const server = spawn('bun', ['dist/server/entry.mjs'], {
  cwd: process.cwd(),
  env: {
    ...(process.env as Record<string, string>),
    HOST: '127.0.0.1',
    PORT: String(PORT),
    NEXUS_PASSWORD: PASSWORD,
    NEXUS_WEBHOOK_URL: webhookUrl,
    NEXUS_REFRESH_MS: '1000',
  },
  stdio: ['null', 'pipe', 'pipe'] as const,
});

async function readServerLogs(): Promise<string> {
  const out: string[] = [];
  if (server.stdout) {
    for await (const chunk of asyncIterable<Uint8Array>(server.stdout)) {
      out.push(chunk.toString());
    }
  }
  if (server.stderr) {
    for await (const chunk of asyncIterable<Uint8Array>(server.stderr)) {
      out.push(chunk.toString());
    }
  }
  return out.join('\n');
}

try {
  /* ----------------------------- boot ------------------------------ */

  console.log('\n\u001b[1m============================================================\u001b[0m');
  console.log('  NEXUS QA — End-to-End Verification Suite');
  console.log('\u001b[1m============================================================\u001b[0m');

  section('1. Server boot & liveness');
  type HealthBody = { status?: string; telemetry?: { lastSampleAt?: number | null } };
  let health: HealthBody | null = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) {
        health = (await res.json()) as HealthBody;
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  if (health?.status === 'ok') ok('GET /api/health → 200 {"status":"ok"}');
  else bad('GET /api/health → 200', JSON.stringify(health));

  section('2. Authentication guard');
  {
    const root = await fetch(`${BASE}/`);
    const redirect = root.headers.get('location') ?? '';
    if (root.status === 302 && redirect.includes('/login')) ok('GET / (unauth) → 302 → /login');
    else bad('GET / (unauth) → 302 → /login', `${root.status} ${redirect}`);

    const m = await request('/api/metrics');
    if (m.status === 401 && (m.body as { error?: string })?.error === 'unauthorized') ok('GET /api/metrics (unauth) → 401');
    else bad('GET /api/metrics (unauth) → 401', `status=${m.status}`);

    const s = await fetch(`${BASE}/api/stream`);
    if (s.status === 401) ok('GET /api/stream (unauth) → 401');
    else bad('GET /api/stream (unauth) → 401', `status=${s.status}`);

    const h = await fetch(`${BASE}/api/health`);
    if (h.status === 200) ok('GET /api/health (public) → 200');
    else bad('GET /api/health (public) → 200', `status=${h.status}`);
  }

  section('3. Security headers');
  {
    const res = await fetch(`${BASE}/login`);
    const h = res.headers;
    const checks: [string, string][] = [
      ['x-frame-options', 'DENY'],
      ['x-content-type-options', 'nosniff'],
      ['referrer-policy', 'no-referrer'],
      ['x-xss-protection', '0'],
    ];
    let allOk = true;
    for (const [k, v] of checks) {
      const got = h.get(k);
      if (!got || got.toLowerCase() !== v.toLowerCase()) allOk = false;
    }
    if (allOk) ok('X-Frame-Options / X-Content-Type-Options / Referrer-Policy / X-XSS-Protection set');
    else bad('Security headers on /login');

    const loginPage = await (await fetch(`${BASE}/login`)).text();
    if (loginPage.includes('Unlock Telemetry') && loginPage.includes('Access Password')) ok('Login page renders form');
    else bad('Login page renders form');
  }

  section('4. Login / session / logout');
  let cookie = '';
  {
    const wrong = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    if (wrong.status === 401 && (await wrong.json() as { error?: string }).error === 'invalid_password') ok('POST /api/login (wrong) → 401');
    else bad('POST /api/login (wrong) → 401', `status=${wrong.status}`);

    const good = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const setCookie = good.headers.get('set-cookie') ?? '';
    cookie = setCookie.split(';')[0];
    const isHttpOnly = /httponly/i.test(setCookie);
    const isSameSiteStrict = /samesite=strict/i.test(setCookie);
    if (good.status === 200 && cookie.startsWith('nexus_session=')) ok('POST /api/login (correct) → 200, session cookie set');
    else bad('POST /api/login (correct) → 200 + Set-Cookie', `status=${good.status}`);
    if (isHttpOnly && isSameSiteStrict) ok('Cookie flags HttpOnly + SameSite=strict');
    else bad('Cookie flags HttpOnly + SameSite=strict', setCookie.slice(0, 120));

    const status = await request('/api/login');
    if ((status.body as { authenticated?: boolean })?.authenticated === false) ok('GET /api/login (no cookie) → authenticated:false');
    else bad('GET /api/login (no cookie) → authenticated:false');

    const auth = await request('/api/login', { headers: { cookie } });
    if ((auth.body as { authenticated?: boolean })?.authenticated === true) ok('GET /api/login (with cookie) → authenticated:true');
    else bad('GET /api/login (with cookie) → authenticated:true');

    const page = await fetch(`${BASE}/`, { headers: { cookie } });
    const html = await page.text();
    if (page.status === 200 && html.includes('NEXUS — System Monitor & Telemetry') && html.includes('Dashboard')) ok('GET / (authed) → 200, dashboard HTML');
    else bad('GET / (authed) → 200, dashboard HTML', `status=${page.status}`);
  }

  section('5. Login rate limiting');
  {
    let blockedStatus = 0;
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${BASE}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'bad-password' }),
      });
      if (i === 5) blockedStatus = r.status;
    }
    if (blockedStatus === 429) ok('6th failed attempt → 429');
    else bad('6th failed attempt → 429', `status=${blockedStatus}`);
  }

  section('6. Telemetry /api/metrics schema');
  let metrics: Record<string, unknown> = {};
  {
    const m = await request('/api/metrics', { headers: { cookie } });
    if (m.status !== 200) {
      bad('GET /api/metrics (authed) → 200', `status=${m.status}`);
    } else {
      ok('GET /api/metrics (authed) → 200');
      metrics = (m.body as Record<string, unknown>);

      const os = (metrics.os ?? {}) as Record<string, unknown>;
      const cpu = (metrics.cpu ?? {}) as Record<string, unknown>;
      const mem = (metrics.memory ?? {}) as Record<string, unknown>;
      const disks = (metrics.disks ?? []) as Array<Record<string, unknown>>;
      const diskIO = (metrics.diskIO ?? {}) as Record<string, unknown>;
      const network = (metrics.network ?? []) as Array<Record<string, unknown>>;
      const battery = (metrics.battery ?? {}) as Record<string, unknown>;
      const gpu = (metrics.gpu ?? []) as Array<Record<string, unknown>>;
      const procs = (metrics.processes ?? {}) as Record<string, unknown>;
      const procsList = (procs.list ?? []) as Array<Record<string, unknown>>;

      const checks: [string, boolean][] = [
        ['os.hostname', typeof os.hostname === 'string' && os.hostname.length > 0],
        ['os.kernel + os.arch', typeof os.kernel === 'string' && typeof os.arch === 'string'],
        ['os.uptime', typeof os.uptime === 'number'],
        ['cpu.usagePercent', typeof cpu.usagePercent === 'number'],
        ['cpu.perCoreLoad array', Array.isArray(cpu.perCoreLoad) && (cpu.perCoreLoad as number[]).length > 0],
        ['cpu.loadAverage length 3', Array.isArray(cpu.loadAverage) && (cpu.loadAverage as number[]).length === 3],
        ['cpu.temperatures {main,cores,max}', typeof (cpu.temperatures as Record<string, unknown>)?.main !== 'undefined'],
        ['memory usage + swap', typeof mem.usagePercent === 'number' && typeof mem.swapPercent === 'number'],
        ['disks array (mount/usePercent)', Array.isArray(disks) && disks.every((d) => typeof d.mount === 'string')],
        ['diskIO.readSec/writeSec', typeof diskIO.readSec === 'number' && typeof diskIO.writeSec === 'number'],
        ['network array', Array.isArray(network) && network.every((n) => typeof n.iface === 'string')],
        ['battery object', typeof battery.hasBattery === 'boolean'],
        ['gpu array', Array.isArray(gpu)],
        ['processes list (pid/name/cpu/mem/user/command)',
          procsList.every((p) => typeof p.pid === 'number' && typeof p.name === 'string' && typeof p.command === 'string')],
      ];
      for (const [name, pass] of checks) {
        if (pass) ok(`schema: ${name}`);
        else bad(`schema: ${name}`);
      }
    }
  }

  section('7. SSE stream (broker fan-out, 2 clients)');
  let alertSseFrame = 0;
  {
    async function readSse(seconds: number, minFrames = 2): Promise<{ frames: number; first: Record<string, unknown> | null; alertFrames: number }> {
      const res = await fetch(`${BASE}/api/stream`, { headers: { cookie } });
      let buf = '';
      let frames = 0;
      let alertFrames = 0;
      let first: Record<string, unknown> | null = null;
      const deadline = Date.now() + seconds * 1000;
      try {
        for await (const chunk of asyncIterable<Uint8Array>(res.body)) {
          buf += chunk.toString();
          const dataLines = buf.match(/^data: (\{.*\})$/gm) ?? [];
          frames = dataLines.length;
          if (frames > 0 && first === null) {
            first = JSON.parse(dataLines[0].slice(5)) as Record<string, unknown>;
          }
          alertFrames = (buf.match(/^event: alert$/gm) ?? []).length;
          if (frames >= minFrames || Date.now() > deadline) break;
        }
      } catch {
        /* stream closed */
      }
      return { frames, first, alertFrames };
    }

    const [a, b] = await Promise.all([readSse(6), readSse(6)]);
    if (a.frames >= 2 && b.frames >= 2) ok('2 concurrent SSE clients each receive live data frames');
    else bad('2 concurrent SSE clients each receive live data frames', `frames=${a.frames}/${b.frames}`);
    if (a.first && typeof (a.first as Record<string, unknown>).timestamp === 'number') ok('SSE frame carries SystemMetrics JSON');
    else bad('SSE frame carries SystemMetrics JSON');
    alertSseFrame = Math.max(a.alertFrames, b.alertFrames);
    if (alertSseFrame > 0) ok(`SSE emitted ${alertSseFrame} event:alert frame(s)`);
    else skip('SSE event:alert (no threshold crossed during window)');

    const m = await request('/api/metrics', { headers: { cookie } });
    const ts1 = (m.body as { timestamp?: number })?.timestamp ?? 0;
    await sleep(1500);
    const h1 = await fetch(`${BASE}/api/health`);
    const status2 = (await h1.json()) as { telemetry?: { lastSampleAt?: number | null } };
    if (h1.status === 200 && typeof status2.telemetry?.lastSampleAt === 'number') ok('Broker status exposes lastSampleAt');
    else bad('Broker status exposes lastSampleAt', `lastSampleAt=${status2.telemetry?.lastSampleAt}`);
    void ts1;
  }

  section('8. History & trends');
  {
    for (const range of ['5m', '1h', '24h']) {
      const r = await request(`/api/history?range=${range}`, { headers: { cookie } });
      const data = (r.body as { data?: Array<Record<string, unknown>> })?.data;
      const shapeOk =
        data === undefined ||
        data.length === 0 ||
        data[0] === undefined ||
        ['ts', 'cpu', 'mem', 'swap', 'temp', 'rx', 'tx'].every((k) => data[0][k] !== undefined);
      if (r.status === 200 && (r.body as { range?: string })?.range === range && shapeOk) {
        ok(`GET /api/history?range=${range} → ${r.status}, buckets=${data?.length ?? 0}`);
      } else {
        bad(`GET /api/history?range=${range}`, `status=${r.status}`);
      }
    }
  }

  section('9. Alerts API');
  {
    const r = await request('/api/alerts', { headers: { cookie } });
    const alerts = (r.body as { alerts?: Array<Record<string, unknown>> })?.alerts;
    if (r.status === 200 && Array.isArray(alerts)) {
      ok(`GET /api/alerts → 200 (${alerts.length} recorded)`);
      if (alerts.length > 0) {
        const a = alerts[0];
        const shapeOk = ['id', 'timestamp', 'level', 'key', 'source', 'message'].every((k) => a[k] !== undefined);
        if (shapeOk) ok('alert record shape {id,timestamp,level,key,source,message}');
        else bad('alert record shape', JSON.stringify(a).slice(0, 200));
      } else {
        skip('alert record shape (no alerts recorded on idle host)');
      }
    } else {
      bad('GET /api/alerts → 200', `status=${r.status}`);
    }
  }

  section('10. Hardware identity (/api/system)');
  {
    const r = await request('/api/system', { headers: { cookie } });
    const body = (r.body ?? {}) as Record<string, unknown>;
    const has = (k: string) => body[k] !== undefined;
    if (r.status === 200 && has('os') && has('system') && has('bios') && has('baseboard') && has('cpu')) {
      ok('GET /api/system → 200 with os/system/bios/baseboard/cpu');
      const sys = (body.system ?? {}) as Record<string, unknown>;
      if (typeof sys.manufacturer === 'string') ok('system.manufacturer present');
      else bad('system.manufacturer present');
    } else {
      bad('GET /api/system → 200 with sections', `status=${r.status}`);
    }
  }

  section('11. Alert → webhook pipeline');
  {
    const deadline = Date.now() + 20_000;
    while (webhookPosts.length === 0 && Date.now() < deadline) await sleep(500);
    if (webhookPosts.length > 0) {
      const p = webhookPosts[0];
      const shapeOk = ['type', 'key', 'level', 'message', 'hostname', 'timestamp'].every((k) => p[k] !== undefined);
      if (shapeOk) {
        ok(`Webhook received alert POST: [${p.level}] ${p.key}`);
        ok('webhook payload shape {type,key,level,message,hostname,timestamp}');
      } else {
        bad('webhook payload shape', JSON.stringify(p).slice(0, 200));
      }
    } else {
      skip('Webhook POST (no threshold crossed on this host during run)');
    }
  }

  section('12. Logout & asset checks');
  {
    const lg = await fetch(`${BASE}/api/logout`, { method: 'POST', headers: { cookie } });
    if (lg.status === 200) ok('POST /api/logout → 200');
    else bad('POST /api/logout → 200', `status=${lg.status}`);

    const after = await request('/api/metrics', { headers: { cookie } });
    if (after.status === 401) ok('metrics with destroyed session cookie → 401');
    else bad('metrics with destroyed session cookie → 401', `status=${after.status}`);

    const ico = await fetch(`${BASE}/Nexus_Icon.png`);
    if (ico.status === 200 && (ico.headers.get('content-type') ?? '').includes('image')) ok('GET /Nexus_Icon.png → 200 image');
    else bad('GET /Nexus_Icon.png → 200 image', `status=${ico.status}`);
  }

  /* ---------------------------- report ------------------------------ */

  console.log(`\n\u001b[1m============================================================\u001b[0m`);
  console.log(`  RESULT: ${passes} passed · ${failures} failed · ${skips} skipped`);
  console.log(`\u001b[1m============================================================\u001b[0m\n`);
  process.exitCode = failures > 0 ? 1 : 0;
} finally {
  server.kill('SIGKILL');
  webhookServer.close();
  try {
    await rm(path.join(process.cwd(), 'data'), { recursive: true });
  } catch {
    /* already gone */
  }
  if (failures > 0) {
    console.log('\n[server logs tail]');
    try {
      console.log((await readServerLogs()).slice(-2000));
    } catch {
      /* ignore */
    }
  }
}
