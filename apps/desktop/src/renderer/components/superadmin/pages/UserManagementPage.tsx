import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Download, MoreVertical, Check, RefreshCw, Loader2, ChevronDown,
  Mail, Trash2, Ban, CheckCircle2, Eye, LogOut,
} from 'lucide-react';
import { FilterIcon } from '../icons';
import { runBulk } from '../bulk';
import ConfirmModal from '../ConfirmModal';
import UserDetailPage from './UserDetailPage';
import api from '../../../lib/api';

/**
 * Super Admin → User Management.
 * Live platform-wide users from GET /api/admin/users (super admins excluded
 * server-side). Filters (role / status / last login), bulk actions and a
 * per-row action menu (view / email / activate / force-logout / suspend / delete).
 */

type ApiUser = {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  organization?: string | null;
  organizationId?: string | null;
  status?: string;
  createdAt: string;
  lastActive?: string;
  orgSuspended?: boolean;
};

type User = {
  id: string;
  name: string;
  email: string;
  org: string;
  organizationId: string | null;
  role: string;
  status: 'Active' | 'Suspended';
  created: string;
  lastActiveMs: number;
  // Blocked by a suspended organization: their own flag may be ACTIVE, so
  // "Activate User" cannot help — the organization must be activated instead.
  orgSuspended: boolean;
};

type BulkAction = 'email' | 'delete' | 'suspend' | 'activate' | 'logout';

const PAGE_SIZE = 8;

const ROLE_OPTIONS = ['Admin', 'Owner', 'Viewer'] as const;
// 'Locked' and 'Never Login' removed — the backend exposes no lock flag and no
// true last-login timestamp yet, so those options always returned nothing.
const STATUS_OPTIONS = ['Active', 'Inactive', 'Suspended'] as const;
const LOGIN_OPTIONS = ['Today', 'Last 7 Days', 'Last 30 Days'] as const;

const statusStyles: Record<User['status'], string> = {
  Active: 'bg-[#ECFDF3] text-[#34C759]',
  Suspended: 'bg-[#FEF3F2] text-[#D92D20]',
};

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
};
const initials = (s: string) => (s || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

const mapUser = (u: ApiUser): User => ({
  id: u.id,
  name: u.name || u.email.split('@')[0],
  email: u.email,
  org: u.organization || '—',
  organizationId: u.organizationId ?? null,
  role: titleCase(u.role || 'Viewer'),
  status: (u.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ? 'Suspended' : 'Active',
  created: formatDate(u.createdAt),
  lastActiveMs: u.lastActive ? new Date(u.lastActive).getTime() : NaN,
  orgSuspended: !!u.orgSuspended,
});

const UserManagementPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // filters
  const [fRole, setFRole] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<string | null>(null);
  const [fLogin, setFLogin] = useState<string | null>(null);
  const [openSec, setOpenSec] = useState({ role: true, status: false, login: false });

  const [menu, setMenu] = useState<'filters' | 'bulk' | null>(null);
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; top: number; bottom: number } | null>(null);
  const [busy, setBusy] = useState<BulkAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ variant: 'suspend' | 'delete' | 'activate'; title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiUser[]>('/api/admin/users');
      setUsers(Array.isArray(data) ? data.map(mapUser) : []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setError('You do not have permission to view users.');
      else if (status === 401) setError('Your session has expired. Please sign in again.');
      else setError(err?.response?.data?.error || 'Failed to load users. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const startToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    return users.filter((u) => {
      if (fRole && u.role !== fRole) return false;
      if (fStatus) {
        if (fStatus === 'Active' && u.status !== 'Active') return false;
        if (fStatus === 'Suspended' && u.status !== 'Suspended') return false;
        // Inactive = no successful login in 30+ days, including never.
        // ("Locked" was removed — the backend has no lock signal.)
        if (fStatus === 'Inactive' && Number.isFinite(u.lastActiveMs) && u.lastActiveMs >= now - 30 * 86400000) return false;
      }
      if (fLogin) {
        const t = u.lastActiveMs;
        if (fLogin === 'Today' && !(Number.isFinite(t) && t >= startToday)) return false;
        if (fLogin === 'Last 7 Days' && !(Number.isFinite(t) && t >= now - 7 * 86400000)) return false;
        if (fLogin === 'Last 30 Days' && !(Number.isFinite(t) && t >= now - 30 * 86400000)) return false;
      }
      if (q && !(u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.org.toLowerCase().includes(q) || u.role.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [users, query, fRole, fStatus, fLogin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // A new filter or search also drops the selection: rows the admin can no
  // longer see must not ride along into a bulk suspend or delete.
  useEffect(() => { setPage(1); setSelected({}); }, [query, fRole, fStatus, fLogin]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSelected = pageRows.length > 0 && pageRows.every((u) => selected[u.id]);
  const toggleAll = () =>
    setSelected((prev) => {
      const next = { ...prev };
      const target = !allSelected;
      pageRows.forEach((u) => { next[u.id] = target; });
      return next;
    });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedCount = selectedIds.length;
  const activeFilterCount = [fRole, fStatus, fLogin].filter(Boolean).length;
  const clearAllFilters = () => { setFRole(null); setFStatus(null); setFLogin(null); };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(null);
    setRowMenu((cur) => (cur?.id === id ? null : { id, x: r.right, top: r.top, bottom: r.bottom }));
  };

  const exportCsv = (list: User[]) => {
    const header = ['Name', 'Email', 'Organization', 'Role', 'Status', 'Created'];
    const body = list.map((u) => [u.name, u.email, u.org, u.role, u.status, u.created]);
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeMenus = () => { setMenu(null); setRowMenu(null); };

  const runStatus = async (status: 'ACTIVE' | 'SUSPENDED', ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setBusy(status === 'ACTIVE' ? 'activate' : 'suspend');
    setActionError(null);
    try {
      const failure = await runBulk(ids, (id) => api.patch(`/api/admin/users/${id}`, { status }), 'users');
      setSelected({});
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to reload users.');
    } finally {
      setBusy(null); closeMenus(); setConfirmModal(null);
    }
  };

  const deleteUsers = async (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setBusy('delete');
    setActionError(null);
    try {
      const failure = await runBulk(ids, (id) => api.delete(`/api/admin/users/${id}`), 'users');
      setSelected({});
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to reload users.');
    } finally {
      setBusy(null); closeMenus(); setConfirmModal(null);
    }
  };

  const sendEmail = (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const emails = Array.from(new Set(users.filter((u) => idSet.has(u.id)).map((u) => u.email).filter(Boolean)));
    closeMenus();
    if (!emails.length) { setActionError('No email addresses found for the selected users.'); return; }
    const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}`;
    if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(mailto);
    else window.location.href = mailto;
  };

  const forceLogout = async (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setBusy('logout');
    setActionError(null);
    setNotice(null);
    try {
      const failure = await runBulk(ids, (id) => api.post(`/api/admin/users/${id}/force-logout`), 'users');
      if (failure) setActionError(failure);
      else setNotice(ids.length > 1 ? `${ids.length} users will be signed out.` : 'User will be signed out.');
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to force logout.');
    } finally {
      setBusy(null); closeMenus();
    }
  };

  const viewDetails = (u: User) => { closeMenus(); setDetailUser(u); };

  const askSuspend = (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    closeMenus();
    const many = ids.length > 1;
    setConfirmModal({
      variant: 'suspend',
      title: many ? `Suspend ${ids.length} users?` : 'Suspend User?',
      message: many ? `This signs out and blocks these ${ids.length} users until you reactivate them.` : 'This signs out and blocks the user until you reactivate them.',
      confirmLabel: 'Suspend',
      onConfirm: () => runStatus('SUSPENDED', ids),
    });
  };

  const askActivate = (requested: string[] = selectedIds) => {
    // A member of a suspended organization stays blocked whatever their own
    // flag says — activating them here would "succeed" and change nothing.
    const ids = requested.filter((id) => !users.find((x) => x.id === id)?.orgSuspended);
    if (requested.length && !ids.length) {
      closeMenus();
      setActionError('These users are blocked by a suspended organization — activate the organization instead.');
      return;
    }
    if (!ids.length) return;
    closeMenus();
    setConfirmModal({
      variant: 'activate',
      title: ids.length > 1 ? `Activate ${ids.length} users?` : 'Activate User?',
      message: ids.length > 1 ? `This restores access for these ${ids.length} users.` : 'This restores access for the user.',
      confirmLabel: 'Activate',
      onConfirm: () => runStatus('ACTIVE', ids),
    });
  };

  const askDelete = (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    closeMenus();
    const many = ids.length > 1;
    setConfirmModal({
      variant: 'delete',
      title: many ? `Delete ${ids.length} users?` : 'Delete User?',
      message: many ? `This deletes these ${ids.length} users, removes them from the list and signs them out.` : 'This deletes the user, removes them from the list and signs them out.',
      confirmLabel: 'Delete',
      onConfirm: () => deleteUsers(ids),
    });
  };

  // User detail takes over the page until dismissed.
  if (detailUser) {
    return <UserDetailPage user={detailUser} onBack={() => setDetailUser(null)} onChanged={load} />;
  }

  return (
    <div className="flex flex-col gap-7" ref={rootRef}>
      {/* Title + CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-black">User Management</h1>
          <p className="mt-1 text-sm text-black/70">Search and manage every user across all organizations on the platform.</p>
        </div>
        <button
          onClick={() => exportCsv(filtered)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-full items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] px-4 sm:max-w-[370px]">
          <Search size={16} className="text-[rgba(26,29,33,0.4)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Users..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(17,19,21,0.4)]"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Filters */}
          <div className="relative">
            <button
              onClick={() => setMenu((m) => (m === 'filters' ? null : 'filters'))}
              className={`inline-flex h-10 items-center gap-2 rounded-[4px] border px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] ${
                menu === 'filters' || activeFilterCount ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)]'
              }`}
            >
              <FilterIcon size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">{activeFilterCount}</span>
              )}
            </button>
            {menu === 'filters' && (
              <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <button
                  onClick={clearAllFilters}
                  className={`flex w-full items-center justify-between border-b border-[rgba(26,29,33,0.08)] px-4 py-2.5 text-sm font-medium ${activeFilterCount === 0 ? 'text-[#FF8A00]' : 'text-[#111315]'} hover:bg-[#F9FAFB]`}
                >
                  All Users
                </button>
                <FilterSection title="Assigned Role" open={openSec.role} onToggle={() => setOpenSec((s) => ({ ...s, role: !s.role }))} options={ROLE_OPTIONS} value={fRole} onSelect={(v) => setFRole((c) => (c === v ? null : v))} />
                <FilterSection title="Status" open={openSec.status} onToggle={() => setOpenSec((s) => ({ ...s, status: !s.status }))} options={STATUS_OPTIONS} value={fStatus} onSelect={(v) => setFStatus((c) => (c === v ? null : v))} />
                <FilterSection title="Last Login" open={openSec.login} onToggle={() => setOpenSec((s) => ({ ...s, login: !s.login }))} options={LOGIN_OPTIONS} value={fLogin} onSelect={(v) => setFLogin((c) => (c === v ? null : v))} />
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="relative">
            <button
              onClick={() => setMenu((m) => (m === 'bulk' ? null : 'bulk'))}
              className={`inline-flex h-10 items-center gap-2 rounded-[4px] border px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] ${menu === 'bulk' || selectedCount ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)]'}`}
            >
              Bulk Actions
              {selectedCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">{selectedCount}</span>
              )}
              <ChevronDown size={16} className={menu === 'bulk' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {menu === 'bulk' && (
              <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <p className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[rgba(17,19,21,0.4)]">{selectedCount > 0 ? `${selectedCount} selected` : 'Select Rows To Act'}</p>
                <BulkItem icon={Mail} label="Send Email" onClick={() => sendEmail()} disabled={!selectedCount || !!busy} />
                <BulkItem icon={Trash2} label="Delete" onClick={() => askDelete()} disabled={!selectedCount || !!busy} loading={busy === 'delete'} danger />
                <BulkItem icon={Download} label="Export Data" onClick={() => { setMenu(null); exportCsv(selectedCount ? users.filter((u) => selected[u.id]) : filtered); }} disabled={!!busy} />
                <BulkItem icon={Ban} label="Suspend" onClick={() => askSuspend()} disabled={!selectedCount || !!busy} loading={busy === 'suspend'} />
                <BulkItem icon={CheckCircle2} label="Activate" onClick={() => askActivate()} disabled={!selectedCount || !!busy} loading={busy === 'activate'} />
              </div>
            )}
          </div>
        </div>
      </div>

      {actionError && <div className="rounded-[4px] border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-sm text-[#D92D20]">{actionError}</div>}
      {notice && <div className="rounded-[4px] border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3 text-sm text-[#039855]">{notice}</div>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
        <table className="w-full min-w-[840px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: '31%' }} />
            <col style={{ width: '21%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '7%' }} />
          </colgroup>
          <thead>
            <tr className="h-11 bg-[#F3F4F6]">
              <th className="px-6 text-left align-middle">
                <div className="flex items-center gap-3">
                  <Checkbox checked={allSelected} onChange={toggleAll} />
                  <span className="text-[12px] font-medium leading-[17px] text-[#111315]">Name</span>
                </div>
              </th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Organization</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Role</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Status</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Created</th>
              <th className="px-6" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={6} className="px-6 py-12 text-center"><span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading Users…</span></td></tr>
            )}
            {!loading && error && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={6} className="px-6 py-12 text-center"><p className="text-sm text-[#D92D20]">{error}</p><button onClick={load} className="mt-3 inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"><RefreshCw size={14} /> Retry</button></td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={6} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">{users.length === 0 ? 'No users yet.' : 'No users match your filters.'}</td></tr>
            )}
            {!loading && !error && pageRows.map((u) => (
              <tr key={u.id} onClick={() => setDetailUser(u)} className="h-[72px] cursor-pointer border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                <td className="px-6 align-middle">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={!!selected[u.id]} onChange={() => setSelected((s) => ({ ...s, [u.id]: !s[u.id] }))} />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">{initials(u.name)}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#111315]">{u.name}</p>
                      <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 align-middle text-sm text-[#111315]">{u.org}</td>
                <td className="px-6 align-middle text-sm text-[#111315]">{u.role}</td>
                <td className="px-6 align-middle">
                  <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${statusStyles[u.status]}`}>{u.orgSuspended ? 'Suspended (Org)' : u.status}</span>
                </td>
                <td className="px-6 align-middle text-sm text-[#111315]">{u.created}</td>
                <td className="px-6 align-middle" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => openRowMenu(e, u.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] ${rowMenu?.id === u.id ? 'bg-[#F3F4F6]' : ''}`}
                  >
                    <MoreVertical size={18} />
                  </button>
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

      {/* Row actions menu */}
      {rowMenu && (() => {
        const MENU_H = 268;
        const topPos = Math.max(8, Math.min(rowMenu.bottom + 6, window.innerHeight - MENU_H - 8));
        const u = users.find((x) => x.id === rowMenu.id);
        const id = rowMenu.id;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
            <div className="fixed z-50 w-52 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl" style={{ top: topPos, left: Math.max(8, rowMenu.x - 208) }}>
              <BulkItem icon={Eye} label="View Details" onClick={() => { if (u) viewDetails(u); }} disabled={!!busy} />
              <BulkItem icon={Mail} label="Send Email" onClick={() => sendEmail([id])} disabled={!!busy} />
              <BulkItem icon={CheckCircle2} label={u?.orgSuspended ? 'Activate User (Organization Suspended)' : 'Activate User'} onClick={() => askActivate([id])} disabled={!!busy || u?.status === 'Active' || !!u?.orgSuspended} loading={busy === 'activate'} />
              <BulkItem icon={LogOut} label="Force Logout User" onClick={() => forceLogout([id])} disabled={!!busy} loading={busy === 'logout'} />
              <BulkItem icon={Ban} label="Suspend User" onClick={() => askSuspend([id])} disabled={!!busy || u?.status === 'Suspended'} loading={busy === 'suspend'} />
              <BulkItem icon={Trash2} label="Delete User" danger onClick={() => askDelete([id])} disabled={!!busy} loading={busy === 'delete'} />
            </div>
          </>
        );
      })()}

      {confirmModal && (
        <ConfirmModal
          variant={confirmModal.variant}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          loading={!!busy}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
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

const BulkItem: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; onClick: () => void; disabled?: boolean; loading?: boolean; danger?: boolean;
}> = ({ icon: Icon, label, onClick, disabled, loading, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'text-[#D92D20] hover:bg-[#FEF3F2]' : 'text-[#111315]'}`}
  >
    {loading ? <Loader2 size={16} className="animate-spin text-[rgba(17,19,21,0.6)]" /> : <Icon size={16} className={danger ? 'text-[#D92D20]' : 'text-[rgba(17,19,21,0.6)]'} />}
    {label}
  </button>
);

const Checkbox: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`flex h-[18px] w-[18px] items-center justify-center rounded-[3px] border transition-colors ${checked ? 'border-[#FF8A00] bg-[#FF8A00] text-white' : 'border-[rgba(26,29,33,0.4)] bg-white'}`}
  >
    {checked && <Check size={12} strokeWidth={3} />}
  </button>
);

export default UserManagementPage;
