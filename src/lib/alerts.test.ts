import { describe, expect, test, beforeEach } from 'bun:test';
import { evaluateAlerts, resetAlertState } from './alerts';
import type { SystemMetrics } from '../types/metrics';

function fixture(overrides: Partial<SystemMetrics> = {}): SystemMetrics {
  return {
    timestamp: Date.now(),
    os: { platform: 'linux', distro: 'x', release: '1', hostname: 'h', kernel: 'k', arch: 'a', uptime: 1 },
    cpu: {
      manufacturer: 'm',
      brand: 'b',
      speed: 3.0,
      cores: 4,
      physicalCores: 4,
      usagePercent: 10,
      perCoreLoad: [10, 10, 10, 10],
      temperatures: { main: 40, cores: [40], max: 40 },
      loadAverage: [0.1, 0.1, 0.1],
    },
    memory: { total: 8_000_000_000, used: 1_000_000_000, free: 2_000_000_000, active: 0, available: 7_000_000_000, usagePercent: 20, swapTotal: 2_000_000_000, swapUsed: 0, swapPercent: 0 },
    disks: [{ fs: '/dev/sda1', type: 'ext4', size: 1, used: 0, available: 1, usePercent: 10, mount: '/' }],
    diskIO: { readSec: 0, writeSec: 0, totalRead: 0, totalWrite: 0 },
    network: [{ iface: 'eth0', ip4: '1.2.3.4', rxBytes: 0, txBytes: 0, rxSec: 0, txSec: 0, operstate: 'up' }],
    battery: { hasBattery: false, isCharging: false, percent: 0, timeRemaining: 0 },
    gpu: [],
    processes: { all: 1, running: 1, blocked: 0, sleeping: 0, list: [] },
    ...overrides,
  };
}

describe('evaluateAlerts', () => {
  beforeEach(() => {
    resetAlertState();
  });

  test('emits no alerts below thresholds', () => {
    expect(evaluateAlerts(fixture())).toHaveLength(0);
  });

  test('emits WARNING when CPU crosses the warning threshold', () => {
    const alerts = evaluateAlerts(fixture({ cpu: { ...fixture().cpu, usagePercent: 85 } }));
    expect(alerts.map((a) => a.key)).toContain('cpu.high');
    expect(alerts.find((a) => a.key === 'cpu.high')?.level).toBe('WARNING');
  });

  test('does not re-emit while the condition persists (no log flooding)', () => {
    const hot = fixture({ cpu: { ...fixture().cpu, usagePercent: 85 } });
    expect(evaluateAlerts(hot)).toHaveLength(1);
    expect(evaluateAlerts(hot)).toHaveLength(0);
    expect(evaluateAlerts(hot)).toHaveLength(0);
  });

  test('escalates WARNING -> CRITICAL on a worse sample', () => {
    const hot = fixture({ cpu: { ...fixture().cpu, usagePercent: 85 } });
    evaluateAlerts(hot);
    const critical = fixture({ cpu: { ...fixture().cpu, usagePercent: 97 } });
    const alerts = evaluateAlerts(critical);
    expect(alerts.find((a) => a.key === 'cpu.high')?.level).toBe('CRITICAL');
  });

  test('re-arms once the resource returns to normal', () => {
    evaluateAlerts(fixture({ cpu: { ...fixture().cpu, usagePercent: 85 } }));
    evaluateAlerts(fixture());
    const again = evaluateAlerts(fixture({ cpu: { ...fixture().cpu, usagePercent: 88 } }));
    expect(again.find((a) => a.key === 'cpu.high')?.level).toBe('WARNING');
  });

  test('fires disk alerts per mount point', () => {
    const full = fixture({ disks: [{ ...fixture().disks[0], usePercent: 96 }] });
    const alerts = evaluateAlerts(full);
    expect(alerts.some((a) => a.key.startsWith('disk.high.'))).toBe(true);
  });
});
