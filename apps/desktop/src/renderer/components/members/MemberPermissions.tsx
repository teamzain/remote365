import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, Lock, Monitor, MonitorPlay, Users, CreditCard, Building2, Navigation } from 'lucide-react';
import api from '../../lib/api';
import { AccessPicker, AccessType, DeviceGroup, OrgDevice } from './AccessPicker';

// The catalog and role defaults are served by GET /api/members/permission-catalog
// (straight from @remotelink/shared, the same source the backend enforces with).
// The copies below are only an offline/startup fallback — keep them roughly in
// sync with packages/shared/src/user-permissions.ts, but the server wins.

type CapabilityKind = 'feature' | 'permission';
interface CapabilityItem { key: string; label: string; description: string; kind: CapabilityKind }
interface CapabilityCategory { category: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }>; items: CapabilityItem[] }

// Icons are presentation-only, so the served (icon-less) catalog is mapped
// onto them by category name.
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Navigation,
  Devices: Monitor,
  Sessions: MonitorPlay,
  Team: Users,
  Billing: CreditCard,
  Organization: Building2,
};

const PERMISSION_CATALOG: CapabilityCategory[] = [
  {
    category: 'Navigation', description: 'What this user sees in the sidebar and menus.', icon: Navigation,
    items: [
      { key: 'licenses', label: 'Licenses & Plan', description: 'See the workspace plan, license usage, and upgrade options.', kind: 'feature' },
      { key: 'chat', label: 'Chat', description: 'Access the team chat.', kind: 'feature' },
      { key: 'remoteSupport', label: 'Remote Support', description: 'See and start remote-support connections.', kind: 'feature' },
      { key: 'feedback', label: 'Feedback', description: 'Send product feedback.', kind: 'feature' },
      { key: 'help', label: 'Help', description: 'Open the help menu.', kind: 'feature' },
      { key: 'adminSettings', label: 'Admin Settings', description: 'Open the organization admin settings (members, devices, policies, billing).', kind: 'feature' },
    ],
  },
  {
    category: 'Devices', description: 'What this user can do to devices they can access.', icon: Monitor,
    items: [
      { key: 'devices:register', label: 'Add / Register Devices', description: 'Enroll new devices into the organization.', kind: 'permission' },
      { key: 'devices:configure', label: 'Rename & Configure Devices', description: 'Edit a device name, tags, and settings.', kind: 'permission' },
      { key: 'devices:remove', label: 'Delete / Remove Devices', description: 'Remove devices from the organization.', kind: 'permission' },
      { key: 'devices:assign', label: 'Assign Devices To Members', description: 'Grant or revoke other members’ device access.', kind: 'permission' },
      { key: 'devices:groups:create', label: 'Create Device Groups', description: 'Create and rename device groups.', kind: 'permission' },
      { key: 'devices:groups:delete', label: 'Delete Device Groups', description: 'Delete device groups.', kind: 'permission' },
      { key: 'devices:reportIssue', label: 'Report A Device Problem', description: 'Flag a device issue to owners/admins.', kind: 'permission' },
    ],
  },
  {
    category: 'Sessions', description: 'Remote-control session capabilities.', icon: MonitorPlay,
    items: [
      { key: 'sessions:start', label: 'Start Remote Sessions', description: 'Initiate a remote-control session to a device.', kind: 'permission' },
      { key: 'sessions:join', label: 'Join Remote Sessions', description: 'Join a session started by someone else.', kind: 'permission' },
      { key: 'sessions:viewHistoryAll', label: 'View Session History', description: 'See the full remote-session history.', kind: 'permission' },
      { key: 'sessions:recordings:view', label: 'View Recordings', description: 'Watch recorded remote sessions.', kind: 'permission' },
    ],
  },
  {
    category: 'Team', description: 'Managing organization members.', icon: Users,
    items: [
      { key: 'members:view', label: 'View Members', description: 'See the list of organization members.', kind: 'permission' },
      { key: 'members:invite', label: 'Invite Members', description: 'Send invitations to new members.', kind: 'permission' },
      { key: 'members:edit', label: 'Edit Members', description: 'Change a member’s access and permissions.', kind: 'permission' },
      { key: 'members:remove', label: 'Remove Members', description: 'Remove members from the organization.', kind: 'permission' },
      { key: 'members:assignRole', label: 'Assign Roles', description: 'Change a member’s role (Admin / Viewer).', kind: 'permission' },
    ],
  },
  {
    category: 'Billing', description: 'Plan and billing visibility.', icon: CreditCard,
    items: [
      { key: 'billing:view', label: 'View Billing & Plan', description: 'See the plan, invoices, and license usage.', kind: 'permission' },
      { key: 'billing:manage', label: 'Manage Billing', description: 'Change the plan and payment details.', kind: 'permission' },
    ],
  },
  {
    category: 'Organization', description: 'Organization-level settings.', icon: Building2,
    items: [
      { key: 'org:settings', label: 'Organization Settings', description: 'Edit organization name, security, and policies.', kind: 'permission' },
    ],
  },
];

// Role defaults for the allocatable capabilities (mirror of rbac.ts). Used as
// the baseline against which per-user overrides are shown as grant/revoke.
const ROLE_DEFAULT_PERMISSIONS: Record<string, Set<string>> = {
  ADMIN: new Set([
    'devices:register', 'devices:configure', 'devices:remove', 'devices:assign',
    'devices:groups:create', 'devices:groups:delete',
    'members:view', 'members:invite', 'members:edit', 'members:remove', 'members:assignRole',
    'sessions:start', 'sessions:join', 'sessions:viewHistoryAll', 'sessions:recordings:view',
    'billing:view', 'org:settings',
  ]),
  VIEWER: new Set(['devices:reportIssue', 'billing:view']),
};
const ROLE_DEFAULT_FEATURES: Record<string, Record<string, boolean>> = {
  ADMIN: { licenses: true, chat: true, remoteSupport: true, feedback: true, help: true, adminSettings: false },
  VIEWER: { licenses: true, chat: true, remoteSupport: false, feedback: true, help: true, adminSettings: false },
};

interface Overrides { features: Record<string, boolean>; permissions: Record<string, boolean> }

interface Member {
  id: string;
  email: string;
  name?: string;
  role: string;
  allowedDeviceIds?: string[];
  allowedGroups?: DeviceGroup[];
  permissionOverrides?: any;
}

interface MemberPermissionsProps {
  member: Member;
  actor: any; // current user from the auth store (role, permissions[], features{})
  groups: DeviceGroup[];
  orgDevices: OrgDevice[];
  roleOptions: Array<{ value: string; label: string }>;
  onBack: () => void;
  onSaved: () => void;
}

const asOverrides = (raw: any): Overrides => ({
  features: raw && typeof raw.features === 'object' ? { ...raw.features } : {},
  permissions: raw && typeof raw.permissions === 'object' ? { ...raw.permissions } : {},
});

export const MemberPermissions: React.FC<MemberPermissionsProps> = ({ member, actor, groups, orgDevices, roleOptions, onBack, onSaved }) => {
  const [role, setRole] = useState(String(member.role || 'VIEWER').toUpperCase());
  const [overrides, setOverrides] = useState<Overrides>(() => asOverrides(member.permissionOverrides));
  const [orgFeatureBaseline, setOrgFeatureBaseline] = useState<Record<string, Record<string, boolean>> | null>(null);
  const [serverCatalog, setServerCatalog] = useState<Array<Omit<CapabilityCategory, 'icon'>> | null>(null);
  const [serverRoleDefaults, setServerRoleDefaults] = useState<Record<string, { features: Record<string, boolean>; permissions: string[] }> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Device access (mirrors SnowMembers.openEditAccess derivation)
  const initialAccess = (() => {
    const ids = member.allowedDeviceIds || [];
    const gIds = (member.allowedGroups || []).map((g) => g.id);
    if (ids.includes('__all__')) return { type: 'full' as AccessType, ids: [] as string[], gIds };
    if (gIds.length > 0) return { type: 'groups' as AccessType, ids: [] as string[], gIds };
    if (ids.length > 0) return { type: 'specific' as AccessType, ids: ids.filter((i) => i !== '__all__'), gIds: [] as string[] };
    return { type: 'none' as AccessType, ids: [] as string[], gIds: [] as string[] };
  })();
  const [accessType, setAccessType] = useState<AccessType>(initialAccess.type);
  const [deviceIds, setDeviceIds] = useState<string[]>(initialAccess.ids);
  const [groupIds, setGroupIds] = useState<string[]>(initialAccess.gIds);
  const [deviceSearch, setDeviceSearch] = useState('');

  // Feature baseline reflects the org's per-role feature toggles when available,
  // falling back to the hardcoded role defaults.
  useEffect(() => {
    let cancelled = false;
    api.get('/api/organizations/role-features')
      .then(({ data }: { data: any }) => { if (!cancelled) setOrgFeatureBaseline(data?.roleFeatures || null); })
      .catch(() => { /* fall back to hardcoded defaults */ });
    // Catalog + role defaults come from the backend (shared package) so the
    // matrix can't drift from what the server actually enforces.
    api.get('/api/members/permission-catalog')
      .then(({ data }: { data: any }) => {
        if (cancelled) return;
        if (Array.isArray(data?.catalog)) setServerCatalog(data.catalog);
        if (data?.roleDefaults && typeof data.roleDefaults === 'object') setServerRoleDefaults(data.roleDefaults);
      })
      .catch(() => { /* fall back to the local mirror */ });
    return () => { cancelled = true; };
  }, []);

  const catalog: CapabilityCategory[] = useMemo(() => {
    if (!serverCatalog) return PERMISSION_CATALOG;
    return serverCatalog.map((cat) => ({ ...cat, icon: CATEGORY_ICONS[cat.category] || Lock }));
  }, [serverCatalog]);

  const actorIsFull = ['OWNER', 'SUPER_ADMIN'].includes(String(actor?.role || '').toUpperCase());
  const actorPerms: string[] = Array.isArray(actor?.permissions) ? actor.permissions : [];
  const actorFeatures: Record<string, boolean> = actor?.features && typeof actor.features === 'object' ? actor.features : {};

  const baselineOf = (item: CapabilityItem): boolean => {
    if (item.kind === 'feature') {
      const orgVal = orgFeatureBaseline?.[role]?.[item.key];
      if (typeof orgVal === 'boolean') return orgVal;
      const serverVal = serverRoleDefaults?.[role]?.features?.[item.key];
      if (typeof serverVal === 'boolean') return serverVal;
      return ROLE_DEFAULT_FEATURES[role]?.[item.key] ?? false;
    }
    if (serverRoleDefaults?.[role]?.permissions) return serverRoleDefaults[role].permissions.includes(item.key);
    return ROLE_DEFAULT_PERMISSIONS[role]?.has(item.key) ?? false;
  };
  const overrideOf = (item: CapabilityItem): boolean | undefined => {
    const bag = item.kind === 'feature' ? overrides.features : overrides.permissions;
    return typeof bag[item.key] === 'boolean' ? bag[item.key] : undefined;
  };
  const effectiveOf = (item: CapabilityItem): boolean => {
    const ov = overrideOf(item);
    return ov === undefined ? baselineOf(item) : ov;
  };
  const canGrant = (item: CapabilityItem): boolean => {
    if (actorIsFull) return true;
    if (item.kind === 'feature') return actorFeatures[item.key] !== false;
    return actorPerms.includes(item.key);
  };

  const REMOTE_SUPPORT_FEATURE: CapabilityItem = { key: 'remoteSupport', label: 'Remote Support', description: '', kind: 'feature' };

  const applyChange = (target: CapabilityItem, value: boolean) => {
    const baseline = baselineOf(target);
    setOverrides((prev) => {
      const bag = target.kind === 'feature' ? { ...prev.features } : { ...prev.permissions };
      if (value === baseline) delete bag[target.key];
      else bag[target.key] = value;
      return target.kind === 'feature' ? { ...prev, features: bag } : { ...prev, permissions: bag };
    });
  };

  const toggle = (item: CapabilityItem) => {
    const current = effectiveOf(item);
    const next = !current;
    // Block turning something ON that the acting admin can't grant.
    if (next && !canGrant(item)) return;
    applyChange(item, next);
    // The Remote support page needs both the nav feature and sessions:start.
    // Granting the action also reveals the page when the role hides it, so
    // the grant never looks like a no-op to the owner.
    if (item.key === 'sessions:start' && next && !effectiveOf(REMOTE_SUPPORT_FEATURE) && canGrant(REMOTE_SUPPORT_FEATURE)) {
      applyChange(REMOTE_SUPPORT_FEATURE, true);
    }
  };

  // Drop overrides that equal the current role baseline (keeps storage clean,
  // esp. after a role switch changes the defaults).
  const prunedOverrides = useMemo((): Overrides => {
    const out: Overrides = { features: {}, permissions: {} };
    for (const cat of catalog) {
      for (const item of cat.items) {
        const ov = overrideOf(item);
        if (ov === undefined) continue;
        if (ov === baselineOf(item)) continue;
        if (item.kind === 'feature') out.features[item.key] = ov;
        else out.permissions[item.key] = ov;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, role, orgFeatureBaseline, catalog, serverRoleDefaults]);

  const filteredDevices = useMemo(
    () => orgDevices.filter((d) => !deviceSearch || d.device_name?.toLowerCase().includes(deviceSearch.toLowerCase()) || d.access_key?.includes(deviceSearch)),
    [deviceSearch, orgDevices]
  );

  const accessPayload = () => ({
    accessType,
    deviceIds: accessType === 'specific' ? deviceIds : [],
    groupIds: accessType === 'groups' ? groupIds : [],
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/members/${member.id}/permissions`, { role, overrides: prunedOverrides });
      await api.patch(`/api/members/${member.id}/access`, accessPayload());
      // Stay on this page: flash a "Saved" confirmation on the button and let
      // the parent refresh its list in the background.
      onSaved();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed To Save Permissions');
    } finally {
      setSaving(false);
    }
  };

  const initial = (member.name?.[0] || member.email[0] || '?').toUpperCase();

  return (
    <div className="w-full px-8 py-8 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded text-[rgba(17,19,21,0.5)] hover:bg-[#F3F4F6] hover:text-[#111315] transition-colors" title="Back To Members">
          <ArrowLeft size={20} />
        </button>
        <div className="w-11 h-11 rounded-full bg-[#F9F5FF] flex items-center justify-center text-[16px] font-medium text-[#7F56D9]">{initial}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-medium leading-[25px] text-black truncate">{member.name || 'Team Member'}</h1>
          <p className="text-[14px] text-[rgba(17,19,21,0.6)] truncate">{member.email}</p>
        </div>
        <button onClick={save} disabled={saving} style={saved ? undefined : { background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }} className={`flex items-center gap-2 h-10 px-5 rounded text-[14px] font-medium text-white transition-all hover:brightness-[1.03] disabled:opacity-50 ${saved ? 'bg-emerald-600' : ''}`}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">{error}</div>}

      <div className="space-y-6">
        {/* Role */}
        <section className="bg-white rounded-xl border border-[rgba(26,29,33,0.3)] p-6">
          <h2 className="text-[16px] font-semibold text-black mb-1">Role</h2>
          <p className="text-[14px] text-[rgba(17,19,21,0.6)] mb-4">The role sets the starting point for permissions. Fine-tune below.</p>
          {roleOptions.length > 0 ? (
            <div className="flex gap-3">
              {roleOptions.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  style={role === r.value ? { background: '#FFB347' } : undefined}
                  className={`h-10 min-w-[120px] rounded border text-[14px] font-medium transition-all ${role === r.value ? 'border-transparent text-white' : 'bg-white text-[rgba(17,19,21,0.7)] border-[rgba(26,29,33,0.3)] hover:border-[#FF8A00]'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-50 text-slate-600">{role}</span>
          )}
        </section>

        {/* Device access */}
        <section className="bg-white rounded-xl border border-[rgba(26,29,33,0.3)] p-6">
          <h2 className="text-[16px] font-semibold text-black mb-1">Device Access</h2>
          <p className="text-[14px] text-[rgba(17,19,21,0.6)] mb-4">Choose which devices this member can see.</p>
          <AccessPicker
            accessType={accessType}
            setAccessType={setAccessType}
            groups={groups}
            groupIds={groupIds}
            onGroupToggle={(id) => setGroupIds((p) => (p.includes(id) ? p.filter((g) => g !== id) : [...p, id]))}
            deviceIds={deviceIds}
            onDeviceToggle={(id) => setDeviceIds((p) => (p.includes(id) ? p.filter((d) => d !== id) : [...p, id]))}
            search={deviceSearch}
            setSearch={setDeviceSearch}
            devices={filteredDevices}
          />
        </section>

        {/* Permission matrix */}
        {catalog.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <section key={cat.category} className="bg-white rounded-xl border border-[rgba(26,29,33,0.3)] overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[rgba(26,29,33,0.12)] bg-[#F3F4F6]">
                <div className="w-8 h-8 rounded bg-[rgba(255,179,71,0.3)] flex items-center justify-center text-[#FF8A00]"><CatIcon size={16} /></div>
                <div>
                  <h2 className="text-[16px] font-semibold text-black">{cat.category}</h2>
                  <p className="text-[12px] text-[rgba(17,19,21,0.6)]">{cat.description}</p>
                </div>
              </div>
              <div className="divide-y divide-[rgba(26,29,33,0.1)]">
                {cat.items.map((item) => {
                  const on = effectiveOf(item);
                  const overridden = overrideOf(item) !== undefined;
                  const grantable = canGrant(item);
                  const locked = !on && !grantable; // can't turn on beyond your own ceiling
                  return (
                    <div key={item.key} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#1C1C1C]">{item.label}</span>
                          {overridden && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                              {on ? 'Granted' : 'Revoked'}
                            </span>
                          )}
                          {!overridden && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-slate-50 text-slate-400">Role Default</span>}
                        </div>
                        <p className="text-[11px] text-[rgba(28,28,28,0.45)] mt-0.5">{item.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        disabled={locked}
                        aria-pressed={on}
                        title={locked ? "You can't grant a capability you don't have" : undefined}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${on ? 'bg-[#FF8A00]' : 'bg-gray-200'} ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {locked && <Lock size={9} className="absolute left-1.5 text-gray-500" />}
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
