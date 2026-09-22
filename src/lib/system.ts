import si from 'systeminformation';
import { readFile } from 'node:fs/promises';
import type { SystemMetrics, SystemInfoSnapshot } from '../types/metrics';

/* ---------------------------- helpers ---------------------------- */

/**
 * Time-box a probe. Resolves `null` on timeout. The underlying promise is
 * caught silently so a late rejection can never crash the process.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const fallback = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  promise.catch(() => {});
  return Promise.race([promise, fallback]);
}

async function probe<T>(fn: () => Promise<T> | T, ms = 4000): Promise<T | null> {
  const value = fn();
  const promise = value instanceof Promise ? value : Promise.resolve(value);
  return withTimeout(promise, ms);
}

const round1 = (n: number | null | undefined): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(1)) : null;

const str = (v: unknown): string => (typeof v === 'string' ? v : '').trim();
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function safeArr<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

/* ------------------------- load average --------------------------- */

async function readLoadAverage(): Promise<number[]> {
  try {
    const raw = await withTimeout(readFile('/proc/loadavg', 'utf8'), 500);
    if (raw) {
      const parts = raw.trim().split(/\s+/).slice(0, 3).map(Number);
      if (parts.length === 3 && parts.every((p) => Number.isFinite(p))) return parts;
    }
  } catch {
    /* non-linux fallback below */
  }
  return [];
}

/* ----------------------------- GPU -------------------------------- */

interface GpuCacheEntry {
  name: string;
  vendor: string;
  vram: number;
  driver: string;
  load: number | null;
  memUsed: number | null;
  memTotal: number | null;
  temp: number | null;
}

let gpuCache: GpuCacheEntry[] = [];
let lastGpuProbe = 0;

async function getGpuData(): Promise<GpuCacheEntry[]> {
  const now = Date.now();
  if (now - lastGpuProbe < 15_000) return gpuCache; // refresh at most every 15s
  lastGpuProbe = now;
  const g = await probe(() => si.graphics(), 5000);
  if (!g || !Array.isArray(g.controllers)) return gpuCache;
  gpuCache = g.controllers
    .filter((c) => c && (c.name || c.model))
    .map((c) => ({
      name: str(c.name || c.model),
      vendor: str(c.vendor),
      vram: num(c.vram),
      driver: str(c.driverVersion),
      load: round1(c.utilizationGpu),
      memUsed: num(c.memoryUsed),
      memTotal: num(c.memoryTotal),
      temp: round1(c.temperatureGpu),
    }));
  return gpuCache;
}

/* ---------------------------- static ------------------------------ */

let staticCache: SystemInfoSnapshot | null = null;
let staticCacheAt = 0;

/** Slow-changing hardware/BIOS identity, cached 5 minutes. */
export async function getStaticSystemInfo(): Promise<SystemInfoSnapshot | null> {
  const now = Date.now();
  if (staticCache && now - staticCacheAt < 300_000) return staticCache;

  const osInfo = await probe(() => si.osInfo(), 5000);
  const sysInfo = await probe(() => si.system(), 5000);
  const biosInfo = await probe(() => si.bios(), 5000);
  const boardInfo = await probe(() => si.baseboard(), 5000);
  const cpuInfo = await probe(() => si.cpu(), 5000);
  const timeInfo = await probe(() => si.time(), 5000);

  staticCache = {
    timestamp: Date.now(),
    os: {
      platform: str(osInfo?.platform),
      distro: str(osInfo?.distro),
      release: str(osInfo?.release),
      hostname: str(osInfo?.hostname),
      kernel: str(osInfo?.kernel),
      arch: str(osInfo?.arch),
    },
    system: {
      manufacturer: str(sysInfo?.manufacturer),
      model: str(sysInfo?.model),
      version: str(sysInfo?.version),
      serial: str(sysInfo?.serial),
      uuid: str(sysInfo?.uuid),
    },
    bios: {
      vendor: str(biosInfo?.vendor),
      version: str(biosInfo?.version),
      releaseDate: str(biosInfo?.releaseDate),
      revision: str(biosInfo?.revision),
    },
    baseboard: {
      manufacturer: str(boardInfo?.manufacturer),
      model: str(boardInfo?.model),
      version: str(boardInfo?.version),
      serial: str(boardInfo?.serial),
    },
    cpu: {
      manufacturer: str(cpuInfo?.manufacturer),
      brand: str(cpuInfo?.brand),
      cores: num(cpuInfo?.cores),
      physicalCores: num(cpuInfo?.physicalCores),
    },
  };
  staticCacheAt = Date.now();
  void timeInfo; // uptime not needed for the static snapshot
  return staticCache;
}

/* -------------------------- live metrics -------------------------- */

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const [osInfo, timeInfo, cpuInfo, currentLoad, cpuTemp, memInfo, fsSize, fsStats, netInterfaces, netStats, batteryInfo, processesInfo] =
    await Promise.all([
      probe(() => si.osInfo(), 3000),
      probe(() => si.time(), 3000),
      probe(() => si.cpu(), 3000),
      probe(() => si.currentLoad(), 3000),
      probe(() => si.cpuTemperature(), 3000),
      probe(() => si.mem(), 3000),
      probe(() => si.fsSize(), 5000),
      probe(() => si.fsStats(), 4000),
      probe(() => si.networkInterfaces(), 4000),
      probe(() => si.networkStats(), 4000),
      probe(() => si.battery(), 3000),
      probe(() => si.processes(), 5000),
    ]);

  const gpu = await getGpuData();
  const loadAvg = await readLoadAverage();

  const ifaceMap = new Map<string, string>();
  safeArr(netInterfaces).forEach((iface) => {
    if (iface.ip4) ifaceMap.set(iface.iface, iface.ip4);
  });

  const network = safeArr(netStats).map((stat) => ({
    iface: stat.iface,
    ip4: ifaceMap.get(stat.iface) || '-',
    rxBytes: stat.rx_bytes || 0,
    txBytes: stat.tx_bytes || 0,
    rxSec: stat.rx_sec || 0,
    txSec: stat.tx_sec || 0,
    operstate: stat.operstate || 'unknown',
  }));

  const temps = safeArr(cpuTemp?.cores).map((c) =>
    typeof c === 'number' && Number.isFinite(c) ? Number(c.toFixed(1)) : null
  );
  const mainTemp =
    typeof cpuTemp?.main === 'number' && cpuTemp.main > 0 ? Number(cpuTemp.main.toFixed(1)) : null;
  const maxTemp =
    typeof cpuTemp?.max === 'number' && cpuTemp.max > 0 ? Number(cpuTemp.max.toFixed(1)) : null;

  const perCoreLoad = safeArr(currentLoad?.cpus).map((c) =>
    Number(Math.min(Math.max(c.load, 0), 100).toFixed(1))
  );

  const list = safeArr(processesInfo?.list);
  const topProcesses = [...list]
    .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
    .slice(0, 20)
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      cpu: Number((p.cpu || 0).toFixed(1)),
      mem: Number((p.mem || 0).toFixed(1)),
      user: p.user,
      command: String(p.command || '').slice(0, 60),
    }));

  const memTotal = num(memInfo?.total);
  const memUsed = num(memInfo?.used);
  const swapTotal = num(memInfo?.swaptotal);
  const swapUsed = num(memInfo?.swapused);

  return {
    timestamp: Date.now(),
    os: {
      platform: str(osInfo?.platform) || 'unknown',
      distro: str(osInfo?.distro) || 'unknown',
      release: str(osInfo?.release) || 'unknown',
      hostname: str(osInfo?.hostname) || 'host',
      kernel: str(osInfo?.kernel),
      arch: str(osInfo?.arch),
      uptime: num(timeInfo?.uptime) || 0,
    },
    cpu: {
      manufacturer: str(cpuInfo?.manufacturer),
      brand: str(cpuInfo?.brand),
      speed: num(cpuInfo?.speed),
      cores: num(cpuInfo?.cores),
      physicalCores: num(cpuInfo?.physicalCores),
      usagePercent: round1(currentLoad?.currentLoad) ?? 0,
      perCoreLoad,
      temperatures: { main: mainTemp, cores: temps, max: maxTemp },
      loadAverage: loadAvg.length === 3
        ? loadAvg
        : [num(currentLoad?.avgLoad), num(currentLoad?.avgLoad), num(currentLoad?.avgLoad)],
    },
    memory: {
      total: memTotal,
      used: memUsed,
      free: num(memInfo?.free),
      active: num(memInfo?.active),
      available: num(memInfo?.available),
      usagePercent: memTotal > 0 ? Number(((memUsed / memTotal) * 100).toFixed(1)) : 0,
      swapTotal,
      swapUsed,
      swapPercent: swapTotal > 0 ? Number(((swapUsed / swapTotal) * 100).toFixed(1)) : 0,
    },
    disks: safeArr(fsSize)
      .filter((d) => !['efivarfs', 'fuse-overlayfs', 'squashfs'].includes(d.type) && d.size > 10 * 1024 * 1024)
      .map((d) => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        usePercent: Number(d.use.toFixed(1)),
        mount: d.mount,
      })),
    diskIO: {
      readSec: num(fsStats?.rx_sec) || 0,
      writeSec: num(fsStats?.wx_sec) || 0,
      totalRead: num(fsStats?.rx) || 0,
      totalWrite: num(fsStats?.wx) || 0,
    },
    network,
    battery: {
      hasBattery: Boolean(batteryInfo?.hasBattery),
      isCharging: Boolean(batteryInfo?.isCharging),
      percent: num(batteryInfo?.percent),
      timeRemaining: num(batteryInfo?.timeRemaining),
    },
    gpu,
    processes: {
      all: num(processesInfo?.all),
      running: num(processesInfo?.running),
      blocked: num(processesInfo?.blocked),
      sleeping: num(processesInfo?.sleeping),
      list: topProcesses,
    },
  };
}
