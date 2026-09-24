import React, { useEffect, useState } from 'react';
import { Globe, Users, Monitor, Network, Ticket, CheckCircle2, CreditCard, Clock } from 'lucide-react';
import api from '../../../lib/api';

/**
 * Super Admin -> Home.
 * Platform overview wired to real metrics from `GET /api/admin/overview`
 * (gated server-side by `audit:viewPlatform`). Charts animate on mount and the
 * stats silently refetch so live figures (active sessions etc.) stay current.
 */

type IconType = React.ComponentType<{ size?: number; className?: string }>;
type NavTarget = 'organizations' | 'users' | 'devices' | 'sessions';

type Overview = {
  stats: {
    totalOrganizations: number; activeOrganizations: number; paidOrganizations: number; trialOrganizations: number;
    totalUsers: number; totalDevices: number; activeSessions: number; openTickets: number;
  };
  deltas: { totalOrganizations: number; totalUsers: number; totalDevices: number };
  orgGrowth: { month: string; total: number; new: number }[];
  userGrowth: { month: string; value: number }[];
  loginTrend: { month: string; value: number }[];
  topOrganizations: { name: string; members: number; pct: number }[];
  planDistribution: { label: string; value: number }[];
  sessionsTrend: { month: string; value: number }[];
  deviceTrend: { month: string; value: number }[];
};

// Orange-family palette to match the dashboard design.
const PLAN_COLORS = ['#FF8A00', '#FFB347', '#FFD497', '#FFC069', '#FFE3BF'];

// ---------------------------------------------------------------- bar (twin)
const AnimatedBarChart: React.FC<{ data: { cur: number; prev: number }[]; labels: string[] }> = ({ data, labels }) => {
  const [animated, setAnimated] = useState(false);
  const chartMax = Math.max(1, ...data.flatMap((d) => [d.cur, d.prev]));

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="relative h-44">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-[#E2E7E7]" />
          ))}
        </div>
        <div className="relative flex h-full items-end justify-between gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center gap-1">
              <div
                className="w-2 rounded-t-sm bg-[#FF8A00] transition-all duration-1000 ease-out"
                style={{ height: animated ? `${(d.cur / chartMax) * 100}%` : '0%' }}
              />
              <div
                className="w-2 rounded-t-sm bg-[#FFD497] transition-all duration-1000 ease-out delay-100"
                style={{ height: animated ? `${(d.prev / chartMax) * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between px-1">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-[rgba(26,29,33,0.5)]">{l}</span>
        ))}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------- donut
const AnimatedPieChart: React.FC<{ data: { label: string; value: number }[]; centerLabel: string }> = ({ data, centerLabel }) => {
  const [animated, setAnimated] = useState(false);
  const total = data.reduce((s, d) => s + d.value, 0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (total === 0) {
    return <div className="flex h-[124px] items-center justify-center text-sm text-black/40">No data yet</div>;
  }

  let acc = 0;
  const stops = data
    .map((d, i) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${PLAN_COLORS[i % PLAN_COLORS.length]} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-[124px] w-[124px]">
        <div
          className="h-full w-full rounded-full transition-all duration-[900ms] ease-out"
          style={{
            background: `conic-gradient(${stops})`,
            opacity: animated ? 1 : 0,
            transform: animated ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.8)',
          }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white">
            <span className="text-base font-semibold text-[#111315]">{total}</span>
            <span className="text-[10px] text-black/50">{centerLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------- axis helpers
// Round an axis maximum up to a clean number (5, 10, 20, 50, 100, ...).
function niceCeil(n: number): number {
  if (n <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}
const fmtAxis = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

// ---------------------------------------------------- full-width area chart
const GUTTER = 48; // px reserved on the left for the y-axis labels

const UsersAreaChart: React.FC<{
  data: { month: string; value: number }[];
  color?: string;
  area?: boolean;
  height?: number;
}> = ({ data, color = '#FFB347', area = true, height = 320 }) => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const niceMax = niceCeil(Math.max(1, ...data.map((d) => d.value)));
  const GRID = 6;
  const yLabels = Array.from({ length: GRID }, (_, i) => Math.round((niceMax * (GRID - 1 - i)) / (GRID - 1))); // top -> 0

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const n = data.length;
  const pts = data.map((d, i) => ({ x: ((i + 0.5) / n) * 100, y: 100 - (d.value / niceMax) * 100, ...d }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPts = pts.length ? `${pts[0].x},100 ${line} ${pts[pts.length - 1].x},100` : '';

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* y-axis labels on full-width dashed gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {yLabels.map((l, i) => (
            <div key={i} className="flex items-center" style={{ gap: 20 }}>
              <span className="shrink-0 text-right text-[13px] text-[#6D6D6D]" style={{ width: GUTTER - 20 }}>{fmtAxis(l)}</span>
              <span className="h-0 flex-1 border-t border-dashed border-[#E7E7E7]" />
            </div>
          ))}
        </div>

        {/* line + area + markers, offset past the label gutter */}
        <div className="absolute inset-y-0 right-0" style={{ left: GUTTER }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id="usersArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,138,0,0.1)" />
                <stop offset="100%" stopColor="rgba(255,179,71,0)" />
              </linearGradient>
            </defs>
            {area && <polygon points={areaPts} fill="url(#usersArea)" style={{ opacity: animated ? 1 : 0, transition: 'opacity 1s ease-out' }} />}
            <polyline
              points={line}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ strokeDasharray: 1400, strokeDashoffset: animated ? 0 : 1400, transition: 'stroke-dashoffset 1.6s ease-out' }}
            />
          </svg>
          {/* markers (HTML so they stay square and can carry tooltips) */}
          {pts.map((p, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: animated ? 1 : 0, transition: `opacity .3s ease ${i * 80}ms` }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="h-2.5 w-2.5 rotate-45 rounded-[2px] ring-2 ring-white" style={{ backgroundColor: color }} />
              {hovered === i && (
                <div className="absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[12px] text-white">
                  {p.value} · {p.month}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* x-axis month labels */}
      <div className="mt-2 flex" style={{ paddingLeft: GUTTER }}>
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[13px] text-[rgba(26,29,33,0.7)]">{d.month}</span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------- bar w/ tooltip
const AnimatedBarWithTooltip: React.FC<{ data: { label: string; value: number }[]; unit?: string }> = ({ data, unit = '' }) => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-56 w-full">
      <div className="ml-1 flex h-[calc(100%-1.25rem)] items-end justify-between gap-3">
        {data.map((item, index) => (
          <div
            key={index}
            className="relative flex h-full flex-1 flex-col items-center justify-end"
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              className="w-full max-w-[28px] rounded-t-sm bg-gradient-to-t from-[#FFB347] to-[#FF8A00] transition-all duration-700 ease-out"
              style={{ height: animated ? `${(item.value / maxValue) * 100}%` : '0%', transitionDelay: `${index * 100}ms` }}
            />
            {hovered === index && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[12px] text-white">
                {item.value}{unit}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between">
        {data.map((item, index) => (
          <span key={index} className="flex-1 text-center text-[10px] text-[rgba(26,29,33,0.7)]">{item.label}</span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- card / shell
const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-xl border border-[rgba(26,29,33,0.2)] bg-white p-6 ${className}`}>{children}</div>
);

// Ranked organizations with a popularity bar + member count (Figma "Top Products").
const TopOrganizations: React.FC<{ data: { name: string; members: number; pct: number }[] }> = ({ data }) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="rounded border border-[rgba(26,29,33,0.2)] p-4">
      <div className="grid grid-cols-[28px_1fr_110px_56px] items-center gap-2 text-[12px] font-medium text-[rgba(26,29,33,0.7)]">
        <span>#</span>
        <span>Name</span>
        <span>Popularity</span>
        <span className="text-center">Members</span>
      </div>
      <div className="my-3 h-px bg-[rgba(26,29,33,0.15)]" />
      <div className="flex flex-col gap-[18px]">
        {data.length === 0 && <span className="text-sm text-black/40">No organizations yet</span>}
        {data.map((o, i) => (
          <div key={o.name + i} className="grid grid-cols-[28px_1fr_110px_56px] items-center gap-2 text-[12px] font-medium text-black">
            <span>{String(i + 1).padStart(2, '0')}</span>
            <span className="truncate" title={o.name}>{o.name}</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,138,0,0.15)]">
              <span
                className="block h-full rounded-full bg-[#FF8A00] transition-all duration-1000 ease-out"
                style={{ width: animated ? `${o.pct}%` : '0%' }}
              />
            </span>
            <span className="mx-auto rounded-full border border-[rgba(255,138,0,0.4)] px-2 py-0.5 text-[11px] text-[#FF8A00]">{o.members}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const HomePage: React.FC<{ onNavigate?: (key: NavTarget) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api.get('/api/admin/overview')
      .then((res: { data: Overview }) => { setData(res.data); setError(null); })
      .catch(() => { if (!silent) setError('Could not load platform metrics.'); })
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = window.setInterval(() => load(true), 60000); // keep live figures fresh
    return () => window.clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-7">
        <div>
          <h1 className="text-lg font-semibold text-black">Platform Overview</h1>
          <p className="mt-1 text-sm text-black/70">Key metrics across every organization on the platform.</p>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[110px] animate-pulse rounded-xl border border-[rgba(26,29,33,0.12)] bg-black/[0.03]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <div className="h-[340px] animate-pulse rounded-xl bg-black/[0.03] lg:col-span-2" />
          <div className="h-[340px] animate-pulse rounded-xl bg-black/[0.03]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-black">Platform Overview</h1>
        <Card className="text-sm text-[#D92D20]">{error || 'No data available.'}</Card>
      </div>
    );
  }

  const { stats, deltas } = data;
  // `nav: null` = a read-only figure with no page behind it yet (support
  // tickets); it used to open a "coming soon" placeholder.
  const cards: { label: string; value: number; delta?: number; icon: IconType; nav: NavTarget | null }[] = [
    { label: 'Total organizations', value: stats.totalOrganizations, delta: deltas.totalOrganizations, icon: Globe, nav: 'organizations' },
    { label: 'Active organizations', value: stats.activeOrganizations, icon: CheckCircle2, nav: 'organizations' },
    { label: 'Paid organizations', value: stats.paidOrganizations, icon: CreditCard, nav: 'organizations' },
    { label: 'Trial organizations', value: stats.trialOrganizations, icon: Clock, nav: 'organizations' },
    { label: 'Total users', value: stats.totalUsers, delta: deltas.totalUsers, icon: Users, nav: 'users' },
    { label: 'Total devices', value: stats.totalDevices, delta: deltas.totalDevices, icon: Monitor, nav: 'devices' },
    { label: 'Active remote sessions', value: stats.activeSessions, icon: Network, nav: 'sessions' },
    { label: 'Open support tickets', value: stats.openTickets, icon: Ticket, nav: null },
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* Title */}
      <div>
        <h1 className="text-lg font-semibold text-black">Platform Overview</h1>
        <p className="mt-1 text-sm text-black/70">Key metrics across every organization on the platform.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => { if (s.nav) onNavigate?.(s.nav); }}
              disabled={!s.nav}
              title={s.nav ? undefined : 'Support tickets page coming soon'}
              className={`group flex items-start justify-between rounded-xl border border-[rgba(26,29,33,0.2)] bg-white p-6 text-left transition-all focus:outline-none ${s.nav ? 'hover:-translate-y-0.5 hover:border-[#FF8A00] hover:shadow-md focus-visible:border-[#FF8A00]' : 'cursor-default'}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1D21]">{s.label}</p>
                <p className="mt-3 text-lg font-semibold text-[#111315]">
                  {s.value.toLocaleString()}
                  {s.delta != null && s.delta > 0 && (
                    <span className="ml-1 text-xs font-normal text-[#149D52]">(+{s.delta} this month)</span>
                  )}
                </p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(255,179,71,0.3)] text-[#FF8A00] transition-colors group-hover:bg-[#FF8A00] group-hover:text-white">
                <Icon size={18} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Organizations growth + plan distribution */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium text-black">Organizations growth</h3>
              <p className="mt-1 text-sm text-black/60">Cumulative total vs newly added, last 12 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[rgba(17,19,21,0.6)]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FF8A00]" /> Total</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FFD497]" /> New</span>
            </div>
          </div>
          <div className="mt-6">
            <AnimatedBarChart
              data={data.orgGrowth.map((d) => ({ cur: d.total, prev: d.new }))}
              labels={data.orgGrowth.map((d) => d.month)}
            />
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-medium text-black">Plans distribution</h3>
          <p className="mt-1 text-sm text-black/60">Organizations by subscription plan</p>
          <div className="mt-6">
            <AnimatedPieChart data={data.planDistribution} centerLabel="Orgs" />
          </div>
          <div className="mt-6 flex flex-col gap-2">
            {data.planDistribution.length === 0 && <span className="text-sm text-black/40">No subscriptions yet</span>}
            {data.planDistribution.map((item, i) => {
              const total = data.planDistribution.reduce((s, t) => s + t.value, 0) || 1;
              return (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                    <span className="text-sm text-[rgba(17,19,21,0.7)]">{item.label}</span>
                  </div>
                  <span className="text-sm text-[rgba(17,19,21,0.7)]">{item.value} ({Math.round((item.value / total) * 100)}%)</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* New users line */}
      {(() => {
        const series = data.userGrowth;
        const total = series.reduce((s, d) => s + d.value, 0);
        const cur = series[series.length - 1]?.value ?? 0;
        const prev = series[series.length - 2]?.value ?? 0;
        const pct = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
        const up = pct >= 0;
        return (
          <Card className="!items-stretch">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-medium text-black">New users</h3>
              <p className="text-lg font-medium text-[#111315]">
                {total.toLocaleString()} <span className="text-sm font-normal text-black/50">in the last 12 months</span>
              </p>
              <p className={`text-sm font-medium ${up ? 'text-[#149D52]' : 'text-[#D92D20]'}`}>
                {up ? '▲' : '▼'} {Math.abs(Math.round(pct))}% vs last month
              </p>
            </div>
            <div className="mt-5">
              <UsersAreaChart data={series} />
            </div>
          </Card>
        );
      })()}

      {/* Login activity line + top organizations */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {(() => {
          const series = data.loginTrend;
          const total = series.reduce((s, d) => s + d.value, 0);
          const cur = series[series.length - 1]?.value ?? 0;
          const prev = series[series.length - 2]?.value ?? 0;
          const pct = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
          const up = pct >= 0;
          return (
            <Card className="lg:col-span-2">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-medium text-black">Login activity</h3>
                <p className={`text-sm font-medium ${up ? 'text-[#149D52]' : 'text-[#D92D20]'}`}>
                  {up ? '▲' : '▼'} {Math.abs(Math.round(pct))}% vs last month
                </p>
                <p className="text-sm font-medium text-[#111315]">{total.toLocaleString()} successful sign-ins · last 12 months</p>
              </div>
              <div className="mt-5">
                <UsersAreaChart data={series} color="#FF8A00" area height={200} />
              </div>
            </Card>
          );
        })()}

        <Card>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-medium text-[#111315]">Top organizations</h3>
            <button
              type="button"
              onClick={() => onNavigate?.('organizations')}
              className="text-sm font-medium text-[#FF8A00] transition-colors hover:text-[#e07b00]"
            >
              Show more
            </button>
          </div>
          <TopOrganizations data={data.topOrganizations} />
        </Card>
      </div>

      {/* Remote sessions + new devices */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card>
          <h3 className="text-lg font-medium text-black">Remote sessions</h3>
          <p className="mt-1 text-sm text-black/60">Sessions started per month, last 6 months</p>
          <div className="mt-4">
            <AnimatedBarWithTooltip data={data.sessionsTrend.map((d) => ({ label: d.month, value: d.value }))} />
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-medium text-black">New devices</h3>
          <p className="mt-1 text-sm text-black/60">Devices registered per month, last 6 months</p>
          <div className="mt-4">
            <AnimatedBarWithTooltip data={data.deviceTrend.map((d) => ({ label: d.month, value: d.value }))} />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HomePage;
