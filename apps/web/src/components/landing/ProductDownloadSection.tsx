import React from 'react'

const ProductDownloadSection: React.FC = () => {
  const platforms = [
    { name: 'android', width: 120 },
    { name: 'iOS', width: 80 },
    { name: 'Synology', width: 140 },
    { name: 'RaspberryPi', width: 160 },
    { name: 'Linux', width: 100 },
    { name: 'Windows', width: 140 },
    { name: 'macOS', width: 100 }
  ]

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '112px 40px',
        width: '100%',
        background: '#FFFFFF'
      }}
    >
      <style>
        {`
          @keyframes downloadMarquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .download-marquee {
            display: flex;
            gap: 0;
            width: fit-content;
            animation: downloadMarquee 30s linear infinite;
          }
          .download-marquee:hover {
            animation-play-state: paused;
          }
        `}
      </style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '125px 40px 110px',
          isolation: 'isolate',
          width: '100%',
          maxWidth: '1360px',
          background: '#FF8A00',
          borderRadius: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Remote365 Icon */}
        <div
          style={{
            position: 'absolute',
            width: '96px',
            height: '96px',
            left: 'calc(50% - 48px)',
            top: 0,
            zIndex: 0
          }}
        >
          <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
            <rect width="96" height="96" rx="12" fill="#111315"/>
            <path d="M32 44h8v8h-8z" fill="#fff"/>
            <path d="M48 44h8v8h-8z" fill="#fff"/>
            <path d="M64 44h8v8h-8z" fill="#fff"/>
            <path d="M32 60h8v8h-8z" fill="#fff" opacity="0.2"/>
            <path d="M48 60h8v8h-8z" fill="#fff"/>
            <path d="M64 60h8v8h-8z" fill="#fff" opacity="0.2"/>
            <path d="M32 28h8v8h-8z" fill="#fff" opacity="0.2"/>
            <path d="M48 28h8v8h-8z" fill="#fff" opacity="0.2"/>
            <path d="M64 28h8v8h-8z" fill="#fff" opacity="0.2"/>
            <rect x="0.5" y="0.5" width="95" height="95" rx="11.5" stroke="rgba(0,0,0,0.08)" fill="none"/>
          </svg>
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            width: '100%',
            maxWidth: '1062px',
            marginTop: '166px',
            zIndex: 1
          }}
        >
          <h2
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 500,
              fontSize: 'clamp(32px, 5vw, 48px)',
              lineHeight: '1.18',
              letterSpacing: '-0.96px',
              color: '#FFFFFF',
              textAlign: 'center',
              margin: 0
            }}
          >
            How can I try Remote365?
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0,
              width: '100%',
              maxWidth: '680px'
            }}
          >
            <p
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: '1.5',
                letterSpacing: '-0.18px',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                margin: 0
              }}
            >
              Remote365 is available for download on all major operating systems, can be installed from the Apple & Google Play app stores, and works directly from your browser.
            </p>
          </div>

          {/* Download Button */}
          <a
            href="#"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '8.32px 18px 9px',
              gap: '11px',
              background: '#FFFFFF',
              border: '1px solid #FFFFFF',
              borderRadius: '8px',
              transition: 'opacity 0.2s',
              marginTop: '40px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <span
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '23px',
                letterSpacing: '-0.16px',
                color: '#111315',
                whiteSpace: 'nowrap'
              }}
            >
              Download now
            </span>
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 9H14M14 9L7 2M14 9L7 16" stroke="#111315" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        {/* Platform Marquee */}
        <div
          style={{
            position: 'absolute',
            height: '104px',
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            zIndex: 1
          }}
        >
          {/* Left fade */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '20%',
              bottom: '20%',
              width: '10%',
              background: 'linear-gradient(90deg, #FF8A00 0%, rgba(23, 81, 52, 0) 100%)',
              zIndex: 2
            }}
          />
          {/* Right fade */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '20%',
              bottom: '20%',
              width: '10%',
              background: 'linear-gradient(270deg, #FF8A00 0%, rgba(23, 81, 52, 0) 100%)',
              zIndex: 2
            }}
          />

          <div className="download-marquee">
            {[...platforms, ...platforms].map((platform, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: platform.width,
                  height: '104px',
                  flexShrink: 0,
                  padding: '0 16px'
                }}
              >
                <span
                  style={{
                    fontFamily: "'Roboto', 'Segoe UI', 'Helvetica Neue', sans-serif",
                    fontWeight: platform.name === 'android' ? 400 : 500,
                    fontSize: platform.name === 'android' ? '18px' : '16px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    letterSpacing: platform.name === 'android' ? '-0.3px' : '0',
                    textTransform: platform.name === 'android' ? 'lowercase' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {platform.name === 'android' ? 'android' : platform.name === 'RaspberryPi' ? 'Raspberry Pi' : platform.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Background decoration */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '241px',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        >
          <svg width="100%" height="241" viewBox="0 0 1360 241" preserveAspectRatio="none" fill="none">
            <path d="M0 80 Q340 160 680 80 T1360 80" stroke="#487961" strokeWidth="1" opacity="0.3" fill="none"/>
            <path d="M0 120 Q340 40 680 120 T1360 120" stroke="#487961" strokeWidth="1" opacity="0.3" fill="none"/>
            <path d="M0 160 Q340 240 680 160 T1360 160" stroke="#487961" strokeWidth="1" opacity="0.3" fill="none"/>
          </svg>
        </div>
      </div>
    </section>
  )
}

export default ProductDownloadSection
