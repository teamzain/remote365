import React, { useState, useEffect } from 'react';
import {
  Shield, Building2, Check, Loader2, Settings,
  Globe, Lock, Zap, RefreshCw, Power, ChevronRight, AlertCircle, WifiOff,
  LayoutGrid, Monitor, FileText, Settings2, Smartphone, Key, CreditCard, Receipt,
  Users, CheckCircle2, ArrowRight, ArrowLeftRight, Mic,
  Plus, Pencil, Trash2, X
} from 'lucide-react';
import api from '../lib/api';
import { hasUserPermission } from '../lib/permissions';
import { SnowMembers } from './SnowMembers';
import { SnowBilling } from './SnowBilling';
import { LicenseUsageTab } from './admin-settings/LicenseUsageTab';
import { AdminDeviceGroupsTab } from './admin-settings/AdminDeviceGroupsTab';
import { AdminDevicesTab } from './admin-settings/AdminDevicesTab';
import { PoliciesTab } from './admin-settings/PoliciesTab';
import cardImage22Asset from '../assets/22.png';
import cardImage33Asset from '../assets/33.png';
import cardImage11Asset from '../assets/11.png';

const cardImage22 = cardImage22Asset.src;
const cardImage33 = cardImage33Asset.src;
const cardImage11 = cardImage11Asset.src;

const DEFAULTS = {
  defaultRelayUrl: 'relay.connect-x.io',
  maxSessionDuration: 60,
  maintenanceMode: false,
  maintenanceMessage: '',
  forceSubAdmin2FA: false,
  globalTokenLifetime: 24,
  minPasswordLength: 8,
  maxPasswordLength: 32,
  defaultOrgPlan: 'TRIAL',
  restrictPlanChanges: false,
};

const LS_KEY = 'platform_settings_local';

function loadLocal() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

const SIDEBAR_SECTIONS = [
  {
    title: 'Organization Management',
    items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutGrid },
      { id: 'general', label: 'Settings', icon: Settings },
      { id: 'security', label: 'Security', icon: Shield },
    ]
  },
  {
    title: 'Team',
    items: [
      { id: 'members', label: 'Members', icon: Users },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    ]
  },
  {
    title: 'Device Management',
    items: [
      { id: 'devices', label: 'Devices', icon: Monitor },
      { id: 'groups', label: 'Device Groups', icon: LayoutGrid },
      { id: 'policies', label: 'Policy', icon: FileText },
    ]
  },
  {
    title: 'Billing',
    items: [
      { id: 'license', label: 'License Usage', icon: CreditCard },
      { id: 'subs', label: 'Subscription', icon: Receipt },
    ]
  }
];

const SLIDES = [
  {
    tag: 'Organization',
    title: 'Assign policies',
    description: 'Give other users access to your devices and specify their account privileges.',
    icon: Settings,
    image: cardImage22,
    button: 'Open policies',
    tab: 'policies'
  },
  {
    tag: 'Team',
    title: 'Create user roles',
    description: 'Create and manage roles of your company and give them the required permission.',
    icon: Users,
    image: cardImage33,
    button: 'Manage roles',
    tab: 'roles'
  },
  {
    tag: 'Organization',
    title: 'Manage access',
    description: 'Set up conditional access for users and devices.',
    icon: Lock,
    image: cardImage11,
    button: 'Security center',
    tab: 'security'
  }
];

const OverviewTab = ({ user, onNavigate }: { user: any; onNavigate?: (tab: string) => void }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [plan, setPlan] = useState<string>('TRIAL');
  const [orgName, setOrgName] = useState<string>('');
  const [renewal, setRenewal] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [loading, setLoading] = useState(true);

  // Reload live when the plan changes anywhere (pushed via account-sync).
  useEffect(() => {
    const onBillingChanged = () => setReloadTick((tick) => tick + 1);
    window.addEventListener('remote365:billing-changed', onBillingChanged);
    return () => window.removeEventListener('remote365:billing-changed', onBillingChanged);
  }, []);

  // Real plan + org status behind the same visual design.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [billRes, orgRes] = await Promise.all([
        api.get('/api/billing/current').catch(() => ({ data: null })),
        api.get('/api/organizations/mine').catch(() => ({ data: null })),
      ]);
      if (cancelled) return;
      setPlan(String(billRes.data?.plan || 'TRIAL').toUpperCase());
      setRenewal(billRes.data?.currentPeriodEnd ? new Date(billRes.data.currentPeriodEnd).toLocaleDateString() : null);
      if (orgRes.data?.name) setOrgName(orgRes.data.name);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length), 3500);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[currentSlide];
  const isTrial = plan === 'TRIAL';
  const planLabel = plan.charAt(0) + plan.slice(1).toLowerCase();

  if (loading) {
    return <div className="flex h-full items-center justify-center py-20 text-[#FF8A00]"><Loader2 className="animate-spin" size={28} /></div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[912px] flex-col gap-12 px-8 py-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold leading-[34px] text-black">Hi {user?.name || 'there'},</h1>
        <p className="text-[14px] font-normal leading-5 text-black">
          {isTrial
            ? <>You're on the <span className="font-medium text-black">Trial</span> plan{renewal ? <> - ends {renewal}</> : ''}. Upgrade to unlock every commercial feature.</>
            : <>Your organization {orgName ? <span className="font-medium text-black">{orgName}</span> : ''} is on the <span className="font-medium text-black">{planLabel}</span> plan.</>}
        </p>
      </div>

      <div className="relative flex h-[250px] w-full max-w-[900px] overflow-hidden rounded-xl border border-[rgba(26,29,33,0.3)] bg-white">
        <div className="admin-slide-text z-10 flex w-[369px] flex-col justify-center pl-[42px] animate-in fade-in slide-in-from-bottom-2 duration-500" key={currentSlide}>
          <span className="mb-2 text-[12px] font-medium leading-[17px] text-black">{slide.tag}</span>
          <h2 className="mb-3 text-[18px] font-medium leading-[25px] text-black">{slide.title === 'Assign policies' ? 'Assigned Policies' : slide.title}</h2>
          <p className="mb-[18px] text-[14px] font-normal leading-5 text-black">{slide.description}</p>
          <button onClick={() => onNavigate?.(slide.tab)} className="inline-flex h-10 w-fit items-center gap-2 rounded px-0 text-[14px] font-medium leading-5 text-[#FF8A00] transition-colors hover:text-[#D46F00]">
            {slide.button} <ArrowRight size={16} />
          </button>

          <div className="mt-4 flex items-center gap-2 px-[6px] py-[6px]">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-[4px] transition-all duration-300 ${currentSlide === idx ? 'w-5 bg-[#FF8A00]' : 'w-2.5 bg-[rgba(26,29,33,0.15)] hover:bg-[rgba(26,29,33,0.25)]'}`}
                aria-label={`Show admin settings slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="admin-slide-art pointer-events-none absolute right-[52px] top-1/2 h-[276px] w-[276px] -translate-y-1/2 overflow-visible">
            {/* Blurred orange halo behind the illustration (Figma: Ellipse 2 & 3) */}
            <div
              className="absolute left-[24px] top-[-24px] h-[150px] w-[150px] rounded-full"
              style={{ background: 'linear-gradient(180deg, rgba(255,138,0,0.2) 0%, rgba(255,179,71,0.2) 100%)', filter: 'blur(50px)' }}
            />
            <div
              className="absolute left-[70px] top-[80px] h-[200px] w-[200px] rounded-full"
              style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,138,0,0.3) 0%, rgba(255,179,71,0.3) 100%)', filter: 'blur(50px)' }}
            />
            <img
              src={slide.image}
              alt=""
              className="relative h-full w-full object-contain animate-in fade-in zoom-in duration-700"
              key={`card-image-${currentSlide}`}
            />
        </div>
      </div>

      <div className="grid w-full max-w-[900px] grid-cols-1 gap-6 md:grid-cols-2">
        <button type="button" onClick={() => onNavigate?.('subs')} className="group flex min-h-[202px] flex-col justify-center gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6 text-left transition-colors hover:border-[#FF8A00]">
          <div className="flex h-8 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
              <Receipt size={22} strokeWidth={1.7} />
            </div>
            <h3 className="text-[14px] font-medium leading-5 text-black">{isTrial ? 'Buy a License' : 'Manage Subscription'}</h3>
          </div>
          <p className="text-[12px] font-medium leading-[17px] text-black">
            {isTrial ? 'Purchase a license to unlock all commercial features and manage your organization.' : 'Change your plan, update payment details, or download invoices.'}
          </p>
          <span className="flex h-10 w-full items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-center text-[14px] font-medium leading-5 text-[#FF8A00] transition-colors group-hover:border-[#FF8A00] group-hover:bg-[#FFF6ED]">
            {isTrial ? 'Buy a License' : 'Manage Subscription'}
          </span>
        </button>

        <button type="button" onClick={() => onNavigate?.('license')} className="group flex min-h-[202px] flex-col justify-center gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6 text-left transition-colors hover:border-[#FF8A00]">
          <div className="flex h-8 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
              <CheckCircle2 size={22} strokeWidth={1.7} />
            </div>
            <h3 className="text-[14px] font-medium leading-5 text-black">{isTrial ? 'Your Free Trial' : 'License Usage'}</h3>
          </div>
          <p className="text-[12px] font-medium leading-[17px] text-black">
            {isTrial ? `See how many days are left in your trial and what each plan includes.${renewal ? ` Trial ends ${renewal}.` : ''}` : 'See how many member seats and device slots your plan is using.'}
          </p>
          <span className="flex h-10 w-full items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-center text-[14px] font-medium leading-5 text-[#FF8A00] transition-colors group-hover:border-[#FF8A00] group-hover:bg-[#FFF6ED]">
            {isTrial ? 'View Trial Details' : 'View License Usage'}
          </span>
        </button>
      </div>
    </div>
  );
};

const SecurityCenterTab = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);

  // Real org security posture from GET /api/organizations/security-overview
  // (org 2FA policy, member 2FA adoption, device password protection).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/api/organizations/security-overview');
        if (!cancelled) setOverview(data);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.status === 403
          ? 'You do not have permission to view the security center.'
          : err?.response?.status === 404
            ? 'You are not part of an organization yet.'
            : 'Could not load the security overview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const membersTotal = overview?.membersTotal ?? 0;
  const membersWith2FA = overview?.membersWith2FA ?? 0;
  const devicesTotal = overview?.devicesTotal ?? 0;
  const devicesProtected = overview?.devicesProtected ?? 0;
  const require2FA = Boolean(overview?.require2FA);

  // Weighted score over the checks that apply to this org (no devices → the
  // device check is skipped and the remaining weights are renormalized).
  const checks = [
    { weight: 30, earned: require2FA ? 1 : 0, passed: require2FA, applicable: true },
    { weight: 35, earned: membersTotal > 0 ? membersWith2FA / membersTotal : 0, passed: membersTotal > 0 && membersWith2FA === membersTotal, applicable: membersTotal > 0 },
    { weight: 35, earned: devicesTotal > 0 ? devicesProtected / devicesTotal : 0, passed: devicesTotal > 0 && devicesProtected === devicesTotal, applicable: devicesTotal > 0 },
  ].filter((check) => check.applicable);
  const weightSum = checks.reduce((sum, check) => sum + check.weight, 0);
  const score = weightSum > 0 ? Math.round((checks.reduce((sum, check) => sum + check.earned * check.weight, 0) / weightSum) * 100) : 0;
  const passedCount = checks.filter((check) => check.passed).length;

  const level = score >= 80
    ? { label: 'High', color: '#34C759', badge: 'bg-[#E8F8EC] text-[#1F9D4D]' }
    : score >= 45
      ? { label: 'Medium', color: '#FF8A00', badge: 'bg-[#FFF4E5] text-[#B45309]' }
      : { label: 'Low', color: '#D92D20', badge: 'bg-[#FEECEB] text-[#B42318]' };

  // Soft status-pill colors matching the Figma (red / amber / green).
  const levelPill = score >= 80
    ? { background: 'rgba(20,174,92,0.1)', color: '#14AE5C' }
    : score >= 45
      ? { background: 'rgba(255,204,0,0.12)', color: '#B7791F' }
      : { background: 'rgba(255,56,60,0.1)', color: '#FF383C' };
  const goodPill = { background: 'rgba(20,174,92,0.1)', color: '#14AE5C' };
  const warnPill = { background: 'rgba(255,204,0,0.12)', color: '#B7791F' };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-10 text-center text-[14px] text-[#757575]">{error}</div>
    );
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center py-20 text-[#FF8A00]"><Loader2 className="animate-spin" size={28} /></div>;
  }

  const IconChip = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-8 w-8 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">{children}</div>
  );

  const stepCount = checks.length || 3;

  return (
    <div className="flex w-full flex-col px-8 py-8 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in duration-500">
      <div className="mb-12">
        <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black">Security center</h1>
        <p className="m-0 mt-1 text-[14px] leading-5 text-[#757575]">Manage your security settings and strengthen your protection.</p>
      </div>

      {/* Top 2 cards */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Security Level */}
        <div className="flex flex-col justify-center gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <IconChip><Shield size={20} strokeWidth={1.8} /></IconChip>
              <span className="text-[16px] font-semibold text-black">Security Level</span>
            </div>
            {loading
              ? <div className="h-[22px] w-14 animate-pulse rounded-full bg-[#F5F5F5]" />
              : <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={levelPill}>{level.label}</span>}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-black">Current Level</span>
              <span className="text-[12px] font-medium text-[#757575]">{loading ? '—' : `${passedCount} of ${checks.length} checks passed`}</span>
            </div>
            <div className="flex items-center">
              {Array.from({ length: stepCount }).map((_, i) => {
                const on = !loading && i < passedCount;
                return (
                  <React.Fragment key={i}>
                    <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: on ? '#FF8A00' : '#D5D6D8' }} />
                    {i < stepCount - 1 && <div className="h-[2px] flex-1" style={{ background: on ? '#FF8A00' : '#D5D6D8' }} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Overall Score */}
        <div className="flex flex-col justify-center gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <IconChip><LayoutGrid size={20} strokeWidth={1.8} /></IconChip>
              <span className="text-[16px] font-semibold text-black">Overall Score</span>
            </div>
            {!loading && <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={levelPill}>{score}/100</span>}
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-medium text-black">Total progress</span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#D5D6D8]">
              {!loading && <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: 'linear-gradient(180deg, #FF8A00 0%, #FFB347 100%)' }} />}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 3 cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Users */}
        <div className="flex flex-col gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconChip><Users size={20} strokeWidth={1.8} /></IconChip>
              <h3 className="text-[14px] font-medium text-black">Users</h3>
            </div>
            {loading
              ? <div className="h-[22px] w-16 animate-pulse rounded-full bg-[#F5F5F5]" />
              : <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={membersTotal > 0 && membersWith2FA === membersTotal ? goodPill : warnPill}>{membersWith2FA}/{membersTotal} with 2FA</span>}
          </div>
          <p className="flex-1 text-[12px] font-medium leading-[17px] text-black">Secure user accounts with SSO or 2FA and limit permissions to reduce risks and strengthen security.</p>
          <button onClick={() => onNavigate?.('members')} className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white text-[14px] font-medium text-black transition-colors hover:border-[#FF8A00] hover:text-[#FF8A00]">View and manage</button>
        </div>

        {/* Devices */}
        <div className="flex flex-col gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconChip><Monitor size={20} strokeWidth={1.8} /></IconChip>
              <h3 className="text-[14px] font-medium text-black">Devices</h3>
            </div>
            {loading
              ? <div className="h-[22px] w-16 animate-pulse rounded-full bg-[#F5F5F5]" />
              : <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={devicesTotal > 0 && devicesProtected === devicesTotal ? goodPill : warnPill}>{devicesProtected}/{devicesTotal} protected</span>}
          </div>
          <p className="flex-1 text-[12px] font-medium leading-[17px] text-black">Check your devices' security and reinforce protection to ensure safe access.</p>
          <button onClick={() => onNavigate?.('devices')} className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white text-[14px] font-medium text-black transition-colors hover:border-[#FF8A00] hover:text-[#FF8A00]">View and manage</button>
        </div>

        {/* Connections */}
        <div className="flex flex-col gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconChip><ArrowLeftRight size={20} strokeWidth={1.8} /></IconChip>
              <h3 className="text-[14px] font-medium text-black">Connections</h3>
            </div>
            {loading
              ? <div className="h-[22px] w-16 animate-pulse rounded-full bg-[#F5F5F5]" />
              : <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={require2FA ? goodPill : warnPill}>{require2FA ? '2FA enforced' : '2FA optional'}</span>}
          </div>
          <p className="flex-1 text-[12px] font-medium leading-[17px] text-black">Manage settings and control sharing to protect sensitive data and enhance privacy.</p>
          <button onClick={() => onNavigate?.('policies')} className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white text-[14px] font-medium text-black transition-colors hover:border-[#FF8A00] hover:text-[#FF8A00]">View and manage</button>
        </div>
      </div>
    </div>
  );
};

// Owner-configurable feature visibility per member role. Mirrors the shared
// role-features module (the renderer is a separate bundle and can't import it).
const ROLE_FEATURE_META: Array<{ key: string; label: string; description: string }> = [
  { key: 'licenses', label: 'Licenses & plan', description: 'See the workspace plan, license usage, and upgrade options.' },
  { key: 'chat', label: 'Chat', description: 'Access the team chat.' },
  { key: 'remoteSupport', label: 'Remote support', description: 'Start remote-support connections to devices.' },
  { key: 'feedback', label: 'Feedback', description: 'Send product feedback.' },
  { key: 'help', label: 'Help', description: 'Open the help menu.' },
  { key: 'adminSettings', label: 'Admin settings', description: 'Open the organization admin settings (members, devices, policies, billing).' },
];
const CONFIGURABLE_ROLES: Array<{ key: 'ADMIN' | 'VIEWER'; label: string }> = [
  { key: 'ADMIN', label: 'Admin' },
  { key: 'VIEWER', label: 'Viewer' },
];

const RolesTab = ({ user }: { user?: any }) => {
  const isOwner = String(user?.role || '').toUpperCase() === 'OWNER';
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({ ADMIN: {}, VIEWER: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/api/organizations/role-features');
        if (!cancelled) setMatrix(data?.roleFeatures || { ADMIN: {}, VIEWER: {} });
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.status === 403
          ? 'You do not have permission to view role permissions.'
          : 'Could not load role permissions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = async (next: Record<string, Record<string, boolean>>) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/api/organizations/role-features', { roleFeatures: next });
      setMatrix(data?.roleFeatures || next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err: any) {
      setError(err?.response?.status === 403 ? 'Only the organization owner can change role permissions.' : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (role: string, key: string) => {
    if (!isOwner || saving) return;
    const next = {
      ...matrix,
      [role]: { ...(matrix[role] || {}), [key]: !(matrix[role]?.[key] ?? true) },
    };
    setMatrix(next);
    persist(next);
  };

  return (
    <div className="w-full px-8 py-8 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in duration-500">
      <div className="mb-12 flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black">Roles & permissions</h1>
          <p className="m-0 mt-1 text-[14px] leading-5 text-[#757575]">Choose what Admins and Viewers can see and use. Owners always have full access.</p>
        </div>
        {saving ? <Loader2 size={16} className="mt-1 animate-spin text-[#FF8A00]" /> : saved ? <span className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[#34C759]"><Check size={14} /> Saved</span> : null}
      </div>

      {!isOwner && (
        <div className="mb-4 rounded-lg border border-[rgba(26,29,33,0.12)] bg-[#F9FAFB] px-4 py-3 text-[12px] text-[#757575]">
          Only the organization owner can change these. You're viewing the current settings.
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-[#FF8A00]"><Loader2 className="animate-spin" size={26} /></div>
      ) : error && !matrix ? (
        <div className="flex h-40 items-center justify-center text-center text-[14px] text-[#757575]">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[rgba(26,29,33,0.3)] bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="px-6 py-3 text-[12px] font-medium text-[#111315]">Feature</th>
                {CONFIGURABLE_ROLES.map(role => (
                  <th key={role.key} className="w-40 px-6 py-3 text-center text-[12px] font-medium text-[#111315]">{role.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_FEATURE_META.map(feature => (
                <tr key={feature.key} className="border-t border-[rgba(26,29,33,0.12)] transition-colors hover:bg-[#FBFBFC]">
                  <td className="px-6 py-6">
                    <div className="text-[16px] font-semibold text-black">{feature.label}</div>
                    <div className="mt-1 text-[14px] leading-5 text-[rgba(17,19,21,0.6)]">{feature.description}</div>
                  </td>
                  {CONFIGURABLE_ROLES.map(role => {
                    const on = matrix[role.key]?.[feature.key] ?? true;
                    return (
                      <td key={role.key} className="px-6 py-6 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(role.key, feature.key)}
                          disabled={!isOwner || saving}
                          aria-pressed={on}
                          style={on ? { background: 'linear-gradient(180deg, #FF8A00 0%, #FFB347 100%)' } : undefined}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? '' : 'bg-[#D5D6D8]'} ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="mt-4 text-[13px] font-medium text-[#D92D20]">{error}</p>}
    </div>
  );
};

type GroupRecord = {
  id: string;
  name: string;
  color?: string | null;
  createdAt: string;
  devices?: Array<{ id: string; name?: string | null; accessKey?: string }>;
  members?: Array<{ id: string; name?: string | null; email: string }>;
  _count?: { devices: number; members: number };
};

const GroupsTab = () => {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GroupRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupRecord | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [groupsRes, devicesRes, membersRes] = await Promise.all([
        api.get('/api/groups'),
        api.get('/api/devices/mine'),
        api.get('/api/members')
      ]);
      setGroups(groupsRes.data.groups || []);
      setDevices(devicesRes.data || []);
      setMembers(membersRes.data.members || []);
    } catch (err) {
      console.error('Failed to load groups tab:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing({ id: '', name: '', color: '#2563eb', createdAt: new Date().toISOString() });
    setName('');
    setColor('#2563eb');
    setDeviceIds([]);
    setMemberIds([]);
    setError(null);
  };

  const openEdit = (group: GroupRecord) => {
    setEditing(group);
    setName(group.name);
    setColor(group.color || '#2563eb');
    setDeviceIds((group.devices || []).map(device => device.id));
    setMemberIds((group.members || []).map(member => member.id));
    setError(null);
  };

  const toggle = (id: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  };

  const saveGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    const payload = { name: name.trim(), color: color || null, deviceIds, memberIds };
    try {
      if (editing.id) await api.patch(`/api/groups/${editing.id}`, payload);
      else await api.post('/api/groups', payload);
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save group');
    }
  };

  const deleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/groups/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } catch {
      alert('Could not delete group');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-10 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#1C1C1C]">Device groups</h1>
          <p className="text-[13px] text-[#757575] mt-1">Group devices and assign access to members.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-[#1C1C1C] text-white rounded-xl text-sm font-bold hover:bg-[#2C2C2C]">
          <Plus size={16} /> New group
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[rgba(0,0,0,0.06)]">
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575]">Name</th>
              <th className="hidden px-5 py-4 text-[12px] font-bold text-[#757575] md:table-cell">Color</th>
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575]">Devices</th>
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575]">Members</th>
              <th className="hidden px-5 py-4 text-[12px] font-bold text-[#757575] md:table-cell">Created</th>
              <th className="px-5 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(0,0,0,0.05)]">
            {groups.map(group => (
              <tr key={group.id} className="hover:bg-[#FAFAFB] group">
                <td className="px-5 py-4 text-[13px] font-bold text-[#1C1C1C]">{group.name}</td>
                <td className="hidden px-5 py-4 md:table-cell"><span className="block w-6 h-6 rounded-full border border-black/10" style={{ backgroundColor: group.color || '#94a3b8' }} /></td>
                <td className="px-5 py-4 text-[13px] text-[#757575]">{group._count?.devices ?? group.devices?.length ?? 0}</td>
                <td className="px-5 py-4 text-[13px] text-[#757575]">{group._count?.members ?? group.members?.length ?? 0}</td>
                <td className="hidden px-5 py-4 text-[13px] text-[#757575] md:table-cell">{new Date(group.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(group)} className="p-2 text-[#757575] hover:text-[#1C1C1C]"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteTarget(group)} className="p-2 text-[#757575] hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && groups.length === 0 && (
          <div className="py-16 text-center text-[13px] text-[#757575]">No device groups yet.</div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form onSubmit={saveGroup} className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-8 border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1C1C1C]">{editing.id ? 'Edit group' : 'New group'}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-[#999] hover:text-[#1C1C1C]"><X size={22} /></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[#999] uppercase tracking-widest mb-2">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={50} required className="w-full px-4 py-3 bg-[#F9F9FA] border border-black/10 rounded-xl text-sm outline-none focus:border-[#1C1C1C]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#999] uppercase tracking-widest mb-2">Color</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-16 h-10 rounded-lg border border-black/10 bg-white p-1" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#999] uppercase tracking-widest mb-2">Devices</label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-black/10 divide-y divide-black/5">
                  {devices.map(device => (
                    <label key={device.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFB] cursor-pointer">
                      <input type="checkbox" checked={deviceIds.includes(device.id)} onChange={() => toggle(device.id, deviceIds, setDeviceIds)} className="accent-[#1C1C1C]" />
                      <span className="text-xs font-semibold text-[#1C1C1C]">{device.device_name || device.name || 'Unnamed device'}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#999] uppercase tracking-widest mb-2">Members</label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-black/10 divide-y divide-black/5">
                  {members.map(member => (
                    <label key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFB] cursor-pointer">
                      <input type="checkbox" checked={memberIds.includes(member.id)} onChange={() => toggle(member.id, memberIds, setMemberIds)} className="accent-[#1C1C1C]" />
                      <span className="text-xs font-semibold text-[#1C1C1C]">{member.name || member.email}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 bg-[#F5F5F5] rounded-xl text-sm font-bold">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-[#1C1C1C] text-white rounded-xl text-sm font-bold">Save group</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-5"><Trash2 size={28} /></div>
            <h3 className="text-lg font-bold text-[#1C1C1C] mb-2">Delete group?</h3>
            <p className="text-sm text-[#757575] mb-7">This will remove the group but not the devices or members it contains. Continue?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 bg-[#F5F5F5] rounded-xl text-sm font-bold">Cancel</button>
              <button onClick={deleteGroup} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SnowAdminSettings: React.FC<{ setCurrentView?: (v: any) => void, user?: any, initialSection?: string, hideSectionNav?: boolean }> = ({ setCurrentView, user, initialSection, hideSectionNav }) => {
  const [activeTab, setActiveTab] = useState(initialSection || 'overview');

  // Only show tabs whose backing permission the user effectively holds, so a
  // member never lands on a tab whose API calls the backend would reject.
  const TAB_PERMISSIONS: Record<string, string> = {
    general: 'org:settings',
    security: 'org:settings',
    members: 'members:view',
    roles: 'org:settings',
    groups: 'devices:assign',
    policies: 'org:settings',
    license: 'billing:view',
    subs: 'billing:view',
  };
  const canSeeTab = (id: string) => !TAB_PERMISSIONS[id] || hasUserPermission(user, TAB_PERMISSIONS[id]);
  const visibleSections = SIDEBAR_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => canSeeTab(item.id)) }))
    .filter((section) => section.items.length > 0);
  
  // Legacy Settings State
  const [settings, setSettings] = useState<any>(loadLocal());
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    // /api/admin/settings is the PLATFORM settings API (super-admin only).
    // Org owners/admins always run on the local fallback — skip the call
    // instead of collecting a guaranteed 403 on every open.
    if (String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN') {
      setApiOnline(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/api/admin/settings');
      const merged = { ...DEFAULTS, ...data };
      setSettings(merged);
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
      setApiOnline(true);
    } catch (e: any) {
      console.error('Admin settings API unavailable — using local state', e.message);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates: any) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));

    if (!apiOnline) return;

    setSaveStatus('saving');
    try {
      const { data } = await api.patch('/api/admin/settings', updates);
      setSettings({ ...DEFAULTS, ...data });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-[#1C1C1C]' : 'bg-[rgba(28,28,28,0.1)]'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  );

  const [companyName, setCompanyName] = useState('');
  const [require2FA, setRequire2FA] = useState(false);
  const [defaultMemberRole, setDefaultMemberRole] = useState('VIEWER');
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgReadOnly, setOrgReadOnly] = useState(false);

  // The General tab is org-scoped: load + save via /api/organizations/mine
  // (the org owner can reach this; the platform /admin/settings API cannot).
  useEffect(() => {
    api.get('/api/organizations/mine')
      .then(({ data }: { data: any }) => {
        setCompanyName(data?.name || '');
        setRequire2FA(!!data?.require2FA);
        setDefaultMemberRole(data?.defaultMemberRole || 'VIEWER');
      })
      .catch((err: any) => { if (err?.response?.status === 403) setOrgReadOnly(true); })
      .finally(() => setOrgLoading(false));
  }, []);

  const saveOrg = async (patch: any) => {
    setSaveStatus('saving');
    try {
      const { data } = await api.patch('/api/organizations/mine', patch);
      if (data?.name !== undefined) setCompanyName(data.name || '');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const renderGeneralTab = () => {
    if (orgLoading) return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#FF8A00]" />
      </div>
    );

    const SettingRow = ({ icon: Icon, title, description, action, locked = false }: { icon: any, title: string | React.ReactNode, description: string | React.ReactNode, action?: React.ReactNode, locked?: boolean }) => (
      <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6 px-6 py-5 border-b border-[rgba(0,0,0,0.05)] last:border-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-[#555]">
            <Icon size={18} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-medium text-[#1C1C1C]">{title}</h3>
              {locked && <span className="px-2.5 py-0.5 bg-orange-400 text-white text-[11px] font-semibold rounded-full">Upgrade</span>}
            </div>
            <p className="text-[13px] text-[#757575] mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    );

    return (
      <div className="w-full animate-in fade-in duration-500 px-8 py-8 pb-20">
        <div className="mb-8 flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#1C1C1C]">General</h1>
            <p className="text-[13px] text-[#757575] mt-1">Set the preferences for your company.</p>
          </div>
          {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin text-[#FF8A00]" />}
          {saveStatus === 'saved' && <span className="flex items-center gap-1 text-[12px] font-medium text-[#12B76A]"><Check size={13} /> Saved</span>}
          {saveStatus === 'error' && <span className="text-[12px] font-medium text-red-500">Couldn't save</span>}
        </div>

        {orgReadOnly && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <WifiOff size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-700 leading-relaxed">
              Only the organization owner can change these settings.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm overflow-hidden divide-y divide-[rgba(0,0,0,0.05)]">
          <SettingRow
            icon={Building2}
            title="Company name"
            description="Choose the name you want to display for this company."
            action={
              <input
                value={companyName}
                disabled={orgReadOnly}
                onChange={e => setCompanyName(e.target.value)}
                onBlur={() => { const n = companyName.trim(); if (n) saveOrg({ name: n }); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-44 text-right text-[14px] font-medium text-[#1C1C1C] bg-transparent outline-none border-b border-transparent hover:border-[rgba(0,0,0,0.1)] focus:border-blue-500 transition-colors pb-0.5 disabled:opacity-60"
              />
            }
          />
          <SettingRow
            icon={Shield}
            title="Require two-factor authentication"
            description="Every member of your organization must set up 2FA to sign in. Members without it are asked to set it up the next time they sign in."
            action={<Toggle checked={require2FA} onChange={v => { if (orgReadOnly) return; setRequire2FA(v); saveOrg({ require2FA: v }); }} />}
          />
          <SettingRow
            icon={Users}
            title="Default role for new members"
            description="The role automatically assigned when someone joins your organization."
            action={
              <select
                value={defaultMemberRole}
                disabled={orgReadOnly}
                onChange={e => { const r = e.target.value; setDefaultMemberRole(r); saveOrg({ defaultMemberRole: r }); }}
                className="rounded-lg border border-[rgba(0,0,0,0.15)] bg-white px-3 py-2 text-[13px] font-medium text-[#1C1C1C] outline-none focus:border-blue-500 disabled:opacity-60"
              >
                <option value="VIEWER">Viewer</option>
                <option value="ADMIN">Admin</option>
              </select>
            }
          />
        </div>
      </div>
    );
  };

  return (
    /* Stacks on small screens: the section nav becomes a horizontal
       scrollable strip on top, and the desktop keeps the left sidebar. */
    <div className="flex h-full w-full flex-col bg-white font-sans lg:flex-row">
      {/* Sidebar */}
      <div className={`${hideSectionNav ? 'hidden' : ''} w-full shrink-0 border-b border-[rgba(26,29,33,0.3)] bg-white px-3 py-3 lg:w-[220px] lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:py-6 custom-scrollbar`}>
        <div className="flex flex-col gap-3 lg:gap-0">
         {visibleSections.map((section, idx) => (
           <div key={idx} className="lg:mb-[30px] lg:last:mb-0">
             <h4 className="mb-2 whitespace-nowrap lg:whitespace-normal text-[14px] font-medium leading-5 text-black lg:mb-3 lg:text-[18px] lg:leading-[25px]">{section.title}</h4>
             <div className="flex flex-row flex-wrap gap-1 lg:flex-col">
               {section.items.map(item => {
                 const isActive = activeTab === item.id;
                 const Icon = item.icon;
                 return (
                   <button
                     key={item.id}
                     onClick={() => setActiveTab(item.id)}
                     className={`flex h-9 lg:h-10 items-center gap-2 whitespace-nowrap rounded px-3 lg:px-4 text-left text-[13px] lg:text-[14px] transition-colors ${
                       isActive ? 'text-white shadow-sm' : 'text-[#111315] hover:bg-[#F3F4F6]'
                     }`}
                     style={isActive ? { background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' } : undefined}
                   >
                     <Icon size={16} className="shrink-0" />
                     <span className="truncate text-[14px] font-medium leading-5">{item.label}</span>
                   </button>
                 );
               })}
             </div>
           </div>
         ))}
        </div>
      </div>

      {/* Main Content — a tab the user can't see falls back to Overview so a
          live permission revoke never leaves them on a rejected page. */}
      <div className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-white custom-scrollbar">
         {(() => { const tab = canSeeTab(activeTab) ? activeTab : 'overview'; return (
          tab === 'overview' ? <OverviewTab user={user} onNavigate={setActiveTab} /> :
          tab === 'general' ? renderGeneralTab() :
          tab === 'security' ? <SecurityCenterTab onNavigate={setActiveTab} /> :
          tab === 'members' ? <SnowMembers /> :
          tab === 'roles' ? <RolesTab user={user} /> :
          tab === 'groups' ? <AdminDeviceGroupsTab /> :
          tab === 'devices' ? <AdminDevicesTab /> :
          tab === 'policies' ? <PoliciesTab /> :
          tab === 'license' ? <LicenseUsageTab user={user} /> :
          tab === 'subs' ? <div className="p-10"><SnowBilling user={user} /></div> :
          <div className="flex items-center justify-center h-full text-[#757575] text-sm">
             Content for {SIDEBAR_SECTIONS.flatMap(s => s.items).find(i => i.id === tab)?.label} coming soon.
          </div>
         ); })()}
      </div>
    </div>
  );
};
