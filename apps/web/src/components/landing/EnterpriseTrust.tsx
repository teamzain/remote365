import React from 'react'

// ── Company logo SVGs (derived from Figma color signatures) ───────────────────

// Logo 1: Dark two-tone wordmark (#1F1F30) — Expensify-style
const Logo1: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    <text x="9" y="50" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="28"
      letterSpacing="-1" fill="#1F1F30">Expensify</text>
  </svg>
)

// Logo 2: Shopify (#003D29 dark green + #0AAD0A bright green + #FF7009 orange bag)
const Logo2: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    {/* Shopping bag icon */}
    <rect x="12" y="22" width="26" height="30" rx="3" fill="#003D29" />
    <path d="M18 22 Q18 13 25 13 Q32 13 32 22" stroke="#003D29" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <rect x="18" y="35" width="14" height="2" rx="1" fill="#0AAD0A" />
    {/* Wordmark */}
    <text x="45" y="47" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="22"
      letterSpacing="-0.5" fill="#003D29">Shopify</text>
  </svg>
)

// Logo 3: Duolingo (#58CC02 green + #F49000 orange owl)
const Logo3: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    {/* Owl simplified */}
    <circle cx="25" cy="32" r="16" fill="#58CC02" />
    <circle cx="20" cy="29" r="4" fill="#FFFFFF" />
    <circle cx="30" cy="29" r="4" fill="#FFFFFF" />
    <circle cx="20" cy="29" r="2" fill="#1A1A1A" />
    <circle cx="30" cy="29" r="2" fill="#1A1A1A" />
    <path d="M20 36 Q25 40 30 36" stroke="#F49000" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <rect x="13" y="44" width="24" height="5" rx="2.5" fill="#F49000" />
    {/* Wordmark */}
    <text x="48" y="47" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="22"
      letterSpacing="-0.5" fill="#222222">duolingo</text>
  </svg>
)

// Logo 4: Dark wordmark (#222222) — GitHub-style
const Logo4: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    <svg x="12" y="20" width="36" height="36" viewBox="0 0 24 24" fill="#222222">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3.01-.41c1.02 0 2.05.14 3.01.41 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"
        fill="#222222"/>
    </svg>
    <text x="55" y="47" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="22"
      letterSpacing="-0.5" fill="#222222">GitHub</text>
  </svg>
)

// Logo 5: Dark wordmark (#262626) — Notion-style
const Logo5: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    {/* Notion N icon */}
    <rect x="12" y="18" width="30" height="36" rx="5" fill="#262626" />
    <text x="18" y="46" fontFamily="serif" fontWeight="900" fontSize="22" fill="#FFFFFF">N</text>
    {/* Wordmark */}
    <text x="50" y="47" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="22"
      letterSpacing="-0.5" fill="#262626">Notion</text>
  </svg>
)

// Logo 6: Stripe purple gradient wordmark
const Logo6: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    <defs>
      <linearGradient id="stripeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#635BFF"/>
        <stop offset="100%" stopColor="#8B85FF"/>
      </linearGradient>
    </defs>
    <text x="20" y="50" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="30"
      letterSpacing="-1" fill="url(#stripeGrad)">stripe</text>
  </svg>
)

// Logo 7: Figma multi-color icon + wordmark
const Logo7: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    {/* Figma icon simplified */}
    <rect x="14" y="18"  width="16" height="16" rx="8" fill="#F24E1E" />
    <rect x="30" y="18"  width="16" height="16" rx="8" fill="#FF7262" />
    <rect x="14" y="34"  width="16" height="16" rx="8" fill="#A259FF" />
    <circle cx="38" cy="42" r="8" fill="#1ABCFE" />
    <rect x="14" y="50"  width="16" height="16" rx="8" fill="#0ACF83" />
    <text x="54" y="50" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="22"
      letterSpacing="-0.5" fill="#242424">Figma</text>
  </svg>
)

// Logo 8: Vercel black wordmark
const Logo8: React.FC = () => (
  <svg width="199" height="81" viewBox="0 0 199 81" fill="none">
    <polygon points="14,54 31,22 48,54" fill="#000000" />
    <text x="57" y="50" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="22"
      letterSpacing="-0.5" fill="#000000">Vercel</text>
  </svg>
)

const LOGOS = [Logo1, Logo2, Logo3, Logo4, Logo5, Logo6, Logo7, Logo8]

// ── Marquee strip ─────────────────────────────────────────────────────────────
const MarqueeStrip: React.FC = () => (
  <>
    <style>{`
      @keyframes marquee-scroll {
        from { transform: translateX(0); }
        to   { transform: translateX(-50%); }
      }
      .marquee-track {
        display: flex;
        flex-direction: row;
        align-items: center;
        animation: marquee-scroll 30s linear infinite;
        width: max-content;
      }
      .marquee-track:hover {
        animation-play-state: paused;
      }
    `}</style>

    {/* Fade masks */}
    <div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '82px' }}>
      {/* Left fade */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '160px', zIndex: 2,
        background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none',
      }} />
      {/* Right fade */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '160px', zIndex: 2,
        background: 'linear-gradient(270deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none',
      }} />

      <div className="marquee-track">
        {/* Render twice for seamless loop */}
        {[...LOGOS, ...LOGOS].map((LogoComp, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 35px',
              flexShrink: 0,
              opacity: 0.75,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
          >
            <LogoComp />
          </div>
        ))}
      </div>
    </div>
  </>
)

// ── Main component ─────────────────────────────────────────────────────────────
const EnterpriseTrust: React.FC = () => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '56px 40px 0',
      background: '#FFFFFF',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '0 40px',
        width: '100%',
        maxWidth: '1280px',
        gap: '32px',
      }}
    >
      {/* Heading */}
      <div style={{ width: '100%', textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: '24px',
            lineHeight: '34px',
            letterSpacing: '-0.48px',
            color: '#787676',
            margin: 0,
          }}
        >
          Trusted by 4,000+ companies
        </h2>
      </div>

      {/* Scrolling logo strip */}
      <div style={{ width: '100%', overflow: 'hidden' }}>
        <MarqueeStrip />
      </div>
    </div>
  </section>
)

export default EnterpriseTrust
