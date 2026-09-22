import React, { useState } from 'react';
import { Search, ArrowUpDown, Layers, Terminal } from 'lucide-react';
import type { SystemMetrics } from '../../types/metrics';

interface ProcessTableProps {
  processes: SystemMetrics['processes'];
  memTotal: number;
}

export default function ProcessTable({ processes, memTotal }: ProcessTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = [...processes.list]
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.pid.toString().includes(searchTerm)
    )
    .sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (sortAsc) return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const toggleSort = (field: 'cpu' | 'mem' | 'pid') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="hud-panel p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <h2 className="text-xs font-mono font-bold tracking-wider text-ink uppercase flex items-center gap-2">
            <Layers className="w-4 h-4 text-info" />
            SYSTEM PROCESSES & RESOURCE ANALYSIS
          </h2>
          <p className="text-[10px] font-mono text-muted mt-0.5">
            TOTAL: {processes.all} • RUNNING: {processes.running} • SLEEPING: {processes.sleeping} • TOP 20 BY CPU
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            aria-label="Search processes"
            placeholder="Search PID, Process, User..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-secondary border border-default focus:border-accent rounded text-xs font-mono text-ink pl-8 pr-3 py-1.5 w-full sm:w-60 outline-none placeholder-muted"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[480px]">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-secondary sticky top-0 z-10 border-b border-default text-soft">
            <tr>
              <th
                onClick={() => toggleSort('pid')}
                aria-sort={sortBy === 'pid' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                className="py-2.5 px-3 font-medium cursor-pointer hover:text-ink"
              >
                <div className="flex items-center gap-1">
                  <span>PID</span>
                  <ArrowUpDown className="w-3 h-3 text-muted" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-medium">PROCESS NAME</th>
              <th className="py-2.5 px-3 font-medium">USER</th>
              <th
                onClick={() => toggleSort('cpu')}
                aria-sort={sortBy === 'cpu' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                className="py-2.5 px-3 font-medium text-right cursor-pointer hover:text-ink"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>CPU %</span>
                  <ArrowUpDown className="w-3 h-3 text-muted" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('mem')}
                aria-sort={sortBy === 'mem' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                className="py-2.5 px-3 font-medium text-right cursor-pointer hover:text-ink"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>MEM %</span>
                  <ArrowUpDown className="w-3 h-3 text-muted" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-medium text-right">EST. MEMORY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default/50 text-ink">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  NO PROCESS MATCHES SEARCH CRITERIA
                </td>
              </tr>
            ) : (
              filtered.map((proc) => {
                const memUsageBytes = (proc.mem / 100) * memTotal;
                const memMB = (memUsageBytes / (1024 * 1024)).toFixed(0);

                return (
                  <tr key={proc.pid} className="hover:bg-elevated/70 transition-colors">
                    <td className="py-2 px-3 text-muted">{proc.pid}</td>
                    <td className="py-2 px-3 font-medium text-ink">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-muted" />
                        <span className="truncate max-w-[200px]" title={proc.command}>
                          {proc.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-soft">{proc.user}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          proc.cpu > 50
                            ? 'text-danger'
                            : proc.cpu > 20
                            ? 'text-warning'
                            : 'text-info'
                        }`}
                      >
                        {proc.cpu.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-accent">
                      {proc.mem.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-soft">
                      ~{memMB} MB
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
