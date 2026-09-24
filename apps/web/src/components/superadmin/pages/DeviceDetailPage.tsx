import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import api from '../../../lib/api';

/**
 * Super Admin -> Device Management -> Device detail.
 * Device profile + recent session history + an activity timeline derived from
 * those sessions. Loaded from GET /api/admin/devices/:id.
 */

type DeviceLite = { id: string; name: string; status?: string };

type Sess = { id: string; viewerName: string | null; viewerEmail: string | null; requestedAt: string; startTime: string | null; endTime: string | null; status: string };
type Detail = {
  id: string; name: string; deviceId: string; type: string;
  org: string | null; ownerName: string | null; ownerEmail: string | null;
  status: string; activeSessions: number; registeredAt: string; lastSeenAt: string;
  sessions: Sess[];
};

const deviceStatusStyles: Record<string, string> = {
  Online: 'bg-[#ECFDF3] text-[#34C759]', Offline: 'bg-[#F5F5F5] text-[#414651]',
  'In session': 'bg-[#F0F9FF] text-[#026AA2]', Disabled: 'bg-[#FEF3F2] text-[#D92D20]', Unregistered: 'bg-[#F2F4F7] text-[#98A2B3]',
};
const sessionBadge = (s: string) =>
  s === 'Active' ? 'bg-[#ECFDF3] text-[#34C759]'
  : s === 'Pending' ? 'bg-[#F0F9FF] text-[#026AA2]'
  : s === 'Expired' ? 'bg-[#F5F5F5] text-[#414651]'
  : 'bg-[#FDF2FA] text-[#C11574]'; // Ended

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : '—');
const relTime = (iso?: string | null) => {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
};
const duration = (start: string | null, end: string | null) => {
  if (!start) return '—';
  if (!end) return 'Ongoing';
  const s = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
const dayLabel = (iso: string) => {
  const d = new Date(iso); const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const DeviceDetailPage: React.FC<{ device: DeviceLite; onBack: () => void }> = ({ device, onBack }) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/api/admin/devices/${device.id}`)
      .then((res: { data: Detail }) => { if (alive) { setDetail(res.data); setError(null); } })
      .catch(() => { if (alive) setError('Could not load device details.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [device.id]);

  const sessions = detail?.sessions ?? [];

  // Build an activity timeline from the remote-access history, grouped by day.
  const events = sessions.flatMap((s) => {
    const who = s.viewerName || s.viewerEmail || 'A viewer';
    const list: { ts: string; text: string }[] = [{ ts: s.requestedAt, text: `${who} requested remote access` }];
    if (s.startTime) list.push({ ts: s.startTime, text: `${who} started a remote session` });
    if (s.endTime) list.push({ ts: s.endTime, text: `Remote session with ${who} ended` });
    return list;
  }).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const grouped: { day: string; items: { ts: string; text: string }[] }[] = [];
  for (const e of events) {
    const day = dayLabel(e.ts);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) last.items.push(e);
    else grouped.push({ day, items: [e] });
  }

  const exportCsv = () => {
    const header = ['Viewer', 'Email', 'Started', 'Ended', 'Duration', 'Status'];
    const rows = sessions.map((s) => [s.viewerName || '—', s.viewerEmail || '—', fmtTime(s.startTime), s.endTime ? fmtTime(s.endTime) : '—', duration(s.startTime, s.endTime), s.status]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${(detail?.name || device.name || 'device').replace(/\s+/g, '-')}-sessions.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const status = detail?.status || device.status || 'Offline';

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#111315] hover:bg-[#F3F4F6]" title="Back"><ArrowLeft size={20} /></button>
          <h1 className="truncate text-lg font-semibold text-black">{detail?.name || device.name}</h1>
        </div>
        <button onClick={exportCsv} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[4px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] px-4 text-sm font-medium text-white hover:opacity-95">
          <Download size={16} /> Export sessions
        </button>
      </div>

      {/* Device info row */}
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-[#111315]">{detail?.name || device.name}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-[#000]">
          <span><span className="text-[rgba(17,19,21,0.6)]">Owner email: </span>{detail?.ownerEmail || '—'}</span>
          <span className={`inline-flex items-center rounded-[16px] px-2 py-0.5 text-[10px] ${deviceStatusStyles[status] || deviceStatusStyles.Offline}`}>{status}</span>
          <span><span className="text-[rgba(17,19,21,0.6)]">Organization: </span>{detail?.org || '—'}</span>
          <span><span className="text-[rgba(17,19,21,0.6)]">Registered: </span>{fmtDate(detail?.registeredAt)}</span>
          <span><span className="text-[rgba(17,19,21,0.6)]">Last seen: </span>{relTime(detail?.lastSeenAt)}</span>
        </div>
      </div>

      {error && <div className="rounded-lg bg-[#FEF3F2] px-4 py-2 text-sm text-[#D92D20]">{error}</div>}

      {/* Sessions table */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-[#111315]">Sessions {!loading && `(${sessions.length})`}</h3>
        <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F3F4F6] text-xs font-medium text-[#111315]">
                <th className="rounded-tl-xl px-6 py-3 text-left">Viewer</th>
                <th className="px-6 py-3 text-center">Requested</th>
                <th className="px-6 py-3 text-center">Started</th>
                <th className="px-6 py-3 text-center">Duration</th>
                <th className="rounded-tr-xl px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">Loading sessions…</td></tr>}
              {!loading && !error && sessions.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">No remote sessions for this device.</td></tr>}
              {!loading && sessions.map((s) => (
                <tr key={s.id} className="h-[72px] border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                  <td className="px-6 align-middle">
                    <p className="truncate text-sm text-[#111315]">{s.viewerName || '—'}</p>
                    {s.viewerEmail && <p className="truncate text-xs text-[rgba(17,19,21,0.6)]">{s.viewerEmail}</p>}
                  </td>
                  <td className="px-6 text-center align-middle text-sm text-[#111315]">
                    <p>{fmtDate(s.requestedAt)}</p>
                    <p className="text-xs text-[rgba(17,19,21,0.6)]">{fmtTime(s.requestedAt)}</p>
                  </td>
                  <td className="px-6 text-center align-middle text-sm text-[#111315]">{s.startTime ? fmtTime(s.startTime) : '—'}</td>
                  <td className="px-6 text-center align-middle text-sm text-[#111315]">{duration(s.startTime, s.endTime)}</td>
                  <td className="px-6 text-center align-middle">
                    <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${sessionBadge(s.status)}`}>{titleCase(s.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-[#111315]">Activity</h3>
        {!loading && grouped.length === 0 && <p className="text-sm text-[rgba(17,19,21,0.5)]">No activity yet.</p>}
        {grouped.map((g) => (
          <div key={g.day} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-black">{g.day}</span>
              <span className="h-px flex-1 bg-[rgba(26,29,33,0.3)]" />
            </div>
            {g.items.map((e, i) => (
              <div key={i} className="flex items-center gap-[60px]">
                <span className="w-[90px] shrink-0 text-xs font-medium text-[rgba(26,29,33,0.7)]">{fmtTime(e.ts)}</span>
                <span className="text-sm font-medium text-[#111315]">{e.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeviceDetailPage;
