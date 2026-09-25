import { Files, Keyboard, Maximize2, MessageSquare, PhoneOff } from 'lucide-react'
import BrowserWindow from './BrowserWindow'

// Illustration: a Windows desktop being controlled from the Remote365 web
// app in a browser (the web viewer is real; this picture is drawn, not a
// screenshot). Pure CSS; the cursor animation stops under reduced motion.
export default function RemoteDesktopScene() {
  return (
    <figure className="rds">
      <BrowserWindow url="remote365.ai/session">
        <div className="rds-screen" aria-hidden="true">
          {/* Session toolbar of the web viewer */}
          <div className="rds-toolbar">
            <span><MessageSquare size={14} /></span>
            <span><Keyboard size={14} /></span>
            <span><Files size={14} /></span>
            <span><Maximize2 size={14} /></span>
            <span className="rds-end"><PhoneOff size={14} /></span>
          </div>

          {/* The remote computer's desktop */}
          <div className="rds-window">
            <div className="rds-window-bar"><i /><i /><i /></div>
            <div className="rds-window-body">
              <div className="rds-side">{Array.from({ length: 5 }, (_, i) => <b key={i} />)}</div>
              <div className="rds-rows">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="rds-row"><em /><b style={{ width: `${40 + ((i * 17) % 45)}%` }} /></div>
                ))}
              </div>
            </div>
          </div>
          <div className="rds-taskbar">
            <span className="rds-start" />
            <span /><span /><span /><span />
          </div>

          <svg className="rds-cursor" viewBox="0 0 16 22" width="16" height="22">
            <path d="M1 1l0 17 4.5-4.2 3 6.8 3-1.3-3-6.6 6.2-0.2z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span className="rds-chip">Connected · end-to-end encrypted</span>
        </div>
      </BrowserWindow>
      <figcaption className="rds-caption">
        Illustration: controlling a computer from the Remote365 web app in a browser.
      </figcaption>
      <style>{`
        .rds { margin: 0; width: 100%; }
        .rds-screen {
          position: relative;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          background:
            radial-gradient(120% 90% at 20% 10%, rgba(66, 116, 255, 0.55), transparent 60%),
            radial-gradient(90% 80% at 90% 90%, rgba(255, 138, 0, 0.35), transparent 60%),
            linear-gradient(160deg, #1b2a52 0%, #101624 100%);
        }
        .rds-toolbar {
          position: absolute;
          top: 4%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
          display: flex;
          gap: 4px;
          padding: 5px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(12, 12, 14, 0.82);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .rds-toolbar span {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.06);
        }
        .rds-toolbar .rds-end { background: #e5484d; color: #fff; }
        .rds-window {
          position: absolute;
          left: 12%;
          top: 18%;
          width: 62%;
          height: 58%;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(248, 249, 251, 0.96);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
        }
        .rds-window-bar {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          height: 12%;
          padding: 0 8px;
          align-items: center;
          background: #e9ecf2;
        }
        .rds-window-bar i { width: 8px; height: 8px; border-radius: 2px; background: #b9c0cc; }
        .rds-window-body { display: flex; height: 88%; }
        .rds-side {
          width: 24%;
          padding: 8% 5%;
          display: flex;
          flex-direction: column;
          gap: 9%;
          background: #f0f2f6;
        }
        .rds-side b { height: 6px; border-radius: 3px; background: #cfd5df; }
        .rds-rows { flex: 1; padding: 5% 6%; display: flex; flex-direction: column; justify-content: space-between; }
        .rds-row { display: flex; align-items: center; gap: 6%; }
        .rds-row em { width: 12px; height: 12px; border-radius: 3px; background: #ffb347; flex-shrink: 0; }
        .rds-row b { height: 6px; border-radius: 3px; background: #d7dce5; }
        .rds-taskbar {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 9%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2%;
          background: rgba(20, 22, 30, 0.85);
        }
        .rds-taskbar span { width: 3.4%; aspect-ratio: 1 / 1; border-radius: 4px; background: rgba(255, 255, 255, 0.28); }
        .rds-taskbar .rds-start { background: linear-gradient(135deg, #4c8dff, #2d63d8); }
        .rds-cursor {
          position: absolute;
          z-index: 4;
          left: 30%;
          top: 40%;
          width: 3%;
          min-width: 12px;
          height: auto;
          filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
          animation: rdsCursor 7s ease-in-out infinite;
        }
        @keyframes rdsCursor {
          0%   { left: 30%; top: 40%; }
          25%  { left: 55%; top: 52%; }
          35%  { left: 55%; top: 52%; transform: scale(0.85); }
          40%  { left: 55%; top: 52%; transform: scale(1); }
          70%  { left: 40%; top: 70%; }
          100% { left: 30%; top: 40%; }
        }
        .rds-chip {
          position: absolute;
          left: 3%;
          bottom: 12%;
          z-index: 3;
          padding: 4px 10px;
          border-radius: 9999px;
          background: rgba(12, 12, 14, 0.8);
          border: 1px solid rgba(40, 200, 64, 0.45);
          font-size: 11px;
          color: #b8f5c4;
          white-space: nowrap;
        }
        .rds-caption {
          margin: 10px 0 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
        }
        @media (prefers-reduced-motion: reduce) {
          .rds-cursor { animation: none; left: 55%; top: 52%; }
        }
        @media (max-width: 480px) {
          .rds-toolbar span { width: 22px; height: 22px; }
          .rds-toolbar span svg { width: 11px; height: 11px; }
          .rds-chip { font-size: 9px; }
        }
      `}</style>
    </figure>
  )
}
