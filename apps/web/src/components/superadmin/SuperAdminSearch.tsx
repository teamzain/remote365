import React, { useEffect, useRef, useState } from 'react';
import { Search, LayoutGrid, Building2, Users, Monitor, Network } from 'lucide-react';
import api from '../../lib/api';

/**
 * Super Admin -> global top-bar search.
 * Tabbed dropdown (All / Organizations / Users / Devices / Sessions) that lazily
 * loads the platform admin lists on first focus and filters them as you type.
 * Picking a result jumps to that section pre-filtered to the chosen item.
 */

type SearchNav = 'organizations' | 'users' | 'devices' | 'sessions';
type TabKey = 'all' | SearchNav;
type Hit = { id: string; primary: string; secondary?: string; nav: SearchNav; query: string; search: string };
type IconType = React.ComponentType<{ size?: number; className?: string }>;

const TABS: { key: TabKey; label: string; icon: IconType }[] = [
  { key: 'all', label: 'All', icon: LayoutGrid },
  { key: 'organizations', label: 'Organizations', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'devices', label: 'Devices', icon: Monitor },
  { key: 'sessions', label: 'Sessions', icon: Network },
];
const KIND_ICON: Record<SearchNav, IconType> = { organizations: Building2, users: Users, devices: Monitor, sessions: Network };
const KIND_LABEL: Record<SearchNav, string> = { organizations: 'Organization', users: 'User', devices: 'Device', sessions: 'Session' };
const NAVS: SearchNav[] = ['organizations', 'users', 'devices', 'sessions'];

const SuperAdminSearch: React.FC<{ onPick: (key: SearchNav, query: string) => void }> = ({ onPick }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<SearchNav, Hit[]>>({ organizations: [], users: [], devices: [], sessions: [] });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const ensureLoaded = () => {
    if (loaded || loading) return;
    setLoading(true);
    Promise.all([
      api.get('/api/organizations').then((r: any) => r.data).catch(() => []),
      api.get('/api/admin/users').then((r: any) => r.data).catch(() => []),
      api.get('/api/admin/devices').then((r: any) => r.data).catch(() => []),
      api.get('/api/admin/remote-sessions').then((r: any) => r.data).catch(() => []),
    ]).then(([orgs, users, devices, sessions]: any[]) => {
      const arr = (x: any) => (Array.isArray(x) ? x : []);
      const lc = (...xs: any[]) => xs.filter(Boolean).join(' ').toLowerCase();
      setData({
        organizations: arr(orgs).map((o: any) => ({
          id: o.id, nav: 'organizations',
          primary: o.name || o.slug || 'Organization',
          secondary: o.owner?.email || o.owner?.name || o.slug || '',
          query: o.name || o.slug || '',
          search: lc(o.name, o.slug, o.owner?.name, o.owner?.email, o.plan),
        })),
        users: arr(users).map((u: any) => ({
          id: u.id, nav: 'users',
          primary: u.name || u.email || 'User',
          secondary: u.email || u.organization || '',
          query: u.email || u.name || '',
          search: lc(u.name, u.email, u.organization, u.role),
        })),
        devices: arr(devices).map((d: any) => ({
          id: d.id, nav: 'devices',
          primary: d.name || 'Device',
          secondary: d.userEmail || d.org || d.deviceId || '',
          query: d.name || '',
          search: lc(d.name, d.userName, d.userEmail, d.org, d.deviceId),
        })),
        sessions: arr(sessions).map((s: any) => ({
          // The /api/admin/remote-sessions payload exposes `code`, `host`,
          // `hostEmail` (not sessionCode/createdBy) — match that shape or every
          // result renders as a blank "Session".
          id: s.id, nav: 'sessions',
          primary: s.name || s.code || 'Session',
          secondary: s.host || s.org || s.code || '',
          query: s.name || s.code || '',
          search: lc(s.name, s.code, s.host, s.hostEmail, s.org),
        })),
      });
      setLoaded(true);
    }).finally(() => setLoading(false));
  };

  const q = query.trim().toLowerCase();
  const match = (h: Hit) => !q || h.search.includes(q);
  const groups = NAVS
    .filter((nav) => tab === 'all' || tab === nav)
    .map((nav) => ({ nav, hits: data[nav].filter(match).slice(0, 6) }));
  const totalHits = groups.reduce((n, g) => n + g.hits.length, 0);

  const pick = (h: Hit) => { onPick(h.nav, h.query); setOpen(false); setQuery(''); };
  const onEnter = () => {
    const first = groups.flatMap((g) => g.hits)[0];
    if (first) pick(first);
    else if (tab !== 'all' && q) { onPick(tab, query.trim()); setOpen(false); }
  };

  return (
    <div ref={rootRef} className="relative w-[474px] max-w-[36vw]">
      <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(26,29,33,0.3)]"><Search size={16} /></div>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); ensureLoaded(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); if (e.key === 'Escape') setOpen(false); }}
        type="text"
        placeholder="Search organizations, users, devices..."
        className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white pl-11 pr-4 text-[14px] font-medium leading-5 text-[#111315] outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
      />

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[520px] max-w-[92vw] overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 px-3 pt-3">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${active ? 'bg-[rgba(255,138,0,0.12)] text-[#FF8A00]' : 'text-[#535862] hover:bg-[#F3F4F6]'}`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 h-px w-full bg-black/10" />

          {/* Body */}
          <div className="max-h-[360px] overflow-auto p-2">
            {loading && <div className="px-3 py-10 text-center text-sm text-black/50">Searching…</div>}

            {!loading && q === '' && (
              <div className="px-4 py-8">
                <h4 className="text-[15px] font-semibold text-[#111315]">Search across your platform</h4>
                <p className="mt-1 text-sm text-[#535862]">Find organizations, users, devices and sessions. Start typing to see matches.</p>
              </div>
            )}

            {!loading && q !== '' && totalHits === 0 && (
              <div className="px-4 py-8">
                <h4 className="text-[15px] font-semibold text-[#111315]">No results for “{query.trim()}”</h4>
                <p className="mt-1 text-sm text-[#535862]">Try a different name, email, or device.</p>
              </div>
            )}

            {!loading && q !== '' && groups.map((g) =>
              g.hits.length > 0 ? (
                <div key={g.nav} className="mb-1">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-black/40">{KIND_LABEL[g.nav]}s</div>
                  {g.hits.map((h) => {
                    const Icon = KIND_ICON[h.nav];
                    return (
                      <button key={h.id} onClick={() => pick(h)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#F3F4F6]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[rgba(255,179,71,0.25)] text-[#FF8A00]"><Icon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[#111315]">{h.primary}</span>
                          {h.secondary && <span className="block truncate text-xs text-[#535862]">{h.secondary}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSearch;
