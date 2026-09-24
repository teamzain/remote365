import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, User, Bug, Radio, ShieldCheck, Clock, AlertTriangle, Zap } from 'lucide-react';

const performanceData = [
  { name: 'Jan', current: 6000, previous: 4000 },
  { name: 'Feb', current: 8000, previous: 3000 },
  { name: 'Mar', current: 5000, previous: 2000 },
  { name: 'Apr', current: 11000, previous: 2780 },
  { name: 'May', current: 16000, previous: 1890 },
  { name: 'Jun', current: 14000, previous: 2390 },
  { name: 'Jul', current: 20000, previous: 3490 },
];

const locationData = [
  { name: 'United States', value: 52.1, fill: '#000000' },
  { name: 'Canada', value: 22.8, fill: '#7DBBFF' },
  { name: 'Mexico', value: 13.9, fill: '#71DD8C' },
  { name: 'Other', value: 11.2, fill: '#A0BCE8' },
];

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  bg: string;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps & { data?: any[] }> = ({ title, value, trend, isPositive, bg, data, onClick }) => (
  <div
    onClick={onClick}
    className={`p-5 rounded-[24px] flex-1 min-w-[180px] flex flex-col gap-3 ${bg} border border-[rgba(28,28,28,0.04)] shadow-sm hover:shadow-md transition-all duration-300 group ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
  >
    <div className="flex justify-between items-start">
      <span className="text-[13px] font-semibold text-[rgba(28,28,28,0.4)] uppercase tracking-wider">{title}</span>
      <div className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${isPositive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
        {trend} {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      </div>
    </div>

    <div className="flex items-end justify-between">
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-[#1C1C1C] tracking-tight">{value}</span>
      </div>

      {/* Sparkline Chart */}
      <div className="w-20 h-10 -mb-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data || [
            { v: 10 }, { v: 15 }, { v: 8 }, { v: 22 }, { v: 18 }, { v: 25 }
          ]}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={isPositive ? '#10B981' : '#EF4444'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur text-white p-3 rounded-xl text-xs shadow-xl border border-white/10">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload.fill }} />
            <span>{entry.name}: {entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const SnowDashboard: React.FC<{
  devices: any[];
  activeSessionCount: number;
  telemetryHistory: { cpu: number, memory: number, time: string }[];
  onNavigate: (view: any, filter?: string) => void;
  analytics?: any;
  user?: any;
}> = ({ devices, activeSessionCount, telemetryHistory = [], onNavigate, analytics, user }) => {
  const isPlatformOwner = user?.role === 'SUPER_ADMIN';
  const latestStats = (telemetryHistory && telemetryHistory.length > 0)
    ? telemetryHistory[telemetryHistory.length - 1]
    : { cpu: 0, memory: 0 };

  // Calculate Latency Distribution across the fleet
  const latencyDistribution = React.useMemo(() => {
    const counts = { ultra: 0, low: 0, med: 0, high: 0 };
    devices.forEach((_, i) => {
      // Mock distribution based on device index to ensure variety
      if (i % 4 === 0) counts.ultra++;
      else if (i % 4 === 1) counts.low++;
      else if (i % 4 === 2) counts.med++;
      else counts.high++;
    });
    // Add some baseline if empty
    if (devices.length === 0) counts.ultra = 1;

    return [
      { name: '< 20ms', uv: counts.ultra, fill: '#71DD8C' },
      { name: '20-60ms', uv: counts.low, fill: '#7DBBFF' },
      { name: '60-150ms', uv: counts.med, fill: '#F59E0B' },
      { name: '> 150ms', uv: counts.high, fill: '#EF4444' },
    ];
  }, [devices]);

  // Network Architecture Distribution
  const networkArchitectureData = [
    { name: 'P2P Direct', value: 65.4, fill: '#000000' },
    { name: 'TURN Relay', value: 24.2, fill: '#7DBBFF' },
    { name: 'Local Mesh', value: 10.4, fill: '#71DD8C' },
  ];

  const onlineCount = devices.filter(d => d.is_online).length;

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-3xl overflow-hidden relative font-lato transition-all duration-500">
      <div className="flex-1 flex flex-col p-8 pt-6 overflow-y-auto custom-scrollbar bg-[#F8F9FA]/50">

        {/* Trial Banner */}
        {user?.plan === 'TRIAL' && user?.currentPeriodEnd && (
          <div className={`mb-8 p-4 rounded-2xl flex items-center justify-between border animate-in slide-in-from-top-4 duration-500 ${new Date() > new Date(user.currentPeriodEnd)
              ? 'bg-red-50 border-red-100 text-red-600'
              : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${new Date() > new Date(user.currentPeriodEnd) ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                {new Date() > new Date(user.currentPeriodEnd) ? <AlertTriangle size={20} /> : <Clock size={20} />}
              </div>
              <div>
                <p className="text-sm font-bold">
                  {new Date() > new Date(user.currentPeriodEnd)
                    ? 'Trial Expired'
                    : `Active Trial Period`}
                </p>
                <p className="text-xs opacity-70">
                  {new Date() > new Date(user.currentPeriodEnd)
                    ? 'Your 14-day trial has ended. Please upgrade to continue using Remote365 features.'
                    : `Your 14-day trial ends on ${new Date(user.currentPeriodEnd).toLocaleDateString()}.`}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('billing')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${new Date() > new Date(user.currentPeriodEnd)
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              <Zap size={14} />
              Upgrade Plan
            </button>
          </div>
        )}

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title={isPlatformOwner ? "Registered Customers" : "Team Members"}
            value={isPlatformOwner ? (analytics?.users?.total || '...').toString() : '—'}
            trend="+12.5%"
            isPositive={true}
            bg="bg-white"
            data={[{ v: 10 }, { v: 12 }, { v: 11 }, { v: 15 }, { v: 14 }, { v: 18 }]}
            onClick={() => onNavigate(isPlatformOwner ? 'analytics' : 'members')}
          />
          <MetricCard
            title="Registered Devices"
            value={devices.length.toString()}
            trend="+12.5%"
            isPositive={true}
            bg="bg-white"
            data={[{ v: 10 }, { v: 12 }, { v: 11 }, { v: 15 }, { v: 14 }, { v: 18 }]}
            onClick={() => onNavigate('devices')}
          />
          <MetricCard
            title="CPU Usage"
            value={`${isPlatformOwner ? (analytics?.devices?.health?.cpuUsage || latestStats.cpu) : latestStats.cpu}%`}
            trend={parseFloat(latestStats.cpu.toString()) > 50 ? "High" : "Optimal"}
            isPositive={parseFloat(latestStats.cpu.toString()) < 80}
            bg="bg-white"
            data={telemetryHistory.map(h => ({ v: h.cpu }))}
          />
          <MetricCard
            title="Memory Load"
            value={`${isPlatformOwner ? (analytics?.devices?.health?.memoryLoad || latestStats.memory) : latestStats.memory}%`}
            trend="Stable"
            isPositive={true}
            bg="bg-white"
            data={telemetryHistory.map(h => ({ v: h.memory }))}
          />
        </div>

        {isPlatformOwner && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <MetricCard
              title="Bandwidth Utilization"
              value={`${analytics?.devices?.health?.bandwidth || '0.00'} Mbps`}
              trend="Optimal"
              isPositive={true}
              bg="bg-blue-50/30"
            />
            <MetricCard
              title="Adapter Usage"
              value={`${analytics?.devices?.health?.adapterUsage || '0'}%`}
              trend="Healthy"
              isPositive={true}
              bg="bg-emerald-50/30"
            />
          </div>
        )}

        {/* Big Line Chart (Performance) */}
        <div className="w-full h-[330px] bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 mb-8 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-6">
              <span className="text-sm font-bold text-[#1C1C1C]">Host Resource Performance</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#1C1C1C]"></div><span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">CPU LOAD %</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#A0BCE8]"></div><span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">MEMORY %</span></div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 uppercase tracking-widest animate-pulse">Live Telemetry</div>
          </div>

          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A0BCE8" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#A0BCE8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.05} />
                    <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'rgba(28,28,28,0.6)', fontSize: 11, fontWeight: 800 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(28,28,28,0.6)', fontSize: 11, fontWeight: 800 }} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" />
                <RTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 1, strokeDasharray: '3 3' }} />

                <Area type="monotone" dataKey="memory" stroke="#A0BCE8" strokeWidth={2} fill="url(#colorMem)" />
                <Area type="monotone" dataKey="cpu" stroke="#1C1C1C" strokeWidth={2.5} fill="url(#colorCpu)" animationDuration={300} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grid for Bottom Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* OS Distribution Bar Chart */}
          <div className="h-[360px] bg-white border border-[rgba(28,28,28,0.06)] rounded-[24px] p-8 flex flex-col shadow-sm transition-all hover:border-[rgba(28,28,28,0.15)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-bold text-[#1C1C1C] uppercase tracking-wider">Fleet Latency Spread (Ms)</h3>
              <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)]">SIGNAL STABILITY</span>
            </div>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyDistribution} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(28,28,28,0.7)', fontSize: 11, fontWeight: 800 }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(28,28,28,0.7)', fontSize: 11, fontWeight: 800 }} />
                  <RTooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '16px', border: 'none', background: '#1C1C1C', color: 'white' }} />
                  <Bar dataKey="uv" radius={[12, 12, 12, 12]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Location Distribution Pie Chart */}
          <div className="h-[360px] bg-white border border-[rgba(28,28,28,0.06)] rounded-[24px] p-8 flex flex-col shadow-sm transition-all hover:border-[rgba(28,28,28,0.15)]">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-[#1C1C1C] uppercase tracking-wider">Mesh Link Architecture</h3>
            </div>
            <div className="flex flex-1 items-center">
              <div className="w-[180px] h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={networkArchitectureData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {networkArchitectureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 flex flex-col gap-4 pl-8">
                {networkArchitectureData.map((loc, i) => (
                  <div key={i} className="flex justify-between items-center group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: loc.fill }}></div>
                      <span className="text-sm font-bold text-[#1C1C1C] opacity-100 transition-opacity">{loc.name}</span>
                    </div>
                    <span className="text-sm font-extrabold text-[#1C1C1C]">{loc.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
