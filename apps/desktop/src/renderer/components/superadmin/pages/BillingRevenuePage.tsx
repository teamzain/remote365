import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Download, MoreVertical, Check, ChevronDown, X, Receipt, Banknote, Clock, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { FilterIcon } from '../icons';
import api from '../../../lib/api';

/**
 * Super Admin → Billing & Revenue.
 * Real platform billing state from `GET /api/admin/billing` (gated by
 * `billing:viewRevenue`): one record per subscription, joined to its
 * organization and priced from the shared plan catalog. There is no payment
 * processor yet, so "revenue" is monthly-recurring value of active paid
 * subscriptions — not processed payments. Export Report downloads the
 * filtered records as CSV.
 */

type BillingStatus = 'Paid' | 'Trial' | 'Past Due' | 'Cancelled';

type BillingRecord = {
  id: string;
  organization: string;
  owner: string;
  planId: string;
  planName: string;
  priceLabel: string;
  amount: number | null;
  renewsOn: string | null;
  startedOn: string;
  users: number;
  status: BillingStatus;
};

type BillingStats = {
  monthlyRevenue: number;
  newRevenueThisMonth: number;
  paidSubscriptions: number;
  activeTrials: number;
  pastDue: number;
};

const STATUS_BADGE: Record<BillingStatus, string> = {
  Paid: 'bg-[#ECFDF3] text-[#34C759]',
  Trial: 'bg-[#F0F9FF] text-[#026AA2]',
  'Past Due': 'bg-[#FEF3F2] text-[#B42318]',
  Cancelled: 'bg-[#F5F5F5] text-[#414651]',
};

const RANGES = ['All Time', 'Renews In 7 Days', 'Renews In 30 Days', 'Overdue'] as const;
type Range = (typeof RANGES)[number];

const STATUS_FILTERS = ['All', 'Paid', 'Trial', 'Past Due', 'Cancelled'] as const;

const PAGE_SIZE = 7;
const MENU_H = 80; // 2 items × 40px

const money = (n: number) => `$${n.toLocaleString()}`;
const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

const inRange = (rec: BillingRecord, range: Range) => {
  if (range === 'All Time') return true;
  if (!rec.renewsOn) return false;
  const diff = new Date(rec.renewsOn).getTime() - Date.now();
  if (range === 'Overdue') return diff < 0 && rec.status !== 'Cancelled';
  const days = range === 'Renews In 7 Days' ? 7 : 30;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

const BillingRevenuePage: React.FC = () => {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [range, setRange] = useState<Range>('All Time');
  const [filterOpen, setFilterOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; bottom: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ stats: BillingStats; records: BillingRecord[] }>('/api/admin/billing');
      setRecords(res.data.records);
      setStats(res.data.stats);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((rec) => {
      if (statusFilter !== 'All' && rec.status !== statusFilter) return false;
      if (!inRange(rec, range)) return false;
      if (!term) return true;
      return `${rec.organization} ${rec.owner} ${rec.planName}`.toLowerCase().includes(term);
    });
  }, [records, query, statusFilter, range]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [query, statusFilter, range]);

  const cards = [
    {
      label: 'Monthly Revenue',
      value: stats ? money(stats.monthlyRevenue) : '—',
      delta: stats && stats.newRevenueThisMonth > 0 ? `(+${money(stats.newRevenueThisMonth)} this month)` : undefined,
      icon: Receipt,
    },
    { label: 'Paid Subscriptions', value: stats ? String(stats.paidSubscriptions) : '—', icon: Banknote },
    { label: 'Active Trials', value: stats ? String(stats.activeTrials) : '—', icon: Clock },
    { label: 'Past Due', value: stats ? String(stats.pastDue) : '—', icon: AlertCircle },
  ];

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setRowMenu((cur) => (cur?.id === id ? null : { id, x: r.right, bottom: r.bottom }));
  };

  const copyOwner = (rec: BillingRecord | undefined) => {
    if (rec) {
      try { navigator.clipboard?.writeText(rec.owner); } catch { /* clipboard unavailable */ }
      setNotice(`Copied ${rec.owner} to clipboard.`);
    }
    setRowMenu(null);
  };

  const exportReport = () => {
    const header = 'Organization,Owner,Plan,Price,Renews On,Started On,Users,Status';
    const lines = filtered.map((r) =>
      [r.organization, r.owner, r.planName, r.priceLabel, r.renewsOn ?? '', r.startedOn, r.users, r.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'billing-revenue.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Title + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-black">Billing & Revenue</h1>
          <p className="mt-1 text-sm text-black">Subscriptions, recurring revenue, and renewal status across organizations.</p>
        </div>
        <button
          onClick={exportReport}
          disabled={loading || !!error}
          className="inline-flex h-10 items-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
        >
          <Download size={16} /> Export Report
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-start justify-between rounded-xl border border-[rgba(26,29,33,0.2)] bg-white p-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1D21]">{s.label}</p>
                <p className="mt-3 text-lg font-semibold text-[#111315]">
                  {s.value}
                  {s.delta && <span className="ml-1 text-xs font-normal text-[#149D52]">{s.delta}</span>}
                </p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
                <Icon size={18} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Notice */}
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-[4px] border border-[#FFE2BF] bg-[#FFF6ED] px-4 py-3 text-sm text-[#B45309]">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 text-[#B45309]/70 hover:text-[#B45309]"><X size={16} /></button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative h-10 w-full max-w-[370px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(26,29,33,0.4)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Organizations, Owners..."
            className="h-full w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white pl-10 pr-4 text-sm text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Status filter */}
          <div className="relative">
            <button
              onClick={() => { setFilterOpen((o) => !o); setRangeOpen(false); }}
              className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"
            >
              <FilterIcon size={16} /> Filter{statusFilter !== 'All' && `: ${statusFilter}`}
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setFilterOpen(false); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[#F9FAFB] ${statusFilter === s ? 'font-medium text-[#FF8A00]' : 'text-[#111315]'}`}
                  >
                    {s}
                    {statusFilter === s && <Check size={16} className="shrink-0 text-[#FF8A00]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Renewal window */}
          <div className="relative">
            <button
              onClick={() => { setRangeOpen((o) => !o); setFilterOpen(false); }}
              className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"
            >
              {range}
              <ChevronDown size={16} className={`transition-transform ${rangeOpen ? 'rotate-180' : ''}`} />
            </button>
            {rangeOpen && (
              <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRange(r); setRangeOpen(false); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[#F9FAFB] ${range === r ? 'font-medium text-[#FF8A00]' : 'text-[#111315]'}`}
                  >
                    {r}
                    {range === r && <Check size={16} className="shrink-0 text-[#FF8A00]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subscriptions table */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
        <table className="w-full min-w-[840px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: '27%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr className="h-11 bg-[#F3F4F6]">
              <th className="rounded-tl-xl px-6 text-left align-middle">
                <span className="text-[12px] font-medium leading-[17px] text-[#111315]">Organization</span>
              </th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Plan</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Price</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Renews On</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Users</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Status</th>
              <th className="rounded-tr-xl px-6" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={7} className="px-6 py-12 text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading Billing Data…</span>
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={7} className="px-6 py-12 text-center">
                  <p className="text-sm text-[#D92D20]">{error}</p>
                  <button onClick={load} className="mt-3 inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"><RefreshCw size={14} /> Retry</button>
                </td>
              </tr>
            )}
            {!loading && !error && pageRows.length === 0 && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">
                  {records.length === 0 ? 'No subscriptions yet.' : 'No subscriptions match your filters.'}
                </td>
              </tr>
            )}
            {!loading && !error && pageRows.map((rec) => (
              <tr key={rec.id} className="h-[72px] border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                <td className="px-6 align-middle">
                  <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#111315]">{rec.organization}</p>
                      <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{rec.owner}</p>
                  </div>
                </td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{rec.planName}</td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{rec.priceLabel}</td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{dateLabel(rec.renewsOn)}</td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{rec.users}</td>
                <td className="px-6 text-center align-middle">
                  <span className={`inline-flex items-center whitespace-nowrap rounded-[16px] px-2 py-1 text-[10px] font-normal ${STATUS_BADGE[rec.status]}`}>{rec.status}</span>
                </td>
                <td className="px-6 align-middle">
                  <button
                    onClick={(e) => openRowMenu(e, rec.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F3F4F6] ${
                      rowMenu?.id === rec.id ? 'bg-[#F3F4F6] text-[#FF8A00]' : 'text-[rgba(26,29,33,0.6)]'
                    }`}
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
        const rec = records.find((r) => r.id === rowMenu.id);
        const topPos = Math.min(rowMenu.bottom + 6, window.innerHeight - MENU_H - 8);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
            <div
              className="fixed z-50 w-[170px] overflow-hidden rounded-[4px] bg-white shadow-[-4px_4px_12px_rgba(0,0,0,0.25)]"
              style={{ top: topPos, left: Math.max(8, rowMenu.x - 170) }}
            >
              <MenuItem label="Copy Owner Email" onClick={() => copyOwner(rec)} />
            </div>
          </>
        );
      })()}
    </div>
  );
};

const MenuItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className="flex h-10 w-full items-center px-4 text-sm font-medium text-[#111315] hover:bg-[#F9FAFB]">
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

export default BillingRevenuePage;
