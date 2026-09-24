import React, { useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { LottieScene } from '../lottie/LottieScene';
// The user's own Lottie exports (512x512, play once and hold).
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
 * Sign-in / sign-up outcome dialog: an animated tick for success, an animated
 * cross for failures such as "Incorrect password", instead of only a red line
 * under the form.
 */
export const AuthResultModal: React.FC<AuthResultModalProps> = ({ state, onClose, successAutoCloseMs = 1600 }) => {
  // The caller passes a fresh arrow each render; keeping it in a ref stops
  // every parent re-render from restarting the auto-close timer.
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
    <Modal open className="z-[9999] p-6 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white px-8 pb-8 pt-6 rounded-[28px] shadow-2xl animate-in zoom-in-95 duration-200 text-center"
        style={{ fontFamily: "'Mona Sans', sans-serif" }}
        role="alertdialog"
        aria-live="assertive"
      >
        <div className="mx-auto mb-2 flex h-[132px] w-[132px] items-center justify-center">
          {/* keyed so a second failure replays the animation */}
          <LottieScene key={`${state.kind}-${state.message}`} animationData={isSuccess ? successAnimation : failedAnimation} size={132} />
        </div>
        <h3 className="text-[20px] font-medium leading-[28px] text-[#111315] mb-2">{state.title}</h3>
        <p className="text-[14px] font-normal leading-5 text-[#1A1D21]/60 max-w-[280px] mx-auto">{state.message}</p>
        {!isSuccess && (
          <button
            onClick={onClose}
            autoFocus
            className="mt-7 w-full h-11 rounded-lg bg-[#111315] text-[14px] font-medium text-white transition-all hover:bg-[#1A1D21]"
          >
            Try Again
          </button>
        )}
      </div>
    </Modal>
  );
};

export default AuthResultModal;
