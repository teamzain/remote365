import React, { useMemo, useState } from 'react';
import { X, MoreHorizontal, ChevronDown, Check, Settings, Trash2 } from 'lucide-react';
import notificationImgAsset from '../../assets/notification.png';
import type { WebNotification } from '../../store/notificationStore';

const notificationImg = notificationImgAsset.src;

interface WebNotificationPanelProps {
  isOpen: boolean;
  notifications: WebNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onNotificationClick: (notification: WebNotification) => void;
  onDismiss: (notification: WebNotification) => void;
  /** "Notification settings" menu entry (the desktop lists it too). */
  onOpenSettings?: () => void;
}

const relativeTime = (createdAt: number) => {
  const minutes = Math.round((Date.now() - createdAt) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const dayBucket = (createdAt: number) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return createdAt >= startOfToday ? 'Today' : 'Older';
};

/**
 * Web twin of the desktop "Alerts" panel: flat list with hairline separators,
 * Today / Older sections, round dark icon tile (orange dot while unread),
 * title + description + View link, time on the right. Opens on All.
 */
export const WebNotificationPanel: React.FC<WebNotificationPanelProps> = ({ isOpen, notifications, onClose, onMarkAllRead, onClearAll, onNotificationClick, onDismiss, onOpenSettings }) => {
  const [filter, setFilter] = useState<'unread' | 'all'>('all');
  const [showMenu, setShowMenu] = useState(false);
  const visible = filter === 'unread' ? notifications.filter((item) => !item.read) : notifications;
  const unreadCount = notifications.filter((item) => !item.read).length;

  const groups = useMemo(() => {
    const byDay = new Map<string, WebNotification[]>();
    for (const item of visible) {
      const bucket = dayBucket(item.createdAt);
      if (!byDay.has(bucket)) byDay.set(bucket, []);
      byDay.get(bucket)!.push(item);
    }
    return ['Today', 'Older'].filter((key) => byDay.has(key)).map((key) => ({ key, items: byDay.get(key)! }));
  }, [visible]);

  return (
    <>
      {isOpen && <button type="button" className="fixed inset-0 z-[100] bg-black/10" onClick={onClose} aria-label="Close notifications" />}
      <aside
        className={`fixed bottom-0 right-0 top-0 z-[101] flex w-full flex-col sm:w-[400px] sm:max-w-[90vw] bg-white font-['Mona_Sans',system-ui,sans-serif] text-[#111315] shadow-[-4px_0_12px_rgba(0,0,0,0.12)] transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-black/[0.08] bg-white px-5">
          <h3 className="m-0 text-[18px] font-semibold leading-6 text-[#111315]">
            Alerts{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilter(filter === 'unread' ? 'all' : 'unread')}
              className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-[#1A1D21]/70 transition-colors hover:bg-[#F3F4F6] hover:text-[#111315]"
              title="Show all or unread only"
            >
              <span className="capitalize">{filter}</span>
              <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform duration-200 ${filter === 'all' ? '' : 'rotate-180'}`} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[#111315] transition-colors hover:bg-[#F3F4F6] ${showMenu ? 'bg-[#F3F4F6]' : ''}`}
                title="More"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <>
                  <button type="button" className="fixed inset-0 z-30 cursor-default" onClick={() => setShowMenu(false)} aria-label="Close menu" />
                  <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => { onMarkAllRead(); setShowMenu(false); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#111315] transition-colors hover:bg-[#F3F4F6]"
                    >
                      <Check size={16} /> Mark all read
                    </button>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => { onOpenSettings(); setShowMenu(false); onClose(); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#111315] transition-colors hover:bg-[#F3F4F6]"
                      >
                        <Settings size={16} /> Notification settings
                      </button>
                    )}
                    <div className="mx-2 my-1 h-px bg-black/10" />
                    <button
                      type="button"
                      onClick={() => { onClearAll(); setShowMenu(false); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 size={16} /> Clear all
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#111315] transition-colors hover:bg-[#F3F4F6]"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto bg-white ${visible.length === 0 ? 'flex flex-col items-center justify-center px-3 text-center' : ''}`}>
          {visible.length === 0 ? (
            <div className="flex w-full max-w-[377px] flex-col items-center justify-center gap-[45px]">
              <img src={notificationImg} alt="" className="h-[214px] w-[251px] object-contain" />
              <p className="m-0 w-full text-center text-sm leading-5 text-black">
                {filter === 'unread' ? "You're all caught up." : "Nothing here yet. We'll let you know when something needs your attention."}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key}>
                <h4 className="m-0 px-5 pb-1 pt-4 text-[12px] font-semibold text-[#1A1D21]/50">{group.key}</h4>
                <ul className="m-0 list-none p-0">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const unread = !item.read;
                    return (
                      <li key={item.id} className="group relative flex items-start gap-3 border-b border-black/[0.06] px-5 py-3.5 transition-colors hover:bg-[#FAFAFB]">
                        <span className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${unread ? 'bg-[#111315]' : 'bg-[#111315]/75'} text-white`}>
                          <Icon size={18} strokeWidth={2} />
                          {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FF8A00]" aria-hidden="true" />}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => onNotificationClick(item)}
                              className={`min-w-0 truncate text-left text-[14px] leading-5 text-[#111315] ${unread ? 'font-semibold' : 'font-medium'}`}
                            >
                              {item.title}
                            </button>
                            <span className="shrink-0 pt-0.5 text-[11px] leading-4 text-[#1A1D21]/45">{relativeTime(item.createdAt)}</span>
                          </div>
                          {item.action && (
                            <p className="m-0 overflow-hidden text-[12px] leading-[17px] text-[#1A1D21]/60" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {item.action}
                            </p>
                          )}
                          {item.target && (
                            <button type="button" onClick={() => onNotificationClick(item)} className="mt-0.5 w-fit text-[12px] font-semibold leading-4 text-[#FF8A00] hover:underline">
                              View
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onDismiss(item); }}
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

export default WebNotificationPanel;
