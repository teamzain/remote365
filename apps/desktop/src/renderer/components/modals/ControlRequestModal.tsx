import React from 'react';
import { MousePointer2 } from 'lucide-react';
import { Modal } from '../ui/Modal';

export interface ControlRequestState {
  viewerId: string;
  countdown: number;
  /** Connecting user's account/display name (resolved by the signaling service). */
  viewerName?: string;
}

interface ControlRequestModalProps {
  state: ControlRequestState | null;
  onClose: () => void;
}

/** Incoming keyboard/mouse control request dialog (extracted from App.tsx). */
export const ControlRequestModal: React.FC<ControlRequestModalProps> = ({ state, onClose }) => {
  if (!state) return null;

  return (
    // Above HostLockOverlay (2147482000) and below the draggable title bar
    // (2147483000). At the old z-[210] this prompt rendered UNDERNEATH the lock
    // overlay, so the host could never see it, never approve, and the viewer
    // just sat on "Waiting For Approval…" until the 20s auto-deny.
    <Modal open className="z-[2147482500] p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-[28px] border border-[rgba(28,28,28,0.08)] shadow-2xl p-8 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          <MousePointer2 className="text-[#1D6DF5] w-8 h-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-[#1C1C1C] tracking-tight mb-2">Control Request</h2>
          <p className="text-sm font-medium text-[#000000] leading-relaxed">
            {state.viewerName
              ? `${state.viewerName} wants keyboard and mouse control of this device.`
              : 'A viewer wants keyboard and mouse control of this device.'}
          </p>
        </div>
        <div className="w-full flex flex-col items-center gap-1">
          <div className="w-full bg-[#F8F9FA] rounded-2xl h-2 overflow-hidden cursor-none">
            <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${(state.countdown / 20) * 100}%` }} />
          </div>
          <p className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-widest">Auto denying in {state.countdown}s</p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => {
              (window as any).electronAPI?.denyControl?.(state.viewerId);
              onClose();
            }}
            className="flex-1 py-3.5 rounded-2xl border border-[rgba(28,28,28,0.1)] text-[11px] font-bold uppercase tracking-widest text-[#000000] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
          >
            Deny
          </button>
          <button
            onClick={() => {
              (window as any).electronAPI?.approveControl?.(state.viewerId);
              onClose();
            }}
            className="flex-1 py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Allow
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ControlRequestModal;
