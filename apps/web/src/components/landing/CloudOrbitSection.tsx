import React from 'react'

// icon-park-outline:earth — white globe
const EarthIcon: React.FC = () => (
  <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="20" stroke="#FFFFFF" strokeWidth="3" />
    <path d="M4 24h40" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="24" cy="24" rx="9" ry="20" stroke="#FFFFFF" strokeWidth="3" />
  </svg>
)

// jam:database — cylinder
const DatabaseIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <ellipse cx="12" cy="5.5" rx="7.5" ry="3" stroke="#111315" strokeWidth="1.6" />
    <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" stroke="#111315" strokeWidth="1.6" />
    <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" stroke="#111315" strokeWidth="1.6" />
  </svg>
)

// carbon:ibm-cloud-virtual-server-vpc — server rack
const ServerIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="16" height="7" rx="1.5" stroke="#111315" strokeWidth="1.6" />
    <rect x="4" y="13" width="16" height="7" rx="1.5" stroke="#111315" strokeWidth="1.6" />
    <circle cx="8" cy="7.5" r="1" fill="#111315" />
    <circle cx="8" cy="16.5" r="1" fill="#111315" />
    <path d="M12 7.5h5M12 16.5h5" stroke="#111315" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

// carbon:virtual-private-cloud — cloud
const CloudIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 18.5a4.5 4.5 0 01-.42-8.98 6 6 0 0111.63 1.5A4 4 0 0117.5 18.5H7z"
      stroke="#111315"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
)

const ORBIT_PERIOD = 40

const BADGES = [
  { label: 'On-premises', Icon: DatabaseIcon, delay: 0 },
  { label: 'Virtual server', Icon: ServerIcon, delay: -ORBIT_PERIOD / 3 },
  { label: 'Private cloud', Icon: CloudIcon, delay: (-ORBIT_PERIOD * 2) / 3 },
]

const CloudOrbitSection: React.FC = () => (
  <section className="cloud-orbit-section">
    <div className="cloud-orbit-canvas">

      {/* Dashed ring */}
      <div className="cloud-orbit-ring" />

      {/* Center globe hub */}
      <div className="cloud-orbit-hub">
        <EarthIcon />
      </div>

      {/* Infrastructure badges revolving around the ring */}
      {BADGES.map(({ label, Icon, delay }) => (
        <div
          key={label}
          className="cloud-orbit-badge"
          style={{ animationDelay: `${delay}s` }}
          aria-label={label}
        >
          <Icon />
        </div>
      ))}
    </div>

    <style>{`
      .cloud-orbit-section {
        width: 100%;
        background: #FFFFFF;
        overflow: hidden;
      }
      .cloud-orbit-canvas {
        position: relative;
        width: 100%;
        height: clamp(440px, 46vw, 700px);
      }
      .cloud-orbit-ring {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(600px, 68vw);
        aspect-ratio: 1;
        border: 1px dashed rgba(26, 29, 33, 0.3);
        border-radius: 50%;
      }
      .cloud-orbit-hub {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: min(130px, 18vw);
        height: min(130px, 18vw);
        background: linear-gradient(180deg, #FF8A00 0%, #FFB347 100%);
        border-radius: 50%;
      }
      .cloud-orbit-hub svg {
        width: 49%;
        height: 49%;
      }
      .cloud-orbit-badge {
        --orbit-r: min(300px, 34vw);
        position: absolute;
        left: 50%;
        top: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px 32px;
        background: #FFFFFF;
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.12);
        border-radius: 50px;
        animation: cloudOrbitRevolve ${ORBIT_PERIOD}s linear infinite;
      }
      /* Revolve around the center while counter-rotating to stay upright */
      @keyframes cloudOrbitRevolve {
        from { transform: translate(-50%, -50%) rotate(0deg)   translateX(var(--orbit-r)) rotate(0deg); }
        to   { transform: translate(-50%, -50%) rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); }
      }

      @media (max-width: 900px) {
        .cloud-orbit-badge { padding: 10px 20px; }
        .cloud-orbit-badge svg { width: 32px; height: 32px; }
      }
      @media (max-width: 560px) {
        .cloud-orbit-canvas { height: 90vw; }
        .cloud-orbit-badge { padding: 8px 14px; }
        .cloud-orbit-badge svg { width: 24px; height: 24px; }
      }
    `}</style>
  </section>
)

export default CloudOrbitSection
