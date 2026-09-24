import React from 'react';
import {
  Activity,
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe,
  Loader2,
  Lock,
  Monitor,
  Pencil,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Users
} from 'lucide-react';
import {
  AdminSettings,
  PERMISSIONS,
  ROLES,
  formatDate,
  formatLimit
} from './adminSettingsData';

export type DeviceRecord = {
  id: string;
  device_name?: string;
  name?: string;
  group?: string;
  device_group?: string;
  device_groups?: Array<{ name: string }>;
  owner?: { name?: string; email?: string };
  user?: { name?: string; email?: string };
  is_online?: boolean;
  online?: boolean;
  last_seen?: string;
  lastSeen?: string;
};

export type AuditEvent = {
  id?: string;
  timestamp?: string;
  createdAt?: string;
  actor?: string | { name?: string; email?: string };
  action?: string;
  target?: string;
};

type ToggleProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
};

export const AdminToggle = ({ checked, onChange }: ToggleProps) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#D4A017]' : 'bg-gray-200 dark:bg-white/10'}`}
  >
    <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-[2px]'}`} />
  </button>
);

export const SettingsHeader = ({ title, description }: { title: string; description: string }) => (
  <div className="mb-12">
    <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{title}</h1>
    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">{description}</p>
  </div>
);

const SettingsPanel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-6 text-[#111315] dark:text-[#F5F5F5]">{children}</div>
);

const SettingsRow = ({
  icon: Icon,
  title,
  description,
  action
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-6">
    <div className="flex max-w-[600px] items-start gap-3">
      {Icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#D4A017]/10 text-[#D4A017]">
          <Icon size={16} />
        </div>
      )}
      <div>
        <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">{title}</h3>
        <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">{description}</p>
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const inputClass = 'h-10 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] leading-5 text-[#111315] outline-none focus:border-[#D4A017] dark:border-white/10 dark:bg-[#141414] dark:text-white';

export const OverviewTab = ({
  user,
  plan,
  memberCount,
  memberLimit,
  devices,
  auditEvents,
  billingVisible,
  onSelectTab,
  onAddDevice
}: {
  user: any;
  plan: string;
  memberCount: number;
  memberLimit: number;
  devices: DeviceRecord[];
  auditEvents: AuditEvent[];
  billingVisible: boolean;
  onSelectTab: (tab: 'members' | 'devices' | 'audit' | 'billing') => void;
  onAddDevice?: () => void;
}) => {
  const recent = auditEvents.slice(0, 4);
  const activeDevices = devices.filter(device => device.is_online || device.online).length;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <SettingsHeader title="Overview" description="Monitor Remote365 usage, device readiness, and recent organization activity." />
      {plan === 'TRIAL' && (
        <div className="mb-8 rounded border border-[#D4A017]/20 bg-[#D4A017]/10 p-5 shadow-sm shadow-amber-500/20">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h2 className="m-0 text-[16px] font-semibold text-black dark:text-[#F5F5F5]">Trial Workspace</h2>
              <p className="m-0 mt-1 text-[14px] text-[#111315] dark:text-[#A0A0A0]">Upgrade to SOLO, PRO, BUSINESS, or ENTERPRISE when you need more seats and devices.</p>
            </div>
            <button type="button" onClick={() => onSelectTab(billingVisible ? 'billing' : 'members')} className="h-10 rounded-xl bg-[#1C1C1C] px-4 text-[14px] font-bold text-white dark:bg-white dark:text-[#1C1C1C]">
              View Options
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: 'Members', value: `${memberCount}/${formatLimit(memberLimit)}`, icon: Users },
          { label: 'Devices', value: devices.length, icon: Monitor },
          { label: 'Online Now', value: activeDevices, icon: Activity },
          { label: 'Plan', value: plan, icon: CreditCard }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded border border-[rgba(26,29,33,0.3)] bg-white p-5 dark:border-white/10 dark:bg-[#111]">
              <Icon size={18} className="mb-4 text-[#D4A017]" />
              <div className="text-[24px] font-bold leading-[34px] text-black dark:text-white">{item.value}</div>
              <div className="text-[13px] text-[#757575] dark:text-[#A0A0A0]">{item.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        <div className="rounded border border-[rgba(26,29,33,0.3)] bg-white p-5 dark:border-white/10 dark:bg-[#111]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-[16px] font-semibold text-black dark:text-white">Recent Activity</h2>
            <button type="button" onClick={() => onSelectTab('audit')} className="text-[13px] font-bold text-[#D4A017]">Open Audit Log</button>
          </div>
          {recent.length === 0 ? (
            <div className="rounded border border-dashed border-[rgba(26,29,33,0.2)] p-8 text-center text-[13px] text-[#757575] dark:border-white/10 dark:text-[#A0A0A0]">
              No recent activity yet.
            </div>
          ) : recent.map(event => (
            <div key={event.id || `${event.timestamp}-${event.action}`} className="flex items-center justify-between border-b border-[rgba(26,29,33,0.08)] py-3 last:border-0 dark:border-white/10">
              <div>
                <div className="text-[13px] font-bold text-[#1C1C1C] dark:text-white">{event.action || 'Activity'}</div>
                <div className="text-[12px] text-[#757575] dark:text-[#A0A0A0]">{typeof event.actor === 'string' ? event.actor : event.actor?.email || user?.name || 'System'}</div>
              </div>
              <div className="text-[12px] text-[#757575] dark:text-[#A0A0A0]">{formatDate(event.timestamp || event.createdAt)}</div>
            </div>
          ))}
        </div>
        <div className="rounded border border-[rgba(26,29,33,0.3)] bg-white p-5 dark:border-white/10 dark:bg-[#111]">
          <h2 className="m-0 text-[16px] font-semibold text-black dark:text-white">Quick Actions</h2>
          <div className="mt-4 flex flex-col gap-3">
            <button type="button" onClick={() => onSelectTab('members')} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1C1C1C] text-[14px] font-bold text-white shadow-lg shadow-amber-500/20 dark:bg-white dark:text-[#1C1C1C]">
              <UserPlus size={16} /> Invite Member
            </button>
            <button type="button" onClick={onAddDevice} className="flex h-10 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] text-[14px] font-bold dark:border-white/10 dark:text-white">
              <Monitor size={16} /> Add Device
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GeneralTab = ({
  loading,
  settings,
  companyName,
  setCompanyName,
  onUpdate
}: {
  loading: boolean;
  settings: AdminSettings;
  companyName: string;
  setCompanyName: (value: string) => void;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}) => (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <SettingsHeader title="General" description="Set organization details used across Remote365." />
    {loading ? (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#757575]" />
      </div>
    ) : (
      <SettingsPanel>
        <SettingsRow
          icon={Building2}
          title="Company Name"
          description="Displayed to team members and managed devices."
          action={
            <input
              value={companyName}
              onChange={event => setCompanyName(event.target.value)}
              onBlur={() => onUpdate({ companyName: companyName.trim() })}
              className={`${inputClass} w-[220px] text-right font-medium`}
            />
          }
        />
        <SettingsRow
          icon={Upload}
          title="Logo"
          description="Upload support will be available here."
          action={<button type="button" className="h-10 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium text-[#111315] dark:border-white/10 dark:bg-transparent dark:text-white">Upload Logo</button>}
        />
        <SettingsRow
          icon={Globe}
          title="Default Language"
          description="Fallback language for new team members."
          action={
            <select value={settings.defaultLanguage || 'en'} onChange={event => onUpdate({ defaultLanguage: event.target.value })} className={`${inputClass} w-[220px]`}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="ur">Urdu</option>
              <option value="ar-SA">Arabic</option>
            </select>
          }
        />
      </SettingsPanel>
    )}
  </div>
);

export const RolesTab = () => (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <SettingsHeader title="Roles & Permissions" description="Default organization roles for Remote365 access." />
    <div className="overflow-hidden rounded border border-[rgba(26,29,33,0.3)] bg-white dark:border-white/10 dark:bg-[#111]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[rgba(26,29,33,0.12)] bg-[#F3F4F6] dark:border-white/10 dark:bg-white/5">
            <th className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">Permission</th>
            {ROLES.map(role => <th key={role} className="px-4 py-4 text-center text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">{role}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(26,29,33,0.08)] dark:divide-white/10">
          {PERMISSIONS.map(permission => (
            <tr key={permission.key} className="hover:bg-[#F9FAFB] dark:hover:bg-white/5">
              <td className="px-5 py-4">
                <div className="text-[13px] font-bold text-[#1C1C1C] dark:text-white">{permission.label}</div>
                <div className="mt-0.5 text-[12px] text-[#757575] dark:text-[#A0A0A0]">{permission.description}</div>
              </td>
              {ROLES.map(role => (
                <td key={role} className="px-4 py-4 text-center">
                  {permission.roles[role] ? <Check className="mx-auto text-emerald-600" size={18} /> : <span className="text-[#C7C7C7] dark:text-white/20">x</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const deviceGroupName = (device: DeviceRecord) => device.group || device.device_group || device.device_groups?.[0]?.name || 'Ungrouped';
const deviceOwner = (device: DeviceRecord) => device.owner?.name || device.owner?.email || device.user?.name || device.user?.email || 'Unassigned';

export const DevicesTab = ({
  devices,
  loading,
  onRefresh,
  onRename,
  onDelete
}: {
  devices: DeviceRecord[];
  loading: boolean;
  onRefresh: () => void;
  onRename: (device: DeviceRecord) => void;
  onDelete: (device: DeviceRecord) => void;
}) => (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <div className="mb-12 flex items-start justify-between gap-6">
      <div>
        <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">All Devices</h1>
        <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Organization-wide registered devices.</p>
      </div>
      <button type="button" onClick={onRefresh} className="h-10 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium text-[#111315] dark:border-white/10 dark:bg-transparent dark:text-white">Refresh</button>
    </div>
    <div className="overflow-hidden rounded border border-[rgba(26,29,33,0.3)] bg-white dark:border-white/10 dark:bg-[#111]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[rgba(26,29,33,0.12)] bg-[#F3F4F6] dark:border-white/10 dark:bg-white/5">
            {['Name', 'Group', 'Owner', 'Status', 'Last Seen', ''].map(header => (
              <th key={header} className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(26,29,33,0.08)] dark:divide-white/10">
          {devices.map(device => (
            <tr key={device.id} className="hover:bg-[#F9FAFB] dark:hover:bg-white/5">
              <td className="px-5 py-4 text-[13px] font-bold text-[#1C1C1C] dark:text-white">{device.device_name || device.name || 'Unnamed Device'}</td>
              <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{deviceGroupName(device)}</td>
              <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{deviceOwner(device)}</td>
              <td className="px-5 py-4">
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${device.is_online || device.online ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[rgba(28,28,28,0.06)] text-[#757575] dark:bg-white/10 dark:text-[#A0A0A0]'}`}>
                  {device.is_online || device.online ? 'Online' : 'Offline'}
                </span>
              </td>
              <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{formatDate(device.last_seen || device.lastSeen)}</td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => onRename(device)} className="rounded-lg p-2 text-[#757575] hover:bg-[#F9FAFB] hover:text-[#1C1C1C] dark:hover:bg-white/5 dark:hover:text-white"><Pencil size={15} /></button>
                  <button type="button" onClick={() => onDelete(device)} className="rounded-lg p-2 text-[#757575] hover:bg-red-500/10 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && devices.length === 0 && <div className="py-16 text-center text-[13px] text-[#757575] dark:text-[#A0A0A0]">No devices yet.</div>}
      {loading && <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin text-[#757575]" /></div>}
    </div>
  </div>
);

export const PoliciesTab = ({ settings, onUpdate }: { settings: AdminSettings; onUpdate: (updates: Partial<AdminSettings>) => void }) => {
  const rows = [
    { key: 'requireHostApproval', title: 'Require Host Approval', description: 'Ask the host to approve incoming remote control sessions.', type: 'toggle', icon: Shield },
    { key: 'defaultViewOnlySessions', title: 'Default View-Only Sessions', description: 'Start new sessions without control permissions.', type: 'toggle', icon: Monitor },
    { key: 'allowFileTransfer', title: 'Allow File Transfer', description: 'Permit moving files during sessions.', type: 'toggle', icon: FileText },
    { key: 'allowClipboardSync', title: 'Allow Clipboard Sync', description: 'Permit copied text to sync between devices.', type: 'toggle', icon: CheckCircle2 },
    { key: 'idleSessionTimeoutMinutes', title: 'Idle Session Timeout', description: 'End idle sessions after this many minutes.', type: 'number', icon: AlertCircle },
    { key: 'sessionRecording', title: 'Session Recording', description: 'Allow approved session recordings for compliance.', type: 'toggle', icon: Activity }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <SettingsHeader title="Connection Policies" description="Set default remote desktop behavior for the organization." />
      <SettingsPanel>
        {rows.map(row => (
          <SettingsRow
            key={row.key}
            icon={row.icon}
            title={row.title}
            description={row.description}
            action={row.type === 'toggle'
              ? <AdminToggle checked={Boolean(settings[row.key])} onChange={value => onUpdate({ [row.key]: value })} />
              : <input type="number" min={5} max={240} value={settings[row.key] ?? 30} onChange={event => onUpdate({ [row.key]: Number(event.target.value) })} className={`${inputClass} w-24 text-right font-medium`} />}
          />
        ))}
      </SettingsPanel>
    </div>
  );
};

export const SecurityTab = ({ settings, onUpdate }: { settings: AdminSettings; onUpdate: (updates: Partial<AdminSettings>) => void }) => (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <SettingsHeader title="Security" description="Organization-wide authentication and trusted-device controls." />
    <SettingsPanel>
      <SettingsRow
        icon={Lock}
        title="Enforce 2FA For Admins"
        description="Require elevated users to use two-factor authentication."
        action={<AdminToggle checked={Boolean(settings.forceSubAdmin2FA)} onChange={value => onUpdate({ forceSubAdmin2FA: value })} />}
      />
      <SettingsRow
        icon={Shield}
        title="Minimum Password Length"
        description="Minimum password length for password-based accounts."
        action={<input type="number" min={8} max={64} value={settings.minPasswordLength ?? 8} onChange={event => onUpdate({ minPasswordLength: Number(event.target.value) })} className={`${inputClass} w-24 text-right font-medium`} />}
      />
      <SettingsRow
        icon={Monitor}
        title="Trusted Devices"
        description="Trusted device management will appear here."
        action={<span className="text-[13px] font-medium text-[#757575] dark:text-[#A0A0A0]">Placeholder</span>}
      />
    </SettingsPanel>
  </div>
);

export const AuditTab = ({ events, loading, available }: { events: AuditEvent[]; loading: boolean; available: boolean }) => (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <SettingsHeader title="Audit Log" description="Organization activity and administrative events." />
    {!available && (
      <div className="mb-6 rounded border border-[rgba(26,29,33,0.3)] bg-white p-4 text-[13px] text-[#757575] dark:border-white/10 dark:bg-[#111] dark:text-[#A0A0A0]">
        Audit API is not available yet. Events will appear here when /api/audit is implemented.
      </div>
    )}
    <div className="overflow-hidden rounded border border-[rgba(26,29,33,0.3)] bg-white dark:border-white/10 dark:bg-[#111]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[rgba(26,29,33,0.12)] bg-[#F3F4F6] dark:border-white/10 dark:bg-white/5">
            {['Timestamp', 'Actor', 'Action', 'Target'].map(header => (
              <th key={header} className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(26,29,33,0.08)] dark:divide-white/10">
          {events.map(event => (
            <tr key={event.id || `${event.timestamp}-${event.action}`} className="hover:bg-[#F9FAFB] dark:hover:bg-white/5">
              <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{formatDate(event.timestamp || event.createdAt)}</td>
              <td className="px-5 py-4 text-[13px] font-bold text-[#1C1C1C] dark:text-white">{typeof event.actor === 'string' ? event.actor : event.actor?.email || event.actor?.name || 'System'}</td>
              <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{event.action || '-'}</td>
              <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{event.target || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && events.length === 0 && <div className="py-16 text-center text-[13px] text-[#757575] dark:text-[#A0A0A0]">No Events Yet</div>}
      {loading && <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin text-[#757575]" /></div>}
    </div>
  </div>
);

export const BillingTab = ({ plan, memberCount, memberLimit }: { plan: string; memberCount: number; memberLimit: number }) => (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <SettingsHeader title="Plan & Billing" description="Review your current Remote365 plan and team seat usage." />
    <div className="rounded border border-[rgba(26,29,33,0.3)] bg-white p-6 dark:border-white/10 dark:bg-[#111]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="inline-flex rounded-full bg-[#D4A017]/10 px-3 py-1 text-[12px] font-bold text-[#D4A017]">{plan}</div>
          <h2 className="m-0 mt-4 text-[24px] font-bold leading-[34px] text-black dark:text-white">Current Plan</h2>
          <p className="m-0 mt-2 text-[14px] text-[#757575] dark:text-[#A0A0A0]">Seats used: {memberCount} of {formatLimit(memberLimit)}</p>
        </div>
        <button type="button" className="h-10 rounded-xl bg-[#1C1C1C] px-5 text-[14px] font-bold text-white shadow-lg shadow-amber-500/20 dark:bg-white dark:text-[#1C1C1C]">
          Upgrade Plan
        </button>
      </div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-[rgba(28,28,28,0.08)] dark:bg-white/10">
        <div className="h-full rounded-full bg-[#D4A017]" style={{ width: Number.isFinite(memberLimit) ? `${Math.min(100, (memberCount / memberLimit) * 100)}%` : '12%' }} />
      </div>
    </div>
  </div>
);
