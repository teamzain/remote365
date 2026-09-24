import React, { useEffect } from 'react';

export interface ModalProps {
  /** Whether the modal is rendered. */
  open: boolean;
  /**
   * Overlay variant classes (z-index, backdrop tint, blur, padding, animation,
   * font). The invariant `fixed inset-0 flex items-center justify-center` is
   * always applied, so only pass the parts that vary per modal.
   */
  className?: string;
  /**
   * When provided, clicking the backdrop or pressing Escape closes the modal.
   * Omit for modals that should only close via their own buttons (preserves the
   * original behaviour of the inline dialogs).
   */
  onClose?: () => void;
  children: React.ReactNode;
}

const BASE = 'fixed inset-0 flex items-center justify-center';
const DEFAULT_VARIANT = 'z-[200] p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200';

/**
 * Shared modal overlay. Replaces the repeated
 * `{cond && (<div className="fixed inset-0 …">…</div>)}` boilerplate that was
 * scattered through App.tsx. The card/content is passed as children so each
 * dialog keeps its own layout.
 */
export const Modal: React.FC<ModalProps> = ({ open, className = DEFAULT_VARIANT, onClose, children }) => {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`${BASE} ${className}`}
      onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      {children}
    </div>
  );
};

export default Modal;
