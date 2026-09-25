'use client'

import React, { useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Port of Cult UI's "Direction Aware Tabs" (cult-ui.com, `shadcn add
// https://cult-ui.com/r/direction-aware-tabs.json`): a pill tab bar whose
// highlight slides to the chosen tab, and content that enters from the side
// you moved towards. Changed for this site:
//  - every panel is rendered (inactive ones `hidden`), so all of the text is
//    in the HTML for search engines and AI answers
//  - WAI-ARIA tabs: roles, aria-selected/controls, arrow keys, Home and End
//  - tabs wrap on narrow screens instead of scrolling sideways
//  - framer-motion instead of motion/react, no react-use-measure (panels
//    size themselves), no motion under prefers-reduced-motion

export interface FeatureTab {
  id: string
  label: string
  title: string
  body: string
  points: string[]
  visual: React.ReactNode
}

function Panel({ tab }: { tab: FeatureTab }) {
  return (
    <div className="ft-panel-grid">
      <div className="ft-copy">
        <h3 className="ft-title">{tab.title}</h3>
        <p className="ft-body">{tab.body}</p>
        <ul className="ft-points">
          {tab.points.map(p => <li key={p}>{p}</li>)}
        </ul>
      </div>
      <div className="ft-visual">{tab.visual}</div>
    </div>
  )
}

export default function FeatureTabs({ tabs, heading, intro }: { tabs: FeatureTab[]; heading: string; intro?: string }) {
  const uid = useId().replace(/:/g, '')
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(1)
  const reduceMotion = useReducedMotion() ?? false
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const select = (i: number, focus = false) => {
    if (i === active) return
    setDirection(i > active ? 1 : -1)
    setActive(i)
    if (focus) buttons.current[i]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = tabs.length - 1
    const to =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (to === null) return
    e.preventDefault()
    select(to, true)
  }

  return (
    <section className="ft" aria-labelledby={`${uid}-heading`}>
      <header className="ft-head">
        <h2 className="ft-heading" id={`${uid}-heading`}>{heading}</h2>
        {intro && <p className="ft-intro">{intro}</p>}
      </header>

      <div className="ft-tabs" role="tablist" aria-label={heading}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={el => { buttons.current[i] = el }}
            type="button"
            role="tab"
            id={`${uid}-tab-${tab.id}`}
            aria-selected={i === active}
            aria-controls={`${uid}-panel-${tab.id}`}
            tabIndex={i === active ? 0 : -1}
            className={`ft-tab${i === active ? ' is-active' : ''}`}
            onClick={() => select(i)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {i === active && (
              <motion.span
                layoutId={`${uid}-bubble`}
                className="ft-bubble"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.19, duration: 0.4 }}
              />
            )}
            <span className="ft-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="ft-panels">
        {tabs.map((tab, i) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${uid}-panel-${tab.id}`}
            aria-labelledby={`${uid}-tab-${tab.id}`}
            hidden={i !== active}
            tabIndex={0}
            className="ft-panel"
          >
            {i === active && !reduceMotion ? (
              <motion.div
                key={active}
                initial={{ x: 48 * direction, opacity: 0, filter: 'blur(4px)' }}
                animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
              >
                <Panel tab={tab} />
              </motion.div>
            ) : (
              <Panel tab={tab} />
            )}
          </div>
        ))}
      </div>

      <style>{`
        .ft {
          max-width: 1214px;
          margin: 0 auto;
          padding: clamp(56px, 8vw, 96px) clamp(16px, 4vw, 40px);
          color: #fff;
        }
        .ft-head { max-width: 760px; margin: 0 auto; text-align: center; }
        .ft-heading {
          margin: 0;
          font-size: clamp(2rem, 4vw, 48px);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.03em;
          background-image: linear-gradient(180deg, #ffffff 0%, #b8bec8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          padding-bottom: 0.06em;
        }
        .ft-intro { margin: 14px 0 0; font-size: 17px; line-height: 1.6; color: rgba(255, 255, 255, 0.66); }
        .ft-tabs {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 4px;
          width: fit-content;
          max-width: 100%;
          margin: 32px auto 0;
          padding: 4px;
          border-radius: 26px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .ft-tab {
          position: relative;
          padding: 9px 16px;
          border: 0;
          border-radius: 9999px;
          background: none;
          color: rgba(255, 255, 255, 0.7);
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: color 0.2s;
        }
        .ft-tab:hover { color: #fff; }
        .ft-tab.is-active { color: #111315; }
        .ft-tab:focus-visible { outline: 2px solid #ff8a00; outline-offset: 2px; }
        .ft-bubble {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: linear-gradient(135deg, #ff8a00 0%, #ffb347 100%);
          box-shadow: 0 6px 18px rgba(255, 138, 0, 0.3);
        }
        .ft-tab-label { position: relative; z-index: 1; }
        .ft-panels { margin-top: 32px; }
        .ft-panel { outline: none; }
        .ft-panel:focus-visible { outline: 2px solid rgba(255, 138, 0, 0.6); outline-offset: 8px; border-radius: 20px; }
        .ft-panel-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          align-items: center;
          gap: clamp(24px, 4vw, 56px);
          padding: clamp(20px, 3vw, 36px);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 12, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .ft-title { margin: 0; font-size: clamp(22px, 2.4vw, 30px); font-weight: 650; letter-spacing: -0.02em; line-height: 1.2; }
        .ft-body { margin: 12px 0 0; font-size: 16px; line-height: 1.65; color: rgba(255, 255, 255, 0.72); }
        .ft-points { margin: 18px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .ft-points li {
          position: relative;
          padding-left: 26px;
          font-size: 15px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.84);
        }
        .ft-points li::before {
          content: '';
          position: absolute;
          left: 2px;
          top: 0.42em;
          width: 12px;
          height: 7px;
          border-left: 2px solid #ff8a00;
          border-bottom: 2px solid #ff8a00;
          transform: rotate(-45deg);
        }
        .ft-visual { min-width: 0; }
        .ft-visual img { display: block; width: 100%; height: auto; border-radius: 16px; }
        @media (max-width: 860px) {
          .ft-panel-grid { grid-template-columns: minmax(0, 1fr); }
          .ft-visual { order: -1; }
        }
      `}</style>
    </section>
  )
}
