import React from 'react';
import { RefreshCw, Menu, Play, Pause } from 'lucide-react';
import type { SystemMetrics } from '../../types/metrics';

type ConnState = 'connecting' | 'live' | 'fallback' | 'offline';

interface TopbarProps {
  data: SystemMetrics | null;
  connState: ConnState;
  lastSync: Date | null;
  isPaused: boolean;
  onTogglePause: () => void;
  onManualRefresh: () => void;
  onOpenMobileSidebar: () => void;
  activeTabTitle: string;
}

function statusBadge(connState: ConnState) {
  switch (connState) {
    case 'live':
      return { dot: 'bg-accent nexus-ping', cls: 'bg-accent/10 text-accent border-accent/30', label: 'LIVE ●' };
    case 'fallback':
      return { dot: 'bg-warning nexus-ping', cls: 'bg-warning/10 text-warning border-warning/30', label: 'POLL ●' };
    case 'connecting':
      return { dot: 'bg-info animate-pulse', cls: 'bg-info/10 text-info border-info/30', label: 'SYNC…' };
    default:
      return { dot: 'bg-danger', cls: 'bg-danger/10 text-danger border-danger/30', label: 'OFFLINE ×' };
  }
}

export default function Topbar({
  data,
  connState,
  lastSync,
  isPaused,
  onTogglePause,
  onManualRefresh,
  onOpenMobileSidebar,
  activeTabTitle,
}: TopbarProps) {
  const syncTimeStr = lastSync ? lastSync.toLocaleTimeString('id-ID') : '--:--:--';
  const badge = statusBadge(connState);

  return (
    <header className="bg-secondary border-b border-default px-4 py-3 lg:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
          className="lg:hidden p-1.5 rounded text-soft hover:text-ink bg-panel border border-default"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold font-mono text-ink tracking-wide uppercase">
              {activeTabTitle}
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-elevated text-soft border border-default">
              SYS.MONITOR / 01
            </span>
          </div>
          <p className="text-xs text-soft font-sans">
            {data ? `${data.os.hostname} • ${data.os.distro} (${data.os.release})` : 'Initializing system telemetry...'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <div role="status" className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${badge.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          <span className="font-bold">{badge.label}</span>
        </div>

        <div className="bg-panel px-2.5 py-1 rounded border border-default text-soft">
          <span>{data ? `[ ${data.os.hostname} ]` : '[ 1 DEVICE ]'}</span>
        </div>

        <div className="bg-panel px-2.5 py-1 rounded border border-default text-soft">
          <span>SYNC: {syncTimeStr}</span>
        </div>

        <div className="flex items-center gap-1 ml-auto md:ml-0">
          <button
            onClick={onTogglePause}
            aria-label={isPaused ? 'Resume live updates' : 'Pause live updates'}
            title={isPaused ? 'Resume live updates' : 'Pause live updates'}
            className={`p-1.5 rounded border transition-colors ${
              isPaused
                ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                : 'bg-panel text-soft border-default hover:text-ink hover:border-active'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onManualRefresh}
            aria-label="Manual sync"
            title="Manual sync"
            className="p-1.5 rounded bg-panel border border-default text-soft hover:text-ink hover:border-active transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
