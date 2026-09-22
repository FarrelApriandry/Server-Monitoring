import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SystemMetrics, LogEntry, ServerAlert } from '../types/metrics';
import { formatBytes, formatUptime } from '../lib/format';
import Sidebar, { type NavTab } from './layout/Sidebar';
import Topbar from './layout/Topbar';
import MetricPanel from './monitoring/MetricPanel';
import TelemetryChart from './monitoring/TelemetryChart';
import ProcessTable from './processes/ProcessTable';
import LogViewer from './logs/LogViewer';
import DeviceList from './devices/DeviceList';
import StorageView from './storage/StorageView';
import NetworkView from './network/NetworkView';
import {
  Cpu,
  Zap,
  HardDrive,
  Wifi,
  Flame,
  Terminal,
  RefreshCw,
  TriangleAlert,
  X,
  Battery,
  Activity,
} from 'lucide-react';

const POLL_INTERVAL_MS = 1500;
const OFFLINE_TIMEOUT_MS = 8000;
const SSE_REPROBE_MS = 20000;
const HISTORY_RANGES = ['live', '5m', '1h', '6h', '24h', '7d'] as const;

type ConnState = 'connecting' | 'live' | 'fallback' | 'offline';

export default function Dashboard() {
  const [data, setData] = useState<SystemMetrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString('id-ID'),
      level: 'INFO',
      source: 'system',
      message: 'Nexus Telemetry Monitoring Service initialized',
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString('id-ID'),
      level: 'INFO',
      source: 'network',
      message: 'Established SSE telemetry stream at /api/stream',
    },
  ]);
  const [toasts, setToasts] = useState<ServerAlert[]>([]);

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  const [historyRange, setHistoryRange] = useState<string>('live');
  const [historyCache, setHistoryCache] = useState<Record<string, (number | null)[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  const dataRef = useRef<SystemMetrics | null>(null);
  const isPausedRef = useRef(isPaused);
  const manualPauseRef = useRef(false);
  const lastSeenAlertRef = useRef(Date.now());
  const seenAlertRef = useRef(new Set<string>());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  /* ------------------------------ logs ------------------------------ */

  const addLog = useCallback((level: LogEntry['level'], source: string, message: string) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('id-ID'),
      level,
      source,
      message,
    };
    setLogs((prev) => [...prev.slice(-199), entry]);
  }, []);

  const showToast = useCallback((alert: ServerAlert) => {
    if (alert.level === 'INFO') return;
    setToasts((prev) => [...prev.slice(-3), alert]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== alert.id)), 8000);
  }, []);

  const handleAlerts = useCallback((alerts: ServerAlert[]) => {
    let latestTs = lastSeenAlertRef.current;
    for (const alert of alerts) {
      if (alert.timestamp > latestTs) latestTs = alert.timestamp;
      if (seenAlertRef.current.has(alert.id)) continue;
      seenAlertRef.current.add(alert.id);
      if (seenAlertRef.current.size > 200) seenAlertRef.current.clear();
      addLog(alert.level, alert.source, alert.message);
      showToast(alert);
    }
    lastSeenAlertRef.current = latestTs;
  }, [addLog, showToast]);

  const handleNewData = useCallback((metrics: SystemMetrics) => {
    setData(metrics);
    setLastSync(new Date());
    setCpuHistory((prev) => [...prev.slice(-39), metrics.cpu.usagePercent]);
    setMemHistory((prev) => [...prev.slice(-39), metrics.memory.usagePercent]);
  }, []);

  /* ---------------------- visibility pause / resume ------------------ */

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && isPausedRef.current === false) {
        setIsPaused(true);
      } else if (!document.hidden && !manualPauseRef.current && isPausedRef.current) {
        setIsPaused(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const togglePause = useCallback(() => {
    const next = !isPaused;
    manualPauseRef.current = next;
    setIsPaused(next);
  }, [isPaused]);

  /* ---------------------- streaming (SSE + fallback) ------------------ */

  useEffect(() => {
    let disposed = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let failCount = 0;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const pollTick = async () => {
      if (isPausedRef.current) return;
      try {
        const res = await fetch('/api/metrics');
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (res.ok) {
          handleNewData((await res.json()) as SystemMetrics);
          setConnState('fallback');
        } else {
          setConnState('offline');
        }
      } catch {
        setConnState('offline');
      }

      try {
        const ares = await fetch(`/api/alerts?since=${lastSeenAlertRef.current}`);
        if (ares.ok) {
          const payload = await ares.json();
          if (Array.isArray(payload.alerts)) handleAlerts(payload.alerts);
        }
      } catch {
        /* alerts are best-effort in polling mode */
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      void pollTick();
      pollTimer = setInterval(() => void pollTick(), POLL_INTERVAL_MS);
    };

    const attemptSse = () => {
      if (disposed) return;
      let next: EventSource;
      try {
        next = new EventSource('/api/stream');
      } catch {
        retryAfter(1000);
        return;
      }
      es = next;

      next.onopen = () => {
        failCount = 0;
        setConnState('live');
        stopPolling();
      };

      next.onmessage = (event) => {
        if (isPausedRef.current) return;
        try {
          handleNewData(JSON.parse(event.data) as SystemMetrics);
        } catch {
          /* malformed frame */
        }
      };

      next.addEventListener('alert', (event) => {
        try {
          const alert = JSON.parse((event as MessageEvent).data) as ServerAlert;
          handleAlerts([alert]);
        } catch {
          /* ignore */
        }
      });

      next.addEventListener('status', (event) => {
        try {
          const status = JSON.parse((event as MessageEvent).data) as { error?: string | null };
          if (status.error) setConnState('fallback');
        } catch {
          /* ignore */
        }
      });

      next.onerror = () => {
        if (es === next) es = null;
        try {
          next.close();
        } catch {
          /* ignore */
        }
        failCount += 1;
        if (dataRef.current && pollTimer) {
          // Streaming while polling: keep data flowing, probe SSE occasionally.
          retryAfter(SSE_REPROBE_MS);
        } else if (failCount >= 3) {
          startPolling();
          retryAfter(SSE_REPROBE_MS);
        } else {
          retryAfter(Math.min(1000 * Math.pow(2, failCount - 1), 9000));
        }
      };
    };

    const retryAfter = (ms: number) => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => attemptSse(), ms);
    };

    attemptSse();

    const offlineCheck = setTimeout(() => {
      if (!dataRef.current && !disposed) setConnState('offline');
    }, OFFLINE_TIMEOUT_MS);

    return () => {
      disposed = true;
      if (es) {
        try {
          es.close();
        } catch {
          /* ignore */
        }
      }
      if (retryTimer) clearTimeout(retryTimer);
      clearTimeout(offlineCheck);
      stopPolling();
    };
  }, [handleNewData, handleAlerts]);

  /* ----------------------------- manual ------------------------------ */

  const manualRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        handleNewData((await res.json()) as SystemMetrics);
        addLog('INFO', 'metrics', 'Manual telemetry sync requested and received');
      }
    } catch {
      setConnState('offline');
    }
  }, [handleNewData, addLog]);

  /* --------------------------- history ------------------------------- */

  const switchRange = useCallback(async (range: string) => {
    setHistoryRange(range);
    if (range === 'live') return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history?range=${range}`);
      if (!res.ok) return;
      const payload = await res.json();
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setHistoryCache({
        cpu: rows.map((r: { cpu: number }) => r.cpu),
        mem: rows.map((r: { mem: number }) => r.mem),
        swap: rows.map((r: { swap: number }) => r.swap),
        temp: rows.map((r: { temp: number | null }) => r.temp),
      });
    } catch {
      /* history unavailable */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    window.location.href = '/login';
  }, []);

  /* --------------------------- render -------------------------------- */

  if (!data) {
    return connState === 'offline' ? (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center text-soft font-mono px-6">
        <X className="w-8 h-8 text-danger mb-4" />
        <p className="text-sm tracking-widest uppercase text-ink">UNABLE TO ESTABLISH TELEMETRY LINK</p>
        <p className="text-xs text-soft mt-2">The telemetry service is unreachable or returned no data.</p>
        <p className="text-[10px] text-muted mt-1">[ CHECK SERVER STATUS : NEXUS BACKEND ]</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 rounded bg-accent/10 border border-accent/40 text-accent text-xs font-bold uppercase tracking-wider hover:bg-accent/20 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    ) : (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center text-soft font-mono">
        <RefreshCw className="w-8 h-8 animate-spin text-accent mb-4" />
        <p className="text-xs tracking-widest uppercase">CONNECTING TO TELEMETRY STREAM...</p>
        <p className="text-[10px] text-muted mt-1">[ AUTHENTICATING SESSION : NEXUS NODE ]</p>
      </div>
    );
  }

  const primaryDisk = data.disks[0];
  const activeNet =
    data.network.find((n) => n.operstate === 'up' && n.ip4 !== '-') || data.network[0];
  const cpuTemp = data.cpu.temperatures.main ?? data.cpu.temperatures.max;
  const loadAvg = data.cpu.loadAverage;
  const isConnected = connState === 'live' || connState === 'fallback';

  const tabTitles: Record<NavTab, string> = {
    overview: 'SYSTEM OVERVIEW',
    devices: 'MONITORED DEVICES',
    resources: 'RESOURCE TELEMETRY',
    processes: 'PROCESS DIAGNOSTICS',
    network: 'NETWORK CONTROLLERS',
    storage: 'STORAGE VOLUMES',
    logs: 'SYSTEM LOG STREAM',
  };

  const rangeActive = historyRange !== 'live';

  return (
    <div className="min-h-screen bg-primary text-ink flex flex-col lg:flex-row">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        hostname={data.os.hostname}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          data={data}
          connState={connState}
          lastSync={lastSync}
          isPaused={isPaused}
          onTogglePause={togglePause}
          onManualRefresh={manualRefresh}
          onOpenMobileSidebar={() => setIsOpenMobile(true)}
          activeTabTitle={tabTitles[activeTab]}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1">
          {connState === 'fallback' && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1">
              <TriangleAlert className="w-3.5 h-3.5" />
              LOW-LATENCY STREAM UNAVAILABLE — OPERATING IN POLLING MODE
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricPanel
                  title="CPU UTILIZATION"
                  value={data.cpu.usagePercent}
                  unit="%"
                  statusLevel={
                    data.cpu.usagePercent > 80
                      ? 'danger'
                      : data.cpu.usagePercent > 50
                      ? 'warning'
                      : 'success'
                  }
                  statusText={
                    data.cpu.usagePercent > 80
                      ? 'HIGH'
                      : data.cpu.usagePercent > 50
                      ? 'ELEVATED'
                      : 'NOMINAL'
                  }
                  icon={Cpu}
                  progressPercent={data.cpu.usagePercent}
                  badgeCode="01.CPU"
                  metadata={[
                    { label: 'CORES', value: `${data.cpu.cores} THREADS` },
                    { label: 'CLOCK', value: `${data.cpu.speed} GHz` },
                    { label: 'TEMP', value: cpuTemp ? `${cpuTemp}°C` : 'N/A' },
                    {
                      label: 'LOAD',
                      value: loadAvg.length ? loadAvg.map((l) => l.toFixed(2)).join(' / ') : 'N/A',
                    },
                  ]}
                />

                <MetricPanel
                  title="MEMORY (RAM)"
                  value={data.memory.usagePercent}
                  unit="%"
                  statusText={
                    data.memory.usagePercent > 85
                      ? 'CRITICAL'
                      : data.memory.usagePercent > 70
                      ? 'ELEVATED'
                      : 'NORMAL'
                  }
                  statusLevel={
                    data.memory.usagePercent > 85
                      ? 'danger'
                      : data.memory.usagePercent > 70
                      ? 'warning'
                      : 'success'
                  }
                  icon={Zap}
                  progressPercent={data.memory.usagePercent}
                  badgeCode="02.MEM"
                  metadata={[
                    { label: 'USED', value: formatBytes(data.memory.used) },
                    { label: 'FREE', value: formatBytes(data.memory.available) },
                    { label: 'SWAP', value: `${data.memory.swapPercent}%` },
                  ]}
                />

                <MetricPanel
                  title="STORAGE (ROOT)"
                  value={primaryDisk?.usePercent || 0}
                  unit="%"
                  statusText={(primaryDisk?.usePercent || 0) > 90 ? 'WARNING' : 'HEALTHY'}
                  statusLevel={(primaryDisk?.usePercent || 0) > 90 ? 'warning' : 'success'}
                  icon={HardDrive}
                  progressPercent={primaryDisk?.usePercent || 0}
                  badgeCode="03.STR"
                  metadata={[
                    { label: 'MOUNT', value: primaryDisk?.mount || '/' },
                    { label: 'FREE', value: primaryDisk ? formatBytes(primaryDisk.available) : 'N/A' },
                    { label: 'TYPE', value: primaryDisk?.type.toUpperCase() || 'N/A' },
                  ]}
                />

                <MetricPanel
                  title="NETWORK TRAFFIC"
                  value={(activeNet?.rxSec ?? 0) / 1024 >= 1024 ? ((activeNet?.rxSec ?? 0) / 1024 / 1024).toFixed(2) : ((activeNet?.rxSec ?? 0) / 1024).toFixed(1)}
                  unit={(activeNet?.rxSec ?? 0) / 1024 >= 1024 ? 'MB/s' : 'KB/s'}
                  statusText={(activeNet?.operstate ?? '') === 'up' ? 'ONLINE' : 'OFFLINE'}
                  statusLevel={activeNet?.operstate === 'up' ? 'success' : 'danger'}
                  icon={Wifi}
                  badgeCode="04.NET"
                  metadata={[
                    { label: 'IFACE', value: activeNet?.iface || 'N/A' },
                    { label: 'IP', value: activeNet?.ip4 || 'N/A' },
                    { label: 'TX', value: `${formatBytes(activeNet?.txSec ?? 0)}/s` },
                  ]}
                />

                {data.battery.hasBattery && (
                  <MetricPanel
                    title="BATTERY"
                    value={data.battery.percent}
                    unit="%"
                    statusText={data.battery.isCharging ? 'CHARGING' : data.battery.percent < 20 ? 'LOW' : 'NOMINAL'}
                    statusLevel={data.battery.percent < 20 ? 'danger' : 'success'}
                    icon={Battery}
                    progressPercent={data.battery.percent}
                    badgeCode="05.BAT"
                    metadata={[
                      {
                        label: 'STATE',
                        value: data.battery.isCharging
                          ? 'CHARGING'
                          : data.battery.timeRemaining > 0
                          ? `${formatUptime(Math.round(data.battery.timeRemaining))} left`
                          : 'DISCHARGING',
                      },
                    ]}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <TelemetryChart
                    title="CPU UTILIZATION OVER TIME"
                    subtitle="LAST 60 SECONDS TELEMETRY"
                    dataHistory={cpuHistory}
                    currentValue={data.cpu.usagePercent}
                    unit="%"
                    lineColor="#66B7FF"
                    maxBars={40}
                  />

                  <TelemetryChart
                    title="RAM USAGE OVER TIME"
                    subtitle="LAST 60 SECONDS TELEMETRY"
                    dataHistory={memHistory}
                    currentValue={data.memory.usagePercent}
                    unit="%"
                    lineColor="#65E6C1"
                    maxBars={40}
                  />
                </div>

                <div className="space-y-6">
                  <DeviceList metrics={data} isConnected={isConnected} lastSync={lastSync} />

                  <div className="hud-panel p-4 space-y-3 font-mono">
                    <div className="flex items-center justify-between border-b border-default pb-2">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5 uppercase">
                        <Terminal className="w-3.5 h-3.5 text-accent" />
                        RECENT EVENTS
                      </span>
                      <button
                        onClick={() => setActiveTab('logs')}
                        className="text-[10px] text-accent hover:underline"
                      >
                        VIEW ALL ›
                      </button>
                    </div>
                    <div className="space-y-2 text-[11px]">
                      {logs.slice(-4).map((log) => (
                        <div key={log.id} className="text-soft truncate">
                          <span className="text-muted mr-2">[{log.timestamp}]</span>
                          <span className="text-accent font-semibold">{log.source}:</span>{' '}
                          {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'devices' && (
            <DeviceList metrics={data} isConnected={isConnected} lastSync={lastSync} />
          )}

          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                <span className="text-muted uppercase tracking-wider py-1">HISTORY RANGE:</span>
                {HISTORY_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => void switchRange(range)}
                    disabled={historyLoading && range !== historyRange}
                    className={`px-2 py-1 rounded border transition-colors font-semibold ${
                      historyRange === range
                        ? 'bg-elevated text-accent border-accent/40'
                        : 'bg-secondary text-soft border-default hover:text-ink hover:border-active'
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
                {historyLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted" />}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TelemetryChart
                  title="CPU UTILIZATION TELEMETRY"
                  subtitle={rangeActive ? `${historyRange.toUpperCase()} HISTORY` : 'LAST 60 SECONDS TELEMETRY'}
                  dataHistory={rangeActive ? (historyCache.cpu ?? []) as number[] : cpuHistory}
                  currentValue={data.cpu.usagePercent}
                  unit="%"
                  lineColor="#66B7FF"
                  maxBars={rangeActive ? 180 : 40}
                />

                <TelemetryChart
                  title="RAM CONSUMPTION TELEMETRY"
                  subtitle={rangeActive ? `${historyRange.toUpperCase()} HISTORY` : 'LAST 60 SECONDS TELEMETRY'}
                  dataHistory={rangeActive ? (historyCache.mem ?? []) as number[] : memHistory}
                  currentValue={data.memory.usagePercent}
                  unit="%"
                  lineColor="#65E6C1"
                  maxBars={rangeActive ? 180 : 40}
                />

                {rangeActive && (
                  <TelemetryChart
                    title="SWAP UTILIZATION HISTORY"
                    subtitle={`${historyRange.toUpperCase()} HISTORY`}
                    dataHistory={(historyCache.swap ?? []) as number[]}
                    currentValue={data.memory.swapPercent}
                    unit="%"
                    lineColor="#F4C95D"
                    maxBars={180}
                  />
                )}

                {rangeActive && (
                  <TelemetryChart
                    title="CPU TEMPERATURE HISTORY"
                    subtitle={`${historyRange.toUpperCase()} HISTORY`}
                    dataHistory={(historyCache.temp ?? []) as number[]}
                    currentValue={cpuTemp ?? 0}
                    unit="°C"
                    lineColor="#FF667A"
                    maxLimit={100}
                    maxBars={180}
                  />
                )}
              </div>

              <div className="hud-panel p-5 space-y-3 font-mono">
                <h2 className="text-xs font-bold tracking-wider text-ink uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4 text-info" />
                  CPU LOAD AVERAGE
                </h2>
                <p className="text-[10px] text-muted">
                  {loadAvg.length === 3
                    ? `1 MINUTE: ${loadAvg[0].toFixed(2)} · 5 MINUTES: ${loadAvg[1].toFixed(2)} · 15 MINUTES: ${loadAvg[2].toFixed(2)}`
                    : 'LOAD AVERAGE UNAVAILABLE ON THIS PLATFORM'}
                </p>
              </div>

              {data.cpu.temperatures.cores && data.cpu.temperatures.cores.length > 0 && (
                <div className="hud-panel p-5 space-y-3 font-mono">
                  <h2 className="text-xs font-bold tracking-wider text-ink uppercase flex items-center gap-2">
                    <Flame className="w-4 h-4 text-warning" />
                    CPU CORE TEMPERATURE MATRIX
                  </h2>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                    {data.cpu.temperatures.cores.map((temp, idx) => (
                      <div
                        key={idx}
                        className="bg-secondary border border-default rounded p-2 text-center"
                      >
                        <span className="text-[10px] text-muted block font-semibold">
                          CORE {idx}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            temp !== null && temp > 75
                              ? 'text-danger'
                              : temp !== null && temp > 60
                              ? 'text-warning'
                              : 'text-accent'
                          }`}
                        >
                          {temp !== null ? `${temp}°C` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'processes' && (
            <ProcessTable processes={data.processes} memTotal={data.memory.total} />
          )}

          {activeTab === 'network' && <NetworkView network={data.network} />}

          {activeTab === 'storage' && <StorageView disks={data.disks} diskIO={data.diskIO} />}

          {activeTab === 'logs' && (
            <LogViewer logs={logs} onClearLogs={() => setLogs([])} />
          )}
        </main>
      </div>

      {/* Alert toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80" role="region" aria-label="Alert notifications">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`hud-panel p-3 flex items-start gap-2 border ${
                toast.level === 'CRITICAL' ? 'border-danger bg-danger/10' : 'border-warning bg-warning/10'
              }`}
            >
              <TriangleAlert
                className={`w-4 h-4 shrink-0 ${
                  toast.level === 'CRITICAL' ? 'text-danger' : 'text-warning'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-soft uppercase font-mono">
                  {toast.level} • {toast.source}
                </p>
                <p className="text-xs text-ink font-mono break-words">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                aria-label="Dismiss alert"
                className="text-soft hover:text-ink p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
