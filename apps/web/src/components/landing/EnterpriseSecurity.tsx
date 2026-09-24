import React from 'react'

const ArrowRightIcon: React.FC<{ color?: string }> = ({ color = '#FFFFFF' }) => (
  <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
    <path
      d="M3 9H13M13 9L8.5 4.5M13 9L8.5 13.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ExternalIcon: React.FC<{ color?: string }> = ({ color = '#000000' }) => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path
      d="M4.25 12.75L12.75 4.25M12.75 4.25H6.375M12.75 4.25V10.625"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const EnterpriseSecurity: React.FC = () => {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 40px',
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
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          minHeight: '615px',
          gap: '24px'
        }}
      >
        {/* Left Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            maxWidth: '528px',
            paddingLeft: '12px'
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
              margin: '0 0 24px 0',
              maxWidth: '345px'
            }}
          >
            Our commitment to security
          </h2>
          <p
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
              letterSpacing: '-0.18px',
              color: 'rgba(26, 29, 33, 0.65)',
              margin: '0 0 42px 0',
              maxWidth: '490px'
            }}
          >
            We have a deep commitment to keeping your data safe. Our connections are end-to-end
            encrypted with WireGuard®, a modern VPN designed for usability, performance, and
            security. You can keep up-to-date with the latest updates via our Security Bulletins
            below.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '30px'
            }}
          >
            {/* Security Button */}
            <button
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '8px 18px 9px',
                gap: '11px',
                background: '#111315',
                border: '1px solid #111315',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <span
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: '16px',
                  color: '#FFFFFF',
                  letterSpacing: '-0.16px'
                }}
              >
                Security
              </span>
              <ArrowRightIcon />
            </button>

            {/* Bulletins Link */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                borderBottom: '1.5px solid #111315',
                paddingBottom: '2px'
              }}
            >
              <span
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: '16px',
                  color: '#000000',
                  letterSpacing: '-0.17px'
                }}
              >
                Bulletins
              </span>
              <ExternalIcon />
            </div>
          </div>
        </div>

        {/* Right Illustration */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            height: '615px',
            maxWidth: '728px'
          }}
        >
          <img
            src="/enterprise_security_illustration.png"
            alt="Security Illustration"
            style={{
              width: '605px',
              height: 'auto',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
        </div>
      </div>
    </section>
  )
}

export default EnterpriseSecurity
