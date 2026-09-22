import React, { useState, useEffect } from 'react';
import { Server, Cpu, Clock, HardDrive } from 'lucide-react';
import type { SystemMetrics, SystemInfoSnapshot } from '../../types/metrics';
import { formatUptime } from '../../lib/format';

interface DeviceListProps {
  metrics: SystemMetrics;
  isConnected: boolean;
  lastSync: Date | null;
}

export default function DeviceList({ metrics, isConnected, lastSync }: DeviceListProps) {
  const cpuTemp = metrics.cpu.temperatures.main ?? metrics.cpu.temperatures.max;
  const lastSeenStr = lastSync ? lastSync.toLocaleTimeString('id-ID') : 'N/A';
  const [systemInfo, setSystemInfo] = useState<SystemInfoSnapshot | null>(null);
  const [systemInfoError, setSystemInfoError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSystemInfoError(false);
    fetch('/api/system')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: SystemInfoSnapshot | null) => {
        if (json && !cancelled) setSystemInfo(json);
      })
      .catch(() => {
        if (!cancelled) setSystemInfoError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = systemInfo
    ? [
        { label: 'MANUFACTURER', value: systemInfo.system.manufacturer || 'N/A' },
        { label: 'MODEL', value: systemInfo.system.model || 'N/A' },
        { label: 'SERIAL', value: systemInfo.system.serial || 'N/A' },
        { label: 'BIOS', value: [systemInfo.bios.vendor, systemInfo.bios.version].filter(Boolean).join(' ') || 'N/A' },
        { label: 'BIOS DATE', value: systemInfo.bios.releaseDate || 'N/A' },
        { label: 'BOARD', value: [systemInfo.baseboard.manufacturer, systemInfo.baseboard.model].filter(Boolean).join(' ') || 'N/A' },
        { label: 'KERNEL', value: systemInfo.os.kernel || 'N/A' },
        { label: 'ARCHITECTURE', value: systemInfo.os.arch || 'N/A' },
      ]
    : [];

  return (
    <div className="space-y-6 font-mono">
      <div className="flex items-center justify-between border-b border-default pb-4">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-ink uppercase flex items-center gap-2">
            <Server className="w-4 h-4 text-accent" />
            MONITORED DEVICES & NODES
          </h2>
          <p className="text-[10px] text-muted mt-0.5">
            ACTIVE TELEMETRY NODES CONNECTED TO NEXUS COMMAND CENTER
          </p>
        </div>
        <span className="text-[10px] text-soft bg-elevated px-2 py-1 rounded border border-default">
          1 NODE CONNECTED
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="hud-panel p-5 space-y-4 hud-corner-brackets relative border-active">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-accent nexus-ping' : 'bg-danger'
                }`}
              />
              <span
                className={`text-xs font-bold tracking-wider ${
                  isConnected ? 'text-accent' : 'text-danger'
                }`}
              >
                {isConnected ? '● ONLINE' : '× OFFLINE'}
              </span>
              <h3 className="text-sm font-bold text-ink">{metrics.os.hostname}</h3>
            </div>
            <span className="text-[10px] text-muted">[ LOCALHOST / PRIMARY ]</span>
          </div>

          <div className="text-xs text-soft">
            <p className="font-semibold text-ink">{metrics.os.distro}</p>
            <p className="text-[11px] text-muted">
              Release: {metrics.os.release} • Platform: {metrics.os.platform} • {metrics.os.kernel}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-secondary p-3 rounded border border-default text-center">
            <div>
              <span className="text-[9px] text-muted uppercase block">CPU USAGE</span>
              <span className="text-sm font-bold text-info">{metrics.cpu.usagePercent}%</span>
            </div>
            <div>
              <span className="text-[9px] text-muted uppercase block">RAM USAGE</span>
              <span className="text-sm font-bold text-accent">{metrics.memory.usagePercent}%</span>
            </div>
            <div>
              <span className="text-[9px] text-muted uppercase block">TEMP</span>
              <span className="text-sm font-bold text-warning">
                {cpuTemp ? `${cpuTemp}°C` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-info" />
              UPTIME: {formatUptime(metrics.os.uptime)}
            </span>
            <span>LAST SYNC: {lastSeenStr}</span>
          </div>
        </div>

        {systemInfo ? (
          <div className="hud-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-ink uppercase flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-info" />
                HARDWARE IDENTITY
              </h3>
              <span className="text-[10px] text-muted">[ STATIC ]</span>
            </div>
            <div className="divide-y divide-default/50 text-[10px]">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5">
                  <span className="text-muted uppercase">{row.label}</span>
                  <span className="text-soft truncate max-w-[55%]" title={row.value}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-muted border-t border-default/60 pt-2">
              SNAPSHOT: {new Date(systemInfo.timestamp).toLocaleTimeString('id-ID')}
            </div>
          </div>
        ) : (
          <div className="hud-panel p-5 space-y-4 border-dashed border-default">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-ink uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4 text-info" />
                HARDWARE IDENTITY
              </h3>
              <span className="text-[10px] text-muted">[ STATIC ]</span>
            </div>
            <div className="py-6 text-center text-muted text-xs">
              {systemInfoError ? 'System identity information unavailable on this platform.' : 'Querying BIOS / board identity...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
