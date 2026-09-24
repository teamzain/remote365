import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastItem, type ToastVariant } from '../../lib/toastStore';

const VARIANT: Record<ToastVariant, { iconBg: string; iconColor: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  // material-symbols:error-outline-rounded look from the spec (amber tint + orange glyph)
  error: { iconBg: 'rgba(255,179,71,0.3)', iconColor: '#FF8A00', Icon: AlertCircle },
  success: { iconBg: 'rgba(52,199,89,0.18)', iconColor: '#34C759', Icon: CheckCircle2 },
  info: { iconBg: 'rgba(0,136,255,0.12)', iconColor: '#0088FF', Icon: Info },
};

const ToastCard: React.FC<{ item: ToastItem }> = ({ item }) => {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (!item.duration) return;
    const timer = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, dismiss]);

  const { iconBg, iconColor, Icon } = VARIANT[item.variant];

  return (
    <div
      role="status"
      style={{ boxShadow: '-6px 6px 18px rgba(0,0,0,0.28)' }}
      className="pointer-events-auto flex w-[460px] max-w-[calc(100vw-32px)] items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in slide-in-from-right-4 duration-200"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </span>
        <p className="m-0 truncate text-[14px] font-medium leading-[20px] text-[#1A1D21]">{item.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center text-[#1A1D21] transition-opacity hover:opacity-70"
      >
        <X size={18} />
      </button>
    </div>
  );
};

/**
 * Renders the active toast stack. Mount once near the app root.
 * Fire toasts from anywhere via `toast.success(...)` / `toast.error(...)`.
 */
export const ToastViewport: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-6 top-[73px] z-[2000] flex flex-col items-end gap-2">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
};

export default ToastViewport;
