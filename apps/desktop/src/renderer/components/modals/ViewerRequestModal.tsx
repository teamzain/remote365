import React from 'react';
import { Monitor } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { t } from '../../lib/translations';
import { ScamWarning, useConsentArmDelay } from './ScamWarning';

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
  const armSeconds = useConsentArmDelay(state?.viewerId);
  if (!state) return null;

  const name = state.viewerName || '';
  // Function replacer: a display name containing "$&" must not be expanded.
  const withName = (key: string) => t(key, language).replace('{name}', () => name);
  // Signaling stores trust against the connecting ACCOUNT and ignores it for
  // anonymous viewers, so only offer it when we know who is asking.
  const canTrust = Boolean(name);

  return (
    <Modal open className="z-[200] p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[rgba(28,28,28,0.08)] shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Monitor className="text-[#1D6DF5] w-6 h-6" />
          </div>
          {/* Translated here because the text carries a name, which the
              app-wide phrase translator can't match. */}
          <div className="flex-1" translate="no">
            <h2 className="text-lg font-bold text-[#1C1C1C] tracking-tight">
              {name ? withName('viewer_request_title_named') : t('viewer_request_title', language)}
            </h2>
            <p className="text-sm font-medium text-[#4A4A4A] leading-relaxed mt-1">
              {name ? withName('viewer_request_body_named') : t('viewer_request_body', language)}
            </p>
          </div>
        </div>
        <ScamWarning />
        <div className="w-full flex flex-col items-center gap-1">
          <div className="w-full bg-[#F8F9FA] rounded-2xl h-2 overflow-hidden cursor-none">
            <div className="h-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${(state.countdown / 30) * 100}%` }} />
          </div>
          <p className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-widest">
            {t('auto_denying', language).replace('{seconds}', String(state.countdown))}
          </p>
        </div>
        {canTrust && (
          <label className="w-full flex items-center gap-3 rounded-2xl border border-[rgba(28,28,28,0.08)] bg-[#F8F9FA] px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(state.trustDevice)}
              onChange={(e) => setState((prev) => (prev ? { ...prev, trustDevice: e.target.checked } : prev))}
              className="w-4 h-4 accent-[#1C1C1C]"
            />
            <span className="text-[12px] font-bold text-[#1C1C1C] leading-snug" translate="no">{withName('viewer_request_trust_named')}</span>
          </label>
        )}
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
            disabled={armSeconds > 0}
            onClick={() => {
              if (armSeconds > 0) return;
              (window as any).electronAPI?.approveViewer(state.viewerId, canTrust && Boolean(state.trustDevice));
              setState(null);
            }}
            className="flex-1 py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {t('allow_btn', language)}
            {armSeconds > 0 && <span translate="no"> ({armSeconds})</span>}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ViewerRequestModal;
