import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricPanelProps {
  title: string;
  value: string | number;
  unit?: string;
  statusText?: string;
  statusLevel?: 'success' | 'warning' | 'danger';
  icon: LucideIcon;
  progressPercent?: number;
  metadata?: Array<{ label: string; value: string }>;
  deltaText?: string;
  badgeCode?: string;
}

export default function MetricPanel({
  title,
  value,
  unit = '%',
  statusText = 'NORMAL',
  statusLevel = 'success',
  icon: Icon,
  progressPercent,
  metadata = [],
  deltaText,
  badgeCode,
}: MetricPanelProps) {
  const getStatusColor = () => {
    switch (statusLevel) {
      case 'danger':
        return 'text-danger bg-danger/10 border-danger/30';
      case 'warning':
        return 'text-warning bg-warning/10 border-warning/30';
      default:
        return 'text-accent bg-accent/10 border-accent/30';
    }
  };

  const getProgressColor = () => {
    switch (statusLevel) {
      case 'danger':
        return 'bg-danger';
      case 'warning':
        return 'bg-warning';
      default:
        return 'bg-accent';
    }
  };

  return (
    <div className="hud-panel p-4 space-y-3 relative hud-corner-brackets group transition-all duration-150 hover:border-active">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-soft tracking-wider uppercase font-medium flex items-center gap-1.5">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badgeCode && (
            <span className="text-[10px] text-muted font-mono tracking-widest">[ {badgeCode} ]</span>
          )}
          <div className="p-1.5 rounded bg-elevated text-info border border-default">
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold font-mono text-ink tracking-tight">
            {value}
          </span>
          {unit && <span className="text-sm font-mono text-soft">{unit}</span>}
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getStatusColor()}`}
        >
          {statusText}
        </span>
      </div>

      {progressPercent !== undefined && (
        <div className="w-full bg-elevated h-1.5 rounded-xs overflow-hidden border border-default">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
          />
        </div>
      )}

      {metadata.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-default/60 text-[11px] font-mono">
          {metadata.map((item, idx) => (
            <div key={idx} className="truncate">
              <span className="text-muted uppercase block text-[9px]">{item.label}</span>
              <span className="text-ink font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {deltaText && (
        <div className="text-[10px] font-mono text-muted pt-1 flex items-center gap-1">
          <span>▲</span>
          <span>{deltaText}</span>
        </div>
      )}
    </div>
  );
}
