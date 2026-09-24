import React, { useEffect, useMemo, useRef, useState } from 'react';
import logo from '../../logo.png';
import upgradeIcon from '../assets/upgrade.svg';
import {
  Network,
  Monitor,
  MessageSquare,
  Settings,
  HelpCircle,
  MessageCircle,
  Video,
  LifeBuoy,
  Menu,
  MoreHorizontal,
  Sliders,
} from 'lucide-react';
import { t } from '../lib/translations';
import {
  SidebarPreferences,
  applySidebarPreferences,
  getSidebarPreferences,
} from '../lib/sidebarPreferences';
import { canAccessAdminSettings } from './admin-settings/adminSettingsData';
import { hasUserPermission } from '../lib/permissions';
import { SidebarCustomizationModal, CustomizableItem } from './SidebarCustomizationModal';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: any) => void;
  handleLogout: () => void;
  user: any;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showNotifications?: boolean;
  setShowNotifications?: (show: boolean) => void;
  onOpenFeedback?: () => void;
  onCustomizeOpenChange?: (open: boolean) => void;
  onOpenArchivedDevices?: () => void;
  onCheckForUpdate?: () => void;
  onOpenSupportIdentifier?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenCopyright?: () => void;
  onOpenFileLogs?: () => void;
  onOpenAbout?: () => void;
}

export const SnowPremiumSidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  handleLogout,
  user,
  isCollapsed,
  onToggleCollapse,
  showNotifications,
  setShowNotifications,
  onOpenFeedback,
  onCustomizeOpenChange,
  onOpenArchivedDevices,
  onCheckForUpdate,
  onOpenSupportIdentifier,
  onOpenPrivacyPolicy,
  onOpenCopyright,
  onOpenFileLogs,
  onOpenAbout
}) => {
  const [appVersion, setAppVersion] = useState('');
  const normalizedRole = String(user?.role || '').toUpperCase();
  const preferenceScope = `${user?.id || user?.email || 'signed-out'}:${normalizedRole || 'VIEWER'}`;
  const canSeeAdminSettings = canAccessAdminSettings(user);
  // Owner-configured feature visibility for this member's role (from /auth/me).
  // Missing (older cache / pre-fetch) defaults to visible so nothing is hidden
  // by accident before features load.
  const featureEnabled = (key: string) => (user?.features ? user.features[key] !== false : true);
  // Licenses/plan is shared with admins & viewers when the owner allows it.
  const canUpgrade = featureEnabled('licenses');
  const planKey = String(user?.plan || 'TRIAL').toUpperCase();
  const isFreePlan = planKey === 'TRIAL' || planKey === 'FREE';
  const planDisplay = planKey
    .split(/[_\-\s]+/)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
  const planCardTitle = isFreePlan ? 'Free License' : `${planDisplay} License`;
  const planCardBody = isFreePlan ? 'To enjoy more features, upgrade your plan.' : `Your workspace is on the ${planDisplay} plan.`;
  const planCardButton = isFreePlan ? 'Upgrade Plan' : 'Manage Plan';
  // Remote support requires both the page (remoteSupport feature) and the
  // action (sessions:start permission) — both owner-editable per role and per
  // member. A Viewer granted access sees it; an Admin revoked access doesn't.
  const showRemoteSupport = featureEnabled('remoteSupport') && hasUserPermission(user, 'sessions:start');
  const showChat = featureEnabled('chat');
  const showFeedback = featureEnabled('feedback');
  const showHelp = featureEnabled('help');
  const showDevices = true;

  useEffect(() => {
    let active = true;
    const electronApi = (window as any).electronAPI;
    Promise.resolve(electronApi?.getAppVersion?.())
      .then((version) => {
        if (active && version) setAppVersion(String(version).replace(/^v/i, ''));
      })
      .catch(() => {
        if (active) setAppVersion('');
      });
    return () => {
      active = false;
    };
  }, []);

  const allNavItems = useMemo(
    () => {
      // The Home/Dashboard entry was removed; signed-in users land on Devices
      // (or Remote Support if enabled) instead of an overview page.
      const items: { id: string; label: string; icon: any; group: 'main' }[] = [];
      if (showRemoteSupport) {
        items.push({ id: 'connect', label: t('remote_support', user?.language), icon: Network, group: 'main' as const });
      }
      if (showDevices) {
        items.push({ id: 'devices', label: t('devices', user?.language), icon: Monitor, group: 'main' as const });
      }
      if (showChat) {
        items.push({ id: 'chat', label: t('chat', user?.language), icon: MessageSquare, group: 'main' as const });
      }
      items.push({ id: 'meetings', label: t('meetings', user?.language), icon: Video, group: 'main' as const });
      return items;
    },
    [showDevices, showRemoteSupport, showChat, user?.language]
  );

  const allBottomItems = useMemo(
    () => {
      const items = [];
      if (canSeeAdminSettings) {
        items.push({ id: 'admin_settings', label: t('admin_settings', user?.language), icon: Settings, group: 'utility' as const });
      }
      if (showFeedback) {
        items.push({ id: 'feedback', label: t('feedback', user?.language), icon: MessageCircle, group: 'utility' as const });
      }
      if (showHelp) {
        items.push({ id: 'help', label: t('help', user?.language), icon: HelpCircle, group: 'utility' as const });
      }
      return items;
    },
    [canSeeAdminSettings, showFeedback, showHelp, user?.language]
  );

  const [prefs, setPrefs] = useState<SidebarPreferences>(() => getSidebarPreferences(preferenceScope));
  const [showMorePopover, setShowMorePopover] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showHelpPopover, setShowHelpPopover] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePopoverRef = useRef<HTMLDivElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefs(getSidebarPreferences(preferenceScope));
  }, [preferenceScope]);

  useEffect(() => {
    onCustomizeOpenChange?.(showCustomizeModal);
    return () => onCustomizeOpenChange?.(false);
  }, [onCustomizeOpenChange, showCustomizeModal]);

  useEffect(() => {
    if (!showMorePopover) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreButtonRef.current?.contains(target)) return;
      if (morePopoverRef.current?.contains(target)) return;
      setShowMorePopover(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMorePopover]);

  useEffect(() => {
    if (!showHelpPopover) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (helpButtonRef.current?.contains(target)) return;
      if (helpPopoverRef.current?.contains(target)) return;
      setShowHelpPopover(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHelpPopover]);

  // Items the modal lets the user toggle. `dashboard` is protected (always present).
  const customizationItems: CustomizableItem[] = useMemo(
    () => [
      ...allNavItems.map((item) => ({
        id: item.id,
        label: item.label,
        group: 'main' as const,
        protected: item.id === 'dashboard',
      })),
      ...allBottomItems.map((item) => ({
        id: item.id,
        label: item.label,
        group: 'utility' as const,
        protected: item.id === 'admin_settings',
      })),
    ],
    [allNavItems, allBottomItems]
  );

  const navItems = applySidebarPreferences(allNavItems, prefs, ['dashboard']);
  const bottomItems = applySidebarPreferences(allBottomItems, prefs, canSeeAdminSettings ? ['admin_settings'] : []);

  const handleApplyPreferences = (next: SidebarPreferences) => {
    setPrefs(next);
  };

  const helpMenuItems = [
    { label: 'Archived Devices', action: () => onOpenArchivedDevices?.() },
    { label: 'Check For New Version', action: () => onCheckForUpdate?.() },
    { label: 'Customer Support Identifier', action: () => onOpenSupportIdentifier?.() },
    { label: 'Privacy Policy', action: () => onOpenPrivacyPolicy?.() },
    { label: 'Copy Right', action: () => onOpenCopyright?.() },
    { label: 'Open File Logs', action: () => onOpenFileLogs?.() },
    { label: 'About Remote365', action: () => onOpenAbout?.() },
  ];

  const navButtonClass = (isActive: boolean) => `
    w-full h-10 flex items-center rounded transition-colors
    ${isCollapsed ? 'justify-center px-0' : 'gap-2 px-4'}
    ${isActive ? 'bg-white text-[#FF8A00]' : 'text-[#111315] hover:bg-white/70'}
  `;

  const navIconClass = (isActive: boolean) => `
    h-4 w-4 shrink-0 stroke-[1.8]
    ${isActive ? 'text-[#FF8A00]' : 'text-[#111315]'}
  `;

  const navLabelClass = 'text-[14px] font-medium leading-5 whitespace-nowrap';



  return (
    <aside className={`fixed left-0 top-0 bottom-0 z-30 flex h-screen flex-col items-start gap-4 bg-[#F3F4F6] p-4 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[245px]'}`}>
      {/* Brand Header */}
      <div className={`flex h-8 w-full items-center ${isCollapsed ? 'justify-center' : 'justify-between gap-4'}`}>
        {isCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-6 w-6 items-center justify-center text-[#111315]"
            aria-label="Expand Sidebar"
            title="Expand Sidebar"
          >
            <Menu size={24} strokeWidth={1.4} />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className="flex h-8 min-w-0 items-center gap-2"
              title={appVersion ? `Remote365 v${appVersion}` : 'Remote365'}
            >
              <img src={logo} alt="Remote365" className="h-8 w-8 object-contain" />
              <span className="whitespace-nowrap text-[14px] font-normal leading-5 text-[#111315]">Remote365</span>
              {appVersion && (
                <span className="-ml-1 mt-0.5 whitespace-nowrap text-[9px] font-medium leading-none tracking-[0.1px] text-[rgba(17,19,21,0.48)]">
                  v{appVersion}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-6 w-6 items-center justify-center text-[#111315]"
              aria-label="Collapse Sidebar"
              title="Collapse Sidebar"
            >
              <Menu size={24} strokeWidth={1.4} />
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col justify-between">
        {/* Main Nav */}
        <nav className="flex w-full flex-col items-end gap-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={navButtonClass(Boolean(isActive))}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon size={16} className={navIconClass(Boolean(isActive))} />
                {!isCollapsed && <span className={navLabelClass}>{item.label}</span>}
              </button>
            );
          })}

        </nav>

        {/* Bottom group: upgrade card + utility nav */}
        <div className="flex w-full flex-col gap-4">

        {/* Upgrade card (Figma: Frame 1160446393 — 213x220) */}
        {canUpgrade && (
          isCollapsed ? (
            <button
              type="button"
              onClick={() => setCurrentView('billing')}
              title={planCardButton}
              aria-label={planCardButton}
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#FFB347]/30 transition-colors hover:bg-[#FFB347]/45"
            >
              <img src={upgradeIcon} alt="" className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-4 rounded-[12px] border border-[#1A1D21]/30 py-4">
              <div className="flex w-full flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#FFB347]/30">
                    <img src={upgradeIcon} alt="" className="h-5 w-5" />
                  </span>
                  <span className="text-[14px] font-medium leading-5 text-[#111315]">{planCardTitle}</span>
                </div>
                <p className="w-full px-4 text-center text-[12px] font-normal leading-[17px] text-[#111315]/60">
                  {planCardBody}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('billing')}
                className="flex h-[37px] w-[158px] items-center justify-center rounded-[4px] px-4 py-[10px] text-[12px] font-medium leading-[17px] text-white transition-[filter] hover:brightness-105"
                style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
              >
                {planCardButton}
              </button>
            </div>
          )
        )}

        {/* Bottom Nav */}
        <div className="relative flex w-full flex-col items-end gap-1">
          {bottomItems.map((item) => {
            const isActive = Boolean(currentView === item.id || (item.id === 'notifications' && showNotifications));
            return (
              <button
                key={item.id}
                ref={item.id === 'help' ? helpButtonRef : undefined}
                onClick={() => {
                  if (item.id === 'notifications') {
                    setShowNotifications?.(true);
                  } else if (item.id === 'feedback') {
                    onOpenFeedback?.();
                  } else if (item.id === 'help') {
                    setShowHelpPopover((value) => !value);
                    setShowMorePopover(false);
                  } else {
                    setShowHelpPopover(false);
                    setCurrentView(item.id);
                  }
                }}
                className={navButtonClass(isActive || (item.id === 'help' && showHelpPopover))}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon size={16} className={navIconClass(isActive || (item.id === 'help' && showHelpPopover))} />
                {!isCollapsed && <span className={navLabelClass}>{item.label}</span>}
              </button>
            );
          })}

          {showHelpPopover && (
            <div
              ref={helpPopoverRef}
              className="fixed z-50 flex h-[280px] w-[216px] flex-col items-start p-0 font-['Mona_Sans',system-ui,sans-serif] drop-shadow-[-4px_4px_12px_rgba(0,0,0,0.25)]"
              style={{
                left: isCollapsed ? 80 : 245,
                top: 'min(648px, calc(100vh - 292px))',
              }}
            >
              {helpMenuItems.map((entry, index) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => {
                    entry.action();
                    setShowHelpPopover(false);
                  }}
                  className={`flex h-10 w-[216px] items-center gap-2 bg-white px-4 py-2.5 text-left text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F3F4F6] ${
                    index === 0 ? 'rounded-t-[4px]' : index === helpMenuItems.length - 1 ? 'rounded-b-[4px]' : ''
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )}

          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setShowMorePopover((value) => !value)}
            className={navButtonClass(showMorePopover)}
            title={isCollapsed ? t('more', user?.language) : ''}
          >
            <MoreHorizontal size={16} className={navIconClass(showMorePopover)} />
            {!isCollapsed && <span className={navLabelClass}>{t('more', user?.language)}</span>}
          </button>

          {showMorePopover && (
            <div
              ref={morePopoverRef}
              className={`absolute z-50 rounded bg-white p-1 shadow-xl ring-1 ring-black/10 ${
                isCollapsed
                  ? 'bottom-0 left-full ml-2 w-[200px]'
                  : 'bottom-[calc(100%+8px)] left-0 right-0'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCustomizeModal(true);
                  setShowMorePopover(false);
                }}
                className="flex h-9 w-full items-center gap-2 rounded px-3 text-left text-[13px] font-medium text-[#111315] hover:bg-[#F3F4F6]"
              >
                <Sliders size={14} />
                {t('customize_sidebar', user?.language)}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      <SidebarCustomizationModal
        open={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        items={customizationItems}
        preferenceScope={preferenceScope}
        onApply={handleApplyPreferences}
      />
    </aside>
  );
};
