import React, { useEffect, useState } from 'react';
import { ChevronDown, MoreHorizontal, X, CheckCircle2, Trash2, History, BellOff, Video } from 'lucide-react';
import notificationImg from '../../assets/notification.png';

/**
 * Super Admin -> Notifications.
 * Right-hand slide-in panel converted from the provided Figma. There is no
 * notification feed wired to the backend yet, so the list below is seeded with
 * sample items purely so the card design + actions render; replace `SEED` with
 * a real fetch when a feed exists. The Unread/All filter, per-card dismiss and
 * the overflow-menu actions all operate on local state.
 */

const FILTERS = ['Unread', 'All'] as const;
type Filter = (typeof FILTERS)[number];

type NotificationItem = { id: string; body: string; read: boolean; createdAt: number };

const MIN = 60_000;
const seed = (): NotificationItem[] => {
  const now = Date.now();
  return [
    { id: '1', body: 'Session details are loaded. Please connect when ready', read: false, createdAt: now - MIN * 0.2 },
    { id: '2', body: 'Session details are loaded. Please connect when ready', read: false, createdAt: now - MIN * 35 },
    { id: '3', body: 'A new device was registered to your platform', read: true, createdAt: now - MIN * 60 * 3 },
    { id: '4', body: 'Weekly platform report is ready to review', read: true, createdAt: now - MIN * 60 * 26 },
  ];
};

// Relative timestamp matching the Figma ("Just Now", "12:35 AM, Today", ...).
function relTime(ts: number): string {
  const d = new Date(ts);
  const m = Math.floor((Date.now() - ts) / MIN);
  if (m < 1) return 'Just Now';
  if (m < 60) return `${m}m ago`;
  const today = new Date().toDateString();
  if (d.toDateString() === today) return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, Today`;
  if (Math.floor((Date.now() - ts) / (MIN * 60)) < 48) return 'Yesterday';
  return d.toLocaleDateString();
}

const NotificationPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [filter, setFilter] = useState<Filter>('Unread');
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [all, setAll] = useState<NotificationItem[]>(seed);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) { setFilterOpen(false); setMenuOpen(false); }
  }, [open]);

  const items = filter === 'Unread' ? all.filter((n) => !n.read) : all;

  const dismiss = (id: string) => setAll((xs) => xs.filter((n) => n.id !== id));
  const markAllRead = () => { setAll((xs) => xs.map((n) => ({ ...n, read: true }))); setMenuOpen(false); };
  const clearAll = () => { setAll([]); setMenuOpen(false); };
  const clearOlder24h = () => { const cut = Date.now() - MIN * 60 * 24; setAll((xs) => xs.filter((n) => n.createdAt >= cut)); setMenuOpen(false); };
  const toggleMute = () => { setMuted((v) => !v); setMenuOpen(false); };

  const menuItems = [
    { icon: CheckCircle2, label: 'Mark All As Read', onClick: markAllRead },
    { icon: Trash2, label: 'Clear All', onClick: clearAll },
    { icon: History, label: 'Clear Older Than 24H', onClick: clearOlder24h },
    { icon: BellOff, label: muted ? 'Unmute Notifications' : 'Mute Notifications', onClick: toggleMute },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[200] bg-black/20 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-[201] flex h-screen w-[400px] max-w-[90vw] flex-col bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.12)] transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ fontFamily: "'Mona Sans', system-ui, sans-serif" }}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-3 pt-4">
          <div className="relative">
            <button
              onClick={() => { setFilterOpen((v) => !v); setMenuOpen(false); }}
              className="flex items-center gap-2 rounded-md bg-[rgba(255,179,71,0.18)] px-3 py-1 text-base font-semibold text-black"
            >
              {filter}
              <ChevronDown size={16} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            {filterOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-32 overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setFilterOpen(false); }}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-[#F3F4F6] ${f === filter ? 'text-[#FF8A00]' : 'text-[#111315]'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => { setMenuOpen((v) => !v); setFilterOpen(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#111315] transition-colors hover:bg-[#F3F4F6] hover:text-[#FF8A00]"
                title="More"
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-[230px] overflow-hidden rounded-xl border border-black/10 bg-white py-1.5 shadow-xl">
                  {menuItems.map(({ icon: Icon, label, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#111315] hover:bg-[#F3F4F6]"
                    >
                      <Icon size={16} className="shrink-0 text-[#111315]" />
                      {label}
                    </button>
                  ))}
                  <div className="mt-1 border-t border-black/10 px-4 pb-1 pt-2">
                    <p className="text-[11px] leading-4 text-black/40">Notifications older than 30 days are automatically deleted</p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#111315] transition-colors hover:bg-[#F3F4F6] hover:text-[#FF8A00]"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-black/30" />

        {/* Body */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
            <img src={notificationImg} alt="" className="w-[251px] max-w-full" />
            <p className="text-center text-sm text-black">
              {filter === 'Unread' ? 'You have no unread notification!' : 'You have no notifications!'}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
            {items.map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-2.5 rounded-xl border border-black/30 bg-white px-4 py-2.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
                    <Video size={20} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm leading-5 text-[#111315]">{n.body}</p>
                    <span className="text-xs font-medium text-[rgba(26,29,33,0.7)]">{relTime(n.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => dismiss(n.id)}
                  className="shrink-0 text-[#111315] transition-colors hover:text-[#FF8A00]"
                  title="Dismiss"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};

export default NotificationPanel;
