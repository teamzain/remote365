import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Building2, Users, Monitor, Calendar,
  Mail, Shield, Wifi, WifiOff, Clock, Crown, Zap,
  Star, Package, RefreshCw, Loader2, AlertCircle,
  Smartphone, Laptop, Tv, HardDrive
} from 'lucide-react';
import api from '../lib/api';

interface OrgMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  subscription?: { plan: string; status: string } | null;
}

interface OrgDevice {
  id: string;
  name: string | null;
  deviceType: string;
  status: string;
  lastSeenAt: string;
  accessKey: string;
  tags: string[];
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  plan: string;
  _count: { users: number; devices: number };
  users: OrgMember[];
  devices: OrgDevice[];
}

interface Props {
  orgId: string;
  onBack: () => void;
}

const ROLE_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  SUPER_ADMIN: { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500',    label: 'Super Admin' },
  OWNER:       { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Owner' },
  ADMIN:       { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500', label: 'Admin' },
  TECHNICIAN:  { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400',   label: 'Technician' },
  VIEWER:      { bg: 'bg-slate-50',  text: 'text-slate-500',  dot: 'bg-slate-400',  label: 'Viewer' },
};

const PLAN_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  TRIAL:      { bg: 'bg-slate-100', text: 'text-slate-600', icon: <Package size={11} /> },
  SOLO:       { bg: 'bg-slate-100', text: 'text-slate-600', icon: <Package size={11} /> },
  PRO:        { bg: 'bg-blue-50',   text: 'text-blue-600',  icon: <Zap     size={11} /> },
  BUSINESS:   { bg: 'bg-purple-50', text: 'text-purple-600',icon: <Star    size={11} /> },
  ENTERPRISE: { bg: 'bg-amber-50',  text: 'text-amber-600', icon: <Crown   size={11} /> },
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

function DeviceIcon({ type }: { type: string }) {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('phone') || t.includes('mobile')) return <Smartphone size={15} />;
  if (t.includes('tv') || t.includes('screen'))    return <Tv         size={15} />;
  if (t.includes('server'))                         return <HardDrive  size={15} />;
  return <Laptop size={15} />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just Now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const SnowOrgDetail: React.FC<Props> = ({ orgId, onBack }) => {
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'members' | 'devices'>('members');

  useEffect(() => { load(); }, [orgId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/organizations/${orgId}`);
      setOrg(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load organization.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 size={28} className="animate-spin text-[rgba(28,28,28,0.2)]" />
      <p className="text-xs font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest">Loading Organization...</p>
    </div>
  );

  if (error || !org) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
        <AlertCircle size={24} className="text-red-400" />
      </div>
      <p className="text-sm font-bold text-[#1C1C1C]">Failed To Load</p>
      <p className="text-xs text-[rgba(28,28,28,0.4)] text-center max-w-xs">{error}</p>
      <div className="flex gap-3">
        <button onClick={onBack} className="px-5 py-2.5 bg-[#F9F9FA] border border-[rgba(28,28,28,0.08)] rounded-xl text-xs font-bold text-[#1C1C1C] hover:bg-white transition-all">
          Go Back
        </button>
        <button onClick={load} className="px-5 py-2.5 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    </div>
  );

  const plan = PLAN_STYLE[org.plan] ?? PLAN_STYLE['TRIAL'];
  const onlineDevices = org.devices.filter(d => d.status === 'ONLINE').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">

      {/* ── Back + Header ───────────────────────────────────── */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] text-xs font-bold uppercase tracking-widest mb-6 transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back To Analytics
        </button>

        <div className="bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] p-7 shadow-sm">
          <div className="flex items-start gap-5">
            {/* Org avatar */}
            <div className="w-16 h-16 bg-[#1C1C1C] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/10">
              <Building2 size={28} className="text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-xl font-black text-[#1C1C1C] tracking-tight">{org.name}</h1>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${plan.bg} ${plan.text}`}>
                  {plan.icon} {org.plan}
                </span>
              </div>
              <p className="text-xs font-mono text-[rgba(28,28,28,0.35)] mb-4">/{org.slug}</p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-6">
                {[
                  { icon: Users,    label: 'Members',        value: org._count.users },
                  { icon: Monitor,  label: 'Devices',        value: org._count.devices },
                  { icon: Wifi,     label: 'Online Now',     value: onlineDevices },
                  { icon: Calendar, label: 'Created',        value: new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#F9F9FA] rounded-lg flex items-center justify-center">
                      <Icon size={13} className="text-[rgba(28,28,28,0.4)]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest leading-none">{label}</p>
                      <p className="text-sm font-black text-[#1C1C1C]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#F9F9FA] p-1 rounded-2xl border border-[rgba(28,28,28,0.05)] w-fit">
        {(['members', 'devices'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              tab === t
                ? 'bg-white text-[#1C1C1C] shadow-sm border border-[rgba(28,28,28,0.06)]'
                : 'text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C]'
            }`}
          >
            {t === 'members' ? `Members (${org._count.users})` : `Devices (${org._count.devices})`}
          </button>
        ))}
      </div>

      {/* ── Members Tab ─────────────────────────────────────── */}
      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] shadow-sm overflow-hidden">
          {org.users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users size={28} className="text-[rgba(28,28,28,0.15)]" />
              <p className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest">No Members</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(28,28,28,0.04)]">
              {org.users.map((u) => {
                const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE['VIEWER'];
                const initials = (u.name?.[0] ?? u.email[0]).toUpperCase();
                return (
                  <div key={u.id} className="flex items-center gap-4 px-7 py-4 hover:bg-[#FAFAFA] transition-colors">
                    <div className={`w-10 h-10 rounded-2xl ${avatarColor(u.email)} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1C1C1C] truncate">{u.name || 'Anonymous'}</p>
                      <p className="text-[11px] text-[rgba(28,28,28,0.4)] font-medium flex items-center gap-1 truncate">
                        <Mail size={10} /> {u.email}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${rs.bg} flex-shrink-0`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                      <span className={`text-[10px] font-black uppercase tracking-wider ${rs.text}`}>{rs.label}</span>
                    </div>
                    {u.subscription && (
                      <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${(PLAN_STYLE[u.subscription.plan] ?? PLAN_STYLE['TRIAL']).bg} ${(PLAN_STYLE[u.subscription.plan] ?? PLAN_STYLE['TRIAL']).text} flex-shrink-0`}>
                        {u.subscription.plan}
                      </div>
                    )}
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest">Joined</p>
                      <p className="text-[11px] font-mono text-[rgba(28,28,28,0.5)]">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Devices Tab ─────────────────────────────────────── */}
      {tab === 'devices' && (
        <div className="bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] shadow-sm overflow-hidden">
          {org.devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Monitor size={28} className="text-[rgba(28,28,28,0.15)]" />
              <p className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest">No Devices Registered</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(28,28,28,0.04)]">
              {org.devices.map((d) => {
                const isOnline = d.status === 'ONLINE';
                return (
                  <div key={d.id} className="flex items-center gap-4 px-7 py-4 hover:bg-[#FAFAFA] transition-colors">
                    {/* Device icon */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-[#F9F9FA] text-[rgba(28,28,28,0.3)]'}`}>
                      <DeviceIcon type={d.deviceType} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1C1C1C] truncate">{d.name || 'Unnamed Device'}</p>
                      <p className="text-[11px] font-mono text-[rgba(28,28,28,0.35)] truncate">{d.accessKey}</p>
                    </div>

                    {/* Type */}
                    <div className="hidden md:block flex-shrink-0">
                      <p className="text-[11px] font-bold text-[rgba(28,28,28,0.4)] capitalize">{d.deviceType?.toLowerCase() || 'Desktop'}</p>
                    </div>

                    {/* Status */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl flex-shrink-0 ${isOnline ? 'bg-emerald-50' : 'bg-[#F9F9FA]'}`}>
                      {isOnline
                        ? <Wifi size={11} className="text-emerald-600" />
                        : <WifiOff size={11} className="text-[rgba(28,28,28,0.3)]" />}
                      <span className={`text-[10px] font-black uppercase tracking-wider ${isOnline ? 'text-emerald-600' : 'text-[rgba(28,28,28,0.35)]'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {/* Tags */}
                    {d.tags?.length > 0 && (
                      <div className="hidden lg:flex gap-1 flex-shrink-0">
                        {d.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-[#F9F9FA] rounded-lg text-[10px] font-bold text-[rgba(28,28,28,0.4)] border border-[rgba(28,28,28,0.05)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Last Seen */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest flex items-center gap-1 justify-end">
                        <Clock size={9} /> Last seen
                      </p>
                      <p className="text-[11px] font-mono text-[rgba(28,28,28,0.4)]">{timeAgo(d.lastSeenAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
