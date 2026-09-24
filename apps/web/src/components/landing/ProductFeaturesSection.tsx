import React from 'react'

const ProductFeaturesSection: React.FC = () => {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 40px 112px',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        background: '#FFFFFF'
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
          gap: '80px'
        }}
      >
        {/* Network Diagram Illustration */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1200px',
            height: '560px',
            borderRadius: '20px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #5F987C 0%, #487961 50%, #FF8A00 100%)'
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1280 560"
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {/* Background shapes */}
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#5F987C"/>
                <stop offset="50%" stopColor="#487961"/>
                <stop offset="100%" stopColor="#FF8A00"/>
              </linearGradient>
            </defs>
            <rect width="1280" height="560" fill="url(#bgGrad)"/>

            {/* Connection lines - white */}
            <line x1="320" y1="280" x2="580" y2="280" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>
            <line x1="700" y1="280" x2="960" y2="280" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>
            <line x1="640" y1="120" x2="640" y2="220" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>
            <line x1="640" y1="340" x2="640" y2="440" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>
            <line x1="380" y1="160" x2="580" y2="240" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>
            <line x1="700" y1="240" x2="900" y2="160" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>
            <line x1="380" y1="400" x2="580" y2="320" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>
            <line x1="700" y1="320" x2="900" y2="400" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6"/>

            {/* Central 9-dot grid */}
            <g transform="translate(590, 230)">
              <rect x="0" y="0" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="35" y="0" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="70" y="0" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="0" y="35" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="35" y="35" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="70" y="35" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="0" y="70" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="35" y="70" width="30" height="30" rx="4" fill="#111315"/>
              <rect x="70" y="70" width="30" height="30" rx="4" fill="#111315"/>
              {/* White dots inside */}
              <circle cx="15" cy="15" r="3" fill="#FFFFFF"/>
              <circle cx="50" cy="15" r="3" fill="#FFFFFF"/>
              <circle cx="85" cy="15" r="3" fill="#FFFFFF"/>
              <circle cx="15" cy="50" r="3" fill="#FFFFFF"/>
              <circle cx="50" cy="50" r="3" fill="#FFFFFF" opacity="0.2"/>
              <circle cx="85" cy="50" r="3" fill="#FFFFFF"/>
              <circle cx="15" cy="85" r="3" fill="#FFFFFF" opacity="0.2"/>
              <circle cx="50" cy="85" r="3" fill="#FFFFFF" opacity="0.2"/>
              <circle cx="85" cy="85" r="3" fill="#FFFFFF" opacity="0.2"/>
            </g>

            {/* Device A - Left */}
            <g transform="translate(180, 240)">
              <rect x="0" y="0" width="120" height="80" rx="8" fill="#FFFFFF"/>
              <rect x="10" y="10" width="100" height="60" rx="4" fill="#242424"/>
              <rect x="45" y="85" width="30" height="8" rx="2" fill="#FFFFFF"/>
            </g>

            {/* Device B - Top */}
            <g transform="translate(590, 40)">
              <rect x="0" y="0" width="60" height="100" rx="8" fill="#FFFFFF"/>
              <rect x="5" y="10" width="50" height="75" rx="4" fill="#242424"/>
              <circle cx="30" cy="92" r="4" fill="#242424"/>
            </g>

            {/* Device C - Bottom Left */}
            <g transform="translate(200, 420)">
              <rect x="0" y="0" width="100" height="70" rx="8" fill="#FFFFFF"/>
              <rect x="10" y="10" width="80" height="50" rx="4" fill="#242424"/>
              <rect x="35" y="75" width="30" height="6" rx="2" fill="#FFFFFF"/>
            </g>

            {/* Device D - Right */}
            <g transform="translate(980, 240)">
              <rect x="0" y="0" width="120" height="80" rx="8" fill="#FFFFFF"/>
              <rect x="10" y="10" width="100" height="60" rx="4" fill="#242424"/>
              <rect x="45" y="85" width="30" height="8" rx="2" fill="#FFFFFF"/>
            </g>

            {/* Device E - Top Right */}
            <g transform="translate(1000, 60)">
              <rect x="0" y="0" width="60" height="100" rx="8" fill="#FFFFFF"/>
              <rect x="5" y="10" width="50" height="75" rx="4" fill="#242424"/>
              <circle cx="30" cy="92" r="4" fill="#242424"/>
            </g>

            {/* Device F - Bottom Right */}
            <g transform="translate(980, 420)">
              <rect x="0" y="0" width="100" height="70" rx="8" fill="#FFFFFF"/>
              <rect x="10" y="10" width="80" height="50" rx="4" fill="#242424"/>
              <rect x="35" y="75" width="30" height="6" rx="2" fill="#FFFFFF"/>
            </g>

            {/* Green connector nodes */}
            <circle cx="320" cy="280" r="8" fill="#FF8A00" stroke="#FFFFFF" strokeWidth="2"/>
            <circle cx="960" cy="280" r="8" fill="#FF8A00" stroke="#FFFFFF" strokeWidth="2"/>
            <circle cx="640" cy="120" r="8" fill="#FF8A00" stroke="#FFFFFF" strokeWidth="2"/>
            <circle cx="640" cy="440" r="8" fill="#FF8A00" stroke="#FFFFFF" strokeWidth="2"/>
          </svg>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: '40px',
            width: '100%',
            maxWidth: '1200px'
          }}
        >
          {/* Card 1: Remote Access */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '0 0 26px',
              width: '400px',
              height: '365.99px',
              background: '#F3F4F6',
              borderRadius: '12px',
              flex: 'none',
              flexGrow: 0
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '76px 37px 44px',
                gap: '10px',
                width: '100%',
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0 65.67px',
                  gap: '19.48px',
                  width: '100%',
                  height: '155.99px',
                  flex: 'none',
                  flexGrow: 0
                }}
              >
                {/* Remote Access Icon */}
                <svg width="138" height="103" viewBox="0 0 138 103" fill="none">
                  <rect x="44.2" y="34.95" width="49.6" height="18.54" fill="#487961"/>
                  <rect x="44.2" y="1.94" width="49.6" height="18.54" fill="#91BBA6"/>
                  <rect x="68.84" y="34.95" width="69.04" height="18.54" fill="#91BBA6"/>
                  <rect x="19.57" y="34.95" width="69.04" height="18.54" fill="#91BBA6"/>
                  <rect x="44.2" y="67.96" width="49.6" height="18.54" fill="#91BBA6"/>
                  <rect x="59.22" y="8.39" width="49.6" height="18.54" fill="#CAE6D9" transform="rotate(45 83.92 17.66)"/>
                  <rect x="59.22" y="55.07" width="49.6" height="18.54" fill="#CAE6D9" transform="rotate(45 83.92 64.34)"/>
                  <rect x="24.38" y="8.39" width="49.6" height="18.54" fill="#CAE6D9" transform="rotate(45 49.08 17.66)"/>
                  <rect x="24.38" y="55.07" width="49.6" height="18.54" fill="#CAE6D9" transform="rotate(45 49.08 64.34)"/>
                </svg>
              </div>

              <h4
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 400,
                  fontSize: '28px',
                  lineHeight: '33px',
                  letterSpacing: '-0.56px',
                  color: '#111315',
                  margin: 0,
                  textAlign: 'center',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                Remote access
              </h4>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0 6.53px',
                  width: '100%',
                  maxWidth: '380px',
                  height: '54px'
                }}
              >
                <p
                  style={{
                    fontFamily: "'Mona Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '18px',
                    lineHeight: '27px',
                    letterSpacing: '-0.18px',
                    color: '#787676',
                    margin: 0,
                    textAlign: 'center',
                    textDecoration: 'underline'
                  }}
                >
                  Link → Add devices
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Filter DNS */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '0',
              width: '400px',
              height: '365.99px',
              background: '#F3F4F6',
              borderRadius: '12px',
              flex: 'none',
              flexGrow: 0
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '76px 37px 44px',
                gap: '10px',
                width: '100%',
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0 93.5px',
                  gap: '19.48px',
                  width: '100%',
                  height: '154.99px',
                  flex: 'none',
                  flexGrow: 0
                }}
              >
                {/* Filter DNS Icon */}
                <svg width="139" height="102" viewBox="0 0 139 102" fill="none">
                  <rect x="0" y="12.78" width="43" height="75.43" fill="#CAE6D9" transform="rotate(90 21.5 50.495)"/>
                  <rect x="65.83" y="12.78" width="48.17" height="42.19" fill="#91BBA6"/>
                  <rect x="31.65" y="54.38" width="48.7" height="29.9" fill="#487961"/>
                </svg>
              </div>

              <h4
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 400,
                  fontSize: '28px',
                  lineHeight: '33px',
                  letterSpacing: '-0.56px',
                  color: '#111315',
                  margin: 0,
                  textAlign: 'center',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                Session sharing
              </h4>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0 10.14px',
                  width: '100%',
                  maxWidth: '380px',
                  height: '81px'
                }}
              >
                <p
                  style={{
                    fontFamily: "'Mona Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '18px',
                    lineHeight: '27px',
                    letterSpacing: '-0.18px',
                    color: '#787676',
                    margin: 0,
                    textAlign: 'center'
                  }}
                >
                  Generate session codes for instant remote support. No account needed for guests — just share the code and connect.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Encrypt Traffic */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '0 0 27px',
              width: '400px',
              height: '365.99px',
              background: '#F3F4F6',
              borderRadius: '12px',
              flex: 'none',
              flexGrow: 0
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '76px 37px 44px',
                gap: '10px',
                width: '100%',
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0 72.58px',
                  gap: '19.48px',
                  width: '100%',
                  height: '154.99px',
                  flex: 'none',
                  flexGrow: 0
                }}
              >
                {/* Encrypt Traffic Icon */}
                <svg width="155" height="102" viewBox="0 0 155 102" fill="none">
                  <rect x="49.82" y="18.91" width="49.61" height="64.18" fill="#91BBA6"/>
                  <rect x="19.21" y="18.91" width="49.61" height="64.18" fill="#91BBA6"/>
                  <rect x="78.35" y="18.91" width="33.65" height="64.18" fill="#CAE6D9"/>
                  <rect x="0.05" y="18.91" width="33.65" height="64.18" fill="#CAE6D9"/>
                  <circle cx="77.57" cy="59.2" r="15.53" fill="#487961" stroke="#F3F4F6" strokeWidth="8"/>
                </svg>
              </div>

              <h4
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 400,
                  fontSize: '28px',
                  lineHeight: '33px',
                  letterSpacing: '-0.56px',
                  color: '#111315',
                  margin: 0,
                  textAlign: 'center',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                Team chat & meetings
              </h4>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0 10.59px',
                  width: '100%',
                  maxWidth: '380px',
                  height: '54px'
                }}
              >
                <p
                  style={{
                    fontFamily: "'Mona Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '18px',
                    lineHeight: '27px',
                    letterSpacing: '-0.18px',
                    color: '#787676',
                    margin: 0,
                    textAlign: 'center'
                  }}
                >
                  Built-in messaging and video meetings
                </p>
                <p
                  style={{
                    fontFamily: "'Mona Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '18px',
                    lineHeight: '27px',
                    letterSpacing: '-0.18px',
                    color: '#787676',
                    margin: 0,
                    textAlign: 'center'
                  }}
                >
                  keep your team connected while remote.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProductFeaturesSection
