import React from 'react'

const RowIcon1: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 42 42" fill="none">
    <rect x="2.4" y="2.4" width="37.2" height="37.2" rx="18.6" fill="#922F10" stroke="#FFFFFF" strokeWidth="2.6" />
    <rect x="13" y="12" width="15" height="8" fill="#F0AA94" />
    <rect x="13" y="20" width="15" height="8" fill="#F7D1C4" />
  </svg>
)

const RowIcon2: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 42 42" fill="none">
    <rect x="2.4" y="2.4" width="37.2" height="37.2" rx="18.6" fill="#15315B" stroke="#FFFFFF" strokeWidth="2.6" />
    <rect x="13" y="10" width="14" height="10" fill="#AAC6F1" />
    <rect x="13" y="20" width="14" height="10" fill="#DEE8F6" />
  </svg>
)

const RowIcon3: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 42 42" fill="none">
    <rect x="2.4" y="2.4" width="37.2" height="37.2" rx="18.6" fill="#815500" stroke="#FFFFFF" strokeWidth="2.6" />
    <rect x="12" y="12" width="18" height="18" fill="#FADC71" />
    <rect x="12" y="12" width="9" height="9" fill="#FFF4CB" />
  </svg>
)

interface RowProps {
  imagePath: string
  title: string
  description: string
  Icon: React.FC
  isLast?: boolean
}

const FeatureRow: React.FC<RowProps> = ({ imagePath, title, description, Icon, isLast }) => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      maxWidth: '1200px',
      display: 'flex',
      minHeight: '568px',
      marginBottom: isLast ? '0' : '160px',
    }}
  >
    {/* Left Side: Image container */}
    <div style={{ width: '573px', flexShrink: 0 }}>
      <div
        style={{
          width: '100%',
          height: '568px',
          background: 'rgba(73, 100, 149, 0.1)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <img
          src={imagePath}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    </div>

    {/* Center Line and Dot */}
    <div
      style={{
        position: 'relative',
        width: '85px',
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: isLast ? '0' : '-160px',
          width: '1px',
          background: '#000000',
        }}
      />
      <div
        style={{
          position: 'sticky',
          top: '50vh',
          marginTop: '-17px',
          width: '34px',
          height: '34px',
          background: '#FFFFFF',
          borderRadius: '50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2,
        }}
      >
        <Icon />
      </div>
    </div>

    {/* Right Side: Text content */}
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingLeft: '48px',
      }}
    >
      <h2
        style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 500,
          fontSize: '36px',
          lineHeight: '42px',
          letterSpacing: '-0.72px',
          color: '#000000',
          marginBottom: '24px',
          marginTop: 0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: '27px',
          letterSpacing: '-0.18px',
          color: 'rgba(26, 29, 33, 0.65)',
          maxWidth: '535px',
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  </div>
)

const EnterpriseScales: React.FC = () => {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '112px 40px',
        background: '#FFFFFF',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1280px',
        }}
      >
        {/* Heading Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '21px',
            marginBottom: '80px',
            textAlign: 'center',
            maxWidth: '624px',
          }}
        >
          <h2
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 500,
              fontSize: '48px',
              lineHeight: '57px',
              letterSpacing: '-0.96px',
              color: '#000000',
              margin: 0,
            }}
          >
            Remote365 scales with you
          </h2>
          <p
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
              letterSpacing: '-0.18px',
              color: 'rgba(26, 29, 33, 0.65)',
              margin: 0,
            }}
          >
            Remote365 is designed with connectivity, control, and security in mind so
            you’ll always be one step ahead.
          </p>
        </div>

        {/* Rows */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            alignItems: 'center',
          }}
        >
          <FeatureRow
            imagePath="/1.png"
            title="Direct connectivity"
            description="Establish point-to-point connections between nodes for better performance and reduce latency. Every connection is encrypted end-to-end with Wireguard®"
            Icon={RowIcon1}
          />
          <FeatureRow
            imagePath="/2.png"
            title="Identity-based"
            description="Remote365 integrates with your existing identity provider to enable single sign on, provide a seamless onboarding experience, and enforce multi-factor authentication."
            Icon={RowIcon2}
          />
          <FeatureRow
            imagePath="/3.png"
            title="Overlay network"
            description="Manage network-level access to sensitive resources and environments, and reliably connect across complex firewall configurations. Audit activity to ensure network health and security."
            Icon={RowIcon3}
            isLast={true}
          />
        </div>
      </div>
    </section>
  )
}

export default EnterpriseScales
