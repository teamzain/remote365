import React, { useEffect, useRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'

// tabler:arrow-up rotated 90° → arrow pointing right, primary orange
const ArrowRightIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path
      d="M2.5 8H13M13 8L8.5 3.5M13 8L8.5 12.5"
      stroke="#FF8A00"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface GetInvolvedSectionProps {
  /** Optional image; when omitted the Remote365 demo video plays in view */
  image?: string
}

const GetInvolvedSection: React.FC<GetInvolvedSectionProps> = ({ image }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Play the demo only while it's on screen
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.35 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
  <section className="gi-section">
    {/* Showcase media */}
    {image
      ? <img src={image} alt="" className="gi-media" />
      : (
        <video
          ref={videoRef}
          className="gi-media"
          src="/Login_screen.mp4"
          muted
          loop
          playsInline
          preload="auto"
        />
      )}

    {/* Get involved */}
    <div className="gi-copy">
      <div className="gi-text">
        <h2 className="gi-title">Get involved</h2>
        <p className="gi-sub">
          We're always amazed how creative Remote365 users are. If you'd like to share how you're
          using Remote365, tweet us @remote365 or tag us in your posts.
        </p>
      </div>
      <RouterLink to="/resources" className="gi-link">
        Explore our developer community
        <ArrowRightIcon />
      </RouterLink>
    </div>

    <style>{`
      .gi-section {
        background: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 72px;
        padding: 40px clamp(20px, 4vw, 40px) 92px;
      }
      .gi-media {
        display: block;
        width: 100%;
        max-width: 1214px;
        aspect-ratio: 1214 / 680;
        background: #F3F4F6;
        border-radius: 12px;
        object-fit: cover;
      }
      .gi-copy {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 72px;
        max-width: 720px;
      }
      .gi-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        text-align: center;
      }
      .gi-title {
        margin: 0;
        font-weight: 600;
        font-size: clamp(2rem, 4.5vw, 55px);
        line-height: 1.42;
        color: #1A1D21;
      }
      .gi-sub {
        margin: 0;
        font-weight: 400;
        font-size: 18px;
        line-height: 25px;
        color: rgba(26, 29, 33, 0.8);
      }
      .gi-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 16px;
        line-height: 23px;
        color: #FF8A00;
        text-decoration: none;
        transition: background 0.15s;
      }
      .gi-link:hover { background: rgba(255, 138, 0, 0.08); }

      @media (max-width: 640px) {
        .gi-section { gap: 44px; padding: 24px 20px 64px; }
        .gi-copy { gap: 44px; }
      }
    `}</style>
  </section>
  )
}

export default GetInvolvedSection
