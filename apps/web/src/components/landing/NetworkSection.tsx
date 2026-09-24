import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

const SIZE   = 500
const RADIUS = 210

const BADGES = [
  { ip: '482-761-903',  angle: -90  },
  { ip: '219-045-887',  angle: 180  },
  { ip: '573-302-614',  angle: 0    },
  { ip: '810-556-247',  angle: 90   },
]

interface BadgeProps { ip: string; angle: number }

const Badge: React.FC<BadgeProps> = ({ ip, angle }) => (
  <div style={{
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `rotate(${angle}deg) translateX(${RADIUS}px) rotate(${-angle}deg) translate(-50%, -50%)`,
    zIndex: 2,
  }}>
    <div style={{ animation: 'counter-spin 18s linear infinite' }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '9999px',
        padding: '4px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          background: '#E6E4E2',
          borderRadius: '9999px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px',
        }}>
          <span style={{
            fontFamily: '"SF Mono", "Fira Mono", "Consolas", monospace',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '24px',
            letterSpacing: '-0.18px',
            color: '#111315',
            whiteSpace: 'nowrap',
          }}>
            {ip}
          </span>
        </div>
      </div>
    </div>
  </div>
)

const NetworkSection: React.FC = () => {
  const half = SIZE / 2

  return (
    <section style={{ background: '#FFFFFF', position: 'relative' }}>
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: 'clamp(60px, 8vw, 112px) 40px' }}>

        {/* Circle orbit diagram */}
        <div className="network-orbit-wrapper">
          <div style={{
            position: 'relative',
            width: `${SIZE}px`,
            height: `${SIZE}px`,
          }}>
            <div style={{ position: 'absolute', inset: 0, animation: 'spin 18s linear infinite' }}>
              <div style={{
                position: 'absolute',
                width: `${RADIUS * 2 + 5}px`,
                height: `${RADIUS * 2 + 5}px`,
                left: `${half - RADIUS - 2}px`,
                top: `${half - RADIUS - 2}px`,
                border: '1px solid #E0DDD9',
                borderRadius: '9999px',
              }} />
              <div style={{
                position: 'absolute',
                width: `${RADIUS * 2 - 30}px`,
                height: `${RADIUS * 2 - 30}px`,
                left: `${half - RADIUS + 15}px`,
                top: `${half - RADIUS + 15}px`,
                border: '1px solid #C8C4BE',
                borderRadius: '9999px',
              }} />
              <div style={{
                position: 'absolute',
                width: '225px',
                height: '225px',
                left: `${half - 112}px`,
                top: `${half - 112}px`,
                background: '#F3F4F6',
                borderRadius: '9999px',
              }} />
              {BADGES.map((b) => (
                <Badge key={b.ip} ip={b.ip} angle={b.angle} />
              ))}
            </div>
          </div>
        </div>

        {/* Text content */}
        <div style={{ textAlign: 'center', marginTop: '56px' }}>
          <h2 style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: 'clamp(1.8rem, 4vw, 58px)',
            lineHeight: '1.18',
            letterSpacing: '-1.74px',
            color: '#000000',
            margin: '0 auto 20px',
            maxWidth: '603px',
          }}>
            Remote365 makes remote access easy
          </h2>

          <p style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 400,
            fontSize: 'clamp(16px, 2vw, 20px)',
            lineHeight: '1.5',
            letterSpacing: '-0.2px',
            color: 'rgba(26, 29, 33, 0.65)',
            margin: '0 auto 40px',
            maxWidth: '451px',
          }}>
            Every device gets a unique ID. Share it with anyone and they can connect — no VPN, no port forwarding, no setup.
          </p>

          <RouterLink to="/how-it-works" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
          }}>
            <span style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 500,
              fontSize: '16px',
              lineHeight: '23px',
              letterSpacing: '-0.17px',
              color: '#000000',
            }}>
              How it works
            </span>
            <ExternalLink size={17} color="#000000" />
          </RouterLink>

          <div style={{
            width: '40px',
            height: '4px',
            background: '#111315',
            borderRadius: '4px',
            margin: '48px auto 0',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes counter-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        .network-orbit-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }
        .network-orbit-wrapper > div {
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .network-orbit-wrapper > div {
            transform: scale(0.6);
            transform-origin: center center;
            margin: -100px 0;
          }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .network-orbit-wrapper > div {
            transform: scale(0.8);
            transform-origin: center center;
            margin: -50px 0;
          }
        }
      `}</style>
    </section>
  )
}

export default NetworkSection
