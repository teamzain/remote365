import React from 'react'

const GREEN_DARK  = '#487961'
const GREEN_MID   = '#91BBA6'
const GREEN_LIGHT = '#CAE6D9'
const CARD_BG     = '#F3F4F6'

const IconDeploy = () => (
  <svg width="138" height="103" viewBox="0 0 138 103" fill="none">
    <rect x="16" y="24" width="26" height="55" rx="4" fill={GREEN_DARK} />
    <rect x="56" y="24" width="26" height="55" rx="4" fill={GREEN_MID} />
    <rect x="96" y="24" width="26" height="55" rx="4" fill={GREEN_LIGHT} />
    <rect x="10" y="82" width="118" height="3" rx="1.5" fill={GREEN_MID} opacity="0.4" />
  </svg>
)

const IconInfra = () => (
  <svg width="138" height="103" viewBox="0 0 138 103" fill="none">
    {[0, 1, 2].map(col =>
      [0, 1].map(row => {
        const colors = [[GREEN_DARK, GREEN_LIGHT], [GREEN_MID, GREEN_MID], [GREEN_LIGHT, GREEN_DARK]]
        return (
          <rect
            key={`${col}-${row}`}
            x={16 + col * 38} y={18 + row * 34}
            width="30" height="26" rx="4"
            fill={colors[col][row]}
          />
        )
      })
    )}
  </svg>
)

const IconSecure = () => (
  <svg width="138" height="103" viewBox="0 0 138 103" fill="none">
    <path d="M69 8 L108 24 L108 52 C108 72 90 88 69 95 C48 88 30 72 30 52 L30 24 Z" fill={GREEN_MID} />
    <path d="M69 18 L98 31 L98 52 C98 67 85 80 69 86 C53 80 40 67 40 52 L40 31 Z" fill={GREEN_DARK} />
    <path d="M55 51 L65 61 L83 43" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

interface CardProps { icon: React.ReactNode; title: string; description: string }

const FeatureCard: React.FC<CardProps> = ({ icon, title, description }) => (
  <div style={{
    flex: 1,
    minWidth: '220px',
    background: CARD_BG,
    borderRadius: '12px',
    padding: 'clamp(40px, 5vw, 76px) clamp(20px, 3vw, 37px) 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  }}>
    <div style={{ marginBottom: '24px' }}>{icon}</div>

    <h3 style={{
      fontFamily: "'Mona Sans', sans-serif",
      fontWeight: 400,
      fontSize: 'clamp(20px, 2vw, 28px)',
      lineHeight: '1.2',
      letterSpacing: '-0.56px',
      color: '#111315',
      margin: '0 0 20px 0',
    }}>
      {title}
    </h3>

    <p style={{
      fontFamily: "'Mona Sans', sans-serif",
      fontWeight: 400,
      fontSize: 'clamp(15px, 1.5vw, 18px)',
      lineHeight: '1.5',
      letterSpacing: '-0.18px',
      color: '#787676',
      margin: 0,
    }}>
      {description}
    </p>
  </div>
)

interface StatProps { value: string; label: string }
const Stat: React.FC<StatProps> = ({ value, label }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      fontFamily: "'Mona Sans', sans-serif",
      fontWeight: 500,
      fontSize: 'clamp(2rem, 5vw, 72px)',
      lineHeight: '1.18',
      letterSpacing: '-2.16px',
      color: '#000000',
    }}>
      {value}
    </div>
    <div style={{
      fontFamily: "'Mona Sans', sans-serif",
      fontWeight: 400,
      fontSize: 'clamp(14px, 1.5vw, 18px)',
      lineHeight: '1.5',
      letterSpacing: '-0.18px',
      color: '#787676',
    }}>
      {label}
    </div>
  </div>
)

const SimplePowerfulSection: React.FC = () => (
  <section style={{ background: '#FFFFFF' }}>
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: 'clamp(60px, 8vw, 112px) clamp(20px, 4vw, 40px)' }}>

      <h2 style={{
        fontFamily: "'Mona Sans', sans-serif",
        fontWeight: 500,
        fontSize: 'clamp(1.8rem, 3.5vw, 48px)',
        lineHeight: '1.18',
        letterSpacing: '-0.96px',
        color: '#000000',
        margin: '0 0 48px 0',
        maxWidth: '648px',
      }}>
        Simple, powerful, and reliable
      </h2>

      {/* Three cards */}
      <div className="sps-cards">
        <FeatureCard
          icon={<IconDeploy />}
          title="Up in minutes"
          description="Install Remote365, register your device, and start accepting remote connections — no IT department needed."
        />
        <FeatureCard
          icon={<IconInfra />}
          title="Any device, any OS"
          description="Remote365 runs on Windows, macOS, Linux, iOS, and Android. Support and access devices across every platform."
        />
        <FeatureCard
          icon={<IconSecure />}
          title="Encrypted end-to-end"
          description="Every remote session is protected with end-to-end encryption. Role-based access control keeps your devices safe."
        />
      </div>

      {/* Stats row */}
      <div className="sps-stats">
        <Stat value="3 mins"  label="to set up remote access" />
        <Stat value="2.5m"    label="remote sessions monthly" />
        <Stat value="4k+"     label="teams using Remote365" />
      </div>

    </div>

    <style>{`
      .sps-cards {
        display: flex;
        gap: 24px;
        margin-bottom: 72px;
        flex-wrap: wrap;
      }
      .sps-stats {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        flex-wrap: wrap;
        padding: 0 clamp(0px, 3vw, 40px);
      }
      @media (max-width: 768px) {
        .sps-cards {
          flex-direction: column;
        }
        .sps-stats {
          justify-content: center;
          gap: 32px;
          padding: 0;
        }
      }
    `}</style>
  </section>
)

export default SimplePowerfulSection
