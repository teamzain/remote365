import React from 'react'

// jam:screen — white monitor icon
const ScreenIcon: React.FC = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="2" y="3.5" width="20" height="13.5" rx="2" stroke="#FFFFFF" strokeWidth="1.8" />
    <path d="M8 20.5h8M12 17v3.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

// One full revolution takes ORBIT_PERIOD seconds; negative delays spread the
// four pills 90° apart on the ring.
const ORBIT_PERIOD = 36

const PILLS = [
  { id: '123 456 789', delay: 0 },
  { id: '987 654 321', delay: -ORBIT_PERIOD * 0.25 },
  { id: '456 789 123', delay: -ORBIT_PERIOD * 0.5 },
  { id: '789 123 456', delay: -ORBIT_PERIOD * 0.75 },
]

const DeviceOrbitSection: React.FC = () => (
  <section className="orbit-section">
    <div className="orbit-canvas">

      {/* Concentric rings */}
      <div className="orbit-ring" style={{ width: 'min(540px, 60vw)' }} />
      <div className="orbit-ring" style={{ width: 'min(600px, 68vw)' }} />

      {/* Center logo */}
      <img src="/logo.png" alt="Remote365" className="orbit-logo" />

      {/* Device ID pills revolving around the ring */}
      {PILLS.map(pill => (
        <div
          key={pill.id}
          className="orbit-pill"
          style={{ animationDelay: `${pill.delay}s` }}
        >
          <ScreenIcon />
          <span>{pill.id}</span>
        </div>
      ))}
    </div>

    <style>{`
      .orbit-section {
        width: 100%;
        background: #FFFFFF;
        overflow: hidden;
      }
      .orbit-canvas {
        position: relative;
        width: 100%;
        height: clamp(440px, 46vw, 700px);
      }
      .orbit-ring {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        aspect-ratio: 1;
        border: 1px solid rgba(26, 29, 33, 0.15);
        border-radius: 50%;
      }
      .orbit-logo {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(100px, 14vw);
        height: min(100px, 14vw);
        object-fit: contain;
      }
      .orbit-pill {
        --orbit-r: min(300px, 34vw);
        position: absolute;
        left: 50%;
        top: 50%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 32px;
        background: linear-gradient(180deg, #FF8A00 0%, #FFB347 100%);
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.12);
        border-radius: 34px;
        white-space: nowrap;
        animation: orbitRevolve ${ORBIT_PERIOD}s linear infinite;
      }
      .orbit-pill span {
        font-weight: 600;
        font-size: 16px;
        line-height: 23px;
        color: #FFFFFF;
      }
      /* Revolve around the center while counter-rotating to stay upright */
      @keyframes orbitRevolve {
        from { transform: translate(-50%, -50%) rotate(0deg)   translateX(var(--orbit-r)) rotate(0deg); }
        to   { transform: translate(-50%, -50%) rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); }
      }

      @media (max-width: 900px) {
        .orbit-pill {
          gap: 8px;
          padding: 10px 18px;
        }
        .orbit-pill span { font-size: 13px; line-height: 18px; }
        .orbit-pill svg { width: 22px; height: 22px; }
      }
      @media (max-width: 560px) {
        .orbit-canvas { height: 90vw; }
        .orbit-pill {
          gap: 6px;
          padding: 8px 12px;
        }
        .orbit-pill span { font-size: 11px; line-height: 15px; }
        .orbit-pill svg { width: 16px; height: 16px; }
      }
    `}</style>
  </section>
)

export default DeviceOrbitSection
