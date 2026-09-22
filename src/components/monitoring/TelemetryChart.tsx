import React from 'react';
import { Activity } from 'lucide-react';

interface TelemetryChartProps {
  title: string;
  subtitle?: string;
  dataHistory: Array<number | null>;
  currentValue: number | string;
  unit?: string;
  lineColor?: string;
  maxLimit?: number;
  maxBars?: number;
}

export default function TelemetryChart({
  title,
  subtitle = 'REAL-TIME TELEMETRY',
  dataHistory,
  currentValue,
  unit = '%',
  lineColor = '#65E6C1',
  maxLimit = 100,
  maxBars = 40,
}: TelemetryChartProps) {
  const raw = dataHistory.slice(-maxBars);
  const bars = raw.map((v) =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0
  );
  const sampled = bars.length > 180 ? bars.filter((_, i) => i % 2 === 0) : bars;
  const wide = sampled.length > 60;
  const xLabels = wide ? ['EARLIEST', 'MIDPOINT', 'NOW'] : ['-60s', '-30s', 'NOW'];

  return (
    <div className="hud-panel p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-default pb-3">
        <div>
          <h2 className="text-xs font-mono font-bold tracking-wider text-ink uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            {title}
          </h2>
          <p className="text-[10px] font-mono text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="text-2xl font-bold text-ink">{currentValue}</span>
          <span className="text-xs text-soft">{unit}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="relative h-28 bg-secondary p-2 rounded border border-default flex items-end gap-0.5 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 opacity-20">
            <div className="border-b border-dashed border-active w-full" />
            <div className="border-b border-dashed border-active w-full" />
            <div className="border-b border-dashed border-active w-full" />
          </div>
          {sampled.map((val, idx) => {
            const heightPercent = Math.min(Math.max((val / maxLimit) * 100, 3), 100);
            return (
              <div key={idx} className="flex-1 h-full flex items-end group relative z-10">
                <div
                  className="w-full rounded-t-xs transition-all duration-200"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: lineColor,
                    opacity: idx === sampled.length - 1 ? 1 : 0.55 + (idx / Math.max(sampled.length, 1)) * 0.45,
                  }}
                />
                <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-elevated text-ink text-[9px] font-mono px-1.5 py-0.5 rounded border border-active pointer-events-none transition-opacity whitespace-nowrap z-20">
                  {val.toFixed(1)} {unit}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] font-mono text-muted px-1 pt-0.5">
          <span>{xLabels[0]}</span>
          <span>{xLabels[1]}</span>
          <span className="text-accent font-bold">{xLabels[2]}</span>
        </div>
      </div>
    </div>
  );
}
