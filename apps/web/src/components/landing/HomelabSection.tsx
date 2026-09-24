import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'

const HomelabSection: React.FC = () => (
  <section style={{ background: '#FFFFFF', overflow: 'hidden' }}>
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: 'clamp(60px, 8vw, 112px) clamp(20px, 4vw, 40px) 0' }}>

      <div style={{ textAlign: 'center' }}>

        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: '27px',
          letterSpacing: '-0.18px',
          color: '#787676',
          margin: '0 0 20px 0',
        }}>
          Homelab
        </p>

        <h2 style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 500,
          fontSize: 'clamp(1.8rem, 3.5vw, 48px)',
          lineHeight: '1.18',
          letterSpacing: '-0.96px',
          color: '#000000',
          margin: '0 auto 24px',
          maxWidth: '617px',
        }}>
          Your home away from home
        </h2>

        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: 'clamp(16px, 2vw, 20px)',
          lineHeight: '1.5',
          letterSpacing: '-0.2px',
          color: 'rgba(26, 29, 33, 0.65)',
          margin: '0 auto 48px',
          maxWidth: '583px',
          padding: '0 16px',
        }}>
          Access your homelab, personal devices, and dev environments wherever
          you are — for free.
        </p>

        {/* CTA row */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <RouterLink to="/downloads" style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                Download for free
              </span>
              <ArrowRight size={16} color="#FFFFFF" />
            </div>
          </RouterLink>

          <RouterLink to="/homelab" style={{
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
              Learn more
            </span>
            <ExternalLink size={17} color="#000000" />
          </RouterLink>
        </div>
      </div>

      {/* Homelab diagram image */}
      <div style={{ margin: '56px clamp(0px, 3vw, 40px) 0', overflow: 'hidden' }}>
        <img
          src="/svg.png"
          alt="Homelab network diagram"
          style={{ width: '100%', display: 'block' }}
        />
      </div>

    </div>
  </section>
)

export default HomelabSection
