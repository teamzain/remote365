import React from 'react';
import { Monitor } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { t } from '../../lib/translations';

export interface ViewerRequestState {
  viewerId: string;
  countdown: number;
  trustDevice?: boolean;
  /** Connecting user's account/display name (resolved by the signaling service). */
  viewerName?: string;
}

interface ViewerRequestModalProps {
  state: ViewerRequestState | null;
  setState: React.Dispatch<React.SetStateAction<ViewerRequestState | null>>;
  language?: string;
}

/** Incoming remote-support access request dialog (extracted from App.tsx). */
export const ViewerRequestModal: React.FC<ViewerRequestModalProps> = ({ state, setState, language }) => {
  if (!state) return null;

  return (
    <Modal open className="z-[200] p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[rgba(28,28,28,0.08)] shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Monitor className="text-[#1D6DF5] w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#1C1C1C] tracking-tight">
              {state.viewerName ? `${state.viewerName} is requesting to connect` : 'Remote Support Request'}
            </h2>
            <p className="text-sm font-medium text-[#4A4A4A] leading-relaxed mt-1">
              {state.viewerName
                ? `${state.viewerName} wants to view and use this PC in a remote support session. Only allow this if you trust this person.`
                : 'Someone is waiting to use this PC for a remote support session. Only allow this if you trust the person who shared the session.'}
            </p>
          </div>
        </div>
        <div className="w-full flex flex-col items-center gap-1">
          <div className="w-full bg-[#F8F9FA] rounded-2xl h-2 overflow-hidden cursor-none">
            <div className="h-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${(state.countdown / 30) * 100}%` }} />
          </div>
          <p className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-widest">
            {t('auto_denying', language).replace('{seconds}', String(state.countdown))}
          </p>
        </div>
        <label className="w-full flex items-center gap-3 rounded-2xl border border-[rgba(28,28,28,0.08)] bg-[#F8F9FA] px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(state.trustDevice)}
            onChange={(e) => setState((prev) => (prev ? { ...prev, trustDevice: e.target.checked } : prev))}
            className="w-4 h-4 accent-[#1C1C1C]"
          />
          <span className="text-[12px] font-bold text-[#1C1C1C] leading-snug">Don't Ask Again For This Device</span>
        </label>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => {
              (window as any).electronAPI?.denyViewer(state.viewerId);
              setState(null);
            }}
            className="flex-1 py-3.5 rounded-2xl border border-[rgba(28,28,28,0.1)] text-[11px] font-bold uppercase tracking-widest text-[#000000] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
          >
            {t('deny_btn', language)}
          </button>
          <button
            onClick={() => {
              (window as any).electronAPI?.approveViewer(state.viewerId, Boolean(state.trustDevice));
              setState(null);
            }}
            className="flex-1 py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {t('allow_btn', language)}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ViewerRequestModal;
