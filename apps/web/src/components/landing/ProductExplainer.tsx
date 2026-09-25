'use client'

import React, { useState } from 'react'

const STEPS = [
  {
    title: 'Start a remote session',
    description:
      'Generate a session code and share it with anyone who needs support. Sessions are temporary, end-to-end encrypted, and require no account for the guest. Perfect for one-time remote assistance.',
  },
  {
    title: 'Access any device',
    description:
      'Connect to any registered device using its unique device ID. Control keyboard and mouse, share screens, and transfer files in real time — as if you were sitting right in front of it.',
  },
  {
    title: 'Meet, chat & manage your team',
    description:
      'Invite teammates to your organization, assign device access by role, and run multiple sessions at once. Built-in video meetings and team chat keep everyone connected.',
  },
]

const FONT = "'Lato', sans-serif"

// ── Scene 1: Start a remote session ────────────────────────────────────────────
const SessionScene: React.FC = () => (
  <g className="px-scene">
    {/* Code card */}
    <g filter="url(#px-shadow)">
      <rect x="360" y="150" width="440" height="260" rx="24" fill="#FFFFFF" />
    </g>
    <rect x="360" y="150" width="440" height="260" rx="24" fill="none" stroke="rgba(26,29,33,0.07)" />
    <text x="392" y="200" fontFamily={FONT} fontSize="15" fontWeight="500" fill="rgba(26,29,33,0.5)">Session code</text>
    <text x="392" y="258" fontFamily={FONT} fontSize="46" fontWeight="700" fill="#1A1D21" letterSpacing="3">042 851 937</text>
    {/* copy pill */}
    <rect x="686" y="176" width="82" height="34" rx="17" fill="#FFF1E0" />
    <text x="727" y="198" fontFamily={FONT} fontSize="14" fontWeight="600" fill="#FF8A00" textAnchor="middle">Copy</text>
    <line x1="392" y1="300" x2="768" y2="300" stroke="rgba(26,29,33,0.08)" />
    {/* share button + pulse */}
    <rect x="392" y="326" width="230" height="50" rx="10" fill="url(#px-orange)" />
    <text x="507" y="357" fontFamily={FONT} fontSize="16" fontWeight="600" fill="#FFFFFF" textAnchor="middle">Share session</text>
    <rect x="392" y="326" width="230" height="50" rx="10" fill="none" stroke="#FF8A00" strokeWidth="2">
      <animate attributeName="stroke-opacity" values="0.55;0;0.55" dur="2.4s" repeatCount="indefinite" />
    </rect>

    {/* connecting link */}
    <path d="M800,300 C880,300 900,320 960,320" stroke="#FF8A00" strokeWidth="2" fill="none" strokeDasharray="7 6" strokeLinecap="round">
      <animate attributeName="stroke-dashoffset" values="26;0" dur="1.1s" repeatCount="indefinite" />
    </path>
    <circle r="4.5" fill="#FF8A00">
      <animateMotion path="M800,300 C880,300 900,320 960,320" dur="1.7s" repeatCount="indefinite" />
    </circle>

    {/* guest avatar */}
    <g filter="url(#px-shadow)"><circle cx="960" cy="320" r="38" fill="#FFFFFF" /></g>
    <circle cx="960" cy="320" r="22" fill="#FFE7CC" />
    <text x="960" y="327" fontFamily={FONT} fontSize="19" fontWeight="700" fill="#FF8A00" textAnchor="middle">G</text>
    <g transform="translate(984,344)">
      <circle r="13" fill="#22C55E" />
      <path d="M-5 0 L-1 4 L6 -4" stroke="#FFFFFF" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <animate attributeName="opacity" values="0;0;1" keyTimes="0;0.35;0.5" dur="3s" repeatCount="indefinite" />
    </g>
  </g>
)

// ── Scene 2: Access any device ─────────────────────────────────────────────────
const DeviceScene: React.FC = () => (
  <g className="px-scene">
    {/* secondary monitor behind */}
    <g filter="url(#px-shadow)" opacity="0.55">
      <rect x="150" y="230" width="230" height="150" rx="12" fill="#FFFFFF" />
    </g>
    <rect x="168" y="248" width="194" height="104" rx="6" fill="#F3F4F6" />

    {/* main window */}
    <g filter="url(#px-shadow)"><rect x="360" y="120" width="620" height="330" rx="16" fill="#FFFFFF" /></g>
    <rect x="360" y="120" width="620" height="330" rx="16" fill="none" stroke="rgba(26,29,33,0.06)" />
    {/* title bar */}
    <circle cx="392" cy="146" r="5" fill="#FF5F57" />
    <circle cx="412" cy="146" r="5" fill="#FEBC2E" />
    <circle cx="432" cy="146" r="5" fill="#28C840" />
    <rect x="470" y="134" width="300" height="24" rx="12" fill="#F1F1F2" />
    <text x="486" y="151" fontFamily={FONT} fontSize="13" fontWeight="500" fill="rgba(26,29,33,0.55)">ID 248 193 004</text>
    <rect x="836" y="132" width="120" height="26" rx="13" fill="#FFF1E0" />
    <circle cx="852" cy="145" r="3.5" fill="#FF8A00" />
    <text x="864" y="150" fontFamily={FONT} fontSize="12" fontWeight="600" fill="#FF8A00">Remote control</text>

    {/* screen content */}
    <line x1="360" y1="172" x2="980" y2="172" stroke="rgba(26,29,33,0.06)" />
    <rect x="384" y="196" width="150" height="230" rx="8" fill="#F7F8F9" />
    <rect x="404" y="220" width="110" height="9" rx="4.5" fill="rgba(26,29,33,0.12)" />
    <rect x="404" y="242" width="90" height="9" rx="4.5" fill="rgba(26,29,33,0.10)" />
    <rect x="404" y="264" width="104" height="9" rx="4.5" fill="rgba(26,29,33,0.10)" />
    <rect x="404" y="286" width="74" height="9" rx="4.5" fill="rgba(26,29,33,0.08)" />
    <rect x="560" y="196" width="396" height="120" rx="10" fill="#FFF7ED" />
    <rect x="584" y="222" width="220" height="12" rx="6" fill="rgba(255,138,0,0.35)" />
    <rect x="584" y="248" width="320" height="10" rx="5" fill="rgba(26,29,33,0.10)" />
    <rect x="584" y="270" width="290" height="10" rx="5" fill="rgba(26,29,33,0.08)" />
    <rect x="560" y="332" width="190" height="94" rx="10" fill="#F7F8F9" />
    <rect x="766" y="332" width="190" height="94" rx="10" fill="#F7F8F9" />

    {/* file-transfer toast with progress */}
    <g filter="url(#px-shadow)"><rect x="700" y="356" width="250" height="66" rx="12" fill="#FFFFFF" /></g>
    <circle cx="730" cy="389" r="14" fill="#FFF1E0" />
    <path d="M730 382 v14 M724 390 l6 6 6-6" stroke="#FF8A00" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <text x="754" y="384" fontFamily={FONT} fontSize="13" fontWeight="600" fill="#1A1D21">report.pdf</text>
    <rect x="754" y="398" width="172" height="7" rx="3.5" fill="rgba(26,29,33,0.10)" />
    <rect x="754" y="398" width="10" height="7" rx="3.5" fill="#FF8A00">
      <animate attributeName="width" values="10;172;172" keyTimes="0;0.8;1" dur="3.2s" repeatCount="indefinite" />
    </rect>

    {/* moving cursor + click ripple */}
    <g>
      <animateMotion path="M560,300 C640,250 720,360 700,220 S500,320 600,240" dur="7s" repeatCount="indefinite" rotate="0" />
      <path d="M0 0 L0 18 L5 13 L9 20 L11 19 L7 12 L14 12 Z" fill="#1A1D21" stroke="#FFFFFF" strokeWidth="1.2" />
    </g>
    <circle cx="600" cy="240" r="0" fill="none" stroke="#FF8A00" strokeWidth="2">
      <animate attributeName="r" values="0;22;0" dur="3.5s" repeatCount="indefinite" />
      <animate attributeName="stroke-opacity" values="0.7;0;0" dur="3.5s" repeatCount="indefinite" />
    </circle>
  </g>
)

// ── Scene 3: Meet, chat & manage team ──────────────────────────────────────────
const TeamTile: React.FC<{ x: number; y: number; initials: string; hue: string; speaking?: boolean }> =
  ({ x, y, initials, hue, speaking }) => (
    <g>
      <g filter="url(#px-shadow)"><rect x={x} y={y} width="220" height="150" rx="14" fill="#FFFFFF" /></g>
      <circle cx={x + 110} cy={y + 60} r="30" fill={hue} />
      <text x={x + 110} y={y + 68} fontFamily={FONT} fontSize="22" fontWeight="700" fill="#FFFFFF" textAnchor="middle">{initials}</text>
      <rect x={x + 74} y={y + 110} width="72" height="10" rx="5" fill="rgba(26,29,33,0.12)" />
      {speaking && (
        <rect x={x + 2} y={y + 2} width="216" height="146" rx="13" fill="none" stroke="#FF8A00" strokeWidth="2.5">
          <animate attributeName="stroke-opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite" />
        </rect>
      )}
      <circle cx={x + 22} cy={y + 128} r="5" fill="#22C55E" />
    </g>
  )

const ChatBubble: React.FC<{ y: number; w: number; align: 'l' | 'r'; begin: string }> = ({ y, w, align, begin }) => {
  const x = align === 'l' ? 904 : 1136 - w
  const fill = align === 'l' ? '#F3F4F6' : 'url(#px-orange)'
  return (
    <g opacity="0">
      <animate attributeName="opacity" values="0;1;1;1" keyTimes="0;0.15;0.9;1" dur="4.5s" begin={begin} repeatCount="indefinite" />
      <animateTransform attributeName="transform" type="translate" values="0 10;0 0;0 0;0 0" keyTimes="0;0.15;0.9;1" dur="4.5s" begin={begin} repeatCount="indefinite" />
      <rect x={x} y={y} width={w} height="34" rx="12" fill={fill} />
      <rect x={x + 14} y={y + 12} width={w - 40} height="8" rx="4" fill={align === 'l' ? 'rgba(26,29,33,0.25)' : 'rgba(255,255,255,0.85)'} />
    </g>
  )
}

const TeamScene: React.FC = () => (
  <g className="px-scene">
    {/* meeting grid */}
    <TeamTile x={316} y={140} initials="AR" hue="#FF8A00" speaking />
    <TeamTile x={560} y={140} initials="JM" hue="#4A6CF7" />
    <TeamTile x={316} y={316} initials="SP" hue="#22C55E" />
    <TeamTile x={560} y={316} initials="DK" hue="#8B5CF6" />

    {/* chat panel */}
    <g filter="url(#px-shadow)"><rect x="864" y="140" width="300" height="326" rx="18" fill="#FFFFFF" /></g>
    <text x="892" y="182" fontFamily={FONT} fontSize="16" fontWeight="600" fill="#1A1D21">Team chat</text>
    <circle cx="1140" cy="176" r="4" fill="#22C55E" />
    <line x1="892" y1="200" x2="1136" y2="200" stroke="rgba(26,29,33,0.07)" />

    <ChatBubble y={222} w={150} align="l" begin="0s" />
    <ChatBubble y={268} w={180} align="r" begin="0.6s" />
    <ChatBubble y={314} w={130} align="l" begin="1.2s" />

    {/* typing indicator */}
    <g transform="translate(904, 372)">
      <rect x="0" y="0" width="70" height="30" rx="12" fill="#F3F4F6" />
      <circle cx="20" cy="15" r="4" fill="rgba(26,29,33,0.35)">
        <animate attributeName="cy" values="15;10;15" dur="1s" begin="0s" repeatCount="indefinite" />
      </circle>
      <circle cx="35" cy="15" r="4" fill="rgba(26,29,33,0.35)">
        <animate attributeName="cy" values="15;10;15" dur="1s" begin="0.15s" repeatCount="indefinite" />
      </circle>
      <circle cx="50" cy="15" r="4" fill="rgba(26,29,33,0.35)">
        <animate attributeName="cy" values="15;10;15" dur="1s" begin="0.3s" repeatCount="indefinite" />
      </circle>
    </g>
  </g>
)

const SCENES = [SessionScene, DeviceScene, TeamScene]

const BrandDiagram: React.FC<{ active: number }> = ({ active }) => {
  const Scene = SCENES[active]
  return (
    <svg width="100%" height="100%" viewBox="0 0 1280 560" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', top: 0, left: 0 }}>
      <defs>
        <linearGradient id="px-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFDFA" />
          <stop offset="100%" stopColor="#FFF1DF" />
        </linearGradient>
        <linearGradient id="px-orange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#FFB347" />
        </linearGradient>
        <filter id="px-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#B25E00" floodOpacity="0.14" />
        </filter>
      </defs>

      <rect width="1280" height="560" fill="url(#px-bg)" />
      <pattern id="px-grid" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M 46 0 L 0 0 0 46" fill="none" stroke="rgba(178,94,0,0.05)" strokeWidth="1" />
      </pattern>
      <rect width="1280" height="560" fill="url(#px-grid)" />

      {/* Keyed so switching tabs remounts → each scene replays its entrance */}
      <g key={active}>
        <Scene />
      </g>
    </svg>
  )
}

const ProductExplainer: React.FC = () => {
  const [active, setActive] = useState(0)

  return (
    <section className="px-section">
      <div className="px-inner">

        {/* Heading */}
        <div className="px-heading">
          <h2 className="px-title">What is Remote365?</h2>
          <p className="px-sub">
            Remote365 is a secure remote access platform that lets you connect to any device from
            anywhere. Start a session with a code, access devices by ID, run meetings, and chat with
            your team — with remote sessions protected by end-to-end encryption.
          </p>
        </div>

        {/* Animated diagram */}
        <div className="px-diagram">
          <BrandDiagram active={active} />
        </div>

        {/* Tabs */}
        <div className="px-tabs">
          {STEPS.map((step, i) => (
            <button
              key={i}
              className={`px-tab${active === i ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              <span className="px-tab-title">{step.title}</span>
              <div className="px-tab-body" style={{
                maxHeight: active === i ? '220px' : '0',
                opacity: active === i ? 1 : 0,
              }}>
                <p className="px-tab-desc">{step.description}</p>
              </div>
            </button>
          ))}
        </div>

      </div>

      <style>{`
        .px-section { background: #FFFFFF; width: 100%; }
        .px-inner {
          max-width: 1214px;
          margin: 0 auto;
          padding: clamp(60px, 8vw, 111px) clamp(20px, 4vw, 40px) clamp(60px, 8vw, 80px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(48px, 6vw, 80px);
        }
        .px-heading {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 20px;
          max-width: 776px;
        }
        .px-title {
          margin: 0;
          font-weight: 600;
          font-size: clamp(2rem, 4vw, 48px);
          line-height: 1.2;
          letter-spacing: -0.96px;
          color: #1A1D21;
        }
        .px-sub {
          margin: 0;
          font-weight: 400;
          font-size: clamp(16px, 1.5vw, 18px);
          line-height: 1.5;
          color: rgba(26, 29, 33, 0.65);
        }

        .px-diagram {
          position: relative;
          width: 100%;
          aspect-ratio: 1280 / 560;
          border-radius: 16px;
          overflow: hidden;
        }
        .px-scene {
          animation: pxSceneIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes pxSceneIn {
          from { opacity: 0; transform: translateY(14px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .px-tabs {
          display: flex;
          align-items: flex-start;
          gap: 38px;
          width: 100%;
        }
        .px-tab {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          text-align: left;
          background: none;
          border: none;
          border-top: 2px solid rgba(26, 29, 33, 0.3);
          padding: 24px 0 0;
          cursor: pointer;
          font-family: inherit;
          transition: border-color 0.3s ease;
        }
        .px-tab.is-active { border-top-color: #FF8A00; }
        .px-tab-title {
          font-weight: 500;
          font-size: 24px;
          line-height: 34px;
          color: rgba(26, 29, 33, 0.45);
          transition: color 0.25s ease;
        }
        .px-tab.is-active .px-tab-title { color: #000000; }
        .px-tab-body {
          overflow: hidden;
          transition: max-height 0.4s ease, opacity 0.3s ease;
        }
        .px-tab-desc {
          margin: 14px 0 0;
          font-weight: 400;
          font-size: 16px;
          line-height: 23px;
          color: #000000;
        }

        @media (max-width: 768px) {
          .px-tabs { flex-direction: column; gap: 0; }
          .px-tab { width: 100%; }
          .px-tab-body { max-height: none !important; opacity: 1 !important; }
        }
      `}</style>
    </section>
  )
}

export default ProductExplainer
