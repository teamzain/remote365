import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Users, UserCheck, Monitor, MonitorPlay, MoreVertical, Eye, Mail, LogOut, Ban, CheckCircle2, Trash2, X } from 'lucide-react';
import api from '../../../lib/api';
import ConfirmModal from '../ConfirmModal';
import UserDetailPage from './UserDetailPage';

/**
 * Super Admin -> Organizations -> Organization detail.
 * Full profile for one organization (header + stat cards + All Users and All
 * Devices tables), loaded from GET /api/organizations/:id. The per-row menus
 * drive the real admin user/device endpoints.
 */

type OrgLite = {
  id: string;
  name: string;
  plan: string;
  status: 'Active' | 'Suspended' | 'Deleted';
  created: string;
  ownerName?: string;
  ownerEmail?: string;
};

type Member = { id: string; name: string | null; email: string; role: string; status?: string; createdAt: string; lastLoginAt?: string | null; subscription?: { plan?: string; status?: string } | null };
type Dev = { id: string; name: string; deviceId: string; type: string; ownerName?: string | null; ownerEmail?: string | null; status: string; sessions: number; lastSeenAt?: string | null };

type Detail = {
  id: string; name: string; slug: string; status: string; createdAt: string; plan: string; planName?: string | null;
  users: Member[]; devices: Dev[]; _count?: { users?: number; devices?: number };
};

type ConfirmState = { variant: 'suspend' | 'activate' | 'delete'; title: string; message: string; confirmLabel: string; onConfirm: () => void } | null;
type Menu = { kind: 'user' | 'device'; id: string } | null;

const statusBadge: Record<string, string> = {
  Active: 'bg-[#ECFDF3] text-[#34C759]', Suspended: 'bg-[#FEF3F2] text-[#D92D20]', Deleted: 'bg-[#F5F5F5] text-[#414651]',
};
const memberStatus = (s?: string) => {
  const v = (s || 'ACTIVE').toUpperCase();
  if (v === 'SUSPENDED') return { label: 'Suspended', cls: 'bg-[#FEF3F2] text-[#D92D20]' };
  if (v === 'DELETED') return { label: 'Deleted', cls: 'bg-[#F5F5F5] text-[#414651]' };
  return { label: 'Active', cls: 'bg-[#ECFDF3] text-[#34C759]' };
};
const deviceStatusStyles: Record<string, string> = {
  Online: 'bg-[#ECFDF3] text-[#34C759]', Offline: 'bg-[#F5F5F5] text-[#414651]',
  'In Session': 'bg-[#F0F9FF] text-[#026AA2]', Disabled: 'bg-[#FEF3F2] text-[#D92D20]', Unregistered: 'bg-[#F2F4F7] text-[#98A2B3]',
};
// The API sends "In session"; badges here are keyed in Title Case.
const displayDeviceStatus = (raw?: string | null): string => {
  const s = String(raw || 'Offline');
  return s.toLowerCase() === 'in session' ? 'In Session' : s;
};
const planBadge: Record<string, string> = {
  Trial: 'bg-[#FFF6ED] text-[#FF8A00]', Solo: 'bg-[#EFF8FF] text-[#175CD3]', Pro: 'bg-[#F9F5FF] text-[#7F56D9]',
  Business: 'bg-[#F8F9FC] text-[#363F72]', Enterprise: 'bg-[#ECFDF3] text-[#039855]',
};
const initials = (s: string) => (s || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const relTime = (iso?: string | null) => {
  if (!iso) return 'Never';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Just Now';
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
};

const MenuItem: React.FC<{ icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> = ({ icon: Icon, label, onClick, danger, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'text-[#D92D20]' : 'text-[#111315]'}`}
  >
    <Icon size={16} /> {label}
  </button>
);

const OrganizationDetailPage: React.FC<{ org: OrgLite; onBack: () => void }> = ({ org, onBack }) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [detailUser, setDetailUser] = useState<Member | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Dev | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    api.get<Detail>(`/api/organizations/${org.id}`)
      .then((res: { data: Detail }) => { setDetail(res.data); setError(null); })
      .catch(() => setError('Could not load organization details.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [org.id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Inline user detail reuses the User Management detail page.
  if (detailUser) {
    const du = {
      id: detailUser.id,
      name: detailUser.name || detailUser.email,
      email: detailUser.email,
      org: detail?.name || org.name,
      organizationId: detail?.id || org.id,
      role: detailUser.role,
      status: (detailUser.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ? ('Suspended' as const) : ('Active' as const),
      created: detailUser.createdAt,
    };
    return <UserDetailPage user={du} onBack={() => setDetailUser(null)} onChanged={load} />;
  }

  const members = detail?.users ?? [];
  const devices = detail?.devices ?? [];
  const totalUsers = detail?._count?.users ?? members.length;
  const totalDevices = detail?._count?.devices ?? devices.length;
  const activeUsers = members.filter((m) => (m.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
  const activeSessions = devices.reduce((n, d) => n + (d.sessions || 0), 0);
  const plan = detail?.planName || titleCase(detail?.plan || org.plan || 'Trial');
  // Owner = the member that carries the subscription (mirrors the orgs list).
  const ownerId = members.find((m) => m.subscription)?.id;
  const orgStatus = titleCase(detail?.status || org.status); // Active | Suspended | Deleted

  const stats = [
    { label: 'Total Users', value: totalUsers, icon: Users },
    { label: 'Active Users', value: activeUsers, icon: UserCheck },
    { label: 'Total Devices', value: totalDevices, icon: Monitor },
    { label: 'Active Sessions', value: activeSessions, icon: MonitorPlay },
  ];

  // ---- user actions ----
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try { await fn(); setConfirm(null); setMenu(null); load(); }
    catch { setError('Action failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const userActivate = (m: Member) => run(() => api.patch(`/api/admin/users/${m.id}`, { status: 'ACTIVE' }));
  const userForceLogout = (m: Member) => run(() => api.post(`/api/admin/users/${m.id}/force-logout`));
  const userSendEmail = (m: Member) => { window.open(`mailto:${m.email}`); setMenu(null); };
  const askUserSuspend = (m: Member) => setConfirm({
    variant: 'suspend',
    title: 'Suspend User?',
    message: `This signs out and blocks ${m.name || m.email} until reactivated.${m.id === ownerId ? ' This suspends only this user — to suspend the whole organization, use “Suspend organization” at the top.' : ''}`,
    confirmLabel: 'Suspend',
    onConfirm: () => run(() => api.patch(`/api/admin/users/${m.id}`, { status: 'SUSPENDED' })),
  });

  // ---- organization-level actions (whole tenant) ----
  const askOrgSuspend = () => setConfirm({ variant: 'suspend', title: 'Suspend Organization?', message: 'This locks out every member of this organization, everywhere, until you reactivate it.', confirmLabel: 'Suspend Organization', onConfirm: () => run(() => api.patch(`/api/organizations/${org.id}`, { status: 'SUSPENDED' })) });
  const askOrgActivate = () => setConfirm({ variant: 'activate', title: 'Activate Organization?', message: 'This restores access for the organization and all of its members.', confirmLabel: 'Activate Organization', onConfirm: () => run(() => api.patch(`/api/organizations/${org.id}`, { status: 'ACTIVE' })) });
  const askUserDelete = (m: Member) => setConfirm({ variant: 'delete', title: 'Delete User?', message: `This permanently removes ${m.name || m.email} from the platform.`, confirmLabel: 'Delete', onConfirm: () => run(() => api.delete(`/api/admin/users/${m.id}`)) });

  // ---- device actions ----
  const askDeviceBlock = (d: Dev) => setConfirm({ variant: 'suspend', title: 'Block Device?', message: `This blocks "${d.name}" from connecting until unblocked.`, confirmLabel: 'Block', onConfirm: () => run(() => api.patch(`/api/admin/devices/${d.id}`, { status: 'BLOCKED' })) });
  // Unblocking is non-destructive, so no confirmation step.
  const deviceUnblock = (d: Dev) => run(() => api.patch(`/api/admin/devices/${d.id}`, { status: 'OFFLINE' }));
  const askDeviceRemove = (d: Dev) => setConfirm({ variant: 'delete', title: 'Remove Device?', message: `This permanently removes "${d.name}" and its sessions.`, confirmLabel: 'Remove', onConfirm: () => run(() => api.delete(`/api/admin/devices/${d.id}`)) });

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Role', 'Status', 'Last Login', 'Joined'];
    const rows = members.map((m) => [m.name || '—', m.email, titleCase(m.role), memberStatus(m.status).label, fmtDateTime(m.lastLoginAt), fmtDateTime(m.createdAt)]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${detail?.slug || org.name || 'organization'}-members.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#111315] hover:bg-[#F3F4F6]" title="Back"><ArrowLeft size={20} /></button>
          <h1 className="truncate text-lg font-semibold text-black">{detail?.name || org.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {orgStatus === 'Active' && (
            <button onClick={askOrgSuspend} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[#FECDCA] bg-white px-4 text-sm font-medium text-[#D92D20] hover:bg-[#FEF3F2] disabled:opacity-40">
              <Ban size={16} /> Suspend Organization
            </button>
          )}
          {orgStatus === 'Suspended' && (
            <button onClick={askOrgActivate} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[#ABEFC6] bg-white px-4 text-sm font-medium text-[#039855] hover:bg-[#ECFDF3] disabled:opacity-40">
              <CheckCircle2 size={16} /> Activate Organization
            </button>
          )}
          <button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] px-4 text-sm font-medium text-white hover:opacity-95">
            <Download size={16} /> Export Members
          </button>
        </div>
      </div>

      {/* Identity row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-lg font-medium text-[#7F56D9]">{initials(detail?.name || org.name)}</div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-[#111315]">{detail?.name || org.name}</p>
          <div className="mt-1 flex items-center gap-2 text-xs font-medium text-[rgba(17,19,21,0.6)]">
            <span>{detail?.slug || ''}</span>
            <span className={`inline-flex items-center rounded-[16px] px-2 py-0.5 text-[10px] ${statusBadge[titleCase(detail?.status || org.status)] || statusBadge.Active}`}>{titleCase(detail?.status || org.status)}</span>
          </div>
        </div>
        <div className="text-xs font-medium text-[#000]"><span className="text-[rgba(17,19,21,0.6)]">Created At: </span>{fmtDateTime(detail?.createdAt || org.created)}</div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#000]">
          <span className="text-[rgba(17,19,21,0.6)]">Subscription Plan:</span>
          <span className={`inline-flex items-center rounded-[16px] px-2 py-0.5 text-[10px] ${planBadge[plan] || 'bg-[#F5F5F5] text-[#414651]'}`}>{plan}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-start justify-between rounded-xl border border-[rgba(26,29,33,0.2)] bg-white p-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1D21]">{s.label}</p>
                <p className="mt-3 text-lg font-semibold text-[#111315]">{loading ? '—' : s.value.toLocaleString()}</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(255,179,71,0.3)] text-[#FF8A00]"><Icon size={18} /></div>
            </div>
          );
        })}
      </div>

      {error && <div className="rounded-lg bg-[#FEF3F2] px-4 py-2 text-sm text-[#D92D20]">{error}</div>}

      {/* All Users */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-[#111315]">All Users {!loading && `(${members.length})`}</h3>
        <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6] text-left text-xs font-medium text-[#111315]">
                <th className="rounded-tl-xl px-6 py-3">Users</th>
                <th className="px-6 py-3">User ID</th>
                <th className="px-6 py-3">Assigned Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Login History</th>
                <th className="rounded-tr-xl px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">Loading Users…</td></tr>}
              {!loading && members.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">No users in this organization.</td></tr>}
              {!loading && members.map((m) => {
                const badge = memberStatus(m.status);
                const isOpen = menu?.kind === 'user' && menu.id === m.id;
                return (
                  <tr key={m.id} className="h-[72px] border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                    <td className="px-6 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">{initials(m.name || m.email)}</div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-sm font-medium text-[#111315]">
                            {m.name || '—'}
                            {m.id === ownerId && <span className="inline-flex items-center rounded-[16px] bg-[#F9F5FF] px-2 py-0.5 text-[10px] font-medium text-[#7F56D9]">Owner</span>}
                          </p>
                          <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 align-middle text-sm text-[#111315]">{m.id.slice(0, 8)}</td>
                    <td className="px-6 align-middle text-sm text-[#111315]">{titleCase(m.role)}</td>
                    <td className="px-6 align-middle"><span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${badge.cls}`}>{badge.label}</span></td>
                    <td className="px-6 align-middle">
                      <p className="text-sm text-[#111315]">{relTime(m.lastLoginAt)}</p>
                      {m.lastLoginAt && <p className="text-xs text-[rgba(17,19,21,0.6)]">{fmtDateTime(m.lastLoginAt)}</p>}
                    </td>
                    <td className="relative px-6 text-right align-middle">
                      <button onClick={() => setMenu(isOpen ? null : { kind: 'user', id: m.id })} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] ${isOpen ? 'bg-[#F3F4F6]' : ''}`}><MoreVertical size={18} /></button>
                      {isOpen && (
                        <div className="absolute right-6 top-[60px] z-20 w-48 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 text-left shadow-xl">
                          <MenuItem icon={Eye} label="View Details" onClick={() => { setMenu(null); setDetailUser(m); }} />
                          <MenuItem icon={Mail} label="Send Email" onClick={() => userSendEmail(m)} />
                          <MenuItem icon={CheckCircle2} label={orgStatus !== 'Active' ? 'Activate User (Organization Suspended)' : 'Activate User'} onClick={() => userActivate(m)} disabled={busy || badge.label === 'Active'} />
                          <MenuItem icon={LogOut} label="Force Logout User" onClick={() => userForceLogout(m)} disabled={busy} />
                          <MenuItem icon={Ban} label="Suspend User" onClick={() => askUserSuspend(m)} disabled={busy || badge.label !== 'Active'} />
                          <MenuItem icon={Trash2} label="Delete User" danger onClick={() => askUserDelete(m)} disabled={busy} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Devices */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-[#111315]">All Devices {!loading && `(${devices.length})`}</h3>
        <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6] text-left text-xs font-medium text-[#111315]">
                <th className="rounded-tl-xl px-6 py-3">Devices</th>
                <th className="px-6 py-3">Device Type</th>
                <th className="px-6 py-3">Device Owner</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Active Sessions</th>
                <th className="px-6 py-3">Last Seen</th>
                <th className="rounded-tr-xl px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">Loading Devices…</td></tr>}
              {!loading && devices.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">No devices in this organization.</td></tr>}
              {!loading && devices.map((d) => {
                const isOpen = menu?.kind === 'device' && menu.id === d.id;
                return (
                  <tr key={d.id} className="h-[72px] border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                    <td className="px-6 align-middle">
                      <p className="truncate text-sm font-medium text-[#111315]">{d.name}</p>
                      <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{d.deviceId}</p>
                    </td>
                    <td className="px-6 align-middle text-sm text-[#111315]">{titleCase(d.type)}</td>
                    <td className="px-6 align-middle">
                      <p className="truncate text-sm text-[#111315]">{d.ownerName || '—'}</p>
                      {d.ownerEmail && <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{d.ownerEmail}</p>}
                    </td>
                    <td className="px-6 align-middle"><span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${deviceStatusStyles[displayDeviceStatus(d.status)] || deviceStatusStyles.Offline}`}>{displayDeviceStatus(d.status)}</span></td>
                    <td className="px-6 align-middle text-sm text-[#111315]">{d.sessions}</td>
                    <td className="px-6 align-middle text-sm text-[#111315]">{relTime(d.lastSeenAt)}</td>
                    <td className="relative px-6 text-right align-middle">
                      <button onClick={() => setMenu(isOpen ? null : { kind: 'device', id: d.id })} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] ${isOpen ? 'bg-[#F3F4F6]' : ''}`}><MoreVertical size={18} /></button>
                      {isOpen && (
                        <div className="absolute right-6 top-[60px] z-20 w-44 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 text-left shadow-xl">
                          <MenuItem icon={Eye} label="View Details" onClick={() => { setMenu(null); setDeviceInfo(d); }} />
                          {d.status === 'Disabled'
                            ? <MenuItem icon={CheckCircle2} label="Unblock Device" onClick={() => deviceUnblock(d)} disabled={busy} />
                            : <MenuItem icon={Ban} label="Block Device" onClick={() => askDeviceBlock(d)} disabled={busy} />}
                          <MenuItem icon={Trash2} label="Remove Device" danger onClick={() => askDeviceRemove(d)} disabled={busy} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Device details modal */}
      {deviceInfo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4" onClick={() => setDeviceInfo(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-[#111315]">Device Details</h4>
              <button onClick={() => setDeviceInfo(null)} className="text-[#111315] hover:text-[#FF8A00]"><X size={18} /></button>
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ['Name', deviceInfo.name], ['Device ID', deviceInfo.deviceId], ['Type', titleCase(deviceInfo.type)],
                ['Owner', deviceInfo.ownerName || '—'], ['Owner Email', deviceInfo.ownerEmail || '—'],
                ['Status', deviceInfo.status], ['Active Sessions', String(deviceInfo.sessions)], ['Last Seen', fmtDateTime(deviceInfo.lastSeenAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-[rgba(17,19,21,0.6)]">{k}</dt>
                  <dd className="truncate text-right font-medium text-[#111315]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          variant={confirm.variant}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          loading={busy}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default OrganizationDetailPage;
