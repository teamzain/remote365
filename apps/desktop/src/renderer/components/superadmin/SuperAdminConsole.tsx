import React, { useEffect, useRef, useState } from 'react';
import {
  Menu, ChevronLeft, ChevronRight, ChevronDown, Settings, LogOut,
} from 'lucide-react';
import logo from '../../../logo.png';
import { HomeIcon, OrganizationIcon, UserIcon, DeviceIcon, RemoteIcon, SubscriptionIcon, BillingIcon } from './icons';
import { StatusFooter } from '../shell/StatusFooter';
import HomePage from './pages/HomePage';
import OrganizationsPage from './pages/OrganizationsPage';
import UserManagementPage from './pages/UserManagementPage';
import DeviceManagementPage from './pages/DeviceManagementPage';
import RemoteSessionPage from './pages/RemoteSessionPage';
import SubscriptionPlansPage from './pages/SubscriptionPlansPage';
import BillingRevenuePage from './pages/BillingRevenuePage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminSearch from './SuperAdminSearch';

export type NavKey = 'home' | 'organizations' | 'users' | 'devices' | 'sessions' | 'subscriptions' | 'billing' | 'settings';

type IconType = React.ComponentType<{ size?: number; className?: string }>;

const NAV: { key: NavKey; label: string; icon: IconType }[] = [
  { key: 'home', label: 'Home', icon: HomeIcon },
  { key: 'organizations', label: 'Organizations', icon: OrganizationIcon },
  { key: 'users', label: 'User Management', icon: UserIcon },
  { key: 'devices', label: 'Device Management', icon: DeviceIcon },
  { key: 'sessions', label: 'Remote Session', icon: RemoteIcon },
  { key: 'subscriptions', label: 'Subscription Plans', icon: SubscriptionIcon },
  { key: 'billing', label: 'Billing & Revenue', icon: BillingIcon },
];

const TITLES: Record<NavKey, string> = {
  home: 'Home',
  organizations: 'Organizations',
  users: 'User Management',
  devices: 'Device Management',
  sessions: 'Remote Session',
  subscriptions: 'Subscription Plans',
  billing: 'Billing & Revenue',
  settings: 'Settings',
};

const MONA: React.CSSProperties = { fontFamily: "'Mona Sans', system-ui, -apple-system, sans-serif" };

interface Props {
  user: any;
  onLogout: () => void;
}

const SuperAdminConsole: React.FC<Props> = ({ user, onLogout }) => {
  // Internal navigation history so the top-bar back/forward arrows work like the owner shell.
  const [history, setHistory] = useState<NavKey[]>(['home']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const active = history[historyIndex];
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Optional search term to pre-filter a destination page; `token` forces the
  // page to remount so it re-seeds its search box even on repeat searches.
  const [searchSeed, setSearchSeed] = useState<{ key: NavKey; query: string; token: number } | null>(null);

  const navigate = (key: NavKey) => {
    if (key === active) return;
    const next = history.slice(0, historyIndex + 1);
    next.push(key);
    setHistory(next);
    setHistoryIndex(next.length - 1);
  };
  // Manual navigation (sidebar / KPI cards) clears any stale search pre-filter.
  const navClear = (key: NavKey) => { setSearchSeed(null); navigate(key); };
  const goToSearch = (key: NavKey, query: string) => { setSearchSeed({ key, query, token: Date.now() }); navigate(key); };
  const seedQuery = (key: NavKey) => (searchSeed?.key === key ? searchSeed.query : undefined);
  const seedKey = (key: NavKey) => `${key}-${searchSeed?.key === key ? searchSeed.token : 'base'}`;
  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const initial = (user?.name || user?.email || 'S').charAt(0).toUpperCase();
  // The owner dashboard's footer shows the machine's 9-digit device ID. A super
  // admin has no device, so show the real account id (and copy the full one)
  // instead of a number synthesised from UUID digits.
  const accountId = user?.id ? String(user.id) : '';
  const displayId = accountId ? accountId.slice(0, 8).toUpperCase() : '—';

  const navButton = (item: { key: NavKey; label: string; icon: IconType }) => {
    const isActive = active === item.key;
    const Icon = item.icon;
    return (
      <button
        key={item.key}
        onClick={() => navClear(item.key)}
        title={item.label}
        className={`flex h-10 items-center gap-2 rounded-[4px] px-4 transition-colors ${
          collapsed ? 'justify-center px-0' : ''
        } ${isActive ? 'bg-white text-[#FF8A00] shadow-sm' : 'text-[#111315] hover:bg-white/60'}`}
      >
        <Icon size={16} className="shrink-0" />
        {!collapsed && <span className="truncate text-sm font-medium">{item.label}</span>}
      </button>
    );
  };

  const renderPage = () => {
    switch (active) {
      case 'organizations':
        return <OrganizationsPage key={seedKey('organizations')} initialQuery={seedQuery('organizations')} />;
      case 'home':
        return <HomePage onNavigate={navClear} />;
      case 'users':
        return <UserManagementPage key={seedKey('users')} initialQuery={seedQuery('users')} />;
      case 'devices':
        return <DeviceManagementPage key={seedKey('devices')} initialQuery={seedQuery('devices')} />;
      case 'sessions':
        return <RemoteSessionPage key={seedKey('sessions')} initialQuery={seedQuery('sessions')} />;
      case 'subscriptions':
        return <SubscriptionPlansPage key={seedKey('subscriptions')} initialQuery={seedQuery('subscriptions')} />;
      case 'billing':
        return <BillingRevenuePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] text-[#111315]" style={MONA}>
      {/* Sidebar */}
      <aside className={`flex shrink-0 flex-col gap-4 p-4 transition-all duration-300 ${collapsed ? 'w-[76px]' : 'w-[245px]'}`}>
        {/* Brand */}
        <div className={`flex h-8 items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src={logo} alt="Remote365" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
              <span className="truncate text-sm font-medium">Remote365</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#111315] hover:bg-white/60"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Primary nav */}
        <nav className="flex flex-1 flex-col gap-1">{NAV.map(navButton)}</nav>

        {/* Footer */}
        <div className="flex flex-col gap-1 border-t border-[rgba(26,29,33,0.08)] pt-2">
          <button
            title="Settings"
            onClick={() => navClear('settings')}
            className={`flex h-10 items-center gap-2 rounded-[4px] px-4 transition-colors ${collapsed ? 'justify-center px-0' : ''} ${
              active === 'settings' ? 'bg-white text-[#FF8A00] shadow-sm' : 'text-[#111315] hover:bg-white/60'
            }`}
          >
            <Settings size={16} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main content card */}
      <main className="min-w-0 flex-1 py-3 pr-3">
        <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm">
          {/* Top bar — same structure/styling as the owner dashboard */}
          <header className="z-10 flex h-[60px] w-full flex-shrink-0 items-center justify-between bg-white px-5 font-['Mona_Sans',system-ui,sans-serif]">
            <div className="flex items-center gap-6">
              <h1 className="min-w-[41px] text-[14px] font-medium leading-5 tracking-normal text-[#111315]">{TITLES[active]}</h1>
              <div className="flex items-center gap-4 text-[#1A1D21]">
                <button
                  onClick={() => canBack && setHistoryIndex((i) => i - 1)}
                  disabled={!canBack}
                  className={`transition-colors ${canBack ? 'hover:text-[#FF8A00]' : 'cursor-not-allowed opacity-30'}`}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => canForward && setHistoryIndex((i) => i + 1)}
                  disabled={!canForward}
                  className={`transition-colors ${canForward ? 'hover:text-[#FF8A00]' : 'cursor-not-allowed opacity-30'}`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <SuperAdminSearch onPick={goToSearch} />

            <div className="flex items-center gap-7 text-[#1A1D21]">
              <button onClick={() => navClear('settings')} className="transition-colors hover:text-[#FF8A00]" title="Settings"><Settings size={24} strokeWidth={1.5} /></button>
              {/* Notification bell hidden until a real platform-notification feed
                  is wired — the panel was showing hardcoded sample items. */}

              <div className="relative" ref={userMenuRef}>
                <button onClick={() => setShowUserMenu((v) => !v)} className="group relative flex h-10 cursor-pointer items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#F9F5FF] text-base font-medium text-[#7F56D9] shadow-sm">
                    {initial}
                  </div>
                  <span className="hidden max-w-[120px] truncate text-[14px] font-normal leading-5 text-[#111315] xl:block">{user?.name || 'Super Admin'}</span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-[#1A1D21]" />
                  <div className="absolute bottom-0 left-7 h-3 w-3 rounded-full border-2 border-white bg-[#34C759]" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full z-[100] mt-3 w-56 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-2xl">
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F9F5FF] text-sm font-medium text-[#7F56D9]">{initial}</div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-[#1C1C1C]">{user?.name || 'Super Admin'}</span>
                        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#FF8A00]">Super Admin</span>
                      </div>
                    </div>
                    <div className="h-px bg-[rgba(0,0,0,0.06)]" />
                    <button onClick={onLogout} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]">
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page content — settings is full-bleed so its sub-sidebar can run edge to edge */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar ${active === 'settings' ? '' : 'px-6 py-6'}`}>{renderPage()}</div>

          {/* Footer — shared with the owner dashboard */}
          <StatusFooter
            status="status"
            statusLabel={`Signed In As ${user?.email || 'Super Admin'}`}
            idLabel={displayId}
            onCopyId={() => { try { navigator.clipboard?.writeText(accountId || displayId); } catch { /* clipboard unavailable */ } }}
          />
        </div>
      </main>

      {/* Notifications slide-in */}
    </div>
  );
};

export default SuperAdminConsole;
