import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Mail, LogOut, Ban, CheckCircle2, Trash2, Loader2, ChevronDown } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import api from '../../../lib/api';

/**
 * Super Admin → User Management → User details.
 * Header + actions (Send email / Force logout / Suspend / Activate / Delete with
 * the org-style confirm modal), a Login details table (real login history) and
 * an Activity logs timeline — both with a date-range filter.
 */

type DetailUser = {
  id: string;
  name: string;
  email: string;
  org: string;
  organizationId: string | null;
  role: string;
  status: 'Active' | 'Suspended';
  created: string;
};

type ApiLogin = { id: string; ip?: string | null; userAgent?: string | null; result: string; createdAt: string };
type ApiActivity = { id: string; message: string; actorId?: string | null; createdAt: string };
type ApiDetail = {
  id: string; name: string; email: string; role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  orgSuspended?: boolean;
  organization?: string | null; organizationId?: string | null; department?: string | null;
  plan?: string | null; planName?: string | null; planStatus?: string | null;
  is2FAEnabled?: boolean; provider?: string; language?: string;
  deviceCount?: number; createdAt?: string; lastActive?: string;
};

const statusStyles: Record<DetailUser['status'], string> = {
  Active: 'bg-[#ECFDF3] text-[#34C759]',
  Suspended: 'bg-[#FEF3F2] text-[#D92D20]',
};

const RANGES = [
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 7 Days', days: 7 },
  { label: "Today's", days: 0 },
] as const;

const initials = (s: string) => (s || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

const dayLabel = (d: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dd.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
};

const cutoffMs = (days: number) => (days === 0 ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : Date.now() - days * 86400000);

// Best-effort browser + device parse from a user-agent string.
const parseUA = (ua?: string | null): { browser: string; device: string } => {
  if (!ua) return { browser: '—', device: '—' };
  const ver = (re: RegExp) => { const m = ua.match(re); return m ? ' ' + m[1] : ''; };
  let browser = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge' + ver(/Edg\/(\d+)/);
  else if (/OPR\//.test(ua)) browser = 'Opera' + ver(/OPR\/(\d+)/);
  else if (/Firefox\//.test(ua)) browser = 'Firefox' + ver(/Firefox\/(\d+)/);
  else if (/Chrome\//.test(ua)) browser = 'Chrome' + ver(/Chrome\/(\d+)/);
  else if (/Safari\//.test(ua)) browser = 'Safari' + ver(/Version\/(\d+)/);
  let os = 'Unknown'; let form = 'Desktop';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) { os = 'Android'; form = 'Mobile'; }
  else if (/iPhone|iPad|iOS/.test(ua)) { os = 'iOS'; form = 'Mobile'; }
  else if (/Linux/.test(ua)) os = 'Linux';
  return { browser: browser.trim(), device: `${os} ${form}` };
};

const RESULTS: Record<string, { text: string; tone: 'ok' | 'fail' | 'warn' }> = {
  SUCCESS: { text: 'User Logged In Successfully', tone: 'ok' },
  INCORRECT_PASSWORD: { text: 'Incorrect Password', tone: 'fail' },
  NO_ACCOUNT: { text: 'Invalid Credentials', tone: 'fail' },
  SUSPENDED: { text: 'Account Suspended', tone: 'fail' },
  TWO_FACTOR: { text: 'Two-Factor Requested', tone: 'warn' },
};
const resultInfo = (r: string) => RESULTS[r] || { text: r, tone: 'warn' as const };
const toneBadge = (tone: 'ok' | 'fail' | 'warn') =>
  tone === 'ok' ? 'bg-[#ECFDF3] text-[#34C759]' : tone === 'fail' ? 'bg-[#FEF3F2] text-[#D92D20]' : 'bg-[#FFF6ED] text-[#FF8A00]';

const RangeDropdown: React.FC<{ value: number; onChange: (d: number) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const label = RANGES.find((r) => r.days === value)?.label ?? 'Last 30 Days';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]">
        {label}
        <ChevronDown size={16} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-40 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
          {RANGES.map((r) => (
            <button key={r.label} onClick={() => { onChange(r.days); setOpen(false); }} className={`flex w-full px-4 py-2.5 text-sm hover:bg-[#F9FAFB] ${r.days === value ? 'text-[#FF8A00]' : 'text-[#111315]'}`}>{r.label}</button>
          ))}
        </div>
      )}
    </div>
  );
};

const UserDetailPage: React.FC<{ user: DetailUser; onBack: () => void; onChanged: () => void }> = ({ user, onBack, onChanged }) => {
  const [status, setStatus] = useState<DetailUser['status']>(user.status);
  const [busy, setBusy] = useState<'suspend' | 'activate' | 'delete' | 'logout' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ variant: 'suspend' | 'delete' | 'activate'; title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  const [detail, setDetail] = useState<ApiDetail | null>(null);

  const [logins, setLogins] = useState<ApiLogin[]>([]);
  const [loginsLoading, setLoginsLoading] = useState(true);
  const [loginRange, setLoginRange] = useState(30);

  const [acts, setActs] = useState<ApiActivity[]>([]);
  const [actsLoading, setActsLoading] = useState(false);
  const [actRange, setActRange] = useState(30);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get<ApiDetail>(`/api/admin/users/${user.id}`);
        if (alive) { setDetail(data); if (data?.status) setStatus(data.status === 'SUSPENDED' ? 'Suspended' : 'Active'); }
      } catch { /* non-fatal */ }
    })();
    return () => { alive = false; };
  }, [user.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoginsLoading(true);
      try {
        const { data } = await api.get<ApiLogin[]>(`/api/admin/users/${user.id}/login-details`);
        if (alive) setLogins(Array.isArray(data) ? data : []);
      } catch { /* non-fatal */ }
      finally { if (alive) setLoginsLoading(false); }
    })();
    return () => { alive = false; };
  }, [user.id]);

  useEffect(() => {
    if (!user.organizationId) return;
    let alive = true;
    (async () => {
      setActsLoading(true);
      try {
        const { data } = await api.get<ApiActivity[]>(`/api/organizations/${user.organizationId}/activity`);
        if (alive) setActs(Array.isArray(data) ? data : []);
      } catch { /* non-fatal */ }
      finally { if (alive) setActsLoading(false); }
    })();
    return () => { alive = false; };
  }, [user.organizationId]);

  const loginRows = useMemo(() => {
    const c = cutoffMs(loginRange);
    return logins
      .map((l) => ({ ...l, ts: new Date(l.createdAt).getTime() }))
      .filter((l) => !Number.isNaN(l.ts) && l.ts >= c)
      .sort((a, b) => b.ts - a.ts);
  }, [logins, loginRange]);

  const activityGroups = useMemo(() => {
    const c = cutoffMs(actRange);
    const mine = acts
      .filter((l) => l.actorId === user.id || (l.message || '').toLowerCase().includes(user.name.toLowerCase()) || (l.message || '').toLowerCase().includes(user.email.toLowerCase()))
      .map((l) => ({ id: l.id, ts: new Date(l.createdAt).getTime(), text: l.message }))
      .filter((e) => !Number.isNaN(e.ts) && e.ts >= c)
      .sort((a, b) => b.ts - a.ts);
    const out: { label: string; items: { id: string; ts: number; text: string }[] }[] = [];
    mine.forEach((e) => {
      const label = dayLabel(new Date(e.ts));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    });
    return out;
  }, [acts, actRange, user]);

  const runStatus = async (next: 'ACTIVE' | 'SUSPENDED') => {
    setBusy(next === 'ACTIVE' ? 'activate' : 'suspend'); setActionError(null);
    try {
      await api.patch(`/api/admin/users/${user.id}`, { status: next });
      setStatus(next === 'ACTIVE' ? 'Active' : 'Suspended');
      onChanged();
    } catch (err: any) { setActionError(err?.response?.data?.error || 'Failed to update the user.'); }
    finally { setBusy(null); setConfirmModal(null); }
  };

  const deleteUser = async () => {
    setBusy('delete'); setActionError(null);
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      onChanged(); onBack();
    } catch (err: any) { setActionError(err?.response?.data?.error || 'Failed to delete the user.'); setBusy(null); setConfirmModal(null); }
  };

  const sendEmail = () => {
    const mailto = `mailto:${encodeURIComponent(user.email)}`;
    if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(mailto);
    else window.location.href = mailto;
  };

  const forceLogout = async () => {
    setBusy('logout'); setActionError(null); setNotice(null);
    try { await api.post(`/api/admin/users/${user.id}/force-logout`); setNotice('User will be signed out.'); }
    catch (err: any) { setActionError(err?.response?.data?.error || 'Failed to force logout.'); }
    finally { setBusy(null); }
  };

  const askSuspend = () => setConfirmModal({ variant: 'suspend', title: 'Suspend User?', message: 'This signs out and blocks the user until you reactivate them.', confirmLabel: 'Suspend', onConfirm: () => runStatus('SUSPENDED') });
  const askActivate = () => setConfirmModal({ variant: 'activate', title: 'Activate User?', message: 'This restores access for the user.', confirmLabel: 'Activate', onConfirm: () => runStatus('ACTIVE') });
  const askDelete = () => setConfirmModal({ variant: 'delete', title: 'Delete User?', message: 'This deletes the user, removes them from the list and signs them out.', confirmLabel: 'Delete', onConfirm: () => deleteUser() });

  const downloadCsv = () => {
    const header = ['Timestamp', 'IP Address', 'Browser', 'Device', 'Status', 'Result'];
    const body = loginRows.map((l) => {
      const ua = parseUA(l.userAgent);
      const info = resultInfo(l.result);
      return [new Date(l.ts).toLocaleString(), l.ip || '—', ua.browser, ua.device, info.tone === 'ok' ? 'Success' : info.tone === 'fail' ? 'Failed' : 'Pending', info.text];
    });
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user.email || 'user'}-login-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn = 'inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-col gap-7">
      {/* Title + Download */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-lg font-semibold text-black hover:opacity-70">
          <ArrowLeft size={20} /> User Details
        </button>
        <button onClick={downloadCsv} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white" style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}>
          <Download size={16} /> Download CSV
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-lg font-medium text-[#7F56D9]">{initials(user.name)}</div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[#111315]">{user.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[rgba(17,19,21,0.6)]">User ID: #{user.id.slice(0, 8)}</span>
              <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${statusStyles[status]}`}>{status}</span>
              <span className="text-xs font-medium text-[#000000]">Assigned role: {user.role}</span>
            </div>
            <p className="mt-1 truncate text-sm text-[rgba(17,19,21,0.6)]">{user.email} · {user.org}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={sendEmail} disabled={!!busy} className={btn}><Mail size={16} /> Send Email</button>
          <button onClick={forceLogout} disabled={!!busy} className={btn}>{busy === 'logout' ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Force logout</button>
          {status === 'Suspended'
            ? <button onClick={askActivate} disabled={!!busy || !!detail?.orgSuspended} title={detail?.orgSuspended ? 'Blocked by the organization — activate the organization instead' : undefined} className={btn}><CheckCircle2 size={16} /> Activate</button>
            : <button onClick={askSuspend} disabled={!!busy} className={btn}><Ban size={16} /> Suspend</button>}
          <button onClick={askDelete} disabled={!!busy} className={`${btn} border-[#FECDCA] text-[#D92D20] hover:bg-[#FEF3F2]`}><Trash2 size={16} /> Delete</button>
        </div>
      </div>

      {actionError && <div className="rounded-[4px] border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-sm text-[#D92D20]">{actionError}</div>}
      {detail?.orgSuspended && (
        <div className="rounded-[4px] border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-sm text-[#B54708]">
          This user is blocked because their organization is suspended. Activate the organization to restore their access.
        </div>
      )}
      {notice &&<div className="rounded-[4px] border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3 text-sm text-[#039855]">{notice}</div>}

      {/* Overview */}
      <div className="rounded-xl border border-[rgba(26,29,33,0.3)] p-5">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            ['Email', user.email],
            ['Organization', detail?.organization ?? user.org],
            ['Department', detail?.department || '—'],
            ['Role', detail?.role ? detail.role.charAt(0).toUpperCase() + detail.role.slice(1).toLowerCase() : user.role],
            ['Plan', detail?.planName || (detail?.plan ? detail.plan.charAt(0).toUpperCase() + detail.plan.slice(1).toLowerCase() : '—')],
            ['Sign-In Method', detail?.provider || '—'],
            ['Two-factor', detail ? (detail.is2FAEnabled ? 'Enabled' : 'Disabled') : '—'],
            ['Devices', detail ? String(detail.deviceCount ?? 0) : '—'],
            ['Language', detail?.language || '—'],
            ['Joined', user.created],
            ['Last Active', detail?.lastActive ? new Date(detail.lastActive).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'],
            ['User ID', `#${user.id.slice(0, 8)}`],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[rgba(17,19,21,0.45)]">{label}</p>
              <p className="mt-1 truncate text-sm font-medium text-[#111315]">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Login details */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-black">Login Details</span>
          <RangeDropdown value={loginRange} onChange={setLoginRange} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="h-11 bg-[#F3F4F6]">
                {['Timestamp', 'IP Address', 'Browser', 'Device', 'Location', 'Status', 'Result'].map((h) => (
                  <th key={h} className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loginsLoading && (
                <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={7} className="px-6 py-10 text-center"><span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading Login History…</span></td></tr>
              )}
              {!loginsLoading && loginRows.length === 0 && (
                <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={7} className="px-6 py-10 text-center text-sm text-[rgba(17,19,21,0.5)]">No login activity in this period.</td></tr>
              )}
              {!loginsLoading && loginRows.map((l) => {
                const ua = parseUA(l.userAgent);
                const info = resultInfo(l.result);
                return (
                  <tr key={l.id} className="border-t border-[rgba(26,29,33,0.3)]">
                    <td className="px-6 py-4 text-sm text-[#111315]">{new Date(l.ts).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td className="px-6 py-4 text-sm text-[#111315]">{l.ip || '—'}</td>
                    <td className="px-6 py-4 text-sm text-[#111315]">{ua.browser}</td>
                    <td className="px-6 py-4 text-sm text-[#111315]">{ua.device}</td>
                    <td className="px-6 py-4 text-sm text-[rgba(17,19,21,0.6)]">—</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${toneBadge(info.tone)}`}>
                        {info.tone === 'ok' ? 'Success' : info.tone === 'fail' ? 'Failed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#111315]">{info.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity logs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-black">Activity Logs</span>
          <RangeDropdown value={actRange} onChange={setActRange} />
        </div>
        <div className="flex flex-col gap-5">
          {actsLoading && <div className="flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading Activity…</div>}
          {!actsLoading && activityGroups.length === 0 && <p className="text-sm text-[rgba(17,19,21,0.5)]">No recorded activity for this user in this period.</p>}
          {!actsLoading && activityGroups.map((g) => (
            <div key={g.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-black">{g.label}</span>
                <span className="h-px flex-1 bg-[rgba(26,29,33,0.3)]" />
              </div>
              {g.items.map((e) => (
                <div key={e.id} className="flex items-center gap-[60px]">
                  <span className="w-[72px] shrink-0 text-xs font-medium text-[rgba(26,29,33,0.7)]">{new Date(e.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[12px] font-medium text-[#7F56D9]">{initials(user.name)}</div>
                    <span className="text-sm font-medium text-[#111315]">{e.text}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

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

export default UserDetailPage;
