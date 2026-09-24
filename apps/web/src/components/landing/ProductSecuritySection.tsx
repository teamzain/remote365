import React from 'react'

const TimelineNode: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="10" fill="#15315B" stroke="#FFFFFF" strokeWidth="2" />
    <circle cx="11" cy="11" r="4" fill="#AAC6F1" />
  </svg>
)

interface SecurityFeatureProps {
  title: string
  description: string
  lineHeight: number
}

const SecurityFeature: React.FC<SecurityFeatureProps> = ({ title, description, lineHeight }) => (
  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
    {/* Node at the top */}
    <div style={{ zIndex: 2, marginLeft: '9px' }}>
      <TimelineNode />
    </div>

    {/* Vertical Line */}
    <div
      style={{
        width: '1px',
        height: `${lineHeight}px`,
        background: '#111315',
        marginLeft: '20px',
        marginTop: '-2px'
      }}
    />

    {/* Text at the bottom of the line */}
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingLeft: '21px',
        marginTop: '20px',
        marginBottom: '80px'
      }}
    >
      <h3
        style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 500,
          fontSize: '24px',
          lineHeight: '34px',
          letterSpacing: '-0.48px',
          color: '#111315',
          margin: 0
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: '24px',
          letterSpacing: '-0.16px',
          color: 'rgba(26, 29, 33, 0.65)',
          maxWidth: '310px',
          margin: 0
        }}
      >
        {description}
      </p>
    </div>
  </div>
)

const ProductSecuritySection: React.FC = () => {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '112px 80px',
        background: '#FFFFFF',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
          maxWidth: '1280px',
          position: 'relative'
        }}
      >
        {/* Left Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            width: '586px',
            gap: '45px'
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
              marginBottom: '40px'
            }}
          >
            Bolster your organization’s security posture
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '444px'
            }}
          >
            <SecurityFeature
              lineHeight={347}
              title="End-to-end encryption"
              description="Modern WireGuard® encryption protocols protect data at rest and in transit."
            />
            <SecurityFeature
              lineHeight={478}
              title="Microsegmentation"
              description="Any connection on the network between user, node, or service must be explicitly authorized in access control lists (ACLs)."
            />
            <SecurityFeature
              lineHeight={502}
              title="Visibility into your network"
              description="Record and stream audit logs to your SIEM to surface any anomalous activity."
            />
          </div>
        </div>

        {/* Right Column - Sticky Illustration */}
        <div
          style={{
            position: 'sticky',
            top: '120px',
            width: '625px',
            height: '615px',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 32px 64px rgba(0,0,0,0.12)',
            background: '#15315B',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}
        >
          <img
            src="/configuration_logs.png"
            alt="Configuration Logs Dashboard"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '10px'
            }}
          />
        </div>
      </div>
    </section>
  )
}

export default ProductSecuritySection
