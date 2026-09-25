'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import {
  Clipboard,
  FolderUp,
  Hash,
  KeyRound,
  MessageSquare,
  Monitor,
  MonitorSmartphone,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react'
import { useHydrated } from '@/lib/useHydrated'

// What Remote365 does, as a row of app icons: a port of the icon stage of
// Skiper UI's "Skiper 31 — ScrollAnimation_002" (skiper-ui.com/v1/skiper31,
// by @gurvinder-singh02, gxuri.me). Free version; the licence asks for
// attribution to Skiper UI, which this note provides. The icons start fanned
// out and turned, swing into one row as the section scrolls up to the
// middle of the screen, and from then on the row runs as a marquee.
// Changed for this site:
//  - one compact section instead of three 210vh stages, and no scrolling
//    letters; progress runs from the section entering the screen to its
//    centre reaching the screen's centre
//  - no Lenis smooth scrolling (it would change scrolling site-wide and fight
//    the other scroll-driven sections)
//  - the demo's third-party app icons (Discord, Figma, GitHub…) would suggest
//    integrations Remote365 does not have, so each shipped feature gets an
//    app icon of its own in the same style, with its name underneath
//  - the marquee (not in Skiper 31): copies of the row on both sides fade in
//    once it has formed and the strip loops by one copy's width; it pauses on
//    hover and off screen, and never re-scatters
//  - static and readable without JavaScript, before hydration and under
//    prefers-reduced-motion (the icons wrap instead); overflow clipped so
//    nothing scrolls sideways
// It replaces the earlier capability marquee.

interface Capability {
  name: string
  Icon: typeof Video
  /** Icon gradient, top to bottom, and the glyph colour. */
  from: string
  to: string
  ink?: string
}

const CAPABILITIES: Capability[] = [
  { name: 'Remote control', Icon: MonitorSmartphone, from: '#5ab0ff', to: '#1e5fe0' },
  { name: 'Unattended access', Icon: KeyRound, from: '#ffc166', to: '#ff7a00' },
  { name: 'Session codes', Icon: Hash, from: '#b99bff', to: '#6b3fe0' },
  { name: 'Video meetings', Icon: Video, from: '#5ee38b', to: '#139a4a' },
  { name: 'Team chat', Icon: MessageSquare, from: '#5fd4ff', to: '#0a84d6' },
  { name: 'File transfer', Icon: FolderUp, from: '#ffe07a', to: '#f2a516', ink: '#5c3b00' },
  { name: 'Clipboard sync', Icon: Clipboard, from: '#ffffff', to: '#d5dbe5', ink: '#1f2937' },
  { name: 'Multi-monitor', Icon: Monitor, from: '#8e96ff', to: '#3d3bd6' },
  { name: 'Two-factor sign-in', Icon: ShieldCheck, from: '#ff8a9b', to: '#e0224a' },
  { name: 'Role-based access', Icon: Users, from: '#4a4f5a', to: '#15171c' },
]
const ROW_CENTRE = (CAPABILITIES.length - 1) / 2

// Skiper's CharacterV3: slides, turns and rises from an arc, growing to size.
function Tile({ item, offset, progress }: { item: Capability; offset: number; progress: MotionValue<number> }) {
  const x = useTransform(progress, [0, 1], [offset * 90, 0])
  const rotate = useTransform(progress, [0, 1], [offset * 50, 0])
  const y = useTransform(progress, [0, 1], [-Math.abs(offset) * 20, 0])
  const scale = useTransform(progress, [0, 1], [0.75, 1])
  return (
    <motion.li className="cc-tile" style={{ x, rotate, y, scale }}>
      <TileBody item={item} />
    </motion.li>
  )
}

function TileBody({ item }: { item: Capability }) {
  const { Icon } = item
  const colours = { '--cc-from': item.from, '--cc-to': item.to, '--cc-ink': item.ink ?? '#fff' } as React.CSSProperties
  return (
    <>
      <span className="cc-app" style={colours}>
        <Icon className="cc-glyph" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="cc-label">{item.name}</span>
    </>
  )
}

// A copy of the row for the marquee, hidden from assistive technology.
const copy = (key: string) => (
  <ul key={key} className="cc-set cc-set--copy" aria-hidden="true">
    {CAPABILITIES.map(item => <li key={item.name} className="cc-tile"><TileBody item={item} /></li>)}
  </ul>
)

// Skiper's bracket, drawn around the heading.
const Bracket = ({ flip = false }: { flip?: boolean }) => (
  <svg viewBox="0 0 27 78" className={`cc-bracket${flip ? ' cc-bracket--flip' : ''}`} aria-hidden="true">
    <path
      fill="currentColor"
      d="M26.52 77.21h-5.75c-6.83 0-12.38-5.56-12.38-12.38V48.38C8.39 43.76 4.63 40 .01 40v-4c4.62 0 8.38-3.76 8.38-8.38V12.4C8.38 5.56 13.94 0 20.77 0h5.75v4h-5.75c-4.62 0-8.38 3.76-8.38 8.38V27.6c0 4.34-2.25 8.17-5.64 10.38 3.39 2.21 5.64 6.04 5.64 10.38v16.45c0 4.62 3.76 8.38 8.38 8.38h5.75v4.02Z"
    />
  </svg>
)

export default function CapabilityConverge() {
  const headingId = useId()
  const ref = useRef<HTMLElement>(null)
  const hydrated = useHydrated()
  const reduceMotion = useReducedMotion() ?? false
  const inView = useInView(ref)
  const animate = hydrated && !reduceMotion
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })

  // The marquee starts once the row has formed and then stays on.
  const [formed, setFormed] = useState(false)
  useEffect(() => {
    if (!animate || formed) return
    const check = (progress: number) => { if (progress >= 0.999) setFormed(true) }
    // Also covers a page that opens with the section already past the middle.
    const frame = requestAnimationFrame(() => check(scrollYProgress.get()))
    const stop = scrollYProgress.on('change', check)
    return () => {
      cancelAnimationFrame(frame)
      stop()
    }
  }, [animate, formed, scrollYProgress])

  const scatter = animate && !formed
  const marquee = animate && formed
  const className = [
    'cc',
    animate && 'cc--anim',
    scatter && 'cc--scatter',
    marquee && 'cc--marquee',
    marquee && !inView && 'cc--paused',
  ].filter(Boolean).join(' ')

  return (
    <section ref={ref} className={className} aria-labelledby={headingId}>
      <h2 id={headingId} className="cc-heading">
        <Bracket />
        <span>Remote access, support and teamwork in one place</span>
        <Bracket flip />
      </h2>

      <div className="cc-strip">
        <div className="cc-track">
          {animate && ['before-2', 'before-1'].map(copy)}
          <ul className="cc-set cc-set--main">
            {CAPABILITIES.map((item, i) =>
              scatter
                ? <Tile key={item.name} item={item} offset={i - ROW_CENTRE} progress={scrollYProgress} />
                : <li key={item.name} className="cc-tile"><TileBody item={item} /></li>,
            )}
          </ul>
          {animate && ['after-1', 'after-2'].map(copy)}
        </div>
      </div>

      <style>{`
        .cc {
          --cc-tile: clamp(72px, 7.5vw, 96px);
          --cc-gap: clamp(14px, 1.6vw, 20px);
          --cc-size: clamp(56px, 5.6vw, 72px);
          --cc-pad: clamp(16px, 4vw, 40px);
          position: relative;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
          overflow: clip;
          padding: clamp(56px, 8vw, 96px) 0;
          color: #fff;
          text-align: center;
        }
        .cc-heading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          max-width: 900px;
          margin: 0 auto;
          padding: 0 var(--cc-pad);
          text-wrap: balance;
          font-size: clamp(18px, 2.4vw, 28px);
          font-weight: 600;
          line-height: 1.3;
          letter-spacing: -0.015em;
          color: rgba(255, 255, 255, 0.9);
        }
        .cc-bracket { height: 2.2em; width: auto; flex-shrink: 0; color: rgba(255, 255, 255, 0.5); }
        .cc-bracket--flip { transform: scaleX(-1); }

        /* Static (no JavaScript yet, or reduced motion): the icons wrap,
           five to a row, all ten in one row from 1000px. */
        .cc-strip {
          margin-top: clamp(36px, 5vw, 60px);
          padding: 0 var(--cc-pad);
        }
        .cc-set {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 24px var(--cc-gap);
          max-width: calc(5 * (var(--cc-tile) + var(--cc-gap)));
          margin: 0 auto;
          padding: 0;
          list-style: none;
        }
        @media (min-width: 1000px) {
          .cc-set { max-width: none; }
        }
        .cc-tile {
          display: flex;
          flex: 0 0 var(--cc-tile);
          flex-direction: column;
          align-items: center;
          gap: 10px;
          width: var(--cc-tile);
        }

        /* Animated: one row running edge to edge, centred on the real list
           with two copies either side. The strip reaches 120px above and
           below the row so the edge fade never cuts off a tile swinging in. */
        .cc--anim .cc-strip {
          margin: calc(clamp(36px, 5vw, 60px) - 120px) 0 -120px;
          padding: 120px 0;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent);
          mask-image: linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent);
        }
        .cc--anim .cc-track {
          position: relative;
          left: 50%;
          display: flex;
          width: max-content;
          transform: translateX(-50%);
        }
        /* Half a gap each side of every copy: copies sit a full gap apart,
           so moving by one copy (a fifth of the track) loops seamlessly. */
        .cc--anim .cc-set {
          flex-wrap: nowrap;
          max-width: none;
          margin: 0;
          gap: var(--cc-gap);
          padding: 0 calc(var(--cc-gap) / 2);
        }
        .cc--scatter .cc-set--main .cc-tile { will-change: transform; }
        .cc-set--copy { opacity: 0; transition: opacity 0.6s ease; }
        .cc--marquee .cc-set--copy { opacity: 1; }
        .cc--marquee .cc-track { animation: cc-marquee 30s linear infinite; }
        .cc--marquee .cc-track:hover,
        .cc--paused .cc-track { animation-play-state: paused; }
        @keyframes cc-marquee {
          from { transform: translateX(-50%); }
          to { transform: translateX(-70%); }
        }

        /* A desktop app icon: rounded square, top-lit gradient, gloss and a
           soft shadow under it. */
        .cc-app {
          position: relative;
          display: grid;
          place-items: center;
          width: var(--cc-size);
          height: var(--cc-size);
          border-radius: 23%;
          background: linear-gradient(180deg, var(--cc-from), var(--cc-to));
          color: var(--cc-ink);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.45),
            inset 0 -3px 8px rgba(0, 0, 0, 0.16),
            0 2px 6px rgba(0, 0, 0, 0.3),
            0 14px 30px rgba(0, 0, 0, 0.5);
        }
        .cc-app::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.06) 46%, rgba(255, 255, 255, 0) 60%);
          pointer-events: none;
        }
        .cc-glyph {
          position: relative;
          z-index: 1;
          width: 48%;
          height: 48%;
          filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.25));
        }
        .cc-label {
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
          color: rgba(255, 255, 255, 0.78);
          -webkit-hyphens: auto;
          hyphens: auto;
        }
      `}</style>
    </section>
  )
}
