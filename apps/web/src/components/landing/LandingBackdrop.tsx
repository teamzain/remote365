import React, { useEffect, useRef } from 'react'
// Served from our own origin: hot-linking the design hand-off CDN
// (cdn.sceneai.art) left the page black wherever a blocker or DNS filter
// refused that host. Remuxed without the unused audio track and with
// +faststart so playback starts before the whole file has arrived; the
// poster is its first frame, shown until then (and for reduced motion).
// Files live in public/media with a version in the name, so they can be
// cached forever (see next.config.mjs); bump the version when replacing one.
const backgroundVideo = '/media/hero-video.v1.mp4'
const backgroundPoster = '/media/hero-poster.v1.jpg'

// Overlay opacity at the top of the page and once the first screen has
// scrolled away. The home hero is designed for 40%; other pages open
// straight onto body copy, so they start darker to keep it legible over the
// moving footage.
const OVERLAY = {
  hero: { top: 0.4, below: 0.7 },
  content: { top: 0.6, below: 0.75 },
} as const

interface LandingBackdropProps {
  dim?: keyof typeof OVERLAY
}

// Fixed full-screen video behind every website page. Must not be placed
// inside a transformed ancestor (e.g. ScrollReveal), which would turn
// `position: fixed` into scrolling-with-the-content.
const LandingBackdrop: React.FC<LandingBackdropProps> = ({ dim = 'hero' }) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const { top, below } = OVERLAY[dim]

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const progress = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1)
      if (overlayRef.current) {
        overlayRef.current.style.opacity = String(top + (below - top) * progress)
      }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(raf)
    }
  }, [top, below])

  return (
    <div className="lb" aria-hidden="true" style={{ backgroundImage: `url(${backgroundPoster})` }}>
      <video
        className="lb-video"
        src={backgroundVideo}
        poster={backgroundPoster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div ref={overlayRef} className="lb-overlay" style={{ opacity: top }} />

      <style>{`
        .lb {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          background-color: #000;
          background-size: cover;
          background-position: center;
          pointer-events: none;
        }
        .lb-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .lb-overlay {
          position: absolute;
          inset: 0;
          background: #000;
        }
        /* Reduced motion: the still poster (the .lb background) instead. */
        @media (prefers-reduced-motion: reduce) {
          .lb-video { display: none; }
        }
      `}</style>
    </div>
  )
}

export default LandingBackdrop
