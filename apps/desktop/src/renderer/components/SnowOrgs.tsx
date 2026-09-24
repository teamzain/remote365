import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, Globe, Settings, ExternalLink,
  ShieldCheck, Activity, X, CheckCircle2, Users, Monitor,
  ChevronRight, Trash2, AlertTriangle, Cpu, Smartphone,
  Apple, Crown, Zap, Star, Package, ArrowLeft, Clock,
  Wifi, WifiOff, RefreshCw, Mail, Shield, ChevronDown, Check, Loader2, Download, CreditCard
} from 'lucide-react';
import api from '../lib/api';

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { users: number; devices: number };
}

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

interface OrgDetail extends OrgSummary {
  users: OrgMember[];
  devices: OrgDevice[];
  plan: string;
}

interface SnowOrgsProps {
  setCurrentView: (view: any) => void;
  setSelectedDevice: (device: any) => void;
  setSearchQuery: (query: string) => void;
}

const PLAN_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  SOLO:       { label: 'Solo',       color: 'text-slate-500',   bg: 'bg-slate-50',   icon: <Package  size={12} /> },
  PRO:        { label: 'Pro',        color: 'text-blue-600',    bg: 'bg-blue-50',    icon: <Zap      size={12} /> },
  BUSINESS:   { label: 'Business',   color: 'text-purple-600',  bg: 'bg-purple-50',  icon: <Star     size={12} /> },
  ENTERPRISE: { label: 'Enterprise', color: 'text-amber-600',   bg: 'bg-amber-50',   icon: <Crown    size={12} /> },
};

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-red-700',    bg: 'bg-red-50'    },
  OWNER:       { label: 'Owner',       color: 'text-amber-700',  bg: 'bg-amber-50'  },
  ADMIN:       { label: 'Admin',       color: 'text-purple-700', bg: 'bg-purple-50' },
  TECHNICIAN:  { label: 'Technician',  color: 'text-blue-700',   bg: 'bg-blue-50'   },
  VIEWER:      { label: 'Viewer',      color: 'text-slate-600',  bg: 'bg-slate-100' },
};

const isOrgOwnerRole = (role?: string) => ['OWNER', 'SUPER_ADMIN'].includes(String(role || '').toUpperCase());

// Built-in ids keep their branded look; super-admin-created custom plans get a
// generic badge derived from the catalog name.
const FALLBACK_ASSIGNABLE_PLANS = ['SOLO', 'PRO', 'BUSINESS', 'ENTERPRISE'].map((id) => ({ id, name: PLAN_META[id].label }));

const planMetaFor = (id: string, name?: string) =>
  PLAN_META[String(id || '').toUpperCase()] || {
    label: name || String(id || '').charAt(0) + String(id || '').slice(1).toLowerCase().replace(/_/g, ' '),
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    icon: <Package size={12} />,
  };

function DeviceTypeIcon({ type }: { type: string }) {
  const t = type?.toUpperCase();
  if (t === 'IOS' || t === 'MACOS') return <Apple size={14} />;
  if (t === 'ANDROID') return <Smartphone size={14} />;
  return <Monitor size={14} />;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const SnowOrgs: React.FC<SnowOrgsProps> = ({ setCurrentView, setSelectedDevice, setSearchQuery }) => {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Detail panel
  const [selectedOrg, setSelectedOrg] = useState<OrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'members' | 'devices' | 'billing'>('members');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Plan assignment — options come from the live merged catalog so plans the
  // super admin created (or renamed) show up too; TRIAL is not assignable here.
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [planSwitching, setPlanSwitching] = useState(false);
  const [planSuccess, setPlanSuccess] = useState(false);
  const [assignablePlans, setAssignablePlans] = useState<{ id: string; name: string }[]>(FALLBACK_ASSIGNABLE_PLANS);

  // Stats & Revenue
  const [revenue, setRevenue] = useState<{ totalRevenue: number, subscriptions: any[] } | null>(null);
  const [orgBilling, setOrgBilling] = useState<any>(null);

  useEffect(() => {
    fetchOrgs();
    fetchRevenue();
    fetchAssignablePlans();
  }, []);

  const fetchAssignablePlans = async () => {
    try {
      const { data } = await api.get('/api/billing/plans');
      const plans = (data.plans || [])
        .map((p: any) => ({ id: String(p.id).toUpperCase(), name: p.name || p.id }))
        .filter((p: any) => p.id !== 'TRIAL');
      if (plans.length) setAssignablePlans(plans);
    } catch (err) {
      console.error('Failed to fetch plan catalog', err);
    }
  };

  const fetchRevenue = async () => {
    try {
      const { data } = await api.get('/api/billing/revenue');
      setRevenue(data);
    } catch (err) {
      console.error('Failed to fetch revenue stats', err);
    }
  };

  const fetchOrgBilling = async (adminId: string) => {
    try {
      const { data } = await api.get(`/api/billing/organization-admin/${adminId}`);
      setOrgBilling(data);
    } catch (err) {
      console.error('Failed to fetch org billing', err);
    }
  };

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/organizations');
      setOrgs(data);
    } catch (err) {
      console.error('Failed to fetch orgs:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (org: OrgSummary) => {
    setSelectedOrg(null);
    setDetailLoading(true);
    setDetailTab('members');
    try {
      const { data } = await api.get(`/api/organizations/${org.id}`);
      setSelectedOrg(data);
      
      // Fetch billing info for the org's admin
      const owner = data.users?.find((u: any) => isOrgOwnerRole(u.role));
      if (owner) {
        fetchOrgBilling(owner.id);
      } else {
        setOrgBilling(null);
      }
    } catch (err) {
      console.error('Failed to fetch org detail:', err);
      setOrgBilling(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post('/api/organizations', { name, slug });
      setShowAddModal(false);
      setName(''); setSlug('');
      fetchOrgs();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed To Create Organization');
    }
  };

  const handleDeleteOrg = async () => {
    if (!selectedOrg) return;
    try {
      await api.delete(`/api/organizations/${selectedOrg.id}`);
      setSelectedOrg(null);
      setShowDeleteConfirm(false);
      fetchOrgs();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleAssignPlan = async (plan: string) => {
    if (!selectedOrg) return;
    // Find the owner of this org to assign the plan to.
    const owner = selectedOrg.users.find((u: any) => isOrgOwnerRole(u.role));
    if (!owner) return;
    setShowPlanDropdown(false);
    setPlanSwitching(true);
    try {
      await api.patch('/api/billing/set-plan', { userId: owner.id, plan });
      setSelectedOrg({ ...selectedOrg, plan });
      setPlanSuccess(true);
      setTimeout(() => setPlanSuccess(false), 3000);
    } catch (err) {
      console.error('Plan assignment failed:', err);
    } finally {
      setPlanSwitching(false);
    }
  };

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  const planMeta = selectedOrg
    ? planMetaFor(selectedOrg.plan, assignablePlans.find((p) => p.id === String(selectedOrg.plan).toUpperCase())?.name)
    : PLAN_META.SOLO;

  return (
    <div className="flex gap-6 h-full animate-in fade-in duration-500 font-lato">

      {/* ── LEFT: Org List ── */}
      <div className={`flex flex-col gap-5 transition-all duration-300 ${selectedOrg || detailLoading ? 'w-[360px] flex-shrink-0' : 'flex-1'}`}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Organizations</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-[rgba(28,28,28,0.4)]">{orgs.length} tenants</p>
              {revenue && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-100">
                  <span className="opacity-60">Total Revenue:</span>
                  <span>${revenue.totalRevenue.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1C1C1C] text-white rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:opacity-90 transition-all active:scale-95"
          >
            <Plus size={16} /> New Org
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Organizations..."
            className="w-full pl-10 pr-4 py-3 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-2xl text-sm font-medium text-[#1C1C1C] placeholder:text-[rgba(28,28,28,0.25)] outline-none focus:bg-white focus:border-[rgba(28,28,28,0.2)] transition-all"
          />
        </div>

        {/* Org Cards */}
        <div className={`flex flex-col gap-3 overflow-y-auto pb-6 ${selectedOrg || detailLoading ? '' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}
          style={selectedOrg || detailLoading ? {} : { display: 'grid' }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[rgba(28,28,28,0.06)] mb-4" />
                <div className="h-4 bg-[rgba(28,28,28,0.04)] rounded mb-2 w-2/3" />
                <div className="h-3 bg-[rgba(28,28,28,0.03)] rounded w-1/2" />
              </div>
            ))
          ) : filtered.map(org => (
            <div
              key={org.id}
              onClick={() => openDetail(org)}
              className={`bg-white rounded-[24px] border p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/5 group
                ${selectedOrg?.id === org.id
                  ? 'border-[rgba(28,28,28,0.3)] shadow-md shadow-black/8'
                  : 'border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)]'
                }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg transition-colors
                  ${selectedOrg?.id === org.id ? 'bg-[#1C1C1C] text-white' : 'bg-[rgba(28,28,28,0.05)] text-[#1C1C1C] group-hover:bg-[#1C1C1C] group-hover:text-white'}`}>
                  {org.name[0]}
                </div>
                <ChevronRight size={16} className="text-[rgba(28,28,28,0.2)] group-hover:text-[#1C1C1C] transition-colors mt-1" />
              </div>
              <h3 className="font-bold text-[#1C1C1C] mb-0.5 truncate">{org.name}</h3>
              <p className="text-[11px] font-mono text-[rgba(28,28,28,0.3)] mb-4 truncate">{org.slug}</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[rgba(28,28,28,0.4)]">
                  <Users size={12} />
                  <span className="text-xs font-semibold">{org._count.users}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[rgba(28,28,28,0.4)]">
                  <Monitor size={12} />
                  <span className="text-xs font-semibold">{org._count.devices}</span>
                </div>
                <span className="text-[10px] text-[rgba(28,28,28,0.25)] ml-auto">
                  {new Date(org.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center gap-2 text-[rgba(28,28,28,0.3)]">
              <Building2 size={48} strokeWidth={1} />
              <span className="text-sm font-medium">No Organizations Found</span>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail Panel ── */}
      {(selectedOrg || detailLoading) && (
        <div className="flex-1 bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-right-4 duration-300">

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw size={24} className="text-blue-500 animate-spin" />
            </div>
          ) : selectedOrg && (
            <>
              {/* Detail Header */}
              <div className="p-8 border-b border-[rgba(28,28,28,0.05)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] text-white flex items-center justify-center font-bold text-2xl">
                      {selectedOrg.name[0]}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#1C1C1C] tracking-tight">{selectedOrg.name}</h2>
                      <p className="text-xs font-mono text-[rgba(28,28,28,0.35)] mt-0.5">{selectedOrg.slug}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrg(null)}
                    className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3">
                  {/* Plan */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${planMeta.bg}`}>
                    <span className={planMeta.color}>{planMeta.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Plan</p>
                      <p className={`text-xs font-bold ${planMeta.color}`}>{planMeta.label}</p>
                    </div>
                  </div>
                  {/* Members */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)]">
                    <Users size={12} className="text-[rgba(28,28,28,0.4)]" />
                    <div>
                      <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Members</p>
                      <p className="text-xs font-bold text-[#1C1C1C]">{selectedOrg._count.users}</p>
                    </div>
                  </div>
                  {/* Devices */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)]">
                    <Monitor size={12} className="text-[rgba(28,28,28,0.4)]" />
                    <div>
                      <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Devices</p>
                      <p className="text-xs font-bold text-[#1C1C1C]">{selectedOrg._count.devices}</p>
                    </div>
                  </div>
                  {/* Created */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)]">
                    <Clock size={12} className="text-[rgba(28,28,28,0.4)]" />
                    <div>
                      <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Created</p>
                      <p className="text-xs font-bold text-[#1C1C1C]">{new Date(selectedOrg.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-8 pt-4 border-b border-[rgba(28,28,28,0.05)]">
                {(['members', 'devices', 'billing'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2 rounded-t-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      detailTab === tab
                        ? 'bg-[#1C1C1C] text-white'
                        : 'text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C]'
                    }`}
                  >
                    {tab === 'members' ? `Members (${selectedOrg._count.users})` : 
                     tab === 'devices' ? `Devices (${selectedOrg._count.devices})` : 
                     'Billing History'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-8 pt-5">

                {/* Members Tab */}
                {detailTab === 'members' && (
                  <div className="space-y-2">
                    {selectedOrg.users.length === 0 ? (
                      <div className="py-12 flex flex-col items-center gap-2 text-[rgba(28,28,28,0.3)]">
                        <Users size={40} strokeWidth={1} />
                        <span className="text-sm">No Members Yet</span>
                      </div>
                    ) : selectedOrg.users.map(member => {
                      const roleMeta = ROLE_META[member.role] || ROLE_META.VIEWER;
                      return (
                        <div key={member.id} className="flex items-center gap-3 p-3.5 bg-[#F9F9FA] rounded-2xl hover:bg-[rgba(28,28,28,0.03)] transition-colors">
                          <div className="w-9 h-9 rounded-xl bg-white border border-[rgba(28,28,28,0.06)] flex items-center justify-center font-bold text-sm text-[#1C1C1C] shadow-sm flex-shrink-0">
                            {(member.name || member.email)[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-[#1C1C1C] truncate">{member.name || '—'}</p>
                            <p className="text-[11px] text-[rgba(28,28,28,0.4)] truncate flex items-center gap-1">
                              <Mail size={10} />{member.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${roleMeta.bg} ${roleMeta.color}`}>
                              {roleMeta.label}
                            </span>
                            <span className="text-[10px] text-[rgba(28,28,28,0.3)]">
                              {new Date(member.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Devices Tab */}
                {detailTab === 'devices' && (
                  <div className="space-y-2">
                    {selectedOrg.devices.length === 0 ? (
                      <div className="py-12 flex flex-col items-center gap-2 text-[rgba(28,28,28,0.3)]">
                        <Monitor size={40} strokeWidth={1} />
                        <span className="text-sm">No Devices Registered</span>
                      </div>
                    ) : selectedOrg.devices.map(device => {
                      const isOnline = device.status === 'ONLINE';
                      return (
                        <div key={device.id} className="flex items-center gap-3 p-3.5 bg-[#F9F9FA] rounded-2xl hover:bg-[rgba(28,28,28,0.03)] transition-colors">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <DeviceTypeIcon type={device.deviceType} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-[#1C1C1C] truncate">{device.name || 'Unnamed Device'}</p>
                            <p className="text-[11px] text-[rgba(28,28,28,0.4)] font-mono truncate">
                              {device.accessKey} · {device.deviceType}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {device.tags.length > 0 && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600">
                                {device.tags[0]}{device.tags.length > 1 ? ` +${device.tags.length - 1}` : ''}
                              </span>
                            )}
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                              {isOnline ? 'Online' : timeAgo(device.lastSeenAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Billing Tab */}
                {detailTab === 'billing' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    {!orgBilling ? (
                      <div className="py-12 flex flex-col items-center gap-2 text-[rgba(28,28,28,0.3)]">
                        <CreditCard size={40} strokeWidth={1} />
                        <span className="text-sm">No Billing Data Found</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orgBilling.invoices?.length > 0 ? (
                          orgBilling.invoices.map((inv: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.05)] hover:bg-[rgba(28,28,28,0.03)] transition-colors">
                              <div>
                                <p className="text-sm font-bold text-[#1C1C1C]">${inv.amount}</p>
                                <p className="text-[10px] text-[rgba(28,28,28,0.4)] uppercase font-bold tracking-wider mt-0.5">{new Date(inv.date).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider ${
                                  inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {inv.status}
                                </span>
                                {inv.pdfUrl && (
                                  <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="p-2 hover:bg-black/5 rounded-xl transition-colors text-[#1C1C1C]/60">
                                    <Download size={14} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-12 text-center text-[rgba(28,28,28,0.3)]">
                            <p className="text-sm italic">No recent invoices.</p>
                          </div>
                        )}
                        
                        {orgBilling.currentPeriodEnd ? (
                          <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                             <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest text-center">
                               Next Billing Date: {new Date(orgBilling.currentPeriodEnd).toLocaleDateString()}
                             </p>
                          </div>
                        ) : String(orgBilling.plan || selectedOrg.plan || 'TRIAL').toUpperCase() !== 'TRIAL' ? (
                          <div className="mt-6 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                             <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest text-center">
                               Lifetime Access · No Expiry
                             </p>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-[rgba(28,28,28,0.05)] space-y-3">
                {/* Plan Assignment Row */}
                <div className="flex items-center justify-between p-3 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)]">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-[#1C1C1C]">Billing Plan</span>
                    <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">Assign Plan To This Organization's Admin</span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowPlanDropdown(v => !v)}
                      disabled={planSwitching}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${planMeta.bg} ${planMeta.color} ${planMeta.color.replace('text-', 'border-').replace('600', '200').replace('500', '200')}`}
                    >
                      {planSwitching ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : planSuccess ? (
                        <Check size={12} />
                      ) : (
                        planMeta.icon
                      )}
                      {planMeta.label}
                      <ChevronDown size={11} className={`transition-transform ${showPlanDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showPlanDropdown && (
                      <div className="absolute bottom-10 right-0 z-50 w-44 max-h-64 overflow-y-auto bg-white border border-[rgba(28,28,28,0.08)] rounded-2xl shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-150">
                        {assignablePlans.map(({ id, name }) => {
                          const m = planMetaFor(id, name);
                          const isCurrentPlan = id === String(selectedOrg.plan).toUpperCase();
                          return (
                            <button
                              key={id}
                              onClick={() => handleAssignPlan(id)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                                isCurrentPlan
                                  ? `${m.bg} ${m.color}`
                                  : 'text-[#1C1C1C] hover:bg-[#F9F9FA]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 ${m.color}`}>{m.icon}</span>
                                <span className="truncate">{m.label}</span>
                              </div>
                              {isCurrentPlan && <Check size={11} className="shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setSelectedDevice(null); setSearchQuery(selectedOrg.slug); setCurrentView('devices'); }}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[rgba(28,28,28,0.5)] hover:text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] rounded-xl transition-colors"
                  >
                    <Monitor size={14} /> View In Devices
                  </button>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 size={14} /> Delete Org
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-2xl border border-red-100">
                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                      <span className="text-[11px] font-bold text-red-600">Permanently Delete?</span>
                      <button onClick={handleDeleteOrg} className="px-3 py-1 bg-red-500 text-white text-[11px] font-bold rounded-lg hover:bg-red-600 transition-colors">Yes</button>
                      <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-white text-[rgba(28,28,28,0.5)] text-[11px] font-bold rounded-lg border border-[rgba(28,28,28,0.1)] hover:bg-[#F9F9FA] transition-colors">No</button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Create Org Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-10 border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Create Organization</h2>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] mb-2 px-1">Display Name</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')); }}
                    placeholder="Acme Corporation"
                    className="w-full pl-11 pr-5 py-4 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-2xl text-sm font-medium focus:border-[rgba(28,28,28,0.25)] focus:bg-white outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] mb-2 px-1">Slug (URL Identifier)</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    placeholder="acme-corp"
                    className="w-full pl-11 pr-5 py-4 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-2xl text-sm font-mono focus:border-[rgba(28,28,28,0.25)] focus:bg-white outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold border border-red-100">
                  <Activity size={15} /> {formError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-[#1C1C1C] text-white rounded-[20px] text-sm font-bold shadow-xl shadow-black/10 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle2 size={18} /> Provision Organization
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
