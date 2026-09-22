export interface SystemMetrics {
  timestamp: number;
  os: {
    platform: string;
    distro: string;
    release: string;
    hostname: string;
    kernel: string;
    arch: string;
    uptime: number;
  };
  cpu: {
    manufacturer: string;
    brand: string;
    speed: number;
    cores: number;
    physicalCores: number;
    usagePercent: number;
    perCoreLoad: number[];
    temperatures: {
      main: number | null;
      cores: Array<number | null>;
      max: number | null;
    };
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    active: number;
    available: number;
    usagePercent: number;
    swapTotal: number;
    swapUsed: number;
    swapPercent: number;
  };
  disks: Array<{
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    usePercent: number;
    mount: string;
  }>;
  diskIO: {
    readSec: number;
    writeSec: number;
    totalRead: number;
    totalWrite: number;
  };
  network: Array<{
    iface: string;
    ip4: string;
    rxBytes: number;
    txBytes: number;
    rxSec: number;
    txSec: number;
    operstate: string;
  }>;
  battery: {
    hasBattery: boolean;
    isCharging: boolean;
    percent: number;
    timeRemaining: number;
  };
  gpu: Array<{
    name: string;
    vendor: string;
    vram: number;
    driver: string;
    load: number | null;
    memUsed: number | null;
    memTotal: number | null;
    temp: number | null;
  }>;
  processes: {
    all: number;
    running: number;
    blocked: number;
    sleeping: number;
    list: Array<{
      pid: number;
      name: string;
      cpu: number;
      mem: number;
      user: string;
      command: string;
    }>;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  source: string;
  message: string;
}

export interface ServerAlert {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  key: string;
  source: string;
  message: string;
  value: number;
  threshold: number;
}

export interface SystemInfoSnapshot {
  timestamp: number;
  os: {
    platform: string;
    distro: string;
    release: string;
    hostname: string;
    kernel: string;
    arch: string;
  };
  system: {
    manufacturer: string;
    model: string;
    version: string;
    serial: string;
    uuid: string;
  };
  bios: {
    vendor: string;
    version: string;
    releaseDate: string;
    revision: string;
  };
  baseboard: {
    manufacturer: string;
    model: string;
    version: string;
    serial: string;
  };
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
  };
}

/** Snapshot row persisted by the history store. */
export interface SampleRow {
  ts: number;
  cpu: number;
  mem: number;
  swap: number;
  temp: number | null;
  rx: number;
  tx: number;
}
