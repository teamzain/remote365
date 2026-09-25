import React, { useState, useEffect } from 'react'
import GetStartedScreen from './GetStartedScreen'
// Self-hosted copy of the design hand-off image (see LandingBackdrop).
import communityImageAsset from '../../assets/landing/community.png'

const communityImage = communityImageAsset.src

const ROTATING_WORDS = ['any device', 'any desktop', 'any mobile', 'any tablet', 'anywhere']

// Full-viewport hero for the dark landing page: glass badge, gradient heading
// with the rotating word, glass CTA with a rotating gradient border and the
// community avatar group underneath. Transparent — the video comes from
// <LandingBackdrop />, and <Navbar variant="glass" /> floats over the top.
const HeroVideo: React.FC = () => {
  const [wordIndex, setWordIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex(i => (i + 1) % ROTATING_WORDS.length)
    }, 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="vh">
      <div className="vh-glow" aria-hidden="true" />

      <div className="vh-content">
        <span className="vh-badge">Remote access · Meetings · Support</span>

        <h1 className="vh-title">
          <span className="vh-title-top">Remote access to</span>
          <span className="vh-title-bottom">
            {/* The animation lives on the wrapper: Chrome stops painting a
                background-clip:text gradient on an element it is transforming. */}
            <span key={wordIndex} className="vh-word-anim">
              <span className="vh-word">{ROTATING_WORDS[wordIndex]}</span>
            </span>
          </span>
        </h1>

        <p className="vh-sub">
          Remote365 makes remote access effortless — connect to any device,
          run live meetings, chat with your team, and support anyone from
          anywhere in seconds.
        </p>

        {/* Morphs into the full-screen "Get started" chooser */}
        <GetStartedScreen variant="hero" />

        <img
          className="vh-avatars"
          src={communityImage}
          alt="People using Remote365"
          width={130}
          loading="lazy"
        />
      </div>

      <style>{`
        .vh {
          position: relative;
          min-height: 100vh;
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: #fff;
          padding: 128px 24px 88px;
        }
        .vh-glow {
          position: absolute;
          left: 50%;
          top: 46%;
          width: min(960px, 130vw);
          height: 420px;
          transform: translate(-50%, -50%);
          background: radial-gradient(closest-side, rgba(255, 138, 0, 0.22), rgba(234, 88, 12, 0.08) 55%, transparent 75%);
          filter: blur(48px);
          pointer-events: none;
        }

        .vh-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 920px;
          margin: 0 auto;
        }

        .vh-badge {
          display: inline-flex;
          align-items: center;
          padding: 7px 16px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.82);
        }

        .vh-title {
          margin: 28px 0 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-weight: 700;
          font-size: clamp(2.6rem, 7vw, 5.25rem);
          line-height: 1.04;
          letter-spacing: -0.03em;
        }
        .vh-title-top,
        .vh-word {
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .vh-title-top {
          background-image: linear-gradient(180deg, #ffffff 0%, #9ca3af 100%);
        }
        .vh-title-bottom {
          display: inline-block;
          overflow: hidden;
          padding-bottom: 0.08em; /* keeps descenders inside the clipped box */
        }
        .vh-word-anim {
          display: inline-block;
          animation: vhWordIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .vh-word {
          display: inline-block;
          background-image: linear-gradient(90deg, #ff8a00 0%, #ea580c 100%);
        }
        @keyframes vhWordIn {
          from { opacity: 0; transform: translateY(60%); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .vh-sub {
          margin: 24px 0 0;
          max-width: 640px;
          font-size: 18px;
          line-height: 1.6;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Glass pill with a 1.5px rotating orange→red border drawn by a
           masked conic gradient on ::before. */
        @property --vh-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        .vh-cta-wrap {
          margin-top: 40px;
        }
        .vh-cta {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 8px 8px 8px 28px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #fff;
          font-weight: 600;
          font-size: 16px;
          text-decoration: none;
          isolation: isolate;
          transition: background 0.3s, transform 0.3s, box-shadow 0.3s;
        }
        .vh-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.5px;
          background: conic-gradient(from var(--vh-angle), #ff8a00, #ea580c 30%, rgba(255, 138, 0, 0.15) 55%, #ff8a00 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation: vhSpin 3s linear infinite;
          pointer-events: none;
        }
        @keyframes vhSpin {
          to { --vh-angle: 360deg; }
        }
        .vh-cta:hover {
          background: rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
          box-shadow: 0 10px 40px rgba(255, 138, 0, 0.18);
        }
        .vh-cta-icon {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #ff8a00 0%, #ea580c 100%);
          box-shadow: 0 0 18px rgba(255, 138, 0, 0.45);
          transition: transform 0.3s;
        }
        .vh-cta:hover .vh-cta-icon { transform: translateX(2px); }

        .vh-avatars {
          display: block;
          width: 130px;
          height: auto;
          margin-top: 3.25rem;
          filter: drop-shadow(0 12px 25px rgba(0, 0, 0, 0.6));
        }

        @media (max-width: 768px) {
          .vh { padding: 112px 24px 72px; }
          .vh-sub { font-size: 16px; }
          .vh-cta-wrap { margin-top: 32px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .vh-cta::before { animation: none; }
          .vh-word-anim { animation: none; }
        }
      `}</style>
    </section>
  )
}

export default HeroVideo
