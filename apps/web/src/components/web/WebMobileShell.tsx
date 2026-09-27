import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CreditCard,
  HelpCircle,
  Headphones,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  Settings,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useDeviceMonitor } from '../../lib/useDeviceMonitor';
import WebMobileHelp from './WebMobileHelp';
import { useNotificationStore, type WebNotification } from '../../store/notificationStore';
import { useShellChatEvents } from '../../lib/useShellChatEvents';
import { WebNotificationPanel } from './WebNotificationPanel';
import { WebAppToast } from './WebAppToast';

const initials = (name?: string | null) =>
  String(name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

interface WebMobileShellProps {
  view: string;
  title?: string;
  children: React.ReactNode;
}

/**
 * Phone shell for the web dashboard: full-screen content + bottom tab bar
 * (Support · Devices · Meeting · Chat · More) and a slide-up "More" sheet.
 * Replaces WebPremiumShell on phone viewports only — the desktop shell and
 * pages are untouched.
 */
export const WebMobileShell: React.FC<WebMobileShellProps> = ({ view, children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const chatUnread = useChatStore((state) =>
    Object.values(state.unreadCounts).reduce((sum, count) => sum + (count || 0), 0)
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Same notification centre as the desktop shell (chat + session events
  // feed it; entries open the page they are about).
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadAlerts = notifications.filter((item) => !item.read).length;
  useShellChatEvents(user?.id);
  // Destination of a notification entry or the sliding toast.
  const openTarget = (target: Record<string, any>) => {
    if (target.view === 'connect' && target.sessionCode) { navigate(`/join/${String(target.sessionCode).replace(/\D/g, '')}`); return; }
    if (target.view === 'meetings' && target.meetingId) { navigate(`/meeting/${String(target.meetingId).replace(/[^a-zA-Z0-9]/g, '')}`); return; }
    if (target.view === 'chat' && target.chatId) useChatStore.getState().setActiveChat(target.chatId);
    const paths: Record<string, string> = {
      connect: '/dashboard/sessions', devices: '/dashboard/devices', meetings: '/dashboard/meetings', chat: '/dashboard/chat',
      settings: '/dashboard/settings', billing: '/dashboard/billing', members: '/dashboard/members', admin_settings: '/dashboard/admin-settings', support: '/dashboard/support',
    };
    if (target.view && paths[target.view]) navigate(paths[target.view]);
  };
  const openNotification = (item: WebNotification) => {
    useNotificationStore.getState().markRead(item.id);
    setAlertsOpen(false);
    openTarget(item.target || {});
  };

  // Phones had NO device sync at all — the list was whatever it was on mount.
  // Same live presence socket the desktop shell uses.
  useDeviceMonitor();

  const tabs = [
    // '/dashboard' itself redirects to Devices on web — the Remote Support
    // page is the 'connect' view at /dashboard/sessions.
    { id: 'connect', label: 'Support', icon: Headphones, path: '/dashboard/sessions' },
    { id: 'devices', label: 'Devices', icon: Monitor, path: '/dashboard/devices' },
    { id: 'meetings', label: 'Meeting', icon: Video, path: '/dashboard/meetings' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, path: '/dashboard/chat' },
  ];
  const activeTab = tabs.some((tab) => tab.id === view) ? view : 'more';

  const moreItems: { label: string; icon: typeof Settings; path?: string; action?: () => void }[] = [
    { label: 'Alerts', icon: Bell, action: () => { setMoreOpen(false); setAlertsOpen(true); } },
    { label: 'Admin settings', icon: ShieldCheck, path: '/dashboard/admin-settings' },
    { label: 'Members', icon: Users, path: '/dashboard/members' },
    { label: 'Plan and billing', icon: CreditCard, path: '/dashboard/billing' },
    { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    // Same Help menu as the desktop sidebar popover, as a bottom sheet.
    { label: 'Help', icon: HelpCircle, action: () => { setMoreOpen(false); setHelpOpen(true); } },
  ];

  const go = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      <nav
        className="flex flex-none items-stretch border-t border-[rgba(26,29,33,0.1)] bg-white px-1"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.path)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 ${active ? 'text-[#FF8A00]' : 'text-[#111315]/45'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.1 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {tab.id === 'chat' && chatUnread > 0 && (
                <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF383C] px-1 text-[9px] font-bold leading-none text-white">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${activeTab === 'more' ? 'text-[#FF8A00]' : 'text-[#111315]/45'}`}
        >
          <Menu size={20} strokeWidth={activeTab === 'more' ? 2.1 : 1.8} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="More">
          <button type="button" aria-label="Close menu" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white pb-2 shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#FFF1E0] text-[13px] font-semibold text-[#9A5400]">
                {initials(user?.name || user?.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[14px] font-semibold text-[#111315]">{user?.name || 'Account'}</p>
                <p className="m-0 truncate text-[12px] text-[#111315]/50">{user?.email || ''}</p>
              </div>
            </div>
            <div className="border-t border-[rgba(26,29,33,0.08)]">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => (item.path ? go(item.path) : item.action?.())}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]"
                  >
                    <Icon size={18} className="text-[#111315]/55" />
                    <span className="flex-1 text-[14px] font-medium text-[#111315]">{item.label}</span>
                    {item.label === 'Alerts' && unreadAlerts > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF383C] px-1.5 text-[10px] font-bold text-white">{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={async () => {
                  setMoreOpen(false);
                  await logout();
                  navigate('/');
                }}
                className="flex w-full items-center gap-3 border-t border-[rgba(26,29,33,0.08)] px-5 py-3 text-left active:bg-[#FFF5F5]"
              >
                <LogOut size={18} className="text-[#D64545]" />
                <span className="text-[14px] font-medium text-[#D64545]">Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <WebMobileHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <WebNotificationPanel
        isOpen={alertsOpen}
        notifications={notifications}
        onClose={() => setAlertsOpen(false)}
        onMarkAllRead={() => useNotificationStore.getState().markAllRead()}
        onClearAll={() => useNotificationStore.getState().clearAll()}
        onDismiss={(item) => useNotificationStore.getState().dismiss(item.id)}
        onNotificationClick={openNotification}
        onOpenSettings={() => navigate('/dashboard/settings')}
      />
      <WebAppToast onOpen={openTarget} />
    </div>
  );
};

export default WebMobileShell;
