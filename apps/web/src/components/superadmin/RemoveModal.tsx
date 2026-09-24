import React, { useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * Destructive-confirm modal (Figma "Remove device modal"): red featured icon,
 * centered title + supporting text, Cancel + gradient confirm buttons.
 * Used in place of window.confirm for remove/delete actions.
 */
const RemoveModal: React.FC<{
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, confirmLabel = 'Remove', cancelLabel = 'Cancel', icon: Icon = AlertCircle, loading, onConfirm, onCancel }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [loading, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/30 p-4"
      style={{ fontFamily: "'Mona Sans', system-ui, sans-serif" }}
      onClick={() => { if (!loading) onCancel(); }}
    >
      <div className="flex w-[468px] max-w-[92vw] flex-col items-center gap-[22px] rounded-xl bg-white px-6 py-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex w-[420px] max-w-full flex-col items-center gap-[22px] py-3">
          {/* Featured icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE4E2] ring-8 ring-[#FEF3F2]">
            <Icon size={24} className="text-[#B42318]" />
          </div>

          {/* Text */}
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-center text-2xl font-bold leading-[34px] text-[#111315]">{title}</h2>
            <p className="text-center text-sm leading-5 text-[#111315]">{message}</p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#F3F4F6] bg-white text-sm font-medium text-[rgba(26,29,33,0.5)] hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex h-10 w-[124px] items-center justify-center gap-2 rounded-[32px] text-sm font-medium text-[#111315] disabled:opacity-60"
              style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveModal;
