import React, { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import CompanyMarquee from './CompanyMarquee'

interface HeroProps {
  heroImage: string
}

const ROTATING_WORDS = ['any device', 'any desktop', 'any mobile', 'any tablet', 'anywhere']

const Hero: React.FC<HeroProps> = ({ heroImage }) => {
  const [wordIndex, setWordIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex(i => (i + 1) % ROTATING_WORDS.length)
    }, 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <section style={{ background: '#FFFFFF', overflow: 'hidden' }}>
      <div className="hero-container">

        {/* Heading + Description row */}
        <div className="hero-row">

          {/* Left: heading + rotating word chip */}
          <div className="hero-left">
            <h1 className="hero-heading">Remote access to</h1>
            <div className="hero-word-chip">
              <span key={wordIndex} className="hero-word">
                {ROTATING_WORDS[wordIndex]}
              </span>
            </div>
          </div>

          {/* Right: description + CTAs */}
          <div className="hero-right">
            <p className="hero-desc">
              Remote365 makes remote access effortless — connect to any device,
              run live meetings, chat with your team, and support anyone from
              anywhere in seconds.
            </p>

            <div className="hero-ctas">
              <RouterLink to="/register" className="hero-btn-primary">
                Get Started
              </RouterLink>
              <RouterLink to="/contact" className="hero-btn-ghost">
                Contact Sales
                <ArrowRight size={16} />
              </RouterLink>
            </div>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="hero-image-wrap">
          <img
            src={heroImage}
            alt="Remote365 Dashboard"
            className="hero-image"
          />
        </div>
      </div>

      {/* Trusted by */}
      <div className="hero-trusted">
        <CompanyMarquee />
      </div>

      <style>{`
        .hero-container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 48px 40px 0;
        }

        .hero-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 40px;
        }

        .hero-left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
          flex-shrink: 0;
        }
        .hero-heading {
          margin: 0;
          font-weight: 600;
          font-size: clamp(2.2rem, 4.5vw, 55px);
          line-height: 1.42;
          color: #1A1D21;
          white-space: nowrap;
        }
        .hero-word-chip {
          display: inline-flex;
          align-items: center;
          padding: 0 16px;
          height: 63px;
          background: #FF8A00;
          border-radius: 4px;
          overflow: hidden;
        }
        .hero-word {
          font-weight: 600;
          font-size: clamp(1.6rem, 3.7vw, 45px);
          line-height: 63px;
          color: #FFFFFF;
          white-space: nowrap;
          animation: heroWordIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes heroWordIn {
          from { opacity: 0; transform: translateY(60%); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-right {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 36px;
          width: 379px;
          flex-shrink: 0;
        }
        .hero-desc {
          margin: 0;
          font-weight: 400;
          font-size: 18px;
          line-height: 25px;
          color: rgba(26, 29, 33, 0.8);
        }
        .hero-ctas {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .hero-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 4px;
          background: linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%);
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: #FFFFFF;
          text-decoration: none;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .hero-btn-primary:hover { opacity: 0.9; }
        .hero-btn-ghost {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 4px;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: #111315;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .hero-btn-ghost:hover { background: #F3F4F6; }

        .hero-image-wrap {
          margin-top: 72px;
        }
        .hero-image {
          display: block;
          width: 100%;
          aspect-ratio: 1214 / 680;
          object-fit: cover;
          border-radius: 12px;
        }

        .hero-trusted {
          margin-top: 72px;
        }

        @media (max-width: 1100px) {
          .hero-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-heading { white-space: normal; }
          .hero-right { width: 100%; }
        }

        @media (max-width: 768px) {
          .hero-container { padding: 32px 20px 0; }
          .hero-word-chip { height: 52px; }
          .hero-word { line-height: 52px; }
          .hero-image-wrap, .hero-trusted { margin-top: 48px; }
        }
      `}</style>
    </section>
  )
}

export default Hero
