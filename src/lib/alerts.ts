import type { ServerAlert, SystemMetrics } from '../types/metrics';

/**
 * Threshold evaluation engine. Emits an alert only when a metric CROSSES into
 * a worse state (ok -> WARNING or WARNING -> CRITICAL), so logs never flood
 * while a resource stays above its threshold. Webhook-level rate limiting is
 * handled separately in the telemetry broker.
 */

export interface AlertRule {
  key: string;
  source: string;
  label: string;
  value: number;
  unit: string;
  warn: number;
  crit: number;
}

interface MetricState {
  level: 'ok' | 'WARNING' | 'CRITICAL';
}

const states = new Map<string, MetricState>();

function levelFor(value: number, warn: number, crit: number): 'ok' | 'WARNING' | 'CRITICAL' {
  if (value >= crit) return 'CRITICAL';
  if (value >= warn) return 'WARNING';
  return 'ok';
}

function buildRules(m: SystemMetrics): AlertRule[] {
  const rules: AlertRule[] = [];

  rules.push({
    key: 'cpu.high',
    source: 'cpu',
    label: 'CPU utilization',
    value: m.cpu.usagePercent,
    unit: '%',
    warn: 80,
    crit: 90,
  });

  rules.push({
    key: 'memory.high',
    source: 'memory',
    label: 'RAM usage',
    value: m.memory.usagePercent,
    unit: '%',
    warn: 85,
    crit: 95,
  });

  if (m.memory.swapTotal > 0) {
    rules.push({
      key: 'swap.high',
      source: 'memory',
      label: 'Swap usage',
      value: m.memory.swapPercent,
      unit: '%',
      warn: 70,
      crit: 85,
    });
  }

  const temp = m.cpu.temperatures.main ?? m.cpu.temperatures.max;
  if (temp !== null) {
    rules.push({
      key: 'temp.high',
      source: 'thermal',
      label: 'CPU temperature',
      value: temp,
      unit: '°C',
      warn: 75,
      crit: 85,
    });
  }

  for (const disk of m.disks) {
    rules.push({
      key: `disk.high.${disk.mount}`,
      source: 'storage',
      label: `Disk ${disk.mount}`,
      value: disk.usePercent,
      unit: '%',
      warn: 90,
      crit: 95,
    });
  }

  return rules;
}

/** Returns newly triggered alerts for this sample. */
export function evaluateAlerts(m: SystemMetrics): ServerAlert[] {
  const out: ServerAlert[] = [];
  const now = Date.now();

  for (const rule of buildRules(m)) {
    const next = levelFor(rule.value, rule.warn, rule.crit);
    const prev = states.get(rule.key)?.level ?? 'ok';

    if (next === 'ok') {
      if (prev !== 'ok') states.set(rule.key, { level: 'ok' });
      continue;
    }
    if (next === prev) continue; // already announced, no edge

    states.set(rule.key, { level: next });
    out.push({
      id: `${rule.key}:${now}`,
      timestamp: now,
      level: next,
      key: rule.key,
      source: rule.source,
      message: `${rule.label} crossed ${next} at ${rule.value}${rule.unit} (warn ≥ ${rule.warn}${rule.unit}, critical ≥ ${rule.crit}${rule.unit})`,
      value: rule.value,
      threshold: rule.warn,
    });
  }

  return out;
}

/** Testing hook: reset the internal state machine. */
export function resetAlertState(): void {
  states.clear();
}
