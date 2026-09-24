import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ChevronDown, Download, MoreVertical, Check, RefreshCw, Loader2,
  Mail, Trash2, Ban, CheckCircle2, Activity, Eye,
} from 'lucide-react';
import { FilterIcon } from '../icons';
import { runBulk } from '../bulk';
import DatePicker from '../DatePicker';
import ConfirmModal from '../ConfirmModal';
import ActivityLogsPage from './ActivityLogsPage';
import OrganizationDetailPage from './OrganizationDetailPage';
import api from '../../../lib/api';

/**
 * Super Admin → Organizations.
 * Live data from GET /api/organizations (platform `organizations:viewAll`).
 * The list endpoint returns: id, name, slug, status, createdAt, _count.{users,devices}
 * and a derived `plan` (from the owning subscription).
 *
 * Bulk actions (operate on the checkbox selection):
 *  - Send email  → opens the OS mail client (bcc) to the selected orgs' members
 *  - Delete      → DELETE /api/organizations/:id
 *  - Export data → client-side CSV download
 *  - Suspend     → PATCH /api/organizations/:id { status: 'SUSPENDED' }
 *  - Activate    → PATCH /api/organizations/:id { status: 'ACTIVE' }
 *
 * Filters (Plan / Status) and pagination are applied client-side.
 */

type ApiOrg = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  createdAt: string;
  plan?: string;
  planName?: string | null;
  owner?: { name?: string | null; email?: string | null } | null;
  limits?: { users?: number | null; devices?: number | null };
  _count?: { users?: number; devices?: number };
};

type Org = {
  id: string;
  name: string;
  domain: string;
  plan: string;
  ownerName: string;
  ownerEmail: string;
  members: number;
  membersLimit: number | null;
  devices: number;
  devicesLimit: number | null;
  status: 'Active' | 'Suspended' | 'Deleted';
  created: string;
  createdAtMs: number;
};

type BulkAction = 'email' | 'delete' | 'suspend' | 'activate';

const PAGE_SIZE = 8;

const PLAN_OPTIONS = ['Trial', 'Solo', 'Pro', 'Business', 'Enterprise'] as const;
const STATUS_OPTIONS: Org['status'][] = ['Active', 'Suspended', 'Deleted'];


const statusStyles: Record<Org['status'], string> = {
  Active: 'bg-[#ECFDF3] text-[#34C759]',
  Suspended: 'bg-[#FEF3F2] text-[#D92D20]',
  Deleted: 'bg-[#F5F5F5] text-[#414651]',
};

// Plan tiers rendered as colored badges (like Status).
const planStyles: Record<string, string> = {
  Trial: 'bg-[#FFF6ED] text-[#FF8A00]',
  Solo: 'bg-[#EFF8FF] text-[#175CD3]',
  Pro: 'bg-[#F9F5FF] text-[#7F56D9]',
  Business: 'bg-[#F8F9FC] text-[#363F72]',
  Enterprise: 'bg-[#ECFDF3] text-[#039855]',
};
const planBadge = (plan: string) => planStyles[plan] ?? 'bg-[#F5F5F5] text-[#414651]';

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
};

const mapOrg = (o: ApiOrg): Org => {
  const plan = o.planName || (o.plan ? titleCase(o.plan) : '—');
  const rawStatus = (o.status || 'ACTIVE').toUpperCase();
  const status: Org['status'] = rawStatus === 'DELETED' ? 'Deleted' : rawStatus === 'SUSPENDED' ? 'Suspended' : 'Active';
  return {
    id: o.id,
    name: o.name,
    domain: o.slug,
    plan,
    ownerName: o.owner?.name || '—',
    ownerEmail: o.owner?.email || '',
    members: o._count?.users ?? 0,
    membersLimit: o.limits?.users ?? null,
    devices: o._count?.devices ?? 0,
    devicesLimit: o.limits?.devices ?? null,
    status,
    created: formatDate(o.createdAt),
    createdAtMs: new Date(o.createdAt).getTime(),
  };
};

const startOfDayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const quota = (used: number, limit: number | null) => (limit == null ? String(used) : `${used}/${limit}`);

const OrganizationsPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // filters
  const [fPlan, setFPlan] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<Org['status'] | null>(null);
  const [fCreated, setFCreated] = useState<Date | null>(null);
  const [openSec, setOpenSec] = useState({ plan: true, status: false, created: false });

  // pagination
  const [page, setPage] = useState(1);

  // open menus + bulk action state
  const [menu, setMenu] = useState<'filters' | 'bulk' | null>(null);
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; top: number; bottom: number } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ variant: 'suspend' | 'delete' | 'activate'; title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const [activityOrg, setActivityOrg] = useState<Org | null>(null);
  const [detailOrg, setDetailOrg] = useState<Org | null>(null);
  const [busy, setBusy] = useState<BulkAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiOrg[]>('/api/organizations');
      setOrgs(Array.isArray(data) ? data.map(mapOrg) : []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setError('You do not have permission to view organizations.');
      else if (status === 401) setError('Your session has expired. Please sign in again.');
      else setError(err?.response?.data?.error || 'Failed to load organizations. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const createdFromMs = fCreated ? startOfDayMs(fCreated) : null;
    return orgs.filter((o) => {
      if (fPlan && o.plan !== fPlan) return false;
      if (fStatus && o.status !== fStatus) return false;
      if (createdFromMs != null && !(o.createdAtMs >= createdFromMs)) return false;
      if (q && !(o.name.toLowerCase().includes(q) || o.domain.toLowerCase().includes(q) || o.plan.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [orgs, query, fPlan, fStatus, fCreated]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // keep page in range when filters/data change
  // A new filter or search also drops the selection: rows the admin can no
  // longer see must not ride along into a bulk suspend or delete.
  useEffect(() => { setPage(1); setSelected({}); }, [query, fPlan, fStatus, fCreated]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSelected = pageRows.length > 0 && pageRows.every((o) => selected[o.id]);
  const toggleAll = () =>
    setSelected((prev) => {
      const next = { ...prev };
      const target = !allSelected;
      pageRows.forEach((o) => { next[o.id] = target; });
      return next;
    });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedCount = selectedIds.length;
  const activeFilterCount = [fPlan, fStatus, fCreated].filter(Boolean).length;

  const clearAllFilters = () => { setFPlan(null); setFStatus(null); setFCreated(null); };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(null);
    setRowMenu((cur) => (cur?.id === id ? null : { id, x: r.right, top: r.top, bottom: r.bottom }));
  };

  // --- bulk actions ---
  const exportCsv = (list: Org[]) => {
    const header = ['Organization', 'Domain', 'Owner', 'Owner Email', 'Plan', 'Users', 'Devices', 'Status', 'Created'];
    const body = list.map((o) => [o.name, o.domain, o.ownerName, o.ownerEmail, o.plan, quota(o.members, o.membersLimit), quota(o.devices, o.devicesLimit), o.status, o.created]);
    const csv = [header, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'organizations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runStatus = async (status: 'ACTIVE' | 'SUSPENDED', ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setBusy(status === 'ACTIVE' ? 'activate' : 'suspend');
    setActionError(null);
    try {
      const failure = await runBulk(ids, (id) => api.patch(`/api/organizations/${id}`, { status }), 'organizations');
      setSelected({});
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to reload organizations.');
    } finally {
      setBusy(null);
      setMenu(null);
      setRowMenu(null);
      setConfirmModal(null);
    }
  };

  // Disruptive/irreversible actions confirm via a modal first.
  const askSuspend = (ids: string[]) => {
    if (!ids.length) return;
    setMenu(null);
    setRowMenu(null);
    const many = ids.length > 1;
    setConfirmModal({
      variant: 'suspend',
      title: many ? `Suspend ${ids.length} organizations?` : 'Suspend Organization?',
      message: many
        ? `This signs out and blocks all members of these ${ids.length} organizations until you reactivate them.`
        : "This signs out and blocks the organization's members until you reactivate it.",
      confirmLabel: 'Suspend',
      onConfirm: () => runStatus('SUSPENDED', ids),
    });
  };

  const askActivate = (ids: string[]) => {
    if (!ids.length) return;
    setMenu(null);
    setRowMenu(null);
    const many = ids.length > 1;
    setConfirmModal({
      variant: 'activate',
      title: many ? `Activate ${ids.length} organizations?` : 'Activate Organization?',
      message: many
        ? `This restores access for all members of these ${ids.length} organizations.`
        : "This restores access for the organization's members.",
      confirmLabel: 'Activate',
      onConfirm: () => runStatus('ACTIVE', ids),
    });
  };

  const askDelete = (ids: string[]) => {
    if (!ids.length) return;
    setMenu(null);
    setRowMenu(null);
    const many = ids.length > 1;
    setConfirmModal({
      variant: 'delete',
      title: many ? `Delete ${ids.length} organizations?` : 'Delete Organization?',
      message: many
        ? `This marks these ${ids.length} organizations as deleted and signs out their members. You can restore them later by activating them.`
        : 'This marks the organization as deleted and signs out its members. You can restore it later by activating it.',
      confirmLabel: 'Delete',
      onConfirm: () => deleteOrgs(ids),
    });
  };

  const deleteOrgs = async (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setBusy('delete');
    setActionError(null);
    try {
      const failure = await runBulk(ids, (id) => api.delete(`/api/organizations/${id}`), 'organizations');
      setSelected({});
      await load();
      if (failure) setActionError(failure);
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to reload organizations.');
    } finally {
      setBusy(null);
      setMenu(null);
      setRowMenu(null);
      setConfirmModal(null);
    }
  };

  const sendEmail = async (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setBusy('email');
    setActionError(null);
    try {
      type OrgDetail = { data: { users?: { email?: string }[] } };
      const details: OrgDetail[] = await Promise.all(
        ids.map((id) => api.get<{ users?: { email?: string }[] }>(`/api/organizations/${id}`)),
      );
      const emails = Array.from(
        new Set(
          details
            .flatMap((d: OrgDetail) => (d.data.users || []).map((u: { email?: string }) => u.email))
            .filter((e): e is string => !!e),
        ),
      );
      if (!emails.length) {
        setActionError('No member emails found for the selected organizations.');
        return;
      }
      const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}`;
      if ((window as any).electronAPI?.openExternal) {
        await (window as any).electronAPI.openExternal(mailto);
      } else {
        window.location.href = mailto;
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to gather member emails.');
    } finally {
      setBusy(null);
      setMenu(null);
      setRowMenu(null);
    }
  };

  // Per-organization activity log takes over the page until dismissed.
  if (detailOrg) {
    return <OrganizationDetailPage org={detailOrg} onBack={() => setDetailOrg(null)} />;
  }

  if (activityOrg) {
    return <ActivityLogsPage org={activityOrg} onBack={() => setActivityOrg(null)} />;
  }

  return (
    <div className="flex flex-col gap-7" ref={rootRef}>
      {/* Title + CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-black">Organizations</h1>
          <p className="mt-1 text-sm text-black/70">Manage every organization on the platform — plans, members and status.</p>
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
            placeholder="Search Organizations..."
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
              Filter
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {menu === 'filters' && (
              <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <button
                  onClick={clearAllFilters}
                  className={`flex w-full items-center justify-between border-b border-[rgba(26,29,33,0.08)] px-4 py-2.5 text-sm font-medium ${
                    activeFilterCount === 0 ? 'text-[#FF8A00]' : 'text-[#111315]'
                  } hover:bg-[#F9FAFB]`}
                >
                  All Organizations
                </button>

                <FilterSection
                  title="Plan"
                  open={openSec.plan}
                  onToggle={() => setOpenSec((s) => ({ ...s, plan: !s.plan }))}
                  options={PLAN_OPTIONS}
                  value={fPlan}
                  onSelect={(v) => setFPlan((cur) => (cur === v ? null : v))}
                />
                <FilterSection
                  title="Status"
                  open={openSec.status}
                  onToggle={() => setOpenSec((s) => ({ ...s, status: !s.status }))}
                  options={STATUS_OPTIONS}
                  value={fStatus}
                  onSelect={(v) => setFStatus((cur) => (cur === v ? null : (v as Org['status'])))}
                />

                {/* Creation date */}
                <div className="border-b border-[rgba(26,29,33,0.06)] last:border-b-0">
                  <button
                    onClick={() => setOpenSec((s) => ({ ...s, created: !s.created }))}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-[#111315] hover:bg-[#F9FAFB]"
                  >
                    <span className="flex items-center gap-2">
                      Creation date
                      {fCreated && (
                        <span className="rounded-full bg-[#FFF6ED] px-2 py-0.5 text-[11px] font-medium text-[#FF8A00]">
                          {fCreated.toLocaleDateString()}
                        </span>
                      )}
                    </span>
                    <ChevronDown size={16} className={`text-[rgba(17,19,21,0.6)] transition-transform ${openSec.created ? '' : '-rotate-90'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Creation-date calendar — popover beside the filter menu so it is
                never clipped by the dropdown's overflow. */}
            {menu === 'filters' && openSec.created && (
              <div className="absolute right-[19rem] top-12 z-40 w-[280px] rounded-xl bg-white p-3 shadow-[-4px_4px_12px_rgba(0,0,0,0.25)]">
                <DatePicker
                  value={fCreated}
                  onApply={(d) => { setFCreated(d); setOpenSec((s) => ({ ...s, created: false })); }}
                  onCancel={() => { setFCreated(null); setOpenSec((s) => ({ ...s, created: false })); }}
                />
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="relative">
            <button
              onClick={() => setMenu((m) => (m === 'bulk' ? null : 'bulk'))}
              className={`inline-flex h-10 items-center gap-2 rounded-[4px] border px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] ${
                menu === 'bulk' || selectedCount ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)]'
              }`}
            >
              Bulk Actions
              {selectedCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">
                  {selectedCount}
                </span>
              )}
              <ChevronDown size={16} className={menu === 'bulk' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {menu === 'bulk' && (
              <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <p className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[rgba(17,19,21,0.4)]">
                  {selectedCount > 0 ? `${selectedCount} selected` : 'Select Rows To Act'}
                </p>
                <BulkItem icon={Mail} label="Send Email" onClick={sendEmail} disabled={!selectedCount || !!busy} loading={busy === 'email'} />
                <BulkItem icon={Trash2} label="Delete" onClick={() => askDelete(selectedIds)} disabled={!selectedCount || !!busy} loading={busy === 'delete'} danger />
                <BulkItem icon={Download} label="Export Data" onClick={() => { setMenu(null); exportCsv(selectedCount ? orgs.filter((o) => selected[o.id]) : filtered); }} disabled={!!busy} />
                <BulkItem icon={Ban} label="Suspend" onClick={() => askSuspend(selectedIds)} disabled={!selectedCount || !!busy} loading={busy === 'suspend'} />
                <BulkItem icon={CheckCircle2} label="Activate" onClick={() => askActivate(selectedIds)} disabled={!selectedCount || !!busy} loading={busy === 'activate'} />
              </div>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-[4px] border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-sm text-[#D92D20]">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
        <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr className="h-11 bg-[#F3F4F6]">
              <th className="px-6 text-left align-middle">
                <div className="flex items-center gap-2">
                  <Checkbox checked={allSelected} onChange={toggleAll} />
                  <span className="text-[12px] font-medium leading-[17px] text-[#111315]">Organizations</span>
                </div>
              </th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Owner</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Plan</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Users</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Devices</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Status</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Created</th>
              <th className="px-6" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={8} className="px-6 py-12 text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]">
                    <Loader2 size={16} className="animate-spin" /> Loading Organizations…
                  </span>
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={8} className="px-6 py-12 text-center">
                  <p className="text-sm text-[#D92D20]">{error}</p>
                  <button
                    onClick={load}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                </td>
              </tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">
                  {orgs.length === 0
                    ? 'No organizations yet.'
                    : query || activeFilterCount
                      ? 'No organizations match your filters.'
                      : 'No organizations yet.'}
                </td>
              </tr>
            )}

            {!loading && !error && pageRows.map((org) => (
              <tr key={org.id} onClick={() => setDetailOrg(org)} className="h-[72px] cursor-pointer border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                <td className="px-6 align-middle">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!selected[org.id]}
                      onChange={() => setSelected((s) => ({ ...s, [org.id]: !s[org.id] }))}
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">
                      {(org.name || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#111315]">{org.name}</p>
                      <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{org.domain}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 align-middle">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111315]">{org.ownerName}</p>
                    {org.ownerEmail && <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{org.ownerEmail}</p>}
                  </div>
                </td>
                <td className="px-6 align-middle">
                  <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${planBadge(org.plan)}`}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-6 align-middle text-sm text-[#111315]">{quota(org.members, org.membersLimit)}</td>
                <td className="px-6 align-middle text-sm text-[#111315]">{quota(org.devices, org.devicesLimit)}</td>
                <td className="px-6 align-middle">
                  <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${statusStyles[org.status]}`}>
                    {org.status}
                  </span>
                </td>
                <td className="px-6 align-middle text-sm text-[#111315]">{org.created}</td>
                <td className="px-6 align-middle" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => openRowMenu(e, org.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] ${rowMenu?.id === org.id ? 'bg-[#F3F4F6]' : ''}`}
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
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex h-9 items-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex h-9 items-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <span className="text-sm text-[rgba(17,19,21,0.6)]">Page {page} of {totalPages}</span>
        </div>
      )}

      {/* Row actions (fixed so it never clips inside the table's scroll container;
          flips above the trigger when there isn't room below). */}
      {rowMenu && (() => {
        const MENU_H = 270;
        // Open below the trigger, but clamp so the menu never runs off the
        // bottom (or top) of the viewport — shifts up for near-bottom rows.
        const topPos = Math.max(8, Math.min(rowMenu.bottom + 6, window.innerHeight - MENU_H - 8));
        const rowOrg = orgs.find((o) => o.id === rowMenu.id);
        const st = rowOrg?.status;
        return (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
          <div
            className="fixed z-50 w-48 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl"
            style={{ top: topPos, left: Math.max(8, rowMenu.x - 192) }}
          >
            <BulkItem icon={Eye} label="View Details" onClick={() => { setRowMenu(null); if (rowOrg) setDetailOrg(rowOrg); }} disabled={!!busy} />
            <BulkItem icon={Activity} label="Activity Logs" onClick={() => { setRowMenu(null); if (rowOrg) setActivityOrg(rowOrg); }} disabled={!!busy} />
            <BulkItem icon={Mail} label="Send Email" onClick={() => sendEmail([rowMenu.id])} disabled={!!busy} loading={busy === 'email'} />
            <BulkItem icon={Trash2} label="Delete" danger onClick={() => askDelete([rowMenu.id])} disabled={!!busy || st === 'Deleted'} loading={busy === 'delete'} />
            <BulkItem icon={CheckCircle2} label="Activate" onClick={() => askActivate([rowMenu.id])} disabled={!!busy || st === 'Active'} loading={busy === 'activate'} />
            <BulkItem icon={Ban} label="Suspend" onClick={() => askSuspend([rowMenu.id])} disabled={!!busy || st !== 'Active'} loading={busy === 'suspend'} />
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
  title: string;
  open: boolean;
  onToggle: () => void;
  options: readonly string[];
  value: string | null;
  onSelect: (v: string) => void;
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
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}> = ({ icon: Icon, label, onClick, disabled, loading, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40 ${
      danger ? 'text-[#D92D20] hover:bg-[#FEF3F2]' : 'text-[#111315]'
    }`}
  >
    {loading ? (
      <Loader2 size={16} className="animate-spin text-[rgba(17,19,21,0.6)]" />
    ) : (
      <Icon size={16} className={danger ? 'text-[#D92D20]' : 'text-[rgba(17,19,21,0.6)]'} />
    )}
    {label}
  </button>
);

const Checkbox: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`flex h-[18px] w-[18px] items-center justify-center rounded-[3px] border transition-colors ${
      checked ? 'border-[#FF8A00] bg-[#FF8A00] text-white' : 'border-[rgba(26,29,33,0.4)] bg-white'
    }`}
  >
    {checked && <Check size={12} strokeWidth={3} />}
  </button>
);

export default OrganizationsPage;
