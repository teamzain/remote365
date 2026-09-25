'use client'

import React, { useEffect, useRef } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useMediaQuery } from '@/lib/useMediaQuery'

// Port of Componentry's "Scroll Split Card" (componentry.dev, installed via
// `shadcn add @componentry/scroll-split-card`). Same scroll stages and
// timings; changed for this site:
//  - plain <style> classes instead of Tailwind + cn()/shadcn tokens
//  - image drawn with `cover` so it isn't stretched across the three panels
//  - pins below a fixed header (reads --site-nav-h) and centres cards + outro
//    at the end instead of sliding a fixed 200px up under the header
//  - on narrow screens the panels stack and flip about the horizontal axis
//    (side by side they'd be ~110px wide on a phone)
//  - grain generated locally (the original hot-links framerusercontent.com)
//  - prefers-reduced-motion gets the finished cards without the 3D flip

export interface ScrollSplitCardItem {
  title: string
  description: string
  bgColor: string
  textColor: string
  icon?: React.ReactNode
}

interface ScrollSplitCardProps {
  /** One image, split across the three panels before they flip. */
  imageSrc: string
  /** The first three are used. */
  cards: ScrollSplitCardItem[]
  /** Shown above the image at the start; fades as scrolling begins. */
  intro?: React.ReactNode
  /** Revealed under the cards once they have flipped. */
  outro?: React.ReactNode
  /** Scroll container; defaults to the page. */
  containerRef?: React.RefObject<HTMLElement | null>
  /** Extra class on the outer scroll region (its height sets the scroll distance). */
  className?: string
}

const STACK_QUERY = '(max-width: 640px)'

/** 0 → 1 as v moves from `from` to `to`, clamped. */
const between = (v: number, from: number, to: number) =>
  Math.min(Math.max((v - from) / (to - from), 0), 1)
const OUTRO_GAP = 36
const END_SCALE = 0.9

// Fractal-noise tile for the grain on the card backs.
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const CardBack: React.FC<{ card: ScrollSplitCardItem; style?: React.ComponentProps<typeof motion.div>['style'] }> = ({ card, style }) => (
  <motion.div
    className="ssc-face ssc-back"
    style={{ backgroundColor: card.bgColor, color: card.textColor, ...style }}
  >
    <div className="ssc-noise" aria-hidden="true" />
    {card.icon && <div className="ssc-icon">{card.icon}</div>}
    <h3 className="ssc-title">{card.title}</h3>
    <p className="ssc-desc">{card.description}</p>
  </motion.div>
)

export const ScrollSplitCard: React.FC<ScrollSplitCardProps> = ({
  imageSrc,
  cards,
  intro,
  outro,
  containerRef: externalContainerRef,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const outroRef = useRef<HTMLDivElement>(null)
  const stacked = useMediaQuery(STACK_QUERY)
  const reducedMotion = useReducedMotion()
  const items = cards.slice(0, 3)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    container: externalContainerRef,
    offset: ['start start', 'end end'],
  })

  // Stage 1 → 2: separation (0 → 0.4), then 2 → 3: overlap closer (0.4 → 0.8)
  const spread = useTransform(scrollYProgress, [0, 0.4, 0.8], [0, 48, 24])
  const spreadBack = useTransform(spread, (v: number) => -v)
  const scale = useTransform(scrollYProgress, [0, 0.4], [1, END_SCALE])

  // Stage 2 → 3: flip (0.4 → 0.8), with a slight fan-out tilt on the outer
  // panels. After a 180° flip a positive Z tilt reads counter-clockwise.
  const flip = useTransform(scrollYProgress, [0.4, 0.8], [0, 180])
  const tiltFirst = useTransform(scrollYProgress, [0.4, 0.8], [0, 6])
  const tiltLast = useTransform(scrollYProgress, [0.4, 0.8], [0, -6])

  // Inner corners start square so the three panels read as ONE image.
  const r = useTransform(scrollYProgress, [0, 0.2], [0, 16])
  const radiusFirstRow = useMotionTemplate`16px ${r}px ${r}px 16px`
  const radiusLastRow = useMotionTemplate`${r}px 16px 16px ${r}px`
  const radiusFirstCol = useMotionTemplate`16px 16px ${r}px ${r}px`
  const radiusLastCol = useMotionTemplate`${r}px ${r}px 16px 16px`
  const radiusMiddle = useMotionTemplate`${r}px`
  const borderOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 0.2])
  const shadowOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 0.4])
  const boxShadow = useMotionTemplate`inset 0 1px 1px rgba(255, 255, 255, ${borderOpacity}), inset 0 -24px 48px rgba(0, 0, 0, ${shadowOpacity}), 0 25px 50px -12px rgba(0, 0, 0, ${shadowOpacity})`

  // Last stage: the cards rise just far enough that cards + outro end up
  // centred together, however tall the viewport is.
  const rise = useMotionValue(0)
  useEffect(() => {
    const measure = () => {
      const outroHeight = outroRef.current?.offsetHeight ?? 0
      rise.set(outro ? ((outroHeight + OUTRO_GAP) * END_SCALE) / 2 : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [outro, rise, stacked])
  const cardsY = useTransform([scrollYProgress, rise], ([v, d]: number[]) => -d * between(v, 0.8, 1))

  // Opacity as a function, not an input/output range: framer-motion hands a
  // range-mapped scroll opacity to a native ScrollTimeline, which follows the
  // whole page instead of this section (the outro stuck near 19% visible).
  const outroOpacity = useTransform(scrollYProgress, (v: number) => between(v, 0.8, 1))
  const outroY = useTransform(scrollYProgress, [0.8, 1], [40, 0])
  const introOpacity = useTransform(scrollYProgress, (v: number) => 1 - between(v, 0, 0.1))
  const introY = useTransform(scrollYProgress, [0, 0.1], [0, 20])

  const radiusFor = (i: number) => {
    if (i === 1) return radiusMiddle
    if (stacked) return i === 0 ? radiusFirstCol : radiusLastCol
    return i === 0 ? radiusFirstRow : radiusLastRow
  }

  if (reducedMotion) {
    return (
      <div className={`ssc-static${stacked ? ' is-stacked' : ''}${className ? ` ${className}` : ''}`}>
        <div className="ssc-static-cards">
          {items.map(card => (
            <div key={card.title} className="ssc-static-card">
              <CardBack card={card} style={{ borderRadius: 16 }} />
            </div>
          ))}
        </div>
        {outro && <div className="ssc-static-outro">{outro}</div>}
        <style>{STYLES}</style>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`ssc${className ? ` ${className}` : ''}`}>
      <div className="ssc-stage">
        <motion.div
          className={`ssc-group${stacked ? ' is-stacked' : ''}`}
          style={{ scale, y: cardsY, transformStyle: 'preserve-3d' }}
        >
          {intro && (
            <motion.div className="ssc-intro" style={{ opacity: introOpacity, y: introY }}>
              {intro}
            </motion.div>
          )}

          {items.map((card, i) => {
            const offset = i === 0 ? spreadBack : i === 2 ? spread : 0
            const tilt = i === 0 ? tiltFirst : i === 2 ? tiltLast : 0
            const radius = radiusFor(i)
            return (
              <motion.div
                key={card.title}
                className="ssc-panel"
                style={{
                  ...(stacked
                    ? { y: offset, rotateX: flip }
                    : { x: offset, rotateY: flip }),
                  rotateZ: tilt,
                  zIndex: i, // first under middle, last above it
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Front: this panel's slice of the shared image */}
                <motion.div
                  className="ssc-face ssc-front"
                  aria-hidden="true"
                  style={{ borderRadius: radius, boxShadow, zIndex: 2 }}
                >
                  {/* Each front face bleeds 0.5px past its panel so the joins
                      don't show the page through fractional-pixel seams; the
                      +i px / -2px keep the three slices of the image aligned. */}
                  <div
                    className="ssc-image"
                    style={{
                      backgroundImage: `url(${imageSrc})`,
                      ...(stacked
                        ? { top: `calc(${-100 * i}% + ${i}px)`, left: 0, width: '100%', height: 'calc(300% - 2px)' }
                        : { left: `calc(${-100 * i}% + ${i}px)`, top: 0, width: 'calc(300% - 2px)', height: '100%' }),
                    }}
                  />
                </motion.div>

                {/* Back: the card revealed by the flip */}
                <CardBack
                  card={card}
                  style={{
                    transform: stacked ? 'rotateX(180deg)' : 'rotateY(180deg)',
                    borderRadius: radius,
                    boxShadow,
                    zIndex: 1,
                  }}
                />
              </motion.div>
            )
          })}

          {outro && (
            <motion.div
              ref={outroRef}
              className="ssc-outro"
              style={{ opacity: outroOpacity, y: outroY, marginTop: OUTRO_GAP }}
            >
              {outro}
            </motion.div>
          )}
        </motion.div>
      </div>
      <style>{STYLES}</style>
    </div>
  )
}

const STYLES = `
  .ssc {
    position: relative;
    width: 100%;
    height: 500vh;
  }
  .ssc-stage {
    position: sticky;
    top: var(--site-nav-h, 0px);
    height: calc(100vh - var(--site-nav-h, 0px));
    height: calc(100dvh - var(--site-nav-h, 0px));
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    perspective: 1200px;
  }
  .ssc-group {
    position: relative;
    display: flex;
    width: 100%;
    max-width: 896px;
    height: 400px;
    padding: 0 16px;
    box-sizing: border-box;
  }
  .ssc-group.is-stacked {
    flex-direction: column;
    max-width: 480px;
    height: min(62vh, 520px);
  }
  .ssc-panel {
    position: relative;
    flex: 1;
  }
  .ssc-face {
    position: absolute;
    inset: 0;
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  .ssc-front {
    inset: -0.5px;
  }
  .ssc-image {
    position: absolute;
    background-size: cover;
    background-position: center;
  }
  .ssc-back {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 32px;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.05);
    background-image: linear-gradient(to bottom right, rgba(255, 255, 255, 0.1), transparent);
    will-change: transform;
  }
  .ssc-noise {
    position: absolute;
    inset: 0;
    opacity: 0.2;
    mix-blend-mode: overlay;
    background-image: ${NOISE};
    pointer-events: none;
  }
  .ssc-icon {
    position: relative;
    z-index: 1;
    margin-bottom: auto;
  }
  .ssc-title {
    position: relative;
    z-index: 1;
    margin: 0 0 14px;
    font-size: 24px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  .ssc-desc {
    position: relative;
    z-index: 1;
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    opacity: 0.8;
  }
  .ssc-intro {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    margin-bottom: 28px;
    text-align: center;
  }
  .ssc-outro {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    text-align: center;
  }

  /* Stacked (phones): wide, short cards */
  .ssc-group.is-stacked .ssc-back {
    padding: 16px 20px;
  }
  .ssc-group.is-stacked .ssc-title {
    margin-bottom: 6px;
    font-size: 18px;
  }
  .ssc-group.is-stacked .ssc-desc {
    font-size: 13px;
    line-height: 1.45;
  }
  .ssc-group.is-stacked .ssc-icon svg {
    width: 22px;
    height: 22px;
  }

  /* Reduced motion: the finished cards, no scroll-driven 3D */
  .ssc-static {
    padding: 72px 16px;
  }
  .ssc-static-cards {
    display: flex;
    gap: 16px;
    max-width: 896px;
    margin: 0 auto;
  }
  .ssc-static.is-stacked .ssc-static-cards {
    flex-direction: column;
  }
  .ssc-static-card {
    position: relative;
    flex: 1;
    min-height: 320px;
  }
  .ssc-static.is-stacked .ssc-static-card {
    min-height: 200px;
  }
  .ssc-static-outro {
    margin-top: 40px;
    text-align: center;
  }
`

export default ScrollSplitCard
