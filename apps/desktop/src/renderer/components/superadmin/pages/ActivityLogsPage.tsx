import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Search, Loader2, ChevronDown } from 'lucide-react';
import api from '../../../lib/api';

/**
 * Super Admin → Organizations → Activity logs (per organization).
 * Reads the real audit trail from GET /api/organizations/:id/activity
 * (org created/suspended/activated/deleted, members joined, devices added, …),
 * grouped by day (Today / Yesterday / date) with a date-range filter.
 */

type OrgLike = {
  id: string;
  name: string;
  domain: string;
  plan: string;
  status: 'Active' | 'Suspended' | 'Deleted';
  created: string;
  createdAtMs: number;
};

type ApiLog = {
  id: string;
  action?: string;
  message: string;
  actorName?: string | null;
  createdAt: string;
};

type LogEvent = { id: string; ts: number; actor: string; text: string };

const RANGES = [
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 7 Days', days: 7 },
  { label: "Today's", days: 0 },
] as const;

const statusStyles: Record<OrgLike['status'], string> = {
  Active: 'bg-[#ECFDF3] text-[#34C759]',
  Suspended: 'bg-[#FEF3F2] text-[#D92D20]',
  Deleted: 'bg-[#F5F5F5] text-[#414651]',
};

const initials = (s: string) => (s || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

const dayLabel = (d: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dd.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
};

const ActivityLogsPage: React.FC<{ org: OrgLike; onBack: () => void }> = ({ org, onBack }) => {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<ApiLog[]>(`/api/organizations/${org.id}/activity`);
        if (alive) setLogs(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (alive) setError(err?.response?.data?.error || 'Failed to load activity.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [org.id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rangeRef.current && !rangeRef.current.contains(e.target as Node)) setRangeOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const rangeLabel = RANGES.find((r) => r.days === rangeDays)?.label ?? 'Last 30 Days';

  const events = useMemo<LogEvent[]>(() => {
    const cutoff = rangeDays === 0
      ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : Date.now() - rangeDays * 86400000;
    const q = query.trim().toLowerCase();
    return logs
      .map((l) => ({ id: l.id, ts: new Date(l.createdAt).getTime(), actor: l.actorName || org.name, text: l.message }))
      .filter((e) => !Number.isNaN(e.ts) && e.ts >= cutoff)
      .filter((e) => !q || e.text.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q))
      .sort((a, b) => b.ts - a.ts);
  }, [logs, org.name, query, rangeDays]);

  // Group events into consecutive day buckets.
  const groups = useMemo(() => {
    const out: { label: string; items: LogEvent[] }[] = [];
    events.forEach((e) => {
      const label = dayLabel(new Date(e.ts));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    });
    return out;
  }, [events]);

  const exportCsv = () => {
    const header = ['Date', 'Time', 'Actor', 'Activity'];
    const body = events.map((e) => [new Date(e.ts).toLocaleDateString(), new Date(e.ts).toLocaleTimeString(), e.actor, e.text]);
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${org.domain || 'organization'}-activity.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Title + Export */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-lg font-semibold text-black hover:opacity-70">
          <ArrowLeft size={20} />
          Activity Logs
        </button>
        <button
          onClick={exportCsv}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
        >
          <Download size={16} />
          Download CSV
        </button>
      </div>

      {/* Org header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-lg font-medium text-[#7F56D9]">
          {initials(org.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[#111315]">{org.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[rgba(17,19,21,0.6)]">{org.plan} plan</span>
            <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${statusStyles[org.status]}`}>{org.status}</span>
            <span className="text-xs font-medium text-[#000000]">Created: {org.created}</span>
          </div>
        </div>
      </div>

      {/* Search (left) + date-range filter (right corner) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-full items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] px-4 sm:max-w-[370px]">
          <Search size={16} className="text-[rgba(26,29,33,0.4)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Activity..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(17,19,21,0.4)]"
          />
        </div>
        <div className="relative" ref={rangeRef}>
          <button
            onClick={() => setRangeOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"
          >
            {rangeLabel}
            <ChevronDown size={16} className={rangeOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {rangeOpen && (
            <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => { setRangeDays(r.days); setRangeOpen(false); }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-[#F9FAFB] ${r.days === rangeDays ? 'text-[#FF8A00]' : 'text-[#111315]'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-7">
        {loading && (
          <div className="flex items-center gap-2 py-10 text-sm text-[rgba(17,19,21,0.6)]">
            <Loader2 size={16} className="animate-spin" /> Loading Activity…
          </div>
        )}
        {!loading && error && <p className="py-10 text-sm text-[#D92D20]">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="py-10 text-sm text-[rgba(17,19,21,0.5)]">No activity{query ? ' matches your search' : ' in this period'}.</p>
        )}

        {!loading && !error && groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-black">{g.label}</span>
              <span className="h-px flex-1 bg-[rgba(26,29,33,0.3)]" />
            </div>
            {g.items.map((e) => (
              <div key={e.id} className="flex items-center gap-[60px]">
                <span className="w-[72px] shrink-0 text-xs font-medium text-[rgba(26,29,33,0.7)]">
                  {new Date(e.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[12px] font-medium text-[#7F56D9]">
                    {initials(e.actor)}
                  </div>
                  <span className="text-sm font-medium text-[#111315]">{e.text}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLogsPage;
