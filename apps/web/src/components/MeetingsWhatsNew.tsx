import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarPlus, Link2, Sparkles, Video, X } from 'lucide-react';

// Bump the key when a future release ships another meetings announcement.
const STORAGE_KEY = 'r365_whats_new:meetings-2026-08';

interface MeetingsWhatsNewProps {
  user: any;
  onOpenMeetings?: () => void;
}

const STEPS = [
  {
    icon: Video,
    title: 'Meetings just got an upgrade',
    body: 'The New meeting button now gives you three ways to start — pick what fits the moment.',
  },
  {
    icon: Link2,
    title: 'Create a meeting for later',
    body: 'Get a link that stays active for 7 days. Copy the joining info now and share it — the room is ready whenever you are.',
  },
  {
    icon: CalendarPlus,
    title: 'Schedule in Google Calendar',
    body: 'One click opens a prefilled Google Calendar event with your meeting link inside — set the time, invite guests, done.',
  },
];

/**
 * One-time "What's new" walkthrough shown after this update to signed-in
 * users. Card carousel over the three new meeting options; marks itself done
 * in localStorage on any dismissal so it never reappears.
 */
export const MeetingsWhatsNew: React.FC<MeetingsWhatsNewProps> = ({ user, onOpenMeetings }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'done') return;
    } catch {
      return;
    }
    // Let the dashboard settle before announcing.
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, 'done'); } catch { /* storage unavailable */ }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[420px] overflow-hidden rounded-[12px] bg-white font-['Mona_Sans',system-ui,sans-serif] shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#101010]">
        <div className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <button
            type="button"
            onClick={dismiss}
            title="Skip"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded text-[#1A1D21]/50 transition-colors hover:text-[#FF8A00] dark:text-white/50"
          >
            <X size={18} />
          </button>

          <span className="flex items-center gap-1.5 rounded-full bg-[#FFB347]/20 px-3 py-1 text-[12px] font-medium text-[#FF8A00]">
            <Sparkles size={13} /> What's new
          </span>

          {step === 0 ? (
            // Mini mock of the new dropdown so users recognize it on the page.
            <div className="mt-6 w-[248px] overflow-hidden rounded-[8px] border border-[#1A1D21]/10 bg-white py-1 text-left shadow-[0_12px_32px_rgba(17,19,21,0.16)] dark:border-white/10 dark:bg-[#181818]">
              {[
                { icon: Link2, label: 'Create a meeting for later' },
                { icon: Video, label: 'Start an instant meeting' },
                { icon: CalendarPlus, label: 'Schedule in Google Calendar' },
              ].map(({ icon: RowIcon, label }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-normal text-[#111315] dark:text-white">
                  <RowIcon size={15} className="flex-shrink-0 text-[#1A1D21]/60 dark:text-white/60" />
                  {label}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#FFB347]/30">
              <Icon size={30} className="text-[#FF8A00]" />
            </div>
          )}

          <h2 className="mt-5 text-[18px] font-medium leading-[25px] text-[#111315] dark:text-white">{current.title}</h2>
          <p className="mt-2 text-[14px] font-normal leading-5 text-[#1A1D21]/60 dark:text-[#D1D1D1]">{current.body}</p>
        </div>

        <div className="flex items-center justify-between border-t border-[#1A1D21]/10 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setStep(index)}
                aria-label={`Step ${index + 1}`}
                className={`h-1.5 rounded-full transition-all ${index === step ? 'w-5 bg-[#FF8A00]' : 'w-1.5 bg-[#1A1D21]/20 dark:bg-white/20'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex h-9 items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white px-4 text-[13px] font-medium text-[#111315] transition hover:bg-black/5 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
              >
                Back
              </button>
            )}
            {isLast ? (
              onOpenMeetings ? (
                <button
                  type="button"
                  onClick={() => { dismiss(); onOpenMeetings(); }}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-[32px] px-4 text-[13px] font-medium text-white transition hover:brightness-105"
                  style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                >
                  Try it now <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex h-9 items-center justify-center rounded-[32px] px-4 text-[13px] font-medium text-white transition hover:brightness-105"
                  style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                >
                  Done
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex h-9 items-center justify-center rounded-[32px] px-4 text-[13px] font-medium text-white transition hover:brightness-105"
                style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
