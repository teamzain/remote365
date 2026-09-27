import React, { useEffect } from 'react';
import { MessageCircle, Monitor, UserCheck, X } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';

interface WebAppToastProps {
  /** Opens the toast's destination (chat, session, meeting); the shell decides how. */
  onOpen: (target: Record<string, any>) => void;
}

/**
 * Twin of the desktop's sliding toast (App.tsx globalAppToast): a white card
 * at the top right with a tinted icon tile, title + one-line body, click to
 * open, X to dismiss, gone by itself after 4.5 s.
 */
export const WebAppToast: React.FC<WebAppToastProps> = ({ onOpen }) => {
  const toast = useToastStore((state) => state.toast);
  const clearToast = useToastStore((state) => state.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(clearToast, 4500);
    return () => clearTimeout(timeout);
  }, [toast, clearToast]);

  if (!toast) return null;
  const tinted = toast.iconType === 'accepted'
    ? { background: 'rgba(52,199,89,0.18)', color: '#34C759' }
    : toast.iconType === 'session' || toast.iconType === 'message'
      ? { background: 'rgba(0,136,255,0.12)', color: '#0088FF' }
      : { background: 'rgba(255,179,71,0.3)', color: '#FF8A00' };

  return (
    <div
      role="status"
      style={{ boxShadow: '-6px 6px 18px rgba(0,0,0,0.28)' }}
      className="fixed right-6 top-[73px] z-[250] flex w-[460px] max-w-[calc(100vw-32px)] cursor-pointer items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in slide-in-from-right-4 duration-200"
      onClick={() => {
        if (toast.target) onOpen(toast.target);
        clearToast();
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={tinted}>
          {toast.iconType === 'accepted' ? <UserCheck size={18} /> : toast.iconType === 'session' ? <Monitor size={18} /> : <MessageCircle size={18} />}
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[14px] font-medium leading-[20px] text-[#1A1D21]">{toast.title}</p>
          <p className="m-0 truncate text-[12px] leading-[17px] text-[#1A1D21]/60">{toast.body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); clearToast(); }}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center text-[#1A1D21] transition-opacity hover:opacity-70"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default WebAppToast;
