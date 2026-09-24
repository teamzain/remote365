import React, { useEffect, useRef } from 'react';
import { LottieScene } from '../lottie/LottieScene';
// Same Lottie exports the desktop app uses (512x512, play once and hold).
import successAnimation from '../../assets/animations/authSuccess.json';
import failedAnimation from '../../assets/animations/authFailed.json';

export interface AuthResultState {
  kind: 'success' | 'error';
  title: string;
  message: string;
}

interface AuthResultModalProps {
  state: AuthResultState | null;
  onClose: () => void;
  /** Success closes itself after this many ms (errors wait for the button). */
  successAutoCloseMs?: number;
}

/**
 * Sign-in / sign-up outcome dialog (web twin of the desktop modal): an animated
 * tick for success, an animated cross for failures such as "Incorrect
 * password", instead of only a red line under the form.
 */
export const AuthResultModal: React.FC<AuthResultModalProps> = ({ state, onClose, successAutoCloseMs = 1600 }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!state || state.kind !== 'success') return;
    const timer = setTimeout(() => onCloseRef.current(), successAutoCloseMs);
    return () => clearTimeout(timer);
  }, [state, successAutoCloseMs]);

  if (!state) return null;
  const isSuccess = state.kind === 'success';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-[28px] bg-white px-8 pb-8 pt-6 text-center shadow-2xl"
        style={{ fontFamily: "'Mona Sans', sans-serif" }}
        role="alertdialog"
        aria-live="assertive"
      >
        <div className="mx-auto mb-2 flex h-[132px] w-[132px] items-center justify-center">
          <LottieScene key={`${state.kind}-${state.message}`} animationData={isSuccess ? successAnimation : failedAnimation} size={132} />
        </div>
        <h3 className="mb-2 text-[20px] font-medium leading-[28px] text-[#111315]">{state.title}</h3>
        <p className="mx-auto max-w-[280px] text-[14px] font-normal leading-5 text-[#1A1D21]/60">{state.message}</p>
        {!isSuccess && (
          <button
            onClick={onClose}
            autoFocus
            className="mt-7 h-11 w-full rounded-lg bg-[#111315] text-[14px] font-medium text-white transition-all hover:bg-[#1A1D21]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthResultModal;
