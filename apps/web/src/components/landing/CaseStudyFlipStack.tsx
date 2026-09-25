'use client'

import Image from 'next/image'
import { useRef } from 'react'
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import SiteLink from '@/components/site/SiteLink'

// Port of Componentry's "Case Study Flip Stack" (componentry.dev, installed
// via `shadcn add @componentry/case-study-flip-stack`). Same scroll-driven
// fold-up of each card onto the next; changed for this site:
//  - sits inside the home page after the capability marquee: no full-screen
//    "Scroll Down" intro and no "The End" outro; a section heading instead
//    (the page already has its H1, so card titles are H3)
//  - the last card stays put, so the section never ends on an empty stage
//  - Remote365's own images through next/image, and a link to each story
//  - transparent background over the site's video backdrop
//  - no cn()/tailwind-merge dependency; opacity-82 (not a Tailwind step) → 80

export interface CaseStudyFlipItem {
  href: string
  eyebrow: string
  title: string
  description: string
  image: string
  imageAlt: string
  background: string
  foreground: string
}

// Share of the scroll spent with the last card at rest.
const HOLD = 0.15

function FlipCard({
  item,
  index,
  total,
  progress,
  reduceMotion,
}: {
  item: CaseStudyFlipItem
  index: number
  total: number
  progress: MotionValue<number>
  reduceMotion: boolean
}) {
  const transitions = Math.max(total - 1, 1)
  const segment = (1 - HOLD) / transitions
  const isLast = index === total - 1
  const start = index * segment
  const end = start + segment
  const entryStart = Math.max(0, start - segment)
  const entryEnd = index === 0 ? 0.0001 : Math.min(start, entryStart + segment * 0.7)
  const stackedCardGap = Math.min(24, 72 / transitions)
  const stackedOffset = index * stackedCardGap
  const restingOffset = Math.min(index * 12, 34)
  const restingScale = 1 - Math.min(index * 0.012, 0.035)
  // The last card never folds away.
  const still = reduceMotion || isLast
  const exitRange = isLast ? [0, 1] : [start, end]

  const exitYPercent = useTransform(progress, exitRange, still ? [0, 0] : [0, -118])
  const exitStackOffset = useTransform(progress, exitRange, still ? [0, 0] : [0, stackedOffset])
  const exitY = useMotionTemplate`calc(${exitYPercent}% + ${exitStackOffset}px)`
  const rotateX = useTransform(progress, exitRange, still ? [0, 0] : [0, 22])
  const opacity = useTransform(progress, exitRange, reduceMotion && !isLast ? [1, 0] : [1, 1])
  const entryScale = useTransform(progress, [entryStart, entryEnd], index === 0 ? [1, 1] : [restingScale, 1])
  const entryY = useTransform(progress, [entryStart, entryEnd], index === 0 ? [0, 0] : [restingOffset, 0])

  return (
    <motion.article
      className="absolute inset-x-0 top-0 aspect-[3/4] will-change-transform sm:aspect-[1.76/1]"
      style={{
        y: exitY,
        rotateX,
        opacity,
        zIndex: total - index,
        transformOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
      }}
    >
      <motion.div
        className="grid h-full overflow-hidden rounded-[clamp(18px,2vw,30px)] shadow-[0_16px_50px_rgba(0,0,0,0.45)] sm:grid-cols-[1.15fr_0.85fr]"
        style={{
          backgroundColor: item.background,
          color: item.foreground,
          y: entryY,
          scale: entryScale,
          transformOrigin: '50% 100%',
        }}
      >
        <div className="flex min-w-0 flex-col p-[clamp(22px,3vw,48px)] md:pr-[clamp(22px,3vw,48px)]">
          <span className="text-[clamp(24px,2.5vw,36px)] font-medium leading-none tracking-[-0.06em]">
            {String(index + 1).padStart(2, '0')}
          </span>

          <div className="mt-auto max-w-[46rem] pt-6">
            <p className="mb-[clamp(10px,1.5vw,22px)] text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70 sm:text-xs">
              {item.eyebrow}
            </p>
            <h3 className="max-w-[18ch] text-balance text-[clamp(24px,3vw,44px)] font-semibold leading-[1] tracking-[-0.045em]">
              {item.title}
            </h3>
            <p className="mt-[clamp(12px,1.6vw,22px)] max-w-[42rem] text-[clamp(13px,1.1vw,16px)] leading-[1.5] opacity-80">
              {item.description}
            </p>
            <SiteLink
              href={item.href}
              className="mt-[clamp(14px,1.6vw,24px)] inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: item.foreground }}
            >
              Read the story <span aria-hidden="true">→</span>
            </SiteLink>
          </div>
        </div>

        <div className="relative m-[clamp(10px,1.2vw,18px)] min-h-[150px] overflow-hidden rounded-[clamp(12px,1.4vw,22px)] sm:ml-0">
          <Image
            src={item.image}
            alt={item.imageAlt}
            fill
            sizes="(min-width: 640px) 380px, 90vw"
            className="object-cover"
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10" />
        </div>
      </motion.div>
    </motion.article>
  )
}

interface CaseStudyFlipStackProps {
  items: CaseStudyFlipItem[]
  eyebrow?: string
  heading: string
  intro?: string
}

export default function CaseStudyFlipStack({ items, eyebrow, heading, intro }: CaseStudyFlipStackProps) {
  const stackRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion() ?? false
  const { scrollYProgress } = useScroll({
    target: stackRef,
    offset: ['start start', 'end end'],
  })
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 22,
    mass: 0.8,
    restDelta: 0.0005,
  })
  const cardProgress = reduceMotion ? scrollYProgress : smoothProgress
  const transitions = Math.max(items.length - 1, 1)

  return (
    <section className="cs" aria-labelledby="cs-heading">
      <header className="cs-head">
        {eyebrow && <p className="cs-eyebrow">{eyebrow}</p>}
        <h2 className="cs-title" id="cs-heading">{heading}</h2>
        {intro && <p className="cs-intro">{intro}</p>}
      </header>

      {/* Scroll distance: ~75vh per fold, plus the hold on the last card. */}
      <div ref={stackRef} className="relative" style={{ height: `calc(100vh + ${Math.round((transitions * 75) / (1 - HOLD))}vh)` }}>
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-[clamp(14px,4vw,64px)] pb-8 pt-[var(--site-nav-h,88px)]">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[860px] [perspective:800px] sm:aspect-[1.76/1]">
            {[...items].reverse().map((item, reverseIndex) => {
              const index = items.length - reverseIndex - 1
              return (
                <FlipCard
                  key={item.href}
                  item={item}
                  index={index}
                  total={items.length}
                  progress={cardProgress}
                  reduceMotion={reduceMotion}
                />
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        .cs { position: relative; color: #fff; }
        .cs-head {
          max-width: 760px;
          margin: 0 auto;
          padding: clamp(64px, 9vw, 112px) 24px 0;
          text-align: center;
        }
        .cs-eyebrow {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #ff8a00;
        }
        .cs-title {
          margin: 12px 0 0;
          font-size: clamp(2rem, 4.5vw, 56px);
          font-weight: 700;
          line-height: 1.06;
          letter-spacing: -0.035em;
          background-image: linear-gradient(180deg, #ffffff 0%, #b8bec8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          padding-bottom: 0.06em;
        }
        .cs-intro {
          margin: 16px auto 0;
          max-width: 620px;
          font-size: 17px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.68);
        }
      `}</style>
    </section>
  )
}
