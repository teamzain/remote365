import type React from 'react';
import {
  Activity,
  CreditCard,
  FileText,
  LayoutGrid,
  Lock,
  Monitor,
  Settings,
  Shield,
  Users
} from 'lucide-react';

export const PLAN_MEMBER_LIMITS: Record<string, number> = {
  TRIAL: 1,
  SOLO: 2,
  PRO: 5,
  BUSINESS: 25,
  ENTERPRISE: Infinity
};

export const ROLES = [] as const;

export type RoleName = (typeof ROLES)[number];

export const PERMISSIONS: Array<{
  key: string;
  label: string;
  description: string;
  roles: Record<RoleName, boolean>;
}> = [];

export const DEFAULTS = {
  companyName: '',
  defaultLanguage: 'en',
  forceSubAdmin2FA: false,
  minPasswordLength: 8,
  requireHostApproval: true,
  defaultViewOnlySessions: false,
  allowFileTransfer: true,
  allowClipboardSync: true,
  idleSessionTimeoutMinutes: 30,
  sessionRecording: false
};

export const LS_KEY = 'platform_settings_local';

export type AdminSettings = typeof DEFAULTS & Record<string, any>;

export type TabId =
  | 'overview'
  | 'general'
  | 'members'
  | 'roles'
  | 'devices'
  | 'groups'
  | 'policies'
  | 'security'
  | 'audit'
  | 'billing';

export const SIDEBAR_SECTIONS: Array<{
  title: string;
  ownerOnly?: boolean;
  items: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }>;
}> = [
  { title: 'ORGANIZATION', items: [{ id: 'overview', label: 'Overview', icon: LayoutGrid }, { id: 'general', label: 'General', icon: Settings }] },
  { title: 'TEAM', items: [{ id: 'members', label: 'Members', icon: Users }, { id: 'roles', label: 'Roles & Permissions', icon: Shield }] },
  { title: 'DEVICES', items: [{ id: 'devices', label: 'All Devices', icon: Monitor }, { id: 'groups', label: 'Device Groups', icon: LayoutGrid }, { id: 'policies', label: 'Connection Policies', icon: FileText }] },
  { title: 'SECURITY', items: [{ id: 'security', label: 'Security', icon: Lock }, { id: 'audit', label: 'Audit Log', icon: Activity }] },
  { title: 'BILLING', ownerOnly: true, items: [{ id: 'billing', label: 'Plan & Billing', icon: CreditCard }] }
];

export const getPlanLimit = (plan?: string) => PLAN_MEMBER_LIMITS[String(plan || 'TRIAL').toUpperCase()] ?? PLAN_MEMBER_LIMITS.TRIAL;
// Admin settings is owner-only by default. Admins/viewers only see it if the
// owner grants the "Admin settings" role feature (Roles & permissions). Takes
// the user so it can read the resolved features from /auth/me.
export const canAccessAdminSettings = (userOrRole?: any) => {
  const user = userOrRole && typeof userOrRole === 'object' ? userOrRole : { role: userOrRole };
  const role = String(user?.role || '').toUpperCase();
  if (['SUPER_ADMIN', 'OWNER'].includes(role)) return true;
  return user?.features?.adminSettings === true;
};
export const formatLimit = (limit: number) => Number.isFinite(limit) ? String(limit) : 'Unlimited';
export const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Never';

export function loadLocal(): AdminSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
