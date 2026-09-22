import React from 'react';
import { Wifi, ArrowDown, ArrowUp } from 'lucide-react';
import type { SystemMetrics } from '../../types/metrics';
import { formatBytes } from '../../lib/format';

interface NetworkViewProps {
  network: SystemMetrics['network'];
}

export default function NetworkView({ network }: NetworkViewProps) {
  return (
    <div className="hud-panel p-5 space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-default pb-4">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-ink uppercase flex items-center gap-2">
            <Wifi className="w-4 h-4 text-info" />
            NETWORK INTERFACES & THROUGHPUT
          </h2>
          <p className="text-[10px] text-muted mt-0.5">
            ACTIVE NETWORK CONTROLLERS AND BANDWIDTH TELEMETRY
          </p>
        </div>
        <span className="text-[10px] text-soft bg-elevated px-2 py-1 rounded border border-default">
          {network.length} INTERFACES
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {network.map((net, idx) => (
          <div key={idx} className="hud-panel p-4 space-y-3 border-default hover:border-active">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink text-sm">{net.iface}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                    net.operstate === 'up'
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-secondary text-muted border-default'
                  }`}
                >
                  {net.operstate.toUpperCase()}
                </span>
              </div>
              <span className="text-[10px] text-muted">IPv4: {net.ip4}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-secondary p-3 rounded border border-default">
              <div className="space-y-1">
                <span className="text-[9px] text-muted uppercase flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-accent" />
                  DOWNLOAD SPEED
                </span>
                <p className="text-base font-bold text-accent">
                  {formatBytes(net.rxSec)}/s
                </p>
                <p className="text-[9px] text-muted">
                  Total Rx: {formatBytes(net.rxBytes)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] text-muted uppercase flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-info" />
                  UPLOAD SPEED
                </span>
                <p className="text-base font-bold text-info">
                  {formatBytes(net.txSec)}/s
                </p>
                <p className="text-[9px] text-muted">
                  Total Tx: {formatBytes(net.txBytes)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
