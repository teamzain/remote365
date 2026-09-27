import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

/** How long the Allow/Approve button stays disabled so the warning gets read. */
export const CONSENT_ARM_SECONDS = 5;

/**
 * Seconds left before an incoming-access prompt may be accepted. Restarts
 * whenever `requestKey` changes, so every new request gets the full delay; a
 * key that hasn't been armed yet reads as the full delay, never as 0, so the
 * button can't be live for the one render before the effect runs.
 */
export const useConsentArmDelay = (requestKey: string | null | undefined): number => {
  const [armed, setArmed] = useState<{ key: string; remaining: number } | null>(null);

  useEffect(() => {
    if (!requestKey) return;
    const startedAt = Date.now();
    const tick = () => {
      const remaining = Math.max(0, CONSENT_ARM_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setArmed((prev) => (prev?.key === requestKey && prev.remaining === remaining ? prev : { key: requestKey, remaining }));
      return remaining;
    };
    tick();
    const timer = window.setInterval(() => {
      if (tick() === 0) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [requestKey]);

  if (!requestKey || !armed || armed.key !== requestKey) return CONSENT_ARM_SECONDS;
  return armed.remaining;
};

/**
 * Shown where someone asks to get into this PC: the connect prompt
 * (ViewerRequestModal) and a meeting's Remote Control Request. Tech-support
 * scammers phone people, claim to be Microsoft or a bank, and talk them
 * through approving the connection. Each sentence is its own text node so the
 * app-wide translator matches it against dashboardTranslations.
 */
export const ScamWarning: React.FC = () => (
  <div role="note" className="flex w-full items-start gap-3 rounded-xl border border-[#FFD49A] bg-[#FFF6EA] px-4 py-3 text-start">
    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#B45F00]" aria-hidden="true" />
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-bold leading-5 text-[#6B3A00]">Only allow people you know and trust</p>
      <p className="text-[12px] font-medium leading-[18px] text-[#6B3A00]">Scammers pose as Microsoft, a bank, a government office or Remote365 support and ask you to allow a connection. Remote365 will never contact you unexpectedly to ask for access.</p>
      <p className="text-[12px] font-bold leading-[18px] text-[#6B3A00]">If someone contacted you out of the blue, press Deny.</p>
    </div>
  </div>
);

export default ScamWarning;
