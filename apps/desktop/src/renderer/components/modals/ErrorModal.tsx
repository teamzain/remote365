import React from 'react';
import { ShieldOff } from 'lucide-react';
import { Modal } from '../ui/Modal';

export interface ErrorModalState {
  show: boolean;
  title: string;
  message: string;
}

interface ErrorModalProps {
  state: ErrorModalState | null;
  onClose: () => void;
}

/**
 * Global error dialog (extracted from App.tsx). The component owns its own
 * null-guard, so the content keeps TypeScript narrowing without the caller
 * needing a `{cond && (…)}` wrapper.
 */
export const ErrorModal: React.FC<ErrorModalProps> = ({ state, onClose }) => {
  if (!state || !state.show) return null;

  return (
    <Modal open className="z-[9999] p-6 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className="w-full max-w-sm bg-white p-8 rounded-[28px] shadow-2xl animate-in zoom-in-95 duration-300 text-center"
        style={{ fontFamily: "'Mona Sans', sans-serif" }}
      >
        <div className="w-16 h-16 bg-[#FF2D55]/15 rounded-full flex items-center justify-center text-[#FF2D55] mx-auto mb-5">
          <ShieldOff className="w-7 h-7" />
        </div>
        <h3 className="text-[20px] font-medium leading-[28px] text-[#111315] mb-2">{state.title}</h3>
        <p className="text-[14px] font-normal leading-5 text-[#1A1D21]/60 max-w-[280px] mx-auto mb-7">{state.message}</p>
        <button
          onClick={onClose}
          className="w-full h-11 rounded-lg bg-[#111315] text-[14px] font-medium text-white transition-all hover:bg-[#1A1D21]"
        >
          Got It
        </button>
      </div>
    </Modal>
  );
};

export default ErrorModal;
