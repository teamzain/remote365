import React, { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import waitIllustration from '../../assets/wait.png';

const STATUS_MESSAGES = [
  'Waiting For Someone To Join',
  'Holding The Secure Tunnel Open',
  'Ready To Share Your Screen',
  'You Will Be Notified On Join',
];

interface HostWaitingViewProps {
  sessionName?: string;
  sessionCode?: string;
  onCancel: () => void;
}

export const HostWaitingView: React.FC<HostWaitingViewProps> = ({ sessionName, sessionCode, onCancel }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((index) => (index + 1) % STATUS_MESSAGES.length);
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = async () => {
    if (!sessionCode) return;
    try {
      const eAPI = (window as any).electronAPI;
      if (eAPI?.clipboard?.writeText) {
        await eAPI.clipboard.writeText(sessionCode);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sessionCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.warn('[HostWaiting] clipboard copy failed', err);
    }
  };

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full max-w-full flex-col items-center justify-center overflow-hidden bg-white text-[#111315]">
      <div className="pointer-events-none absolute left-1/2 top-[-400px] h-[517px] w-[min(1748px,calc(100vw+320px))] -translate-x-1/2 rounded-full bg-[linear-gradient(360deg,rgba(255,255,255,0.375)_-16.83%,rgba(255,179,71,0.6)_29.84%,rgba(255,138,0,0.75)_76.5%)] blur-[39.5px]" />
      <div className="relative z-10 flex w-[420px] max-w-[calc(100%-48px)] flex-col items-center gap-[60px] text-center">
        <div className="flex flex-col items-center gap-[45px]">
          <img src={waitIllustration} alt="" className="h-[214px] w-[251px] object-contain" />
          <div className="flex flex-col items-center gap-[14px]">
            <h1 className="m-0 text-[24px] font-medium leading-[34px] text-black">Waiting For Someone To Join</h1>
            <p className="m-0 max-w-[377px] text-[12px] leading-[15px] text-black">
              {sessionName ? `"${sessionName}" is live. ` : ''}
              Share the session ID below so the other person can join.
            </p>
            {sessionCode && (
              <button
                type="button"
                onClick={handleCopy}
                className="mt-2 flex items-center gap-3 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[14px] font-semibold tracking-[0.3em] text-black/80 shadow-sm hover:bg-white"
                title="Copy Session ID"
              >
                <span>{sessionCode}</span>
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-black/50" />}
              </button>
            )}
            <p className="m-0 text-[11px] font-medium text-black/45">{STATUS_MESSAGES[messageIndex]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded px-6 text-[14px] font-medium text-[#111315] shadow-sm"
          style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
        >
          Close
        </button>
      </div>
    </div>
  );
};
