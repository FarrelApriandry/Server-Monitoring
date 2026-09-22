import React from 'react';
import { HardDrive, ArrowDown, ArrowUp } from 'lucide-react';
import type { SystemMetrics } from '../../types/metrics';
import { formatBytes } from '../../lib/format';

interface StorageViewProps {
  disks: SystemMetrics['disks'];
  diskIO: SystemMetrics['diskIO'];
}

export default function StorageView({ disks, diskIO }: StorageViewProps) {
  return (
    <div className="hud-panel p-5 space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-default pb-4">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-ink uppercase flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-info" />
            STORAGE VOLUMES & PARTITION TELEMETRY
          </h2>
          <p className="text-[10px] text-muted mt-0.5">
            ACTIVE MOUNTED FILE SYSTEMS, CAPACITY AND DISK I/O
          </p>
        </div>
        <span className="text-[10px] text-soft bg-elevated px-2 py-1 rounded border border-default">
          {disks.length} VOLUMES DETECTED
        </span>
      </div>

      {/* Aggregate Disk I/O */}
      <div className="grid grid-cols-2 gap-3 bg-secondary p-3 rounded border border-default">
        <div className="space-y-1">
          <span className="text-[9px] text-muted uppercase flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-accent" />
            READ THROUGHPUT
          </span>
          <p className="text-base font-bold text-accent">{formatBytes(diskIO.readSec)}/s</p>
          <p className="text-[9px] text-muted">Total Read: {formatBytes(diskIO.totalRead)}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-muted uppercase flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-info" />
            WRITE THROUGHPUT
          </span>
          <p className="text-base font-bold text-info">{formatBytes(diskIO.writeSec)}/s</p>
          <p className="text-[9px] text-muted">Total Write: {formatBytes(diskIO.totalWrite)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {disks.map((d, idx) => (
          <div
            key={idx}
            className="hud-panel p-4 space-y-3 border-default hover:border-active transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink text-sm">{d.mount}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-elevated text-info border border-default">
                  {d.type.toUpperCase()}
                </span>
              </div>
              <span
                className={`text-xs font-bold ${
                  d.usePercent > 90
                    ? 'text-danger'
                    : d.usePercent > 75
                    ? 'text-warning'
                    : 'text-accent'
                }`}
              >
                {d.usePercent}% USED
              </span>
            </div>

            <div className="w-full bg-secondary h-2 rounded border border-default overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  d.usePercent > 90
                    ? 'bg-danger'
                    : d.usePercent > 75
                    ? 'bg-warning'
                    : 'bg-accent'
                }`}
                style={{ width: `${Math.min(d.usePercent, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] text-soft pt-1">
              <div>
                <span className="text-muted block uppercase">USED</span>
                <span className="text-ink">{formatBytes(d.used)}</span>
              </div>
              <div>
                <span className="text-muted block uppercase">AVAILABLE</span>
                <span className="text-accent">{formatBytes(d.available)}</span>
              </div>
              <div>
                <span className="text-muted block uppercase">TOTAL SIZE</span>
                <span className="text-ink">{formatBytes(d.size)}</span>
              </div>
            </div>

            <div className="text-[9px] text-muted border-t border-default/60 pt-2 truncate">
              FILESYSTEM DEVICE: {d.fs}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
