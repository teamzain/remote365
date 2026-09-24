import React from 'react';
import { AlertCircle, Trash2, Check, Loader2 } from 'lucide-react';

/**
 * Centered confirmation modal (Mona Sans) with a featured halo icon, used for
 * Super Admin actions like suspend / delete / activate on an organization.
 * The confirm button is always the brand orange gradient; only the halo icon
 * changes per variant.
 */
type Variant = 'suspend' | 'delete' | 'activate';

const VARIANTS: Record<Variant, { Icon: React.ComponentType<{ size?: number; className?: string }>; iconClass: string; halo: string }> = {
  suspend: { Icon: AlertCircle, iconClass: 'text-[#B42318]', halo: 'bg-[#FEE4E2] ring-[#FEF3F2]' },
  delete: { Icon: Trash2, iconClass: 'text-[#FF383C]', halo: 'bg-[#FEE4E2] ring-[#FEF3F2]' },
  activate: { Icon: Check, iconClass: 'text-[#34C759]', halo: 'bg-[rgba(52,199,89,0.2)] ring-[rgba(52,199,89,0.1)]' },
};

const ConfirmModal: React.FC<{
  variant?: Variant;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}> = ({ variant = 'suspend', title, message, confirmLabel, onConfirm, onCancel, loading }) => {
  const v = VARIANTS[variant];
  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!loading) onCancel(); }}
    >
      <div
        className="flex w-full max-w-[468px] flex-col items-center gap-[22px] rounded-xl bg-white px-6 pb-6 pt-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-[22px]">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ring-8 ${v.halo}`}>
            <v.Icon size={22} className={v.iconClass} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-center text-2xl font-bold leading-[34px] text-[#111315]">{title}</h2>
            <p className="text-center text-sm leading-5 text-[#111315]">{message}</p>
          </div>
        </div>
        <div className="flex w-full max-w-[256px] items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-full border border-[#F3F4F6] py-2.5 text-sm font-medium text-[rgba(26,29,33,0.5)] hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium text-[#111315] disabled:opacity-70"
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
