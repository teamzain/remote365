import React, { useEffect, useState } from 'react';
import { CalendarPlus, Check, Copy, X } from 'lucide-react';

export interface MeetingReadyInfo {
  name?: string;
  joinLink: string;
  displayCode: string;
  expiresAt?: string | Date | null;
}

interface MeetingReadyModalProps {
  open: boolean;
  meeting: MeetingReadyInfo | null;
  onClose: () => void;
  onSchedule: (meeting: MeetingReadyInfo) => void;
}

// "Here's your joining info" — shown after "Create a meeting for later": the
// link stays valid for days, so the user can copy it now and share/use later.
export const MeetingReadyModal: React.FC<MeetingReadyModalProps> = ({ open, meeting, onClose, onSchedule }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !meeting) return null;

  const copyJoiningInfo = () => {
    const text = `${meeting.joinLink}\nMeeting code: ${meeting.displayCode}`;
    const electronApi = (window as any).electronAPI;
    if (electronApi?.clipboard?.writeText) electronApi.clipboard.writeText(text);
    else navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const expiresLabel = meeting.expiresAt
    ? new Date(meeting.expiresAt).toLocaleDateString([], { month: 'long', day: 'numeric' })
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#101010]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[18px] font-medium leading-[25px] text-[#111315] dark:text-white">Here's your joining info</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-[#1A1D21]/60 transition-colors hover:text-[#FF8A00] dark:text-white/60"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-1 text-[14px] font-normal leading-5 text-[#1A1D21]/60 dark:text-[#D1D1D1]">
          Send this to people you want to meet with. Save it so you can use it later, too.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded bg-[#F3F4F6] p-3 dark:bg-white/5">
          <div className="min-w-0 flex-1">
            <p className="break-all text-[13px] font-normal leading-5 text-[#111315] dark:text-white">{meeting.joinLink}</p>
            <p className="mt-1 font-mono text-[12px] text-[#1A1D21]/50 dark:text-[#A0A0A0]">Meeting code: {meeting.displayCode}</p>
          </div>
          <button
            type="button"
            onClick={copyJoiningInfo}
            title="Copy joining info"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-[#1A1D21]/50 transition-colors hover:text-[#FF8A00] dark:text-white/50"
          >
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
        </div>

        {expiresLabel && (
          <p className="mt-2 text-[12px] font-normal leading-[17px] text-[#1A1D21]/50 dark:text-[#A0A0A0]">
            This link stays active until {expiresLabel}.
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => onSchedule(meeting)}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-black/5 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
          >
            <CalendarPlus size={16} />
            Google Calendar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 flex-1 items-center justify-center rounded-[32px] text-[14px] font-medium leading-5 text-white transition hover:brightness-105"
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
