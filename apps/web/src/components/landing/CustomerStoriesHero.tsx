import React from 'react'

const ArrowDownIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 16 18" fill="none" style={{ transform: 'rotate(90deg)' }}>
    <path
      d="M3 9H13M13 9L8.5 4.5M13 9L8.5 13.5"
      stroke="#111315"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// ── Company Logo SVGs ─────────────────────────────────────────────────────────

const VercelLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <path d="M10 5L20 25H0L10 5Z" fill="#000000" />
    <text x="25" y="22" fontFamily="Inter" fontWeight="700" fontSize="16" fill="#000000">VERCEL</text>
  </svg>
)

const OpenAILogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <circle cx="10" cy="15" r="8" stroke="#000000" strokeWidth="2" fill="none" />
    <text x="25" y="22" fontFamily="Inter" fontWeight="700" fontSize="16" fill="#000000">OpenAI</text>
  </svg>
)

const FigmaLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <circle cx="5" cy="5" r="5" fill="#F24E1E" />
    <circle cx="15" cy="5" r="5" fill="#FF7262" />
    <circle cx="5" cy="15" r="5" fill="#A259FF" />
    <circle cx="15" cy="15" r="5" fill="#1ABCFE" />
    <circle cx="5" cy="25" r="5" fill="#0ACF83" />
    <text x="30" y="22" fontFamily="Inter" fontWeight="700" fontSize="16" fill="#000000">Figma</text>
  </svg>
)

const StripeLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <text x="0" y="22" fontFamily="Inter" fontWeight="800" fontSize="22" fill="#635BFF">stripe</text>
  </svg>
)

const NotionLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <rect x="0" y="5" width="20" height="20" rx="4" fill="#000000" />
    <text x="4" y="22" fontFamily="serif" fontWeight="900" fontSize="18" fill="#FFFFFF">N</text>
    <text x="25" y="22" fontFamily="Inter" fontWeight="700" fontSize="16" fill="#000000">Notion</text>
  </svg>
)

const GitHubLogo = () => (
  <svg width="120" height="30" viewBox="0 0 24 24" fill="#000000" style={{ transform: 'scale(1.2)' }}>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 1.5 0 0 1 3.01-.41c1.02 0 2.05.14 3.01.41 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

const SlackLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <rect x="0" y="5" width="8" height="8" rx="4" fill="#E01E5A" />
    <rect x="10" y="5" width="8" height="8" rx="4" fill="#36C5F0" />
    <rect x="0" y="15" width="8" height="8" rx="4" fill="#2EB67D" />
    <rect x="10" y="15" width="8" height="8" rx="4" fill="#ECB22E" />
    <text x="25" y="22" fontFamily="Inter" fontWeight="800" fontSize="18" fill="#000000">slack</text>
  </svg>
)

const ShopifyLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <path d="M15 5L18 25H5L8 5H15Z" fill="#95BF47" />
    <text x="25" y="22" fontFamily="Inter" fontWeight="700" fontSize="16" fill="#000000">Shopify</text>
  </svg>
)

const AirbnbLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <path d="M10 5C5 15 0 25 10 25C20 25 15 15 10 5Z" stroke="#FF5A5F" strokeWidth="2" fill="none" />
    <text x="25" y="22" fontFamily="Inter" fontWeight="700" fontSize="16" fill="#FF5A5F">airbnb</text>
  </svg>
)

const GenericLogo = ({ text, color = '#242424' }: { text: string; color?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
    <span style={{ color, fontWeight: 700, fontSize: '16px', fontFamily: "'Mona Sans', sans-serif", textTransform: 'uppercase' }}>
      {text}
    </span>
  </div>
)

interface LogoCardProps {
  bg: string
  height: number
  top?: number
  left?: number
  right?: number
  bottom?: number
  children: React.ReactNode
}

const CustomerLogoCard: React.FC<LogoCardProps> = ({ bg, height, top, left, right, bottom, children }) => (
  <div
    style={{
      position: 'absolute',
      width: '211px',
      height: `${height}px`,
      background: bg,
      borderRadius: '6px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      top,
      left,
      right,
      bottom,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s ease',
      cursor: 'pointer'
    }}
    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-5px)')}
    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
  >
    {children}
  </div>
)

const CustomerStoriesHero: React.FC = () => {
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
          position: 'relative',
          width: '100%',
          maxWidth: '1440px', // Increased width
          height: '968px',
          background: '#15315B',
          borderRadius: '15px',
          marginTop: '40px',
          overflow: 'hidden'
        }}
      >
        {/* Text Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '1136px',
            margin: '116px auto 0',
            gap: '20px'
          }}
        >
          <div style={{ maxWidth: '610px' }}>
            <h1
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 500,
                fontSize: '48px',
                lineHeight: '57px',
                letterSpacing: '-0.96px',
                color: '#FFFFFF',
                margin: 0
              }}
            >
              Customer stories
            </h1>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '20px',
              maxWidth: '400px'
            }}
          >
            <p
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 400,
                fontSize: '20px',
                lineHeight: '30px',
                letterSpacing: '-0.2px',
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0
              }}
            >
              See how Remote365 simplifies networking, and brings peace-of-mind for teams of every
              size.
            </p>
            <button
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '8px 17px 9px 18px',
                gap: '10px',
                background: '#FFFFFF',
                border: '1px solid #FFFFFF',
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
                  color: '#111315',
                  letterSpacing: '-0.16px'
                }}
              >
                See all customers
              </span>
              <ArrowDownIcon />
            </button>
          </div>
        </div>

        {/* Logos Section */}
        <div
          style={{
            position: 'absolute',
            top: '407px',
            left: '40px',
            right: '40px',
            height: '609px'
          }}
        >
          {/* Column 1 */}
          <CustomerLogoCard bg="#AAC6F1" height={88} top={-50} left={0}>
            <GenericLogo text="MERCARI" color="#1F1F30" />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#AAC6F1" height={145} top={58} left={0}>
            <GenericLogo text="REVERB" color="#1F1F30" />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#DEE8F6" height={174} top={223} left={0}>
            <VercelLogo />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#FFFFFF" height={145} top={417} left={0}>
            <GenericLogo text="WAGTAIL" />
          </CustomerLogoCard>

          {/* Column 2 */}
          <CustomerLogoCard bg="#FFFFFF" height={116} top={150} left={235}>
            <OpenAILogo />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#DEE8F6" height={174} top={286} left={235}>
            <StripeLogo />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#FFFFFF" height={116} top={480} left={235}>
            <GenericLogo text="GHOST" />
          </CustomerLogoCard>

          {/* Column 3 */}
          <CustomerLogoCard bg="#FFFFFF" height={130} top={100} left={470}>
            <FigmaLogo />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#DEE8F6" height={101} top={250} left={470}>
            <NotionLogo />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#FFFFFF" height={87} top={371} left={470}>
            <GenericLogo text="HEROKU" color="#6762A6" />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#AAC6F1" height={116} top={478} left={470}>
            <GenericLogo text="NETLIFY" color="#00AD9F" />
          </CustomerLogoCard>

          {/* Column 4 */}
          <CustomerLogoCard bg="#DEE8F6" height={173} top={200} left={705}>
            <GenericLogo text="VIMEO" color="#1AB7EA" />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#DEE8F6" height={173} top={393} left={705}>
            <AirbnbLogo />
          </CustomerLogoCard>

          {/* Column 5 */}
          <CustomerLogoCard bg="#AAC6F1" height={145} top={200} left={940}>
            <GitHubLogo />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#FFFFFF" height={173} top={365} left={940}>
            <SlackLogo />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#DEE8F6" height={88} top={558} left={940}>
            <GenericLogo text="ZOOM" color="#2D8CFF" />
          </CustomerLogoCard>

          {/* Column 6 */}
          <CustomerLogoCard bg="#AAC6F1" height={88} top={150} left={1175}>
            <GenericLogo text="DRIP" color="#000000" />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#AAC6F1" height={88} top={258} left={1175}>
            <GenericLogo text="HUBSPOT" color="#FF7A59" />
          </CustomerLogoCard>
          <CustomerLogoCard bg="#AAC6F1" height={145} top={366} left={1175}>
            <ShopifyLogo />
          </CustomerLogoCard>
        </div>

        {/* Bottom Gradient Fade */}
        <div
          style={{
            position: 'absolute',
            height: '239px',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(0deg, #15315B 0%, rgba(21, 49, 91, 0) 100%)',
            borderRadius: '0px 0px 15px 15px',
            pointerEvents: 'none'
          }}
        />
      </div>
    </section>
  )
}

export default CustomerStoriesHero
