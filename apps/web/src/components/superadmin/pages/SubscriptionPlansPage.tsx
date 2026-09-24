import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, MoreVertical, Check, RefreshCw, Loader2, ChevronDown, ArrowUpDown,
  Eye, Pencil, Power, Trash2, Star, X,
} from 'lucide-react';
import { FilterIcon } from '../icons';
import PlanFormPage from './PlanFormPage';
import type { PlanDraft } from './PlanFormPage';
import PlanDetailPage from './PlanDetailPage';
import api from '../../../lib/api';
import RemoveModal from '../RemoveModal';

/**
 * Super Admin → Subscription Plans.
 * Full CRUD over the merged plan catalog via /api/admin/plans: built-in plans
 * can be edited (stored as overrides) or disabled, and brand-new custom plans
 * persist to the PlanDef table. Whatever is Active here is exactly what the
 * desktop and mobile apps list through GET /api/billing/plans.
 */

type ApiPlan = {
  id: string;
  name: string;
  price: number | 'Custom';
  priceLabel: string;
  currency?: string;
  billingPeriod?: string;
  description: string;
  maxDevices: number | null;
  maxUsers: number | null;
  maxConcurrentSessions: number | null;
  auditRetentionDays?: number | 'Custom';
  trialDays?: number;
  autoConvert?: boolean;
  trialReminder?: string | null;
  features: string[];
  popular?: boolean;
  status?: string;
  isCustom?: boolean;
  customized?: boolean;
  updatedAt?: string | null;
  subscribers?: number;
  paying?: number;
};

// Only real data is surfaced. `subscribers` and `status` come from the billing
// API; `monthlyRevenue` is derived from real subscribers × price. Growth /
// active-devices / renewal-rate are NOT tracked yet, so they are null and the
// UI omits them rather than showing invented figures.
export type Plan = ApiPlan & {
  subscribers: number;
  paying: number;
  monthlyRevenue: number | null;
  status: 'Active' | 'Draft' | 'Archived' | 'Disabled';
  createdOn: string | null;
  lastModified: string | null;
  isCustom: boolean;
  customized: boolean;
};

const PLAN_STATUSES: Plan['status'][] = ['Active', 'Draft', 'Archived', 'Disabled'];

const enrich = (p: ApiPlan): Plan => {
  const subscribers = p.subscribers ?? 0;
  const paying = p.paying ?? 0;
  // Monthly-recurring value the way Billing & Revenue counts it: only paying
  // (ACTIVE, non-trial) rows, yearly prices spread over 12 months, one-time
  // prices don't recur. Subscribers × list price counted trials and past-due
  // rows and priced yearly plans at 12×.
  const monthly = typeof p.price !== 'number' ? null
    : p.billingPeriod === 'Yearly' ? p.price / 12
    : p.billingPeriod === 'One-time' ? 0
    : p.price;
  return {
    ...p,
    subscribers,
    paying,
    monthlyRevenue: monthly == null ? null : Math.round(paying * monthly * 100) / 100,
    status: PLAN_STATUSES.includes(p.status as Plan['status']) ? (p.status as Plan['status']) : 'Active',
    createdOn: (p as any).createdAt
      ? new Date((p as any).createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      : null,
    lastModified: p.updatedAt
      ? new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      : null,
    isCustom: !!p.isCustom,
    customized: !!p.customized,
  };
};

type SortKey = 'priceAsc' | 'priceDesc' | 'subscribers' | 'name';
type PriceFilter = 'Free' | 'Paid' | 'Custom';

const PAGE_SIZE = 8;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'priceAsc', label: 'Price: low to high' },
  { key: 'priceDesc', label: 'Price: high to low' },
  { key: 'subscribers', label: 'Most subscribers' },
  { key: 'name', label: 'Name: A to Z' },
];

const PRICE_OPTIONS: PriceFilter[] = ['Free', 'Paid', 'Custom'];


export const limitLabel = (n: number | null) => (n === null ? 'Unlimited' : String(n));
const priceValue = (p: number | 'Custom') => (p === 'Custom' ? Number.POSITIVE_INFINITY : p);

const STATUS_BADGE: Record<Plan['status'], string> = {
  Active: 'bg-[#ECFDF3] text-[#34C759]',
  Draft: 'bg-[#FFF6ED] text-[#FF8A00]',
  Archived: 'bg-[#F3F4F6] text-[rgba(17,19,21,0.6)]',
  Disabled: 'bg-[#F3F4F6] text-[rgba(17,19,21,0.6)]',
};

const SubscriptionPlansPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  // filters + sort
  const [fPrice, setFPrice] = useState<PriceFilter | null>(null);
  const [fPopular, setFPopular] = useState(false);
  const [sort, setSort] = useState<SortKey>('priceAsc');
  const [openSec, setOpenSec] = useState({ price: true, highlight: false });

  const [menu, setMenu] = useState<'filters' | 'sort' | null>(null);
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; bottom: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  // Archive and Delete confirm first, like every other destructive action in
  // the console; they used to fire straight from the row menu.
  const [pendingPlanAction, setPendingPlanAction] = useState<{ kind: 'archive' | 'delete'; plan: Plan } | null>(null);
  const [planActionBusy, setPlanActionBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/admin/plans');
      setPlans(((res.data?.plans || []) as ApiPlan[]).map(enrich));
    } catch (e: any) {
      // No silent fallback catalog: a hand-copied list looked live and left
      // Edit/Archive/Delete enabled against a server that wasn't answering.
      setPlans([]);
      setError(e?.response?.data?.error || 'Could not load plans from the server. Check your connection and try again.');
    }
    setLoading(false);
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
    const rows = plans.filter((p) => {
      if (fPopular && !p.popular) return false;
      if (fPrice) {
        if (fPrice === 'Free' && p.price !== 0) return false;
        if (fPrice === 'Paid' && !(typeof p.price === 'number' && p.price > 0)) return false;
        if (fPrice === 'Custom' && p.price !== 'Custom') return false;
      }
      if (q && !(p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))) return false;
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'priceDesc': return priceValue(b.price) - priceValue(a.price);
        case 'subscribers': return b.subscribers - a.subscribers;
        case 'name': return a.name.localeCompare(b.name);
        case 'priceAsc':
        default: return priceValue(a.price) - priceValue(b.price);
      }
    });
    return sorted;
  }, [plans, query, fPrice, fPopular, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [query, fPrice, fPopular, sort]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [fPrice, fPopular ? 'popular' : null].filter(Boolean).length;
  const clearAllFilters = () => { setFPrice(null); setFPopular(false); };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(null);
    setRowMenu((cur) => (cur?.id === id ? null : { id, x: r.right, bottom: r.bottom }));
  };

  const toggleStatus = async (id: string) => {
    setRowMenu(null);
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    const nextStatus = p.status === 'Active' ? 'Archived' : 'Active';
    try {
      const res = await api.put(`/api/admin/plans/${id}`, { status: nextStatus });
      setPlans((prev) => prev.map((x) => (x.id === id ? { ...enrich({ ...(res.data.plan as ApiPlan), subscribers: x.subscribers, paying: x.paying }) } : x)));
      setNotice(nextStatus === 'Archived'
        ? `"${p.name}" is archived — it no longer appears in the desktop and mobile plan lists.`
        : `"${p.name}" is active again and visible in the apps.`);
    } catch (e: any) {
      setNotice(e?.response?.data?.error || 'Status change failed.');
    }
  };

  const deletePlan = async (id: string) => {
    setRowMenu(null);
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    if (!p.isCustom) {
      setNotice('Built-in plans cannot be deleted — disable them instead.');
      return;
    }
    try {
      await api.delete(`/api/admin/plans/${id}`);
      setPlans((prev) => prev.filter((x) => x.id !== id));
      setNotice(`Plan "${p.name}" was deleted.`);
    } catch (e: any) {
      setNotice(e?.response?.data?.error || 'Delete failed.');
    }
  };

  const askToggleStatus = (id: string) => {
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    // Re-activating is harmless; only archiving needs a confirmation.
    if (p.status !== 'Active') { void toggleStatus(id); return; }
    setRowMenu(null);
    setPendingPlanAction({ kind: 'archive', plan: p });
  };

  const askDeletePlan = (id: string) => {
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    setRowMenu(null);
    if (!p.isCustom) { setNotice('Built-in plans cannot be deleted — archive them instead.'); return; }
    setPendingPlanAction({ kind: 'delete', plan: p });
  };

  const confirmPlanAction = async () => {
    if (!pendingPlanAction) return;
    setPlanActionBusy(true);
    try {
      if (pendingPlanAction.kind === 'archive') await toggleStatus(pendingPlanAction.plan.id);
      else await deletePlan(pendingPlanAction.plan.id);
    } finally {
      setPlanActionBusy(false);
      setPendingPlanAction(null);
    }
  };

  const resetPlan = async (id: string) => {
    setRowMenu(null);
    const p = plans.find((x) => x.id === id);
    try {
      const res = await api.post(`/api/admin/plans/${id}/reset`);
      setPlans((prev) => prev.map((x) => (x.id === id ? { ...enrich({ ...(res.data.plan as ApiPlan), subscribers: x.subscribers, paying: x.paying }) } : x)));
      setNotice(`"${p?.name ?? id}" was reset to the built-in default.`);
    } catch (e: any) {
      setNotice(e?.response?.data?.error || 'Reset failed.');
    }
  };

  // PlanFormPage draft → admin plans API body.
  const draftToBody = (draft: PlanDraft) => ({
    name: draft.name,
    description: draft.description,
    price: draft.price,
    priceLabel: draft.priceLabel,
    currency: draft.currency,
    billingPeriod: draft.billingPeriod,
    maxDevices: draft.maxDevices || null,
    maxUsers: draft.maxMembers || null,
    maxConcurrentSessions: draft.maxSessions || null,
    trialDays: draft.offerTrial === 'Yes' ? draft.trialDays || null : null,
    autoConvert: draft.offerTrial === 'Yes' && draft.autoConvert === 'Yes',
    trialReminder: draft.offerTrial === 'Yes' ? draft.trialReminder : null,
    auditRetentionDays: draft.auditRetention === 'No retention'
      ? null
      : draft.auditRetention === 'Custom'
        ? 'Custom'
        : String(draft.auditRetention === '1 year' ? 365 : parseInt(draft.auditRetention, 10) || ''),
    popular: draft.highlight === 'Popular',
    status: draft.status,
    features: draft.features.map((f) => f.trim()).filter(Boolean),
  });

  const planToDraft = (p: Plan): PlanDraft => ({
    name: p.name,
    status: p.status === 'Disabled' ? 'Archived' : p.status,
    highlight: p.popular ? 'Popular' : 'Standard',
    description: p.description,
    price: p.price === 'Custom' ? 'Custom' : String(p.price),
    billingPeriod: p.billingPeriod || (p.price === 'Custom' ? 'Custom' : p.price === 0 ? 'One-time' : 'Monthly'),
    priceLabel: p.priceLabel,
    currency: p.currency || 'USD',
    offerTrial: p.trialDays ? 'Yes' : 'No',
    trialDays: p.trialDays ? String(p.trialDays) : '14',
    autoConvert: (p.autoConvert ?? true) ? 'Yes' : 'No',
    trialReminder: p.trialReminder || 'None',
    maxDevices: p.maxDevices == null ? '' : String(p.maxDevices),
    maxMembers: p.maxUsers == null ? '' : String(p.maxUsers),
    maxSessions: p.maxConcurrentSessions == null ? '' : String(p.maxConcurrentSessions),
    auditRetention: p.auditRetentionDays == null
      ? 'No retention'
      : p.auditRetentionDays === 'Custom' ? 'Custom' : p.auditRetentionDays === 365 ? '1 year' : `${p.auditRetentionDays} days`,
    features: [...(p.features || [])],
  });

  // Plan detail takes over the page until dismissed.
  if (detail) {
    return <PlanDetailPage plan={detail} onBack={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); }} />;
  }

  // Create / edit form takes over the page until dismissed.
  if (creating || editing) {
    const isEdit = !!editing;
    return (
      <PlanFormPage
        mode={isEdit ? 'edit' : 'create'}
        initial={editing ? planToDraft(editing) : undefined}
        toast={editing ? `This plan has ${editing.subscribers.toLocaleString()} active subscriptions. Changes to limits will affect future billing.` : undefined}
        onBack={() => { setCreating(false); setEditing(null); }}
        onCreated={async (draft) => {
          const body = draftToBody(draft);
          try {
            if (isEdit) await api.put(`/api/admin/plans/${editing!.id}`, body);
            else await api.post('/api/admin/plans', body);
          } catch (e: any) {
            throw new Error(e?.response?.data?.error || 'Saving the plan failed.');
          }
          setCreating(false); setEditing(null);
          setNotice(isEdit
            ? `Plan "${draft.name || 'Untitled'}" updated — the desktop and mobile apps see the change immediately.`
            : `Plan "${draft.name || 'Untitled'}" created — it now appears in the desktop and mobile plan lists.`);
          load();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-7" ref={rootRef}>
      {/* Title + CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-black">Subscription Plans</h1>
          <p className="mt-1 text-sm text-black/70">Plans, pricing and limits available to organizations across the platform.</p>
        </div>
        <button
          onClick={() => { setNotice(null); setCreating(true); }}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
        >
          <Plus size={16} />
          Add New Plan
        </button>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-full items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] px-4 sm:max-w-[370px]">
          <Search size={16} className="text-[rgba(26,29,33,0.4)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plans..."
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
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A00] px-1 text-[11px] font-semibold text-white">{activeFilterCount}</span>
              )}
            </button>
            {menu === 'filters' && (
              <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                <button
                  onClick={clearAllFilters}
                  className={`flex w-full items-center justify-between border-b border-[rgba(26,29,33,0.08)] px-4 py-2.5 text-sm font-medium ${activeFilterCount === 0 ? 'text-[#FF8A00]' : 'text-[#111315]'} hover:bg-[#F9FAFB]`}
                >
                  All Plans
                </button>
                <FilterSection
                  title="Pricing"
                  open={openSec.price}
                  onToggle={() => setOpenSec((s) => ({ ...s, price: !s.price }))}
                  options={PRICE_OPTIONS}
                  value={fPrice}
                  onSelect={(v) => setFPrice((c) => (c === v ? null : (v as PriceFilter)))}
                />
                <div className="border-b border-[rgba(26,29,33,0.06)] last:border-b-0">
                  <button onClick={() => setOpenSec((s) => ({ ...s, highlight: !s.highlight }))} className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-[#111315] hover:bg-[#F9FAFB]">
                    Highlight
                    <ChevronDown size={16} className={`text-[rgba(17,19,21,0.6)] transition-transform ${openSec.highlight ? '' : '-rotate-90'}`} />
                  </button>
                  {openSec.highlight && (
                    <div className="pb-1">
                      <button onClick={() => setFPopular((v) => !v)} className="flex w-full items-center justify-between px-4 py-2 text-sm text-[#111315] hover:bg-[#F9FAFB]">
                        <span>Popular only</span>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${fPopular ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.4)]'}`}>
                          {fPopular && <span className="h-2 w-2 rounded-full bg-[#FF8A00]" />}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sort by */}
          <div className="relative">
            <button
              onClick={() => setMenu((m) => (m === 'sort' ? null : 'sort'))}
              className={`inline-flex h-10 items-center gap-2 rounded-[4px] border px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6] ${menu === 'sort' ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)]'}`}
            >
              <ArrowUpDown size={16} />
              Sort by
              <ChevronDown size={16} className={menu === 'sort' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {menu === 'sort' && (
              <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSort(opt.key); setMenu(null); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-[#111315] hover:bg-[#F9FAFB]"
                  >
                    {opt.label}
                    {sort === opt.key && <Check size={16} className="text-[#FF8A00]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-[4px] border border-[#FFE2BF] bg-[#FFF6ED] px-4 py-3 text-sm text-[#B45309]">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 text-[#B45309]/70 hover:text-[#B45309]"><X size={16} /></button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
        <table className="w-full min-w-[840px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: '32%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr className="h-11 bg-[#F3F4F6]">
              <th className="rounded-tl-xl px-6 text-left align-middle">
                <span className="text-[12px] font-medium leading-[17px] text-[#111315]">Plan</span>
              </th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Price</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Devices</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Members</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Subscribers</th>
              <th className="px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Status</th>
              <th className="rounded-tr-xl px-6" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={7} className="px-6 py-12 text-center"><span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading plans…</span></td></tr>
            )}
            {!loading && error && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={7} className="px-6 py-12 text-center"><p className="text-sm text-[#D92D20]">{error}</p><button onClick={load} className="mt-3 inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"><RefreshCw size={14} /> Retry</button></td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]"><td colSpan={7} className="px-6 py-12 text-center text-sm text-[rgba(17,19,21,0.5)]">{plans.length === 0 ? 'No plans found.' : 'No plans match your filters.'}</td></tr>
            )}
            {!loading && !error && pageRows.map((p) => (
              <tr key={p.id} onClick={() => setDetail(p)} className="h-[72px] cursor-pointer border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                <td className="px-6 align-middle">
                  <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-[#111315]">{p.name}</p>
                        {p.popular && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF6ED] px-2 py-0.5 text-[10px] font-medium text-[#FF8A00]">
                            <Star size={9} className="fill-[#FF8A00]" /> Popular
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{p.description}</p>
                  </div>
                </td>
                <td className="px-6 align-middle text-sm font-medium text-[#111315]">{p.priceLabel}</td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{limitLabel(p.maxDevices)}</td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{limitLabel(p.maxUsers)}</td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{p.subscribers}</td>
                <td className="px-6 align-middle">
                  <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                </td>
                <td className="px-6 align-middle" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => openRowMenu(e, p.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] ${rowMenu?.id === p.id ? 'bg-[#F3F4F6]' : ''}`}
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
        const p = plans.find((x) => x.id === rowMenu.id);
        const items = 3 + (p?.customized ? 1 : 0) + (p?.isCustom ? 1 : 0);
        const menuH = items * 46;
        const topPos = Math.min(rowMenu.bottom + 6, window.innerHeight - menuH - 8);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
            <div className="fixed z-50 w-52 overflow-hidden rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl" style={{ top: topPos, left: Math.max(8, rowMenu.x - 208) }}>
              <RowItem icon={Eye} label="View Details" onClick={() => { if (p) setDetail(p); setRowMenu(null); }} />
              <RowItem icon={Pencil} label="Edit Plan" onClick={() => { if (p) setEditing(p); setRowMenu(null); }} />
              <RowItem icon={Power} label={p?.status === 'Active' ? 'Archive Plan' : 'Activate Plan'} onClick={() => askToggleStatus(rowMenu.id)} />
              {p?.customized && <RowItem icon={RefreshCw} label="Reset to Default" onClick={() => resetPlan(rowMenu.id)} />}
              {p?.isCustom && <RowItem icon={Trash2} label="Delete Plan" danger onClick={() => askDeletePlan(rowMenu.id)} />}
            </div>
          </>
        );
      })()}

      {pendingPlanAction && (
        <RemoveModal
          icon={pendingPlanAction.kind === 'archive' ? Power : Trash2}
          title={pendingPlanAction.kind === 'archive' ? `Archive "${pendingPlanAction.plan.name}"?` : `Delete "${pendingPlanAction.plan.name}"?`}
          message={pendingPlanAction.kind === 'archive'
            ? 'Archived plans disappear from the desktop and mobile plan lists immediately. The server refuses this while subscriptions are still on the plan.'
            : 'This permanently removes the plan. It only works when no subscription is on it.'}
          confirmLabel={pendingPlanAction.kind === 'archive' ? 'Archive' : 'Delete'}
          loading={planActionBusy}
          onConfirm={confirmPlanAction}
          onCancel={() => { if (!planActionBusy) setPendingPlanAction(null); }}
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

const RowItem: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; onClick: () => void; danger?: boolean;
}> = ({ icon: Icon, label, onClick, danger }) => (
  <button onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F9FAFB] ${danger ? 'text-[#D92D20] hover:bg-[#FEF3F2]' : 'text-[#111315]'}`}>
    <Icon size={16} className={danger ? 'text-[#D92D20]' : 'text-[rgba(17,19,21,0.6)]'} />
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

export default SubscriptionPlansPage;
