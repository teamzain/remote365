import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ChevronDown, Download, MoreVertical, Check, Ban, Trash2, RefreshCw, Loader2, Eye, CheckCircle2,
} from 'lucide-react';
import api from '../../../lib/api';
import { FilterIcon } from '../icons';
import { runBulk } from '../bulk';
import RemoveModal from '../RemoveModal';
import DeviceDetailPage from './DeviceDetailPage';

/**
 * Super Admin → Device Management.
 * Live platform-wide devices from GET /api/admin/devices (platform `devices:viewAll`),
 * with block / remove / export bulk actions.
 */

type Device = {
  id: string;
  name: string;
  deviceId: string;
  type: string;
  formFactor: string;
  org: string;
  userName: string;
  userEmail: string;
  status: string;
  sessions: number;
  lastSeenAgo: string;
  lastSeenAt: string;
  lastLogin: string;
};

type ApiDevice = {
  id: string;
  name?: string | null;
  deviceId?: string;
  type?: string;
  org?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  status?: string;
  sessions?: number;
  lastSeenAt?: string;
};

const PAGE_SIZE = 8;

const statusStyles: Record<string, string> = {
  Online: 'bg-[#ECFDF3] text-[#34C759]',
  Offline: 'bg-[#F5F5F5] text-[#414651]',
  'In session': 'bg-[#F0F9FF] text-[#026AA2]',
  Disabled: 'bg-[#FEF3F2] text-[#D92D20]',
  Unregistered: 'bg-[#F2F4F7] text-[#98A2B3]',
};

const TYPE_LABELS: Record<string, string> = { WINDOWS: 'Windows', MACOS: 'macOS', LINUX: 'Linux', IOS: 'iOS', ANDROID: 'Android' };
// Form factor derived from the OS/platform (we only store the platform, so a
// laptop can't be told apart from a desktop — both map to "Desktop").
const formFactorOf = (raw?: string) => (['IOS', 'ANDROID'].includes((raw || '').toUpperCase()) ? 'Mobile' : 'Desktop');
const DEVICE_TYPES = ['Desktop', 'Mobile'];
const STATUSES = ['Online', 'Offline', 'In session', 'Disabled', 'Unregistered'];
const LOGINS = ['Today', 'Last 7 days', 'Last 30 days', 'Older'];

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

const relTime = (iso?: string) => {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;
  return `${Math.floor(mo / 12)} year(s) ago`;
};

const fmtDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  return `${date}, ${time}`;
};

const loginBucket = (iso?: string): string => {
  if (!iso) return 'Older';
  const t = new Date(iso); if (Number.isNaN(t.getTime())) return 'Older';
  const now = new Date();
  const days = (now.getTime() - t.getTime()) / 86400000;
  if (t.toDateString() === now.toDateString()) return 'Today';
  if (days <= 7) return 'Last 7 days';
  if (days <= 30) return 'Last 30 days';
  return 'Older';
};

const mapDevice = (d: ApiDevice): Device => ({
  id: d.id,
  name: d.name || 'Unnamed device',
  deviceId: d.deviceId || '',
  type: TYPE_LABELS[(d.type || '').toUpperCase()] || titleCase(d.type || '—'),
  formFactor: formFactorOf(d.type),
  org: d.org || '—',
  userName: d.userName || '—',
  userEmail: d.userEmail || '',
  status: d.status || 'Offline',
  sessions: d.sessions ?? 0,
  lastSeenAgo: relTime(d.lastSeenAt),
  lastSeenAt: fmtDateTime(d.lastSeenAt),
  lastLogin: loginBucket(d.lastSeenAt),
});

const DeviceManagementPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'block' | 'unblock' | 'remove' | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);

  const [fType, setFType] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<string | null>(null);
  const [fLogin, setFLogin] = useState<string | null>(null);
  const [openSec, setOpenSec] = useState({ type: true, status: false, login: false });

  const [menu, setMenu] = useState<'filters' | 'bulk' | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string[] | null>(null);
  const [pendingBlock, setPendingBlock] = useState<string[] | null>(null);
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; top: number; bottom: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/admin/devices');
      setDevices(Array.isArray(data) ? data.map(mapDevice) : []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setError('You do not have permission to view devices.');
      else if (status === 401) setError('Your session has expired. Please sign in again.');
      else setError(err?.response?.data?.error || 'Failed to load devices. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Keep device status fresh (presence/sessions change over time) without flicker.
  useEffect(() => {
    const id = window.setInterval(() => {
      api.get('/api/admin/devices')
        .then((res: { data: ApiDevice[] }) => { if (Array.isArray(res.data)) setDevices(res.data.map(mapDevice)); })
        .catch(() => {});
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (fType && d.formFactor !== fType) return false;
      if (fStatus && d.status !== fStatus) return false;
      if (fLogin && d.lastLogin !== fLogin) return false;
      if (q && !(
        d.name.toLowerCase().includes(q) || d.deviceId.toLowerCase().includes(q) ||
        d.org.toLowerCase().includes(q) || d.userName.toLowerCase().includes(q) || d.userEmail.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [devices, query, fType, fStatus, fLogin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // A new filter or search also drops the selection: rows the admin can no
  // longer see must not ride along into a bulk block or remove.
  useEffect(() => { setPage(1); setSelected({}); }, [query, fType, fStatus, fLogin]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSelected = pageRows.length > 0 && pageRows.every((d) => selected[d.id]);
  const toggleAll = () =>
    setSelected((prev) => { const next = { ...prev }; const target = !allSelected; pageRows.forEach((d) => { next[d.id] = target; }); return next; });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const activeFilterCount = [fType, fStatus, fLogin].filter(Boolean).length;
  const clearAllFilters = () => { setFType(null); setFStatus(null); setFLogin(null); };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(null);
    setRowMenu((cur) => (cur?.id === id ? null : { id, x: r.right, top: r.top, bottom: r.bottom }));
  };

  const exportCsv = (rows: Device[]) => {
    const header = ['Device', 'Device ID', 'Type', 'Organization', 'User', 'Email', 'Status', 'Sessions', 'Last seen'];
    const body = rows.map((d) => [d.name, d.deviceId, d.type, d.org, d.userName, d.userEmail, d.status, String(d.sessions), d.lastSeenAt]);
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open the styled confirm modal; the actual block happens in confirmBlock.
  const blockIds = (ids: string[]) => {
    if (!ids.length) return;
    setMenu(null); setRowMenu(null);
    setPendingBlock(ids);
  };

  const confirmBlock = async () => {
    const ids = pendingBlock;
    if (!ids?.length) return;
    setBusy('block'); setActionError(null);
    try {
      const failure = await runBulk(ids, (id) => api.patch(`/api/admin/devices/${id}`, { status: 'BLOCKED' }), 'devices');
      setSelected({});
      setPendingBlock(null);
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) { setActionError(err?.response?.data?.error || 'Failed to reload devices.'); }
    finally { setBusy(null); }
  };

  // Unblocking is non-destructive, so it runs straight away (no modal). Only
  // devices that are actually Disabled are sent; the rest are left untouched.
  const unblockIds = async (ids: string[]) => {
    const targets = ids.filter((id) => devices.find((d) => d.id === id)?.status === 'Disabled');
    if (!targets.length) return;
    setMenu(null); setRowMenu(null);
    setBusy('unblock'); setActionError(null);
    try {
      const failure = await runBulk(targets, (id) => api.patch(`/api/admin/devices/${id}`, { status: 'OFFLINE' }), 'devices');
      setSelected({});
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) { setActionError(err?.response?.data?.error || 'Failed to reload devices.'); }
    finally { setBusy(null); }
  };
  const anySelectedDisabled = selectedIds.some((id) => devices.find((d) => d.id === id)?.status === 'Disabled');

  // Open the styled confirm modal; the actual delete happens in confirmRemove.
  const removeIds = (ids: string[]) => {
    if (!ids.length) return;
    setMenu(null); setRowMenu(null);
    setPendingRemove(ids);
  };

  const confirmRemove = async () => {
    const ids = pendingRemove;
    if (!ids?.length) return;
    setBusy('remove'); setActionError(null);
    try {
      const failure = await runBulk(ids, (id) => api.delete(`/api/admin/devices/${id}`), 'devices');
      setSelected({});
      setPendingRemove(null);
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) { setActionError(err?.response?.data?.error || 'Failed to reload devices.'); }
    finally { setBusy(null); }
  };

  if (detailDevice) {
    return <DeviceDetailPage device={detailDevice} onBack={() => setDetailDevice(null)} />;
  }

  return (
    <div className="flex flex-col gap-7" ref={rootRef}>
      {/* Title + CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-black">Device Management</h1>
          <p className="mt-1 text-sm text-black/70">All registered agents across every organization — status, owners and live sessions.</p>
        </div>
        <button
          onClick={() => exportCsv(filtered)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
        >
          <Download size={16} /> Export
        </button>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-full items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] px-4 sm:max-w-[370px]">
          <Search size={16} className="text-[rgba(26,29,33,0.4)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search devices..." className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(17,19,21,0.4)]" />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          {/* Filters */}
          <div className="relative">
            <button onClick={() => setMenu((m) => (m === 'filters' ? null : 'filters'))} className={`inline-flex h-10 items-center gap-2 rounded-[4px] border px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] ${menu === 'filters' || activeFilterCount ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)]'}`}>
              <FilterIcon size={16} /> Filters
              {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">{activeFilterCount}</span>}
            </button>
            {menu === 'filters' && (
              <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <button onClick={clearAllFilters} className={`flex w-full items-center justify-between border-b border-[rgba(26,29,33,0.08)] px-4 py-2.5 text-sm font-medium ${activeFilterCount === 0 ? 'text-[#FF8A00]' : 'text-[#111315]'} hover:bg-[#F9FAFB]`}>All Devices</button>
                <FilterSection title="Device type" open={openSec.type} onToggle={() => setOpenSec((s) => ({ ...s, type: !s.type }))} options={DEVICE_TYPES} value={fType} onSelect={(v) => setFType((c) => (c === v ? null : v))} />
                <FilterSection title="Status" open={openSec.status} onToggle={() => setOpenSec((s) => ({ ...s, status: !s.status }))} options={STATUSES} value={fStatus} onSelect={(v) => setFStatus((c) => (c === v ? null : v))} />
                <FilterSection title="Last seen" open={openSec.login} onToggle={() => setOpenSec((s) => ({ ...s, login: !s.login }))} options={LOGINS} value={fLogin} onSelect={(v) => setFLogin((c) => (c === v ? null : v))} />
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="relative">
            <button onClick={() => setMenu((m) => (m === 'bulk' ? null : 'bulk'))} className={`inline-flex h-10 items-center gap-2 rounded-[4px] border px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] ${menu === 'bulk' || selectedIds.length ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)]'}`}>
              Bulk Actions
              {selectedIds.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">{selectedIds.length}</span>}
              <ChevronDown size={16} className={menu === 'bulk' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {menu === 'bulk' && (
              <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <p className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[rgba(17,19,21,0.4)]">{selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select rows to act'}</p>
                <button onClick={() => { setMenu(null); exportCsv(selectedIds.length ? devices.filter((d) => selected[d.id]) : filtered); }} disabled={!!busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB] disabled:opacity-40"><Download size={16} className="text-[rgba(17,19,21,0.6)]" /> Export data</button>
                <button onClick={() => blockIds(selectedIds)} disabled={!selectedIds.length || !!busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40">{busy === 'block' ? <Loader2 size={16} className="animate-spin text-[rgba(17,19,21,0.6)]" /> : <Ban size={16} className="text-[rgba(17,19,21,0.6)]" />} Block devices</button>
                <button onClick={() => unblockIds(selectedIds)} disabled={!anySelectedDisabled || !!busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40">{busy === 'unblock' ? <Loader2 size={16} className="animate-spin text-[rgba(17,19,21,0.6)]" /> : <CheckCircle2 size={16} className="text-[rgba(17,19,21,0.6)]" />} Unblock devices</button>
                <button onClick={() => removeIds(selectedIds)} disabled={!selectedIds.length || !!busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#D92D20] hover:bg-[#FEF3F2] disabled:cursor-not-allowed disabled:opacity-40">{busy === 'remove' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Remove devices</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {actionError && <div className="rounded-[4px] border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-sm text-[#D92D20]">{actionError}</div>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
        <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: '19%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr className="h-11 bg-[#F3F4F6]">
              <th className="px-6 text-left align-middle">
                <div className="flex items-center gap-3">
                  <Checkbox checked={allSelected} onChange={toggleAll} />
                  <span className="text-[12px] font-medium leading-[17px] text-[#111315]">Devices</span>
                </div>
              </th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Device Type</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Organization</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">User name</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Status</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Sessions</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Last seen</th>
              <th className="px-6" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={8} className="px-6 py-12 text-center"><span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading devices…</span></td></tr>
            )}
            {!loading && error && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={8} className="px-6 py-12 text-center"><p className="text-sm text-[#D92D20]">{error}</p><button onClick={load} className="mt-3 inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"><RefreshCw size={14} /> Retry</button></td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={8} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">{devices.length === 0 ? 'No devices yet.' : 'No devices match your filters.'}</td></tr>
            )}
            {!loading && !error && pageRows.map((d) => (
              <tr key={d.id} onClick={() => setDetailDevice(d)} className="h-[72px] cursor-pointer border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                <td className="px-6 align-middle">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={!!selected[d.id]} onChange={() => setSelected((s) => ({ ...s, [d.id]: !s[d.id] }))} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#111315]">{d.name}</p>
                      <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{d.deviceId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 align-middle">
                  <p className="text-sm text-[#111315]">{d.formFactor}</p>
                  <p className="text-xs text-[rgba(17,19,21,0.6)]">{d.type}</p>
                </td>
                <td className="px-6 align-middle text-sm text-[#111315]">{d.org}</td>
                <td className="px-6 text-center align-middle">
                  <p className="truncate text-sm text-[#111315]">{d.userName}</p>
                  {d.userEmail && <p className="truncate text-xs text-[rgba(17,19,21,0.6)]">{d.userEmail}</p>}
                </td>
                <td className="px-6 align-middle">
                  <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${statusStyles[d.status] ?? statusStyles.Offline}`}>{d.status}</span>
                </td>
                <td className="px-6 align-middle text-sm text-[#111315]">{d.sessions || 0}</td>
                <td className="px-6 text-center align-middle">
                  <p className="text-sm text-[#111315]">{d.lastSeenAgo}</p>
                  <p className="text-xs text-[rgba(17,19,21,0.6)]">{d.lastSeenAt}</p>
                </td>
                <td className="px-6 align-middle">
                  <button onClick={(e) => openRowMenu(e, d.id)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] ${rowMenu?.id === d.id ? 'bg-[#F3F4F6]' : ''}`}><MoreVertical size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex h-9 items-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="inline-flex h-9 items-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
          <span className="text-sm text-[rgba(17,19,21,0.6)]">Page {page} of {totalPages}</span>
        </div>
      )}

      {/* Row actions */}
      {rowMenu && (() => {
        const MENU_H = 160;
        const topPos = Math.max(8, Math.min(rowMenu.bottom + 6, window.innerHeight - MENU_H - 8));
        const id = rowMenu.id;
        const dev = devices.find((x) => x.id === id);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
            <div className="fixed z-50 w-44 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl" style={{ top: topPos, left: Math.max(8, rowMenu.x - 176) }}>
              <button onClick={() => { setRowMenu(null); if (dev) setDetailDevice(dev); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB]"><Eye size={16} className="text-[rgba(17,19,21,0.6)]" /> View details</button>
              {dev?.status === 'Disabled' ? (
                <button onClick={() => unblockIds([id])} disabled={!!busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB] disabled:opacity-40"><CheckCircle2 size={16} className="text-[rgba(17,19,21,0.6)]" /> Unblock device</button>
              ) : (
                <button onClick={() => blockIds([id])} disabled={!!busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB] disabled:opacity-40"><Ban size={16} className="text-[rgba(17,19,21,0.6)]" /> Block device</button>
              )}
              <button onClick={() => removeIds([id])} disabled={!!busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#D92D20] hover:bg-[#FEF3F2] disabled:opacity-40"><Trash2 size={16} /> Remove device</button>
            </div>
          </>
        );
      })()}

      {/* Block confirmation */}
      {pendingBlock && (
        <RemoveModal
          icon={Ban}
          title={`Block ${pendingBlock.length} device${pendingBlock.length > 1 ? 's' : ''}?`}
          message="Blocked device(s) can't connect or host sessions until you unblock them."
          confirmLabel="Block"
          loading={busy === 'block'}
          onConfirm={confirmBlock}
          onCancel={() => setPendingBlock(null)}
        />
      )}

      {/* Remove confirmation */}
      {pendingRemove && (
        <RemoveModal
          title={`Remove ${pendingRemove.length} device${pendingRemove.length > 1 ? 's' : ''}?`}
          message="This permanently removes the selected device(s) and all of their sessions from the platform. This action cannot be undone."
          confirmLabel="Remove"
          loading={busy === 'remove'}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
};

const FilterSection: React.FC<{
  title: string; open: boolean; onToggle: () => void; options: readonly string[]; value: string | null; onSelect: (v: string) => void;
}> = ({ title, open, onToggle, options, value, onSelect }) => (
  <div className="border-b border-[rgba(26,29,33,0.06)] last:border-b-0">
    <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-[#111315] hover:bg-[#F9FAFB]">
      {title}
      <ChevronDown size={16} className={`text-[rgba(17,19,21,0.6)] transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
    {open && (
      <div className="pb-1">
        {options.map((opt) => (
          <button key={opt} onClick={() => onSelect(opt)} className="flex w-full items-center justify-between px-4 py-2 text-sm text-[#111315] hover:bg-[#F9FAFB]">
            <span>{opt}</span>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${value === opt ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.4)]'}`}>
              {value === opt && <span className="h-2 w-2 rounded-full bg-[#FF8A00]" />}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);

const Checkbox: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button type="button" onClick={(e) => { e.stopPropagation(); onChange(); }} className={`flex h-[18px] w-[18px] items-center justify-center rounded-[3px] border transition-colors ${checked ? 'border-[#FF8A00] bg-[#FF8A00] text-white' : 'border-[rgba(26,29,33,0.4)] bg-white'}`}>
    {checked && <Check size={12} strokeWidth={3} />}
  </button>
);

export default DeviceManagementPage;
