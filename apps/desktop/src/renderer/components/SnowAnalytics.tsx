import React, { useState, useEffect } from 'react';
import {
  Users, Building2, Monitor, TrendingUp, ArrowUpRight,
  Activity, PieChart as PieIcon, DollarSign, ExternalLink
} from 'lucide-react';
import api from '../lib/api';

interface AnalyticsData {
  users: {
    total: number;
    last24h: number;
    last7d: number;
    trend: { date: string; count: number }[];
  };
  orgs: { total: number };
  devices: {
    total: number;
    health?: {
      cpuUsage: number;
      memoryLoad: number;
      bandwidth: string;
      adapterUsage: number;
    };
  };
  recentUsers: any[];
}

interface RevenueData {
  totalRevenue: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  subscriptions: { plan: string; _count: number }[];
}

const ROLE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  SUPER_ADMIN: { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500' },
  OWNER:       { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  ADMIN:       { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
  TECHNICIAN:  { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400' },
  VIEWER:      { bg: 'bg-slate-50',  text: 'text-slate-500',  dot: 'bg-slate-400' },
};

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500',  'bg-rose-500', 'bg-cyan-500',
];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface Props {
  onSelectOrg?: (orgId: string) => void;
  onPayoutClick?: () => void;
}

export const SnowAnalytics: React.FC<Props> = ({ onSelectOrg, onPayoutClick }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowLoading, setRowLoading] = useState<number | null>(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, revenueRes] = await Promise.allSettled([
        api.get('/api/analytics/summary'),
        api.get('/api/billing/revenue'),
      ]);

      if (analyticsRes.status === 'fulfilled') {
        const body = analyticsRes.value.data;
        if (body && typeof body === 'object' && 'users' in body) {
          setData(body);
        } else {
          const status = analyticsRes.value.status;
          console.error('[Analytics] Unexpected response:', status, body);
          setError(`Server returned status ${status} with unexpected body. Check server logs — Prisma may have failed.`);
        }
      } else {
        const reason = (analyticsRes as PromiseRejectedResult).reason;
        const msg = reason?.response?.data?.error || reason?.message || 'Failed to load analytics data.';
        setError(`${reason?.response?.status ? `[${reason.response.status}] ` : ''}${msg}`);
      }

      setRevenue(
        revenueRes.status === 'fulfilled'
          ? revenueRes.value.data
          : { totalRevenue: 0, availableBalance: 0, pendingBalance: 0, currency: 'usd', subscriptions: [] }
      );
    } catch (err: any) {
      setError('Unexpected error loading analytics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="w-12 h-12 border-4 border-[rgba(28,28,28,0.05)] border-t-[#1C1C1C] rounded-full animate-spin mb-4" />
      <p className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em]">Aggregating Platform Data...</p>
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-16 h-16 bg-red-50 rounded-[24px] flex items-center justify-center">
        <Activity size={28} className="text-red-400" />
      </div>
      <p className="text-sm font-bold text-[#1C1C1C]">Analytics Unavailable</p>
      <p className="text-xs text-[rgba(28,28,28,0.4)] max-w-sm text-center leading-relaxed">
        {error ?? 'No data returned from the analytics API.'}
      </p>
      <p className="text-[11px] text-[rgba(28,28,28,0.25)] max-w-sm text-center">
        Endpoint: <span className="font-mono">/api/analytics/summary</span> — ensure the server is deployed and the PlatformSettings migration has run.
      </p>
      <button onClick={fetchStats} className="mt-2 px-6 py-2.5 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all">
        Retry
      </button>
    </div>
  );

  const maxTrend = Math.max(...data.users.trend.map(t => t.count), 1);

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 animate-in fade-in duration-700">

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',   value: data.users?.total,                                    icon: Users,     accent: '#6366F1', light: '#EEF2FF' },
          { label: 'Devices',       value: data.devices?.total,                                  icon: Monitor,   accent: '#10B981', light: '#ECFDF5' },
          { label: 'Organizations', value: data.orgs?.total,                                     icon: Building2, accent: '#8B5CF6', light: '#F5F3FF' },
          { label: 'Revenue',       value: `$${revenue?.totalRevenue?.toFixed(2) ?? '0.00'}`,    icon: DollarSign,accent: '#F59E0B', light: '#FFFBEB' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.light }}>
                <s.icon size={18} style={{ color: s.accent }} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: s.light, color: s.accent }}>
                <TrendingUp size={9} /> +12%
              </span>
            </div>
            <p className="text-2xl font-black text-[#1C1C1C] tracking-tight">{s.value}</p>
            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] p-7 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-black text-[#1C1C1C] uppercase tracking-tight">Registration Trend</h3>
              <p className="text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest mt-0.5">New Users · Last 7 Days</p>
            </div>
            <span className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] bg-[#F9F9FA] px-3 py-1.5 rounded-xl border border-[rgba(28,28,28,0.05)]">Weekly</span>
          </div>
          <div className="h-48 flex items-end justify-between gap-3 px-1">
            {data.users.trend.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar">
                <div className="relative w-full flex flex-col items-center">
                  <div className="absolute -top-8 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-[#1C1C1C] text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10">
                    {t.count} users
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-[#E8E8E8] group-hover/bar:bg-[#1C1C1C] transition-colors duration-200"
                    style={{ height: `${Math.max((t.count / maxTrend) * 180, 6)}px` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase">{t.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subscriptions */}
        <div className="bg-[#0F0F0F] rounded-2xl p-7 text-white shadow-xl flex flex-col">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <PieIcon size={17} className="text-white/70" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest">Subscriptions</h3>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Paid Plans</p>
            </div>
          </div>
          <div className="space-y-5 flex-grow">
            {['PRO', 'BUSINESS', 'ENTERPRISE'].map((plan) => {
              const stat = revenue?.subscriptions.find(s => s.plan === plan);
              const count = stat?._count || 0;
              const totalSubs = revenue?.subscriptions.reduce((acc, s) => acc + s._count, 0) || 1;
              const pct = Math.round((count / totalSubs) * 100);
              const colors: Record<string, string> = { PRO: '#818CF8', BUSINESS: '#A78BFA', ENTERPRISE: '#FCD34D' };
              return (
                <div key={plan}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[11px] font-black tracking-widest text-white/80">{plan}</span>
                    <span className="text-[11px] font-mono text-white/40">{count}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: colors[plan] }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Available Payout</p>
              <p className="text-xl font-black">${revenue?.availableBalance?.toFixed(2) ?? '0.00'}</p>
            </div>
            <button
              onClick={onPayoutClick}
              className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/20 rounded-xl flex items-center justify-center hover:bg-emerald-500/30 active:scale-95 transition-all"
            >
              <ArrowUpRight size={18} className="text-emerald-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Health Metrics ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] p-7 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black text-[#1C1C1C] uppercase tracking-tight">Platform Health</h3>
            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest mt-0.5">Simulated avg across registered devices</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">All Systems Online</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'CPU Usage', value: data.devices?.health?.cpuUsage,    unit: '%',     color: '#6366F1' },
            { label: 'Memory',    value: data.devices?.health?.memoryLoad,  unit: '%',     color: '#8B5CF6' },
            { label: 'Bandwidth', value: data.devices?.health?.bandwidth,   unit: ' Mbps', color: '#F59E0B' },
            { label: 'Adapter',   value: data.devices?.health?.adapterUsage, unit: '%',    color: '#10B981' },
          ].map((m, i) => (
            <div key={i}>
              <div className="flex justify-between mb-2">
                <span className="text-[11px] font-black text-[#1C1C1C] uppercase tracking-wide">{m.label}</span>
                <span className="text-[11px] font-mono text-[rgba(28,28,28,0.4)]">{m.value}{m.unit}</span>
              </div>
              <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: m.unit === ' Mbps' ? '65%' : `${m.value}%`, background: m.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Sign-ups ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-[rgba(28,28,28,0.04)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-[#1C1C1C] uppercase tracking-tight">Recent Sign-Ups</h3>
            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest mt-0.5">Click a row to view the full organization profile</p>
          </div>
          <button className="text-[10px] font-black text-[#1C1C1C] uppercase tracking-widest bg-[#F9F9FA] px-4 py-2 rounded-xl border border-[rgba(28,28,28,0.06)] hover:bg-white hover:border-[rgba(28,28,28,0.15)] transition-all flex items-center gap-2">
            <ExternalLink size={11} /> View All
          </button>
        </div>

        <div className="divide-y divide-[rgba(28,28,28,0.04)]">
          {data.recentUsers.map((u, i) => {
            const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES['VIEWER'];
            const initials = (u.name?.[0] ?? u.email[0]).toUpperCase();
            const aColor = avatarColor(u.email);
            const hasOrg = !!u.organization?.name;
            const isRowLoading = rowLoading === i;

            const handleClick = async () => {
              if (!hasOrg || !onSelectOrg || isRowLoading) return;
              if (u.organization?.id) {
                onSelectOrg(u.organization.id);
                return;
              }
              // org id not in analytics payload — look it up by name
              setRowLoading(i);
              try {
                const { data: orgs } = await api.get('/api/organizations');
                const match = orgs.find((o: any) => o.name === u.organization.name);
                if (match?.id) onSelectOrg(match.id);
              } catch {}
              finally { setRowLoading(null); }
            };

            return (
              <button
                key={i}
                onClick={handleClick}
                className={`w-full flex items-center gap-4 px-7 py-4 transition-colors text-left group ${hasOrg ? 'hover:bg-[#FAFAFA] active:bg-[#F5F5F5] cursor-pointer' : 'cursor-default opacity-50'}`}
              >
                <div className={`w-10 h-10 rounded-2xl ${aColor} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}>
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1C1C1C] truncate">{u.name || 'Anonymous'}</p>
                  <p className="text-[11px] text-[rgba(28,28,28,0.4)] font-medium truncate">{u.email}</p>
                </div>

                <div className="hidden md:block w-44 flex-shrink-0">
                  <p className="text-[11px] font-bold text-[rgba(28,28,28,0.5)] truncate">{u.organization?.name || 'Personal'}</p>
                </div>

                <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${rs.bg} flex-shrink-0`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                  <span className={`text-[10px] font-black uppercase tracking-wider ${rs.text}`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </div>

                <div className="hidden lg:block w-24 flex-shrink-0 text-right">
                  <p className="text-[11px] font-mono text-[rgba(28,28,28,0.35)]">
                    {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>
                </div>

                <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${hasOrg ? 'text-[rgba(28,28,28,0.2)] group-hover:bg-[#F0F0F0] group-hover:text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.1)]'}`}>
                  {isRowLoading
                    ? <div className="w-3.5 h-3.5 border-2 border-[rgba(28,28,28,0.15)] border-t-[#1C1C1C] rounded-full animate-spin" />
                    : <ArrowUpRight size={14} />
                  }
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
