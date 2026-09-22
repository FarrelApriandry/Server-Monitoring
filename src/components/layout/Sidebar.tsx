import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Layers,
  Wifi,
  HardDrive,
  Terminal,
  Server,
  Activity,
  X,
  LogOut,
} from 'lucide-react';

export type NavTab = 'overview' | 'devices' | 'resources' | 'processes' | 'network' | 'storage' | 'logs';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  hostname?: string;
  onLogout?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile,
  hostname,
  onLogout,
}: SidebarProps) {
  const navItems = [
    { id: 'overview', label: 'OVERVIEW', icon: LayoutDashboard, group: 'main' },
    { id: 'devices', label: 'DEVICES', icon: Server, group: 'monitoring' },
    { id: 'resources', label: 'RESOURCES', icon: Cpu, group: 'monitoring' },
    { id: 'processes', label: 'PROCESSES', icon: Layers, group: 'monitoring' },
    { id: 'network', label: 'NETWORK', icon: Wifi, group: 'monitoring' },
    { id: 'storage', label: 'STORAGE', icon: HardDrive, group: 'monitoring' },
    { id: 'logs', label: 'SYSTEM LOGS', icon: Terminal, group: 'system' },
  ];

  const handleSelect = (id: NavTab) => {
    setActiveTab(id);
    setIsOpenMobile(false);
  };

  const renderGroup = (group: string) =>
    navItems
      .filter((item) => item.group === group)
      .map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            aria-label={`Open ${item.label}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => handleSelect(item.id as NavTab)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-mono font-medium transition-colors relative ${
              isActive
                ? 'bg-elevated text-ink border-l-2 border-accent'
                : 'text-soft hover:text-ink hover:bg-panel'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-muted'}`} />
            <span>{item.label}</span>
          </button>
        );
      });

  return (
    <>
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsOpenMobile(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-secondary border-r border-default flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label="Primary navigation"
      >
        <div>
          <div className="p-5 border-b border-default flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-accent/10 border border-accent/40 flex items-center justify-center text-accent hud-corner-brackets">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-ink font-mono">NEXUS</h1>
                <p className="text-[10px] text-muted font-mono tracking-widest uppercase">SYSTEM MONITOR</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpenMobile(false)}
              aria-label="Close menu"
              className="lg:hidden text-soft hover:text-ink"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-6">
            <div className="px-3 text-[10px] font-mono tracking-widest text-muted uppercase mb-2">MAIN</div>
            <div className="space-y-1">{renderGroup('main')}</div>

            <div className="px-3 text-[10px] font-mono tracking-widest text-muted uppercase mb-2">MONITORING</div>
            <div className="space-y-1">{renderGroup('monitoring')}</div>

            <div className="px-3 text-[10px] font-mono tracking-widest text-muted uppercase mb-2">SYSTEM</div>
            <div className="space-y-1">{renderGroup('system')}</div>
          </nav>
        </div>

        <div className="p-4 border-t border-default bg-primary/50 font-mono text-[10px] text-muted space-y-1">
          <div className="flex items-center justify-between">
            <span>NODE: {hostname ? hostname.toUpperCase() : 'LOCALHOST'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent nexus-ping" />
          </div>
          <div className="text-[9px] text-soft truncate">[ TELEMETRY STREAM ACTIVE ]</div>
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Log out"
              className="mt-2 w-full flex items-center gap-2 px-3 py-1.5 rounded text-[10px] text-soft hover:text-danger border border-default hover:border-danger/40 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              LOG OUT
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
