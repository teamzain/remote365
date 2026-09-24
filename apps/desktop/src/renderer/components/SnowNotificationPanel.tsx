import React, { useMemo, useState } from 'react';
import { X, MoreHorizontal, ChevronDown, Video, Check, Settings, Trash2 } from 'lucide-react';
import { t } from '../lib/translations';
import { useAuthStore } from '../store/authStore';
import notificationImg from '../assets/notification.png';

interface SnowNotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: any[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onNotificationClick: (notification: any) => void;
  onDismiss?: (notification: any) => void;
  /** Clear entries older than N hours (wired from App; kept optional). */
  onClearOlder?: (hours: number) => void;
}

// Icon tile colours per notification kind (App.tsx addNotification's iconType).
const KIND_STYLES: Record<string, { tile: string; icon: string; label: string }> = {
  host: { tile: 'bg-[#EEF0FF]', icon: 'text-[#4F5BD5]', label: 'Device' },
  security: { tile: 'bg-[#E8F3FF]', icon: 'text-[#1F7AE0]', label: 'Security' },
  session: { tile: 'bg-[#FFF1E0]', icon: 'text-[#FF8A00]', label: 'Session' },
  system: { tile: 'bg-[#F1F2F4]', icon: 'text-[#111315]', label: 'System' },
  message: { tile: 'bg-[#E8F3FF]', icon: 'text-[#1F7AE0]', label: 'Message' },
  accepted: { tile: 'bg-[#E7F8EE]', icon: 'text-[#1E9E5A]', label: 'Update' },
  removed: { tile: 'bg-[#FFF1E0]', icon: 'text-[#D9741A]', label: 'Update' },
  blocked: { tile: 'bg-[#FDECEC]', icon: 'text-[#E5484D]', label: 'Blocked' },
};

const relativeTime = (createdAt?: number, fallback?: string) => {
  if (!createdAt) return fallback || 'Just Now';
  const diff = Date.now() - createdAt;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just Now';
  if (minutes < 60) return `${minutes}m Ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h Ago`;
  return new Date(createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const dayBucket = (createdAt?: number) => {
  if (!createdAt) return 'Older';
  const now = new Date();
  const then = new Date(createdAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return then.getTime() >= startOfToday ? 'Today' : 'Older';
};

export const SnowNotificationPanel: React.FC<SnowNotificationPanelProps> = ({ isOpen, onClose, notifications, onMarkAllRead, onClearAll, onNotificationClick, onDismiss }) => {
  // Everything by default; "Unread" is an opt-in filter.
  const [filter, setFilter] = useState<'unread' | 'all'>('all');
  const [showMenu, setShowMenu] = useState(false);
  const { user } = useAuthStore();
  const lang = user?.language;
  const visibleNotifications = filter === 'unread'
    ? notifications.filter((notification) => !notification.read)
    : notifications;
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  // Group by day so the list reads as a timeline rather than a flat stack.
  const groups = useMemo(() => {
    const order = ['Today', 'Older'];
    const byDay = new Map<string, any[]>();
    for (const notification of visibleNotifications) {
      const bucket = dayBucket(notification.createdAt);
      if (!byDay.has(bucket)) byDay.set(bucket, []);
      byDay.get(bucket)!.push(notification);
    }
    return order.filter((key) => byDay.has(key)).map((key) => ({ key, items: byDay.get(key)! }));
  }, [visibleNotifications]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 top-8 z-[100] bg-black/10 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <aside
        className={`fixed bottom-0 right-0 top-8 z-[101] flex w-[400px] max-w-[90vw] flex-col bg-white text-[#111315] shadow-[-4px_0_12px_rgba(0,0,0,0.12)] transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ fontFamily: "'Mona Sans', system-ui, sans-serif" }}
        aria-hidden={!isOpen}
      >
        {/* Header: "Alerts (unread)" with the filter, menu and close on the right */}
        <div className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-black/[0.08] bg-white px-5">
          <h3 className="m-0 text-[18px] font-semibold leading-6 text-[#111315]">
            Alerts{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter(filter === 'unread' ? 'all' : 'unread')}
              className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-[#1A1D21]/70 transition-colors hover:bg-[#F3F4F6] hover:text-[#111315]"
              title="Show all or unread only"
            >
              <span className="capitalize">{t(filter, lang)}</span>
              <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform duration-200 ${filter === 'all' ? '' : 'rotate-180'}`} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[#111315] transition-colors hover:bg-[#F3F4F6] ${showMenu ? 'bg-[#F3F4F6]' : ''}`}
                title="More"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-xl">
                    <button
                      onClick={() => { onMarkAllRead(); setShowMenu(false); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#111315] transition-colors hover:bg-[#F3F4F6]"
                    >
                      <Check size={16} />
                      {t('mark_all_read', lang)}
                    </button>
                    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#111315] transition-colors hover:bg-[#F3F4F6]">
                      <Settings size={16} />
                      {t('notification_settings', lang)}
                    </button>
                    <div className="mx-2 my-1 h-px bg-black/10" />
                    <button
                      onClick={() => { onClearAll(); setShowMenu(false); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      {t('clear_all', lang)}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#111315] transition-colors hover:bg-[#F3F4F6]"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content: flat list, TODAY / OLDER sections, hairline separators */}
        <div className={`flex-1 overflow-y-auto bg-white ${visibleNotifications.length === 0 ? 'flex flex-col items-center justify-center px-3 text-center' : ''}`}>
          {visibleNotifications.length === 0 ? (
            <div className="flex w-full max-w-[377px] flex-col items-center justify-center gap-[45px]">
              <img src={notificationImg} alt="" className="h-[214px] w-[251px] object-contain" />
              <p className="m-0 w-full text-center text-sm font-normal leading-5 text-black">
                {filter === 'unread' ? "You're all caught up." : t('no_notifications_desc', lang)}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key}>
                <h4 className="m-0 px-5 pb-1 pt-4 text-[12px] font-semibold text-[#1A1D21]/50">{group.key}</h4>
                <ul className="m-0 list-none p-0">
                  {group.items.map((notification) => {
                    const Icon = notification.icon || Video;
                    const style = KIND_STYLES[notification.kind] || KIND_STYLES.system;
                    // Entries written before titles existed keep their message visible.
                    const title = notification.title || notification.action || style.label;
                    const body = notification.title ? notification.action : '';
                    const unread = !notification.read;
                    const openable = Boolean(notification.target);
                    return (
                      <li
                        key={notification.id || `${notification.action}-${notification.time}`}
                        className="group relative flex items-start gap-3 border-b border-black/[0.06] px-5 py-3.5 transition-colors hover:bg-[#FAFAFB]"
                      >
                        {/* round dark tile like the reference; unread adds an orange dot */}
                        <span className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${unread ? 'bg-[#111315]' : 'bg-[#111315]/75'} text-white`}>
                          <Icon size={18} strokeWidth={2} />
                          {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FF8A00]" aria-hidden="true" />}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => onNotificationClick(notification)}
                              className={`min-w-0 truncate text-left text-[14px] leading-5 text-[#111315] ${unread ? 'font-semibold' : 'font-medium'}`}
                            >
                              {title}
                            </button>
                            <span className="shrink-0 pt-0.5 text-[11px] font-normal leading-4 text-[#1A1D21]/45">{relativeTime(notification.createdAt, notification.time)}</span>
                          </div>
                          {body && (
                            <p
                              className="m-0 overflow-hidden text-[12px] font-normal leading-[17px] text-[#1A1D21]/60"
                              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                            >
                              {body}
                            </p>
                          )}
                          {openable && (
                            <button
                              type="button"
                              onClick={() => onNotificationClick(notification)}
                              className="mt-0.5 w-fit text-[12px] font-semibold leading-4 text-[#FF8A00] hover:underline"
                            >
                              View
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onDismiss?.(notification); }}
                          className="absolute right-3 top-9 flex h-6 w-6 items-center justify-center rounded-full text-[#1A1D21]/40 opacity-0 transition-all hover:bg-[#F3F4F6] hover:text-[#111315] focus:opacity-100 group-hover:opacity-100"
                          title="Dismiss"
                          aria-label="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
};
