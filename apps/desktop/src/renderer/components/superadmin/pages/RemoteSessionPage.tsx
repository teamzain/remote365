import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Download, MoreVertical, Check, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { runBulk } from '../bulk';

/**
 * Super Admin → Remote Session Management.
 * Live platform-wide remote sessions from GET /api/admin/remote-sessions
 * (platform `sessions:monitorAll`), with delete / export bulk actions.
 */

type Session = {
  id: string;
  code: string;
  name: string;
  type: string;
  host: string;
  hostEmail: string;
  org: string;
  participants: number;
  status: 'Live' | 'Connecting' | 'Pending' | 'Expired' | 'Ended';
  duration: string;
  startedDate: string;
  startedTime: string;
};

type ApiSession = {
  id: string;
  code?: string;
  name?: string | null;
  type?: string;
  host?: string | null;
  hostEmail?: string | null;
  org?: string | null;
  participants?: number;
  status?: string;
  createdAt?: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

const PAGE_SIZE = 8;

const statusStyles: Record<string, string> = {
  Live: 'bg-[#ECFDF3] text-[#34C759]',
  Connecting: 'bg-[#F0F9FF] text-[#026AA2]',
  Pending: 'bg-[#FFF6ED] text-[#FF8A00]',
  Expired: 'bg-[#F2F4F7] text-[#98A2B3]',
  Ended: 'bg-[#F5F5F5] text-[#414651]',
};

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

const typeLabel = (t?: string) => {
  const u = (t || '').toUpperCase();
  if (u === 'VIDEO_MEETING') return 'Video Meeting';
  if (u === 'REMOTE_CONTROL') return 'Remote Control';
  return titleCase(t || '—');
};

const statusLabel = (s?: string): Session['status'] => {
  const u = (s || '').toUpperCase();
  if (u === 'ACTIVE' || u === 'CONNECTED') return 'Live';
  if (u === 'ENDED' || u === 'COMPLETED') return 'Ended';
  // Backend-derived states: a grant nobody has connected to yet, and one whose
  // link lapsed unused. Both used to fall through to "Ended".
  if (u === 'PENDING') return 'Pending';
  if (u === 'EXPIRED') return 'Expired';
  if (['CONNECTING', 'QUEUED', 'RINGING', 'CREATED', 'ASSIGNED'].includes(u)) return 'Connecting';
  return 'Ended';
};

const durationStr = (started?: string | null, ended?: string | null) => {
  if (!started) return '—';
  const s = new Date(started).getTime();
  if (Number.isNaN(s)) return '—';
  const e = ended ? new Date(ended).getTime() : Date.now();
  let sec = Math.max(0, Math.floor((e - s) / 1000));
  const h = Math.floor(sec / 3600); sec %= 3600;
  const m = Math.floor(sec / 60); const ss = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const mapSession = (s: ApiSession): Session => {
  const when = s.startedAt || s.createdAt;
  const d = when ? new Date(when) : null;
  return {
    id: s.id,
    code: s.code || s.id.slice(0, 8),
    name: s.name || '',
    type: typeLabel(s.type),
    host: s.host || '—',
    hostEmail: s.hostEmail || '',
    org: s.org || '—',
    participants: s.participants ?? 0,
    status: statusLabel(s.status),
    duration: durationStr(s.startedAt, s.endedAt),
    startedDate: d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) : '—',
    startedTime: d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '',
  };
};

const RemoteSessionPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<'bulk' | null>(null);
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; top: number; bottom: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiSession[]>('/api/admin/remote-sessions');
      setSessions(Array.isArray(data) ? data.map(mapSession) : []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setError('You do not have permission to view remote sessions.');
      else if (status === 401) setError('Your session has expired. Please sign in again.');
      else setError(err?.response?.data?.error || 'Failed to load remote sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    // `name` is what global search seeds for a named meeting — without it here
    // that hand-off landed on "No sessions match your search."
    return sessions.filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.host.toLowerCase().includes(q) || s.hostEmail.toLowerCase().includes(q) || s.org.toLowerCase().includes(q) || s.type.toLowerCase().includes(q));
  }, [sessions, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // A new search also drops the selection: rows the admin can no longer see
  // must not ride along into a bulk delete.
  useEffect(() => { setPage(1); setSelected({}); }, [query]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSelected = pageRows.length > 0 && pageRows.every((s) => selected[s.id]);
  const toggleAll = () => setSelected((prev) => { const next = { ...prev }; const target = !allSelected; pageRows.forEach((s) => { next[s.id] = target; }); return next; });
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(null);
    setRowMenu((cur) => (cur?.id === id ? null : { id, x: r.right, top: r.top, bottom: r.bottom }));
  };

  const exportCsv = (rows: Session[]) => {
    const header = ['Session', 'Name', 'Type', 'Host', 'Host Email', 'Organization', 'Participants', 'Status', 'Duration', 'Started'];
    const body = rows.map((s) => [s.code, s.name, s.type, s.host, s.hostEmail, s.org, String(s.participants), s.status, s.duration, `${s.startedDate} ${s.startedTime}`]);
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'remote-sessions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteIds = async (ids: string[]) => {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} session${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) { setMenu(null); setRowMenu(null); return; }
    setBusy(true); setActionError(null);
    try {
      const failure = await runBulk(ids, (id) => api.delete(`/api/admin/remote-sessions/${id}`), 'sessions');
      setSelected({});
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) { setActionError(err?.response?.data?.error || 'Failed to reload sessions.'); }
    finally { setBusy(false); setMenu(null); setRowMenu(null); }
  };

  return (
    <div className="flex flex-col gap-7" ref={rootRef}>
      {/* Title + CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-black">Remote Session Management</h1>
          <p className="mt-1 text-sm text-black/70">Monitor and manage remote sessions across the entire platform.</p>
        </div>
        <button onClick={() => exportCsv(filtered)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white" style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}>
          <Download size={16} /> Export
        </button>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-full items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] px-4 sm:max-w-[370px]">
          <Search size={16} className="text-[rgba(26,29,33,0.4)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Sessions..." className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(17,19,21,0.4)]" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="relative">
            <button onClick={() => setMenu((m) => (m === 'bulk' ? null : 'bulk'))} className={`inline-flex h-10 items-center gap-2 rounded-[4px] border px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] ${menu === 'bulk' || selectedIds.length ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)]'}`}>
              Bulk Actions
              {selectedIds.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">{selectedIds.length}</span>}
              <ChevronDown size={16} className={menu === 'bulk' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {menu === 'bulk' && (
              <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <p className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[rgba(17,19,21,0.4)]">{selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select Rows To Act'}</p>
                <button onClick={() => deleteIds(selectedIds)} disabled={!selectedIds.length || busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#D92D20] hover:bg-[#FEF3F2] disabled:cursor-not-allowed disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete</button>
                <button onClick={() => { setMenu(null); exportCsv(selectedIds.length ? sessions.filter((s) => selected[s.id]) : filtered); }} disabled={busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB] disabled:opacity-40"><Download size={16} className="text-[rgba(17,19,21,0.6)]" /> Export Data</button>
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
            <col style={{ width: '18%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr className="h-11 bg-[#F3F4F6]">
              <th className="px-6 text-left align-middle">
                <div className="flex items-center gap-3">
                  <Checkbox checked={allSelected} onChange={toggleAll} />
                  <span className="text-[12px] font-medium leading-[17px] text-[#111315]">Session</span>
                </div>
              </th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Host</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Organization</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Participants</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Status</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Duration</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Started</th>
              <th className="px-6" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={8} className="px-6 py-12 text-center"><span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading Sessions…</span></td></tr>
            )}
            {!loading && error && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={8} className="px-6 py-12 text-center"><p className="text-sm text-[#D92D20]">{error}</p><button onClick={load} className="mt-3 inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"><RefreshCw size={14} /> Retry</button></td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={8} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">{sessions.length === 0 ? 'No remote sessions yet.' : 'No sessions match your search.'}</td></tr>
            )}
            {!loading && !error && pageRows.map((s) => (
              <tr key={s.id} className="h-[72px] border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                <td className="px-6 align-middle">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={!!selected[s.id]} onChange={() => setSelected((p) => ({ ...p, [s.id]: !p[s.id] }))} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#111315]">{s.name || s.code}</p>
                      <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{s.name ? `${s.code} · ${s.type}` : s.type}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 align-middle">
                  <p className="truncate text-sm text-[#111315]">{s.host}</p>
                  {s.hostEmail && <p className="truncate text-xs text-[rgba(17,19,21,0.6)]">{s.hostEmail}</p>}
                </td>
                <td className="px-6 align-middle text-sm text-[#111315]">{s.org}</td>
                <td className="px-6 align-middle text-sm text-[#111315]">{s.participants}</td>
                <td className="px-6 align-middle">
                  <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${statusStyles[s.status] ?? statusStyles.Ended}`}>{s.status}</span>
                </td>
                <td className="px-6 align-middle text-sm tabular-nums text-[#111315]">{s.duration}</td>
                <td className="px-6 align-middle">
                  <p className="text-sm text-[#111315]">{s.startedDate}</p>
                  <p className="text-xs text-[rgba(17,19,21,0.6)]">{s.startedTime}</p>
                </td>
                <td className="px-6 align-middle">
                  <button onClick={(e) => openRowMenu(e, s.id)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] ${rowMenu?.id === s.id ? 'bg-[#F3F4F6]' : ''}`}><MoreVertical size={18} /></button>
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
        const MENU_H = 60;
        const topPos = Math.max(8, Math.min(rowMenu.bottom + 6, window.innerHeight - MENU_H - 8));
        const id = rowMenu.id;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
            <div className="fixed z-50 w-44 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl" style={{ top: topPos, left: Math.max(8, rowMenu.x - 176) }}>
              <button onClick={() => deleteIds([id])} disabled={busy} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#D92D20] hover:bg-[#FEF3F2] disabled:opacity-40"><Trash2 size={16} /> Delete Session</button>
            </div>
          </>
        );
      })()}
    </div>
  );
};

const Checkbox: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button type="button" onClick={onChange} className={`flex h-[18px] w-[18px] items-center justify-center rounded-[3px] border transition-colors ${checked ? 'border-[#FF8A00] bg-[#FF8A00] text-white' : 'border-[rgba(26,29,33,0.4)] bg-white'}`}>
    {checked && <Check size={12} strokeWidth={3} />}
  </button>
);

export default RemoteSessionPage;
