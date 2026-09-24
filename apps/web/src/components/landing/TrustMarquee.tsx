import React from 'react'

const W = 'rgba(255,255,255,0.85)'

const WindowsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={W}>
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
  </svg>
)

const AppleIcon = () => (
  <svg width="20" height="24" viewBox="0 0 24 29" fill={W}>
    <path d="M18.71 21.8c-.72.97-1.47 1.94-2.58 1.96-1.11.02-1.46-.66-2.73-.66-1.27 0-1.66.64-2.73.68-1.07.04-1.88-1.03-2.61-1.99C5.71 18.37 5 14.65 6.58 12.11c.79-1.27 2.21-2.07 3.74-2.09 1.1-.02 2.14.74 2.81.74s1.93-.91 3.24-.78c.55.03 2.1.22 3.09 1.68-.08.05-1.84 1.08-1.82 3.22.02 2.55 2.24 3.4 2.27 3.41-.03.09-.35 1.2-1.2 2.52ZM13 3.5c.67-.8 1.67-1.39 2.6-1.44.13 1.04-.31 2.09-.92 2.84-.62.75-1.57 1.35-2.53 1.27-.15-1.01.34-2.05.85-2.67Z" />
  </svg>
)

const AndroidIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={W}>
    <path d="M17.6 9.48l1.84-3.18c.1-.17.05-.39-.12-.48-.17-.1-.38-.05-.48.12l-1.87 3.22C15.89 8.66 14 8.25 12 8.25s-3.89.41-4.97 1.01L5.16 6.04c-.1-.17-.31-.22-.48-.12-.17.1-.22.31-.12.48L6.4 9.48C3.87 10.79 2.3 13.32 2 16h20c-.3-2.68-1.87-5.21-4.4-6.52ZM8.5 13.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
  </svg>
)

const LinuxIcon = () => (
  <svg width="20" height="24" viewBox="0 0 24 28" fill={W}>
    <path d="M12 1C9.24 1 7 3.69 7 7c0 1.85.6 3.5 1.56 4.67C7.2 13.1 6 15.3 6 17.5c0 .69.07 1.36.2 2H4.5c-.83 0-1.5.67-1.5 1.5S3.67 22.5 4.5 22.5h15c.83 0 1.5-.67 1.5-1.5S20.33 19.5 19.5 19.5h-1.7c.13-.64.2-1.31.2-2 0-2.2-1.2-4.4-2.56-5.83C16.4 10.5 17 8.85 17 7c0-3.31-2.24-6-5-6Zm0 2c1.66 0 3 1.79 3 4s-1.34 4-3 4-3-1.79-3-4 1.34-4 3-4Zm0 9c2.21 0 4 2.69 4 5.5 0 .69-.1 1.37-.27 2H8.27A9.36 9.36 0 0 1 8 17.5C8 14.69 9.79 12 12 12Z" />
  </svg>
)

const ChromeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="4" fill={W} />
    <path d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-4.33 2.5" stroke={W} strokeWidth="1.8" fill="none" />
    <path d="M2.46 7.5A10 10 0 0 0 2 12a10 10 0 0 0 5.34 8.82L9.67 17A5 5 0 0 1 7 12" stroke={W} strokeWidth="1.8" fill="none" />
    <path d="M12 22a10 10 0 0 0 8.66-5H14.33A5 5 0 0 1 7 14.5" stroke={W} strokeWidth="1.8" fill="none" />
  </svg>
)

const RaspberryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={W}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 18c0-4.42 3.58-8 8-8s8 3.58 8 8H4Z" />
    <circle cx="8" cy="4" r="1.5" />
    <circle cx="16" cy="4" r="1.5" />
  </svg>
)

const IOSIcon = () => (
  <svg width="28" height="14" viewBox="0 0 36 14" fill={W}>
    <text x="0" y="12" fontFamily="Inter,sans-serif" fontWeight="700" fontSize="13" letterSpacing="-0.3">iOS</text>
  </svg>
)

const PLATFORMS = [
  { label: 'Windows',   Icon: WindowsIcon   },
  { label: 'macOS',     Icon: AppleIcon     },
  { label: 'iOS',       Icon: IOSIcon       },
  { label: 'Android',   Icon: AndroidIcon   },
  { label: 'Linux',     Icon: LinuxIcon     },
  { label: 'Chrome OS', Icon: ChromeIcon    },
  { label: 'Raspberry Pi', Icon: RaspberryIcon },
]

const TrustMarquee: React.FC = () => (
  <section style={{ background: '#FF8A00', width: '100%', overflow: 'hidden' }}>
    <div style={{ height: '66px', position: 'relative', overflow: 'hidden' }}>

      {/* Fade edges */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, #FF8A00 0%, transparent 14%, transparent 86%, #FF8A00 100%)',
        zIndex: 10,
        pointerEvents: 'none',
      }} />

      {/* Scrolling track */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        animation: 'trust-marquee 28s linear infinite',
        width: 'max-content',
        height: '100%',
      }}>
        {[...PLATFORMS, ...PLATFORMS].map(({ label, Icon }, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 40px',
            height: '66px',
            flexShrink: 0,
          }}>
            <Icon />
            <span style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '-0.2px',
              color: 'rgba(255,255,255,0.75)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>

    <style>{`
      @keyframes trust-marquee {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
    `}</style>
  </section>
)

export default TrustMarquee
