import React, { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import CompanyMarquee from '../../components/landing/CompanyMarquee'
import EnterpriseZeroTrust from '../../components/landing/EnterpriseZeroTrust'
import EnterpriseScales from '../../components/landing/EnterpriseScales'
import EnterpriseSecurity from '../../components/landing/EnterpriseSecurity'

const ChevronDownIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M4.5 7L9 11.5L13.5 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// ── Enterprise Hero — light, centered, glowing media card ─────────────────────
const EnterpriseHero: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Play the demo only while it's actually on screen
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => { /* autoplay blocked — user can tap */ })
        } else {
          video.pause()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="ent-hero">

      {/* Heading */}
      <h1 className="ent-title">The zero-trust network for your enterprise</h1>

      {/* Sub copy */}
      <p className="ent-sub">
        Organizations of all sizes choose Remote365 to connect their employees,
        devices, and workloads securely across infrastructure spanning the globe.
      </p>

      {/* CTAs */}
      <div className="ent-ctas">
        <a href="mailto:sales@remote365.ai" className="ent-pill">
          <span className="ent-pill-glow" />
          Contact sales
        </a>
        <button
          className="ent-learn"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          Learn more
          <ChevronDownIcon />
        </button>
      </div>

      {/* Media card */}
      <div className="ent-media-wrap">
        <div className="ent-media-halo" />
        <div className="ent-media-card">
          <video
            ref={videoRef}
            className="ent-video"
            src="/Login_screen.mp4"
            muted
            loop
            playsInline
            preload="auto"
          />
          {/* Accent glow lines */}
          <span className="ent-line ent-line-top" />
          <span className="ent-line ent-line-bottom" />
        </div>
      </div>

      <style>{`
        .ent-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: clamp(72px, 9vw, 128px) clamp(20px, 5vw, 80px) clamp(80px, 11vw, 160px);
          background: #FFFFFF;
          overflow: hidden;
        }
        .ent-title {
          margin: 0;
          max-width: 768px;
          font-weight: 700;
          font-size: clamp(2.5rem, 6vw, 72px);
          line-height: 1.07;
          letter-spacing: -1.8px;
          text-align: center;
          background: linear-gradient(135deg, #111315 0%, #71717A 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .ent-sub {
          margin: 28px 0 0;
          max-width: 768px;
          font-weight: 500;
          font-size: clamp(16px, 2vw, 20px);
          line-height: 1.6;
          text-align: center;
          color: rgba(26, 29, 33, 0.7);
        }
        .ent-ctas {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 25px;
          margin-top: 44px;
        }
        .ent-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 16px;
          border-radius: 9999px;
          background: #FFFFFF;
          box-shadow: 0 0 0 1px rgba(26, 29, 33, 0.15);
          font-weight: 500;
          font-size: 14px;
          line-height: 24px;
          color: #111315;
          text-decoration: none;
          transition: color 0.2s, box-shadow 0.2s;
        }
        .ent-pill:hover {
          color: #FF8A00;
          box-shadow: 0 0 0 1px rgba(255, 138, 0, 0.45);
        }
        .ent-pill-glow {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, rgba(255, 138, 0, 0) 0%, rgba(255, 138, 0, 0.9) 50%, rgba(255, 138, 0, 0) 100%);
        }
        .ent-learn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
          font-weight: 500;
          font-size: 14px;
          line-height: 24px;
          color: rgba(26, 29, 33, 0.6);
          transition: color 0.2s;
        }
        .ent-learn:hover { color: #FF8A00; }

        .ent-media-wrap {
          position: relative;
          width: 100%;
          max-width: 1216px;
          margin-top: clamp(56px, 8vw, 98px);
        }
        .ent-media-halo {
          position: absolute;
          left: 50%;
          top: -220px;
          transform: translateX(-50%);
          width: min(900px, 90vw);
          height: 440px;
          background: radial-gradient(closest-side, rgba(255, 138, 0, 0.12), transparent);
          pointer-events: none;
        }
        .ent-media-card {
          position: relative;
          border-radius: 16px;
        }
        .ent-video {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 16px;
        }
        .ent-line {
          position: absolute;
          width: 256px;
          max-width: 40%;
          height: 1px;
          background: linear-gradient(90deg, rgba(255, 138, 0, 0) 0%, #FF8A00 50%, rgba(255, 138, 0, 0) 100%);
          box-shadow: 0 0 14px rgba(255, 138, 0, 0.65);
          pointer-events: none;
        }
        .ent-line-top { top: -1px; right: 80px; }
        .ent-line-bottom { bottom: -1px; left: 80px; }
      `}</style>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
const EnterprisePage: React.FC = () => (
  <Box sx={{ bgcolor: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <Navbar />
    <Box sx={{ flexGrow: 1 }}>
      <EnterpriseHero />
      <div style={{ padding: '48px 0' }}>
        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 700,
          fontSize: '24px',
          lineHeight: '34px',
          textAlign: 'center',
          color: '#000000',
          margin: '0 0 42px 0',
        }}>
          Trusted by 4,000+ Companies
        </p>
        <CompanyMarquee title="" />
      </div>
      <EnterpriseZeroTrust />
      <EnterpriseScales />
      <EnterpriseSecurity />
    </Box>
    <Footer />
  </Box>
)

export default EnterprisePage
