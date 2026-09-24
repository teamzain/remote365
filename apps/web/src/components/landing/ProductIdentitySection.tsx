import React, { useState } from 'react'

const ProductIdentitySection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'auth' | 'device' | 'privilege'>('auth')

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '120px 40px',
        background: '#FFFFFF',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1280px',
          gap: '80px'
        }}
      >
        {/* Heading Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '745px',
            gap: '0px'
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
              margin: 0
            }}
          >
            Tying identity to network connections
          </h2>
        </div>

        {/* Content Area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '1200px',
            gap: '80px'
          }}
        >
          {/* Main Illustration */}
          <div
            style={{
              width: '100%',
              height: '560px',
              borderRadius: '20px',
              overflow: 'hidden',
              background: '#F3F4F6'
            }}
          >
            <img
              src="/product_identity_illustration.png"
              alt="Identity to Network Connections"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Bottom Tabs/Buttons Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              width: '100%',
              gap: '40px',
              borderTop: '1px solid rgba(26, 29, 33, 0.2)',
              paddingTop: '0px'
            }}
          >
            {/* Tab 1: Authenticate users */}
            <div
              onClick={() => setActiveTab('auth')}
              style={{
                flex: 1,
                padding: '17px 0 54px 0',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Active Indicator Top Border */}
              {activeTab === 'auth' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-1px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: '#487961'
                  }}
                />
              )}
              <h3
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: '24px',
                  lineHeight: '34px',
                  letterSpacing: '-0.48px',
                  color: activeTab === 'auth' ? '#000000' : 'rgba(26, 29, 33, 0.5)',
                  margin: '0 0 24px 0'
                }}
              >
                Authenticate users
              </h3>
              <div style={{ height: '54px' }}>
                <p
                  style={{
                    fontFamily: "'Mona Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '18px',
                    lineHeight: '27px',
                    letterSpacing: '-0.18px',
                    color: 'rgba(26, 29, 33, 0.8)',
                    margin: 0,
                    display: activeTab === 'auth' ? 'flex' : 'none'
                  }}
                >
                  Remote365 integrates with various identity providers (IdP) to authenticate user
                  access to the network with SSO and MFA.
                </p>
              </div>
            </div>

            {/* Tab 2: Authorize devices */}
            <div
              onClick={() => setActiveTab('device')}
              style={{
                flex: 0.5,
                padding: '17px 0 54px 0',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              {activeTab === 'device' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-1px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: '#487961'
                  }}
                />
              )}
              <h3
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: '24px',
                  lineHeight: '34px',
                  letterSpacing: '-0.48px',
                  color: activeTab === 'device' ? '#000000' : 'rgba(26, 29, 33, 0.5)',
                  margin: '0 0 24px 0'
                }}
              >
                Authorize devices
              </h3>
              <div style={{ height: '54px' }}>
                <p
                  style={{
                    fontFamily: "'Mona Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '18px',
                    lineHeight: '27px',
                    letterSpacing: '-0.18px',
                    color: 'rgba(26, 29, 33, 0.8)',
                    margin: 0,
                    display: activeTab === 'device' ? 'flex' : 'none'
                  }}
                >
                  Ensure only verified and secure devices can connect to your infrastructure,
                  regardless of where they are.
                </p>
              </div>
            </div>

            {/* Tab 3: Least privilege access */}
            <div
              onClick={() => setActiveTab('privilege')}
              style={{
                flex: 0.5,
                padding: '17px 0 54px 0',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              {activeTab === 'privilege' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-1px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: '#487961'
                  }}
                />
              )}
              <h3
                style={{
                  fontFamily: "'Mona Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: '24px',
                  lineHeight: '34px',
                  letterSpacing: '-0.48px',
                  color: activeTab === 'privilege' ? '#000000' : 'rgba(26, 29, 33, 0.5)',
                  margin: '0 0 24px 0'
                }}
              >
                Least privilege access
              </h3>
              <div style={{ height: '54px' }}>
                <p
                  style={{
                    fontFamily: "'Mona Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '18px',
                    lineHeight: '27px',
                    letterSpacing: '-0.18px',
                    color: 'rgba(26, 29, 33, 0.8)',
                    margin: 0,
                    display: activeTab === 'privilege' ? 'flex' : 'none'
                  }}
                >
                  Implement fine-grained access control policies to ensure users only have access to
                  what they need.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProductIdentitySection
