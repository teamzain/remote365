/**
 * The viewer's own camera preview during a remote session.
 *
 * Self-view exists for one reason: without it you have no idea what you are
 * broadcasting into someone else's living room. It is small, draggable and
 * always muted — playing your own microphone back is a feedback loop.
 *
 * Capture, encoding and transport all live in viewerCameraCapture; this is
 * only the surface for them.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Mic, MicOff, User, X } from 'lucide-react';
import {
  CameraState,
  clearCameraError,
  setViewerMicEnabled,
  stopViewerCamera,
  subscribeCameraState,
} from '../../lib/viewerCameraCapture';

const ViewerCameraDock: React.FC<{ deviceName?: string }> = ({ deviceName }) => {
  const [state, setState] = useState<CameraState | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => subscribeCameraState(setState), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = state?.stream || null;
    if (state?.stream) void video.play().catch(() => { /* preview only */ });
  }, [state?.stream]);

  if (!state?.active && !state?.error) return null;

  if (state.error && !state.active) {
    return (
      <div
        className="absolute bottom-28 left-6 z-[115] flex max-w-[340px] items-start gap-2.5 rounded-xl border border-[#FFB4AB] bg-[#FFF2F0] p-3 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#FF383C]" />
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-semibold text-[#111315]">Camera Unavailable</p>
          <p className="m-0 mt-0.5 text-[12px] leading-[17px] text-[#111315]/75">{state.error}</p>
        </div>
        <button
          type="button"
          title="Dismiss"
          onClick={() => clearCameraError()}
          className="shrink-0 text-[#111315]/40 hover:text-[#111315]"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute z-[115] w-[228px] overflow-hidden rounded-xl border border-white/15 bg-[#111315] shadow-2xl"
      style={{ left: `calc(1.5rem + ${offset.x}px)`, bottom: `calc(7rem - ${offset.y}px)` }}
      onMouseDown={(event) => {
        // Own the drag entirely: a mousedown that reaches the video surface
        // underneath would be forwarded to the remote machine as a click.
        event.stopPropagation();
        const startX = event.clientX;
        const startY = event.clientY;
        const origin = { ...offset };
        const onMove = (move: MouseEvent) => {
          setOffset({ x: origin.x + move.clientX - startX, y: origin.y + move.clientY - startY });
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      }}
    >
      {state.hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          // Never unmute: this is our own microphone coming back at us.
          muted
          playsInline
          // Mirrored, because a self-view that is not mirrored feels wrong to
          // everyone who has ever used a webcam.
          className="h-[128px] w-full scale-x-[-1] object-cover"
        />
      ) : (
        // Mic-only fallback. Say so plainly rather than showing a black box
        // that reads as "broken".
        <div className="flex h-[128px] w-full flex-col items-center justify-center gap-2 bg-[#1A1D21] px-3 text-center">
          <User size={30} strokeWidth={1.4} className="text-white/70" />
          <span className="text-[11px] leading-[15px] text-white/60">
            {state.notice || 'Microphone Only'}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 bg-[#1A1D21] px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/70">
          You → {deviceName || 'remote'}
        </span>
        <button
          type="button"
          title={state.micOn ? 'Mute Microphone' : 'Unmute Microphone'}
          onClick={() => setViewerMicEnabled(!state.micOn)}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10 ${
            state.micOn ? 'text-white' : 'text-[#FF8A00]'
          }`}
        >
          {state.micOn ? <Mic size={14} /> : <MicOff size={14} />}
        </button>
        <button
          type="button"
          title="Turn Camera Off"
          onClick={() => void stopViewerCamera()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-[#FF383C]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default ViewerCameraDock;
