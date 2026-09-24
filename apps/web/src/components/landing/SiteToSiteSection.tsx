import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

const SiteToSiteSection: React.FC = () => (
  <section style={{ background: '#FFFFFF' }}>
    <div style={{
      maxWidth: '1360px',
      margin: '0 auto',
      padding: 'clamp(60px, 8vw, 112px) 0 0',
    }}>

      {/* Text block */}
      <div className="s2s-text">
        <h2 style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 500,
          fontSize: 'clamp(1.8rem, 3.5vw, 48px)',
          lineHeight: '1.18',
          letterSpacing: '-0.96px',
          color: '#000000',
          margin: '0 0 28px 0',
          maxWidth: '672px',
        }}>
          Unlock site-to-site networking
        </h2>

        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: 'clamp(16px, 1.5vw, 18px)',
          lineHeight: '1.5',
          letterSpacing: '-0.18px',
          color: 'rgba(26, 29, 33, 0.65)',
          margin: '0 0 28px 0',
          maxWidth: '671px',
        }}>
          Connect clouds, VPCs, and on-premises networks without opening firewall ports with NAT traversal.
        </p>

        <RouterLink to="/site-to-site" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          textDecoration: 'none',
        }}>
          <span style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: '16px',
            lineHeight: '23px',
            letterSpacing: '-0.17px',
            color: '#000000',
          }}>
            Site-to-Site Networking
          </span>
          <ExternalLink size={17} color="#000000" />
        </RouterLink>
      </div>

      {/* Image card */}
      <div className="s2s-image">
        <img
          src="/image.png"
          alt="Site-to-site networking diagram"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
          }}
        />
      </div>

    </div>

    <style>{`
      .s2s-text {
        padding: 0 clamp(20px, 5vw, 67px);
        margin-bottom: 56px;
      }
      .s2s-image {
        margin: 0 clamp(16px, 3vw, 40px);
        background: #E0BE43;
        border-radius: 12px;
        overflow: hidden;
        position: relative;
        height: clamp(280px, 45vw, 640px);
      }
    `}</style>
  </section>
)

export default SiteToSiteSection
