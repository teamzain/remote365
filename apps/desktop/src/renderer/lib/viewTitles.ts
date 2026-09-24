import { t } from './translations';

// The top bar used to fall through to the raw view id, which printed a
// lowercase "connect" / "members" / "org-detail" for every view the ternary
// chain did not name. Every view the shell can land on is mapped here.
const VIEW_TITLE_KEYS: Record<string, string> = {
  home: 'home_title',
  dashboard: 'home_title',
  connect: 'remote_support',
  devices: 'devices_title',
  chat: 'chat',
  meetings: 'meetings',
  settings: 'settings_title',
  billing: 'billing_title',
  profile: 'profile_title_nav',
  support: 'support_title_nav',
  admin_settings: 'admin_settings',
  members: 'members_title',
  organizations: 'organizations_title',
  analytics: 'analytics_title',
  'org-detail': 'organization_detail_title',
  host: 'host_title',
  support_workstation: 'sessions',
  end_user_home: 'get_help',
};

// Anything new that has not been mapped yet still reads as a label rather than
// as an identifier: "some_new_view" -> "Some New View".
const titleCaseViewId = (view: string): string =>
  view.replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase());

export const getViewTitle = (view: string, lang?: string): string => {
  const key = VIEW_TITLE_KEYS[view];
  return key ? t(key, lang) : titleCaseViewId(view);
};
