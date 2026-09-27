import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  HelpCircle,
  Info,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Monitor,
  Network,
  RefreshCw,
  Search,
  Settings,
  Video,
  X,
} from 'lucide-react';
import logoAsset from '../../assets/logo.png';
import upgradeIconAsset from '../../assets/upgrade.svg';
import { useAuthStore } from '../../store/authStore';
import { useDeviceStore } from '../../store/deviceStore';
import { copyText, formatAccessCode } from '../../lib/webPlatform';
import { hasUserPermission } from '../../lib/permissions';
import { useDeviceMonitor } from '../../lib/useDeviceMonitor';
import { notify } from '../NotificationProvider';
import api from '../../lib/api';
import { openSessionTab } from '../../lib/sessionLauncher';
import { useShellChatEvents } from '../../lib/useShellChatEvents';
import { useNotificationStore, type WebNotification } from '../../store/notificationStore';
import { useChatStore } from '../../store/chatStore';
import { WebNotificationPanel } from './WebNotificationPanel';
import { WebAppToast } from './WebAppToast';

const logo = logoAsset.src;

// Two-letter initials for the avatar fallback, as the desktop header does it.
const initialsOf = (name?: string | null) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || '').slice(0, 2).toUpperCase();
};
const upgradeIcon = upgradeIconAsset.src;

interface WebPremiumShellProps {
  view: string;
  title: string;
  children: React.ReactNode;
}

const routeByView: Record<string, string> = {
  dashboard: '/dashboard',
  connect: '/dashboard/sessions',
  devices: '/dashboard/devices',
  meetings: '/dashboard/meetings',
  billing: '/dashboard/billing',
  settings: '/dashboard/settings',
  profile: '/dashboard/profile',
  support: '/dashboard/support',
  chat: '/dashboard/chat',
  admin_settings: '/dashboard/admin-settings',
};

const viewByRoute = (pathname: string) => {
  if (pathname.includes('/devices')) return 'devices';
  if (pathname.includes('/sessions')) return 'connect';
  if (pathname.includes('/meetings')) return 'meetings';
  if (pathname.includes('/billing')) return 'billing';
  // admin-settings must match before the plain /settings substring.
  if (pathname.includes('/admin-settings')) return 'admin_settings';
  if (pathname.includes('/settings')) return 'settings';
  if (pathname.includes('/profile')) return 'profile';
  if (pathname.includes('/support')) return 'support';
  if (pathname.includes('/chat')) return 'chat';
  return 'dashboard';
};

const canViewBilling = (role?: string) => ['SUPER_ADMIN', 'OWNER', 'ADMIN'].includes(String(role || '').toUpperCase());
const canViewAdmin = (role?: string) => ['SUPER_ADMIN', 'OWNER', 'ADMIN'].includes(String(role || '').toUpperCase());
const WEB_VERSION = '0.0.0';

const copyrightText = `Copyright © 2026 TechVision365 Inc. All rights reserved.

Remote365, the Remote365 logo, Remote365 ID, and related product names, designs, interfaces, icons, features, software components, documentation, and service materials are owned by Remote365 or its licensors and are protected by applicable copyright, trademark, and intellectual property laws.

You may use Remote365 only according to the license, subscription, or service terms that apply to your account or organization. No part of the Remote365 application, website, documentation, branding, or user interface may be copied, reproduced, modified, distributed, reverse engineered, republished, uploaded, posted, transmitted, sold, or used to create derivative works without prior written permission from Remote365, except where permitted by law or by an active written agreement.

Third-party names, logos, services, and trademarks shown inside Remote365 belong to their respective owners. Their appearance does not imply endorsement, sponsorship, or affiliation unless clearly stated.

Remote365 may include open-source software or third-party components. Those components remain subject to their own license terms. Unauthorized use of Remote365 materials may violate copyright, trademark, privacy, security, and other laws. Remote365 reserves all rights not expressly granted.`;

const privacySections = [
  {
    title: '1. Introduction',
    body: 'Welcome to Remote365. Remote365 provides secure remote desktop access, device management, collaboration, and support services for individuals, businesses, and enterprise organizations. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, account, desktop/mobile applications, support sessions, and related services.',
  },
  {
    title: '2. Information We Collect',
    body: 'We collect account information, device and technical information, session metadata, payment-related provider information, and support communication data needed to provide secure, reliable remote access services.',
  },
  {
    title: '3. Remote Sessions & Privacy',
    body: 'Remote sessions are designed around privacy and security. Remote365 employees cannot access your sessions unless you explicitly request support, access is legally required, or access is necessary to investigate abuse, fraud, or security threats.',
  },
  {
    title: '4. Cookies & Tracking Technologies',
    body: 'We may use cookies and similar technologies to keep users logged in, remember preferences, improve performance, analyze usage trends, and enhance security.',
  },
  {
    title: '5. Your Privacy Rights',
    body: 'Depending on your location, you may have rights to access, correct, delete, restrict, object to processing, export your data, or withdraw consent where applicable.',
  },
  {
    title: '6. Third-Party Services',
    body: 'Remote365 may integrate with third-party services including authentication providers, payment processors, analytics tools, and infrastructure services. These services have their own policies and practices.',
  },
  {
    title: '7. Contact Us',
    body: 'If you have questions about this Privacy Policy or our privacy practices, please contact Remote365 support.',
  },
];

const HelpModalShell: React.FC<{
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ open, title, onClose, children, wide = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-white/35 p-3 font-['Mona_Sans',system-ui,sans-serif] backdrop-blur-[6px] sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`my-auto flex max-h-[calc(100dvh-24px)] flex-col rounded-[12px] bg-white shadow-2xl ${wide ? 'w-[884px] max-w-full p-5 sm:p-6' : 'w-[468px] max-w-full px-5 py-4 sm:px-6 sm:py-3'}`}>
        {title ? (
          <div className="mb-5 flex items-center justify-between gap-6">
            <h2 className="m-0 text-[22px] font-bold leading-[30px] text-[#111315] sm:text-[24px] sm:leading-[34px]">{title}</h2>
            <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
              <X size={24} strokeWidth={1.5} />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
};

export const WebPremiumShell: React.FC<WebPremiumShellProps> = ({ view, title, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { devices, fetchDevices } = useDeviceStore();
  const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth < 1100);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelpPopover, setShowHelpPopover] = useState(false);
  // Header avatar menu (profile, plan, help, sign out) — same as the desktop.
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showUserDropdownHelp, setShowUserDropdownHelp] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showUserDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!userDropdownRef.current?.contains(event.target as Node)) {
        setShowUserDropdown(false);
        setShowUserDropdownHelp(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showUserDropdown]);
  const [helpModal, setHelpModal] = useState<'update' | 'support' | 'privacy' | 'copyright' | 'about' | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('Your version of Remote365 is up-to-date.');
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpPopoverRef = useRef<HTMLDivElement>(null);
  // Notification centre (store-backed; see store/notificationStore).
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const clearAllNotifications = useNotificationStore((state) => state.clearAll);
  const dismissNotification = useNotificationStore((state) => state.dismiss);
  const markNotificationRead = useNotificationStore((state) => state.markRead);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const activeView = view || viewByRoute(location.pathname);
  const role = String(user?.role || 'OWNER').toUpperCase();
  const plan = String(user?.plan || 'TRIAL').toUpperCase();
  // Owner-configured feature visibility for this member's role + per-user
  // overrides (resolved by /auth/me). Missing (pre-fetch) defaults to visible
  // so nothing hides by accident — mirrors the desktop sidebar gating.
  const featureEnabled = (key: string) => (user?.features ? (user.features as any)[key] !== false : true);
  // Admin settings is owner-only unless the owner grants the role feature.
  const canOpenAdminSettings = ['SUPER_ADMIN', 'OWNER'].includes(role) || (user as any)?.features?.adminSettings === true;

  useEffect(() => {
    fetchDevices(true);
  }, [fetchDevices]);

  // Live device state (online/offline, in-session) over the same presence socket
  // the desktop app uses, plus teammate add/remove sync and a poll fallback.
  // Replaces the old 10s blind poll + account-sync-only socket that used to live
  // here — see lib/useDeviceMonitor.
  useDeviceMonitor();

  useEffect(() => {
    setMobileSidebarOpen(false);
    setShowHelpPopover(false);
  }, [location.pathname]);

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

  // Nav honours the owner's RBAC: Remote support needs the page feature AND
  // the sessions:start permission; Chat needs the chat feature — both
  // owner-editable per role and per member, same rules as the desktop sidebar.
  const navItems = useMemo(() => {
    const items = [
      ...(featureEnabled('remoteSupport') && hasUserPermission(user, 'sessions:start')
        ? [{ id: 'connect', label: 'Remote support', icon: Network }]
        : []),
      { id: 'devices', label: 'Devices', icon: Monitor },
      { id: 'meetings', label: 'Meeting', icon: Video },
      ...(featureEnabled('chat') ? [{ id: 'chat', label: 'Chat', icon: MessageSquare }] : []),
    ];
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const utilityItems = [
    ...(canViewAdmin(role) && canOpenAdminSettings ? [{ id: 'admin_settings', label: 'Admin settings', icon: Settings }] : []),
    { id: 'support', label: 'Help', icon: HelpCircle },
  ];

  // Header search, desktop-style: matches devices by name/ID and app pages by
  // name; a full 9-digit ID offers a direct connect.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const digits = q.replace(/\D/g, '');
    const deviceMatches = (devices || []).filter((d: any) =>
      String(d.device_name || d.name || '').toLowerCase().includes(q)
      || (digits.length >= 2 && String(d.access_key || '').replace(/\s/g, '').includes(digits))
    ).slice(0, 5);
    const pages = [
      { label: 'Remote support', view: 'connect' },
      { label: 'Devices', view: 'devices' },
      { label: 'Meeting', view: 'meetings' },
      { label: 'Chat', view: 'chat' },
      { label: 'Settings', view: 'settings' },
      { label: 'Billing', view: 'billing' },
      { label: 'Members', view: 'members' },
      { label: 'Admin settings', view: 'admin_settings' },
      { label: 'Help', view: 'support' },
    ].filter((p) => p.label.toLowerCase().includes(q)).slice(0, 4);
    const idCandidate = digits.length === 9 ? digits : null;
    return { deviceMatches, pages, idCandidate };
  }, [searchQuery, devices]);
  const runSearchAction = (fn: () => void) => {
    fn();
    setSearchQuery('');
    setSearchFocused(false);
  };

  const setCurrentView = (nextView: string) => {
    navigate(routeByView[nextView] || '/dashboard');
  };

  useShellChatEvents(user?.id);

  // Every entry opens the page it is about.
  // Destination of a notification entry or the sliding toast.
  const openTarget = (target: Record<string, any>) => {
    if (target.view === 'connect' && target.sessionCode) { navigate(`/join/${String(target.sessionCode).replace(/\D/g, '')}`); return; }
    if (target.view === 'meetings' && target.meetingId) { navigate(`/meeting/${String(target.meetingId).replace(/[^a-zA-Z0-9]/g, '')}`); return; }
    if (target.view === 'chat' && target.chatId) useChatStore.getState().setActiveChat(target.chatId);
    if (target.view) setCurrentView(target.view);
  };
  const openNotification = (item: WebNotification) => {
    markNotificationRead(item.id);
    setShowNotifications(false);
    openTarget(item.target || {});
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const idLabel = formatAccessCode(devices[0]?.access_key);
  const showSidebarLabels = !isCollapsed || mobileSidebarOpen;
  // The deployed bundle name IS the web app's version. Compare what the
  // server serves right now with what this tab is running; a mismatch means
  // a new build shipped and a reload picks it up.
  const runningBundle = () => (Array.from(document.querySelectorAll('script[src]'))
    .map((s) => (s as HTMLScriptElement).src)
    .find((src) => /assets\/index-[A-Za-z0-9_-]+\.js/.test(src)) || '')
    .match(/index-[A-Za-z0-9_-]+\.js/)?.[0] || '';
  const openUpdateModal = async () => {
    setHelpModal('update');
    setUpdateBusy(true);
    setUpdateAvailable(false);
    setUpdateMessage('Checking for updates...');
    try {
      const html = await fetch(`/?update-check=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
      const served = html.match(/index-[A-Za-z0-9_-]+\.js/)?.[0] || '';
      const running = runningBundle();
      if (served && running && served !== running) {
        setUpdateMessage('A newer version of Remote365 is available. Reload to update.');
        setUpdateAvailable(true);
      } else {
        setUpdateMessage('Your version of Remote365 is up-to-date.');
      }
    } catch {
      setUpdateMessage('Could not check for updates. Please try again.');
    } finally {
      setUpdateBusy(false);
    }
  };
  const helpMenuItems = [
    {
      label: 'Archived Devices',
      action: () => {
        navigate('/dashboard/devices?archived=1');
      },
    },
    { label: 'Check for new version', action: openUpdateModal },
    {
      label: 'Customer support identifier',
      action: async () => {
        await copyText(idLabel);
        setHelpModal('support');
      },
    },
    { label: 'Privacy policy', action: () => window.open('/privacy', '_blank') },
    { label: 'Copy right', action: () => window.open('/terms', '_blank') },
    {
      label: 'Open file logs',
      action: () => {
        // A browser has no log files on disk — hand over a diagnostics
        // snapshot instead (what support actually needs from a web session).
        const lines = [
          `Remote365 web diagnostics — ${new Date().toISOString()}`,
          `Bundle: ${runningBundle() || 'unknown'}`,
          `URL: ${window.location.href}`,
          `User: ${user?.email || 'signed out'} (${user?.id || '-'})`,
          `Role: ${role}  Plan: ${plan}`,
          `Organization: ${user?.organizationId || '-'}`,
          `Devices visible: ${devices?.length ?? 0}`,
          `Support ID: ${idLabel || '-'}`,
          `Browser: ${navigator.userAgent}`,
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'remote365-web-diagnostics.txt';
        a.click();
        URL.revokeObjectURL(url);
        notify('Diagnostics file downloaded.', 'success');
      },
    },
    { label: 'About Remote365', action: () => setHelpModal('about') },
  ];

  const SidebarContent = (
    <aside className={`flex h-[100dvh] flex-col bg-[#F3F4F6] p-3 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] transition-all duration-300 sm:p-4 ${isCollapsed ? 'w-[80px] max-md:w-[min(86vw,245px)]' : 'w-[245px] max-md:w-[min(86vw,245px)]'}`}>
      <div className={`flex h-8 w-full items-center ${showSidebarLabels ? 'justify-between gap-6' : 'justify-center'}`}>
        {showSidebarLabels ? (
          <button type="button" onClick={() => setCurrentView('dashboard')} className="flex h-8 items-center gap-2">
            <img src={logo} alt="Remote365" className="h-8 w-8 object-contain" />
            <span className="text-[14px] font-normal leading-5">Remote365</span>
          </button>
        ) : null}
        <button type="button" onClick={() => setIsCollapsed((value) => !value)} className="flex h-6 w-6 items-center justify-center">
          <Menu size={24} strokeWidth={1.4} />
        </button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col justify-between">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentView(item.id)}
                title={!showSidebarLabels ? item.label : undefined}
                className={`flex h-10 w-full items-center rounded transition-colors ${showSidebarLabels ? 'gap-2 px-4' : 'justify-center px-0'} ${isActive ? 'bg-white text-[#FF8A00]' : 'text-[#111315] hover:bg-white/70'}`}
              >
                <Icon size={16} className={isActive ? 'text-[#FF8A00]' : 'text-[#111315]'} />
                {showSidebarLabels && <span className="text-[14px] font-medium leading-5">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col gap-4">
          {canViewBilling(role) ? (
            !showSidebarLabels ? (
              <button type="button" onClick={() => setCurrentView('billing')} className="mx-auto flex h-10 w-10 items-center justify-center rounded bg-[#FFB347]/30">
                <img src={upgradeIcon} alt="" className="h-5 w-5" />
              </button>
            ) : (
              <div className="flex min-h-[190px] flex-col items-center justify-center gap-4 rounded-[12px] border border-[#1A1D21]/30 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded bg-[#FFB347]/30">
                  <img src={upgradeIcon} alt="" className="h-5 w-5" />
                </span>
                <div className="px-4 text-center">
                  <p className="m-0 text-[14px] font-medium">{plan === 'TRIAL' || plan === 'FREE' ? 'Free License' : `${plan} License`}</p>
                  <p className="m-0 mt-2 text-[12px] leading-[17px] text-[#111315]/60">To enjoy more features, upgrade your plan.</p>
                </div>
                <button type="button" onClick={() => setCurrentView('billing')} className="h-[37px] w-[158px] rounded bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] text-[12px] font-medium text-white">
                  {plan === 'TRIAL' || plan === 'FREE' ? 'Upgrade Plan' : 'Manage Plan'}
                </button>
              </div>
            )
          ) : null}

          <div className="flex flex-col gap-1">
            {utilityItems.map((item) => {
              const Icon = item.icon;
              const isHelp = item.id === 'support';
              const isActive = activeView === item.id || (isHelp && showHelpPopover);
              return (
                <button
                  key={item.id}
                  type="button"
                  ref={isHelp ? helpButtonRef : undefined}
                  onClick={() => {
                    if (isHelp) {
                      setShowHelpPopover((value) => !value);
                      return;
                    }
                    setShowHelpPopover(false);
                    setCurrentView(item.id);
                  }}
                  title={!showSidebarLabels ? item.label : undefined}
                  className={`flex h-10 w-full items-center rounded transition-colors ${showSidebarLabels ? 'gap-2 px-4' : 'justify-center px-0'} ${isActive ? 'bg-white text-[#FF8A00]' : 'text-[#111315] hover:bg-white/70'}`}
                >
                  <Icon size={16} />
                  {showSidebarLabels && <span className="text-[14px] font-medium leading-5">{item.label}</span>}
                </button>
              );
            })}
            {showHelpPopover && (
              <div
                ref={helpPopoverRef}
                className="fixed z-[220] flex h-[280px] w-[216px] flex-col items-start p-0 font-['Mona_Sans',system-ui,sans-serif] drop-shadow-[-4px_4px_12px_rgba(0,0,0,0.25)]"
                style={{
                  left: mobileSidebarOpen ? 16 : isCollapsed ? 80 : 245,
                  top: mobileSidebarOpen ? undefined : 'min(648px, calc(100vh - 348px))',
                  bottom: mobileSidebarOpen ? 88 : undefined,
                }}
              >
                {helpMenuItems.map((entry, index) => (
                  <button
                    key={entry.label}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
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
              type="button"
              onClick={() => {
                setShowHelpPopover(false);
                logout();
              }}
              className={`flex h-10 w-full items-center rounded text-[#111315] transition-colors hover:bg-white/70 ${showSidebarLabels ? 'gap-2 px-4' : 'justify-center px-0'}`}
            >
              <LogOut size={16} />
              {showSidebarLabels && <span className="text-[14px] font-medium leading-5">Logout</span>}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#00193F] text-[#1C1C1C]">
      {mobileSidebarOpen && (
        <button className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar" />
      )}
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">{SidebarContent}</div>
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform md:hidden ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {SidebarContent}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-[#F3F4F6] p-2 transition-all duration-300 sm:p-3 ${isCollapsed ? 'md:ml-[80px]' : 'md:ml-[245px]'}`}>
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl md:rounded-t-xl md:rounded-b-none bg-white">
          <header className="z-10 flex min-h-[60px] shrink-0 flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 font-['Mona_Sans',system-ui,sans-serif] sm:px-5">
            <div className="flex min-w-0 items-center gap-4">
              <button type="button" onClick={() => setMobileSidebarOpen(true)} className="flex h-8 w-8 items-center justify-center md:hidden">
                <Menu size={20} />
              </button>
              <div className="hidden items-center gap-4 text-[#1A1D21] md:flex">
                <button type="button" onClick={() => window.history.back()} className="transition-colors hover:text-[#FF8A00]">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => window.history.forward()} className="transition-colors hover:text-[#FF8A00]">
                  <ChevronRight size={18} />
                </button>
              </div>
              <h1 className="truncate text-[14px] font-medium leading-5 text-[#111315]">{title}</h1>
            </div>

            {/* Header search bar removed (Sep 7): every page has its own search field. */}
            <div className="order-3 hidden w-full min-w-[220px] max-w-[474px] lg:order-none lg:max-w-[36vw] xl:max-w-[474px]">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(26,29,33,0.3)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults?.idCandidate) {
                      runSearchAction(() => openSessionTab(String(searchResults.idCandidate || '')));
                    }
                    if (e.key === 'Escape') { setSearchQuery(''); setSearchFocused(false); }
                  }}
                  placeholder="Search device, contact, group or feature. Type an ID to connect."
                  className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white pl-11 pr-4 text-[14px] font-medium leading-5 outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
                />
                {searchFocused && searchResults && (searchResults.deviceMatches.length > 0 || searchResults.pages.length > 0 || searchResults.idCandidate) && (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] overflow-hidden rounded-lg border border-[rgba(26,29,33,0.12)] bg-white shadow-xl">
                    {searchResults.idCandidate && (
                      <button
                        type="button"
                        onMouseDown={() => runSearchAction(() => openSessionTab(String(searchResults.idCandidate || '')))}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-[#FF8A00] hover:bg-[#FFF6ED]"
                      >
                        <Monitor size={15} /> Connect to {formatAccessCode(searchResults.idCandidate)}
                      </button>
                    )}
                    {searchResults.deviceMatches.map((device: any) => (
                      <button
                        key={device.id || device.access_key}
                        type="button"
                        onMouseDown={() => runSearchAction(() => openSessionTab(String(device.access_key || '')))}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#FBFBFC]"
                      >
                        <Monitor size={15} className={device.is_online ? 'text-[#34C759]' : 'text-[rgba(17,19,21,0.3)]'} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#111315]">{device.device_name || device.name || 'Device'}</span>
                        <span className="shrink-0 text-[12px] text-[rgba(17,19,21,0.45)]">{formatAccessCode(device.access_key)}</span>
                      </button>
                    ))}
                    {searchResults.pages.map((page) => (
                      <button
                        key={page.view}
                        type="button"
                        onMouseDown={() => runSearchAction(() => setCurrentView(page.view))}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-[#111315] hover:bg-[#FBFBFC]"
                      >
                        <Search size={14} className="text-[rgba(17,19,21,0.35)]" /> {page.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Gear · bell · avatar menu — the desktop header, same order and sizes. */}
            <div className="flex items-center gap-5 text-[#1A1D21] sm:gap-7">
              <button
                type="button"
                onClick={() => setCurrentView('settings')}
                className="transition-colors hover:text-[#FF8A00]"
                title="Settings"
              >
                <Settings size={24} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setShowNotifications(true)}
                className={`relative transition-colors hover:text-[#FF8A00] ${showNotifications ? 'text-[#FF8A00]' : ''}`}
                title="Notifications"
              >
                <Bell size={24} strokeWidth={1.7} />
                {unreadCount > 0 ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" /> : null}
              </button>

              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => { setShowUserDropdown((open) => !open); setShowUserDropdownHelp(false); }}
                  className="relative flex h-10 items-center gap-3"
                  title={user?.name || 'Account'}
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#F9F5FF] text-base font-medium text-[#7F56D9] shadow-sm">
                    {user?.avatar ? <img src={user.avatar} alt={user.name || ''} className="h-full w-full object-cover" /> : initialsOf(user?.name || user?.email)}
                  </div>
                  <span className="hidden max-w-[107px] truncate text-[14px] font-normal leading-5 text-[#111315] xl:block">{user?.name || 'User'}</span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-[#1A1D21]" />
                  <div className="absolute bottom-0 left-7 h-3 w-3 rounded-full border-2 border-white bg-[#34C759]" />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 top-full z-[100] mt-3 w-64 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white font-sans shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-start gap-3 p-4">
                      <div className="relative">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#E91E63] text-sm font-bold text-white shadow-sm">
                          {user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initialsOf(user?.name || user?.email)}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-[#34C759]">
                          <Check size={7} className="text-white" />
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold leading-tight text-[#1C1C1C]">{user?.name || 'User'}</span>
                        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#D4A017]">{plan || 'TRIAL'}</span>
                        <div className="-ml-1.5 mt-1 flex items-center gap-1 rounded px-1.5 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                          <span className="text-xs text-[#757575]">Online</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-[rgba(0,0,0,0.06)]" />
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => { setCurrentView('settings'); setShowUserDropdown(false); }}
                        className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] transition-colors hover:bg-[rgba(28,28,28,0.04)]"
                      >
                        <span>Edit profile</span>
                      </button>
                    </div>

                    <div className="h-px bg-[rgba(0,0,0,0.06)]" />
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => { setCurrentView('billing'); setShowUserDropdown(false); }}
                        className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] transition-colors hover:bg-[rgba(28,28,28,0.04)]"
                      >
                        <span>Upgrade plan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { window.open('/dashboard', '_blank', 'noopener,noreferrer'); setShowUserDropdown(false); }}
                        className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] transition-colors hover:bg-[rgba(28,28,28,0.04)]"
                      >
                        <span>Customer portal</span>
                        <ExternalLink size={12} className="text-[#757575]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowUserDropdownHelp((open) => !open)}
                        className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] transition-colors hover:bg-[rgba(28,28,28,0.04)]"
                      >
                        <span>Help</span>
                        <ChevronRight size={12} className={`text-[#757575] transition-transform ${showUserDropdownHelp ? 'rotate-90' : ''}`} />
                      </button>
                      {showUserDropdownHelp && helpMenuItems.map((entry) => (
                        <button
                          key={entry.label}
                          type="button"
                          onClick={() => { entry.action(); setShowUserDropdown(false); setShowUserDropdownHelp(false); }}
                          className="flex w-full items-center px-4 py-2 pl-8 text-[13px] text-[#4A4A4A] transition-colors hover:bg-[rgba(28,28,28,0.04)]"
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>

                    <div className="h-px bg-[rgba(0,0,0,0.06)]" />
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => { setShowUserDropdown(false); logout(); }}
                        className="flex w-full items-center px-4 py-2 text-[13px] text-[#1C1C1C] transition-colors hover:bg-[rgba(28,28,28,0.04)]"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">{children}</div>
        </main>

        <footer className="z-[20] min-h-[55px] shrink-0 rounded-b-xl border-t border-[rgba(26,29,33,0.06)] bg-white" aria-hidden="true" />
      </div>

      <WebNotificationPanel
        isOpen={showNotifications}
        notifications={notifications}
        onClose={() => setShowNotifications(false)}
        onMarkAllRead={markAllRead}
        onClearAll={clearAllNotifications}
        onDismiss={(item) => dismissNotification(item.id)}
        onNotificationClick={openNotification}
        onOpenSettings={() => setCurrentView('settings')}
      />
      <WebAppToast onOpen={openTarget} />

      <HelpModalShell open={helpModal === 'update'} title="Remote365 update" onClose={() => setHelpModal(null)}>
        <div className="flex flex-col gap-[22px]">
          <p className="m-0 text-[14px] font-normal leading-5 text-[#111315]">{updateMessage}</p>
          <div className="flex justify-end gap-2">
            {updateAvailable && (
              <button type="button" onClick={() => window.location.reload()} className="flex h-10 items-center justify-center gap-2 rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-5 text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-black/5">
                Reload now
              </button>
            )}
            <button type="button" onClick={() => setHelpModal(null)} disabled={updateBusy} className="flex h-10 w-[124px] items-center justify-center gap-2 rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 py-2.5 text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70">
              {updateBusy ? <RefreshCw size={16} className="animate-spin" /> : 'OK'}
            </button>
          </div>
        </div>
      </HelpModalShell>

      <HelpModalShell open={helpModal === 'support'} title="Customer support identifier" onClose={() => setHelpModal(null)}>
        <div className="grid gap-[7px] rounded bg-[#F3F4F6] sm:grid-cols-[1fr_1px_1fr]">
          <div className="flex min-h-[70px] flex-col justify-center rounded bg-[#F3F4F6] px-4 py-2">
            <span className="text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">Support identifier</span>
            <button type="button" onClick={() => { copyText(idLabel); notify('Support identifier copied', 'success'); }} className="flex items-center gap-2 whitespace-nowrap text-left text-[24px] font-medium leading-[34px] text-[#111315]">
              {idLabel || '--'} <Copy size={16} />
            </button>
          </div>
          <div className="hidden h-11 w-px self-center bg-[rgba(26,29,33,0.3)] sm:block" />
          <div className="flex min-h-[70px] flex-col justify-center rounded bg-[#F3F4F6] px-4 py-2">
            <span className="text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">Remote365 versions</span>
            <span className="text-[24px] font-medium leading-[34px] text-[#111315]">{WEB_VERSION}</span>
          </div>
        </div>
      </HelpModalShell>

      <HelpModalShell open={helpModal === 'about'} onClose={() => setHelpModal(null)}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Remote365" className="h-[50px] w-[50px] object-contain" />
            <h2 className="m-0 text-[24px] font-bold leading-[34px] text-[#111315]">Remote365</h2>
          </div>
          <button type="button" onClick={() => setHelpModal(null)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>
        <div className="mt-[22px] flex flex-col gap-2">
          <p className="m-0 text-[14px] font-normal leading-5 text-[#111315]">Version: {WEB_VERSION}</p>
          <p className="m-0 text-[14px] font-normal leading-5 text-[#111315]">Date: {new Date().toLocaleDateString()}</p>
          <p className="m-0 text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.5)]">Copyright 2026 © TechVision365 Inc. All rights reserved.</p>
        </div>
      </HelpModalShell>

      <HelpModalShell open={helpModal === 'copyright'} title="Copyright" onClose={() => setHelpModal(null)} wide>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
          <p className="m-0 whitespace-pre-line break-words text-[14px] font-normal leading-5 text-black">{copyrightText}</p>
        </div>
      </HelpModalShell>

      <HelpModalShell open={helpModal === 'privacy'} title="Privacy Policy of Remote365" onClose={() => setHelpModal(null)} wide>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden pr-2">
          {privacySections.map((section, index) => (
            <section key={section.title} className="flex flex-col gap-2 text-black">
              {index > 0 ? <div className="mb-4 h-px w-full bg-[rgba(26,29,33,0.3)]" /> : null}
              <h3 className="m-0 text-[18px] font-medium leading-[25px]">{section.title}</h3>
              <p className="m-0 whitespace-pre-line break-words text-[14px] font-normal leading-5">{section.body}</p>
            </section>
          ))}
        </div>
      </HelpModalShell>
    </div>
  );
};
