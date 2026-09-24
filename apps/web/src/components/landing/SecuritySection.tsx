import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'

const PhoneMockup: React.FC = () => (
  <div style={{
    width: '160px',
    height: '300px',
    background: '#FFFFFF',
    borderRadius: '24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  }}>
    <div style={{
      height: '28px',
      background: '#111827',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: '64px', height: '8px', background: '#1F2937', borderRadius: '4px' }} />
    </div>
    <div style={{ flex: 1, background: '#111827', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ height: '9px', background: '#1F2937', borderRadius: '4px', width: '70%' }} />
      <div style={{ height: '7px', background: '#1F2937', borderRadius: '4px', width: '90%' }} />
      <div style={{ height: '7px', background: '#1F2937', borderRadius: '4px', width: '55%' }} />
      <div style={{ height: '36px', background: '#1A2E22', borderRadius: '8px', marginTop: '6px' }} />
      <div style={{ height: '36px', background: '#1A2535', borderRadius: '8px' }} />
      <div style={{ height: '36px', background: '#2A1A1A', borderRadius: '8px' }} />
    </div>
    <div style={{
      height: '24px',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: '50px', height: '4px', background: '#D0D0D0', borderRadius: '2px' }} />
    </div>
  </div>
)

const SecuritySection: React.FC = () => (
  <section style={{ background: '#F3F4F6', overflow: 'hidden' }}>
    <div className="security-container">

      {/* Left: text */}
      <div className="security-text">
        <h2 style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 500,
          fontSize: 'clamp(1.8rem, 4vw, 58px)',
          lineHeight: '1.1',
          letterSpacing: '-1.16px',
          color: '#000000',
          margin: '0 0 24px 0',
        }}>
          Our commitment to security
        </h2>

        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: 'clamp(15px, 1.5vw, 18px)',
          lineHeight: '1.5',
          letterSpacing: '-0.18px',
          color: 'rgba(26, 29, 33, 0.65)',
          margin: '0 0 40px 0',
        }}>
          Remote365 is built on zero-trust architecture with end-to-end encryption and rigorous compliance standards to protect your network at every layer.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
          <a href="#" style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#111315',
                border: '1px solid #111315',
                borderRadius: '8px',
                padding: '0 20px',
                height: '41px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                letterSpacing: '-0.16px',
                color: '#FFFFFF',
              }}>
                Learn more
              </span>
              <ArrowRight size={16} color="#FFFFFF" />
            </div>
          </a>

          <RouterLink to="/security-bulletins" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
          }}>
            <span style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 500,
              fontSize: '16px',
              letterSpacing: '-0.17px',
              color: '#000000',
            }}>
              Security bulletins
            </span>
            <ExternalLink size={17} color="#000000" />
          </RouterLink>
        </div>
      </div>

      {/* Right: staggered phone columns */}
      <div className="security-phones">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '40px' }}>
          <PhoneMockup />
          <PhoneMockup />
          <PhoneMockup />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '-20px' }}>
          <PhoneMockup />
          <PhoneMockup />
          <PhoneMockup />
        </div>
      </div>

    </div>

    <style>{`
      .security-container {
        max-width: 1360px;
        margin: 0 auto;
        padding: clamp(60px, 8vw, 112px) clamp(20px, 5vw, 67px);
        display: flex;
        align-items: center;
        gap: clamp(32px, 5vw, 80px);
      }
      .security-text {
        flex: 0 0 460px;
        max-width: 460px;
      }
      .security-phones {
        flex: 1;
        display: flex;
        gap: 16px;
        justify-content: center;
        overflow: hidden;
        height: 500px;
        align-items: flex-start;
      }
      @media (max-width: 1024px) {
        .security-text {
          flex: 1;
          max-width: 100%;
        }
        .security-phones {
          height: 420px;
        }
      }
      @media (max-width: 768px) {
        .security-container {
          flex-direction: column;
        }
        .security-text {
          flex: none;
          width: 100%;
          max-width: 100%;
        }
        .security-phones {
          width: 100%;
          height: 320px;
          justify-content: center;
        }
      }
    `}</style>
  </section>
)

export default SecuritySection
