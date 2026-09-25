'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, Globe2 } from 'lucide-react'
import DeviceIdFlap from './DeviceIdFlap'

// "Start in three steps", in the style of Cult UI's "Feature Carousel"
// (cult-ui.com, `shadcn add https://cult-ui.com/r/feature-carousel.json`):
// a framed stage with step pills (done ✓ / current / next) above a visual
// per step. Rebuilt for this site rather than ported line by line: plain
// CSS, framer-motion, all three steps' text in the HTML (inactive ones
// hidden), auto-advance only while on screen and not hovered, focused or
// under prefers-reduced-motion.

const STEP_MS = 6000

const WindowsIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
    <path d="M3 5.3l7.4-1v7.2H3V5.3zm0 13.4l7.4 1v-7.1H3v6.1zm8.3 1.1L21 21v-8.4h-9.7v7.2zm0-15.6v7.3H21V3l-9.7 1.2z" />
  </svg>
)
const AndroidIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
    <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.87 3.23a11.43 11.43 0 0 0-9.82 0L5.22 5.92a.38.38 0 0 0-.66.38l1.84 3.18A10.84 10.84 0 0 0 1 18h22a10.84 10.84 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 7 15.25zm10 0A1.25 1.25 0 1 1 18.25 14 1.25 1.25 0 0 1 17 15.25z" />
  </svg>
)

const InstallVisual = () => (
  <div className="ss-install">
    <div className="ss-tile"><WindowsIcon /><span>Windows app</span></div>
    <div className="ss-tile"><AndroidIcon /><span>Android app</span></div>
    <div className="ss-tile ss-tile--soft"><Globe2 size={26} strokeWidth={1.8} /><span>Web app in any browser</span></div>
  </div>
)

const ConnectVisual = () => (
  <div className="ss-connect">
    <span className="ss-connect-label">Session code</span>
    <div className="ss-connect-field"><span>042 851 937</span><span className="ss-caret" /></div>
    <span className="ss-connect-btn">Connect</span>
    <span className="ss-connect-or">or connect to your own device by its ID</span>
  </div>
)

interface Step {
  id: string
  label: string
  title: string
  body: string
  visual: React.ReactNode
}

const STEPS: Step[] = [
  {
    id: 'install',
    label: 'Install',
    title: 'Install Remote365',
    body: 'Download the Windows app, or the Android app for phones and tablets. On an Android device you want to control, install the Remote365 Host app.',
    visual: <InstallVisual />,
  },
  {
    id: 'sign-in',
    label: 'Sign in',
    title: 'Sign in and get your device ID',
    body: 'Create a free account or sign in. Your workspace starts with a 15-day trial, and the device registers itself with a permanent 9-digit ID and a password.',
    visual: <DeviceIdFlap />,
  },
  {
    id: 'connect',
    label: 'Connect',
    title: 'Connect',
    body: 'Help someone by sharing a one-time session code, which they join in the Remote365 app, or reach your own devices by their ID from the app or a browser.',
    visual: <ConnectVisual />,
  },
]

export default function StartSteps() {
  const uid = useId().replace(/:/g, '')
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const reduceMotion = useReducedMotion() ?? false
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const running = inView && !paused && !reduceMotion

  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => setActive(i => (i + 1) % STEPS.length), STEP_MS)
    return () => clearTimeout(id)
  }, [running, active])

  return (
    <section
      ref={ref}
      className="ss"
      aria-labelledby={`${uid}-heading`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false) }}
    >
      <h2 className="ss-heading" id={`${uid}-heading`}>Start in three steps</h2>

      <div className="ss-frame">
        <ol className="ss-pills">
          {STEPS.map((step, i) => {
            const state = i < active ? 'done' : i === active ? 'current' : 'next'
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={`ss-pill ss-pill--${state}`}
                  aria-current={i === active ? 'step' : undefined}
                  aria-controls={`${uid}-${step.id}`}
                  onClick={() => setActive(i)}
                >
                  <span className="ss-pill-mark">{state === 'done' ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  {step.label}
                  {state === 'current' && running && (
                    <motion.span
                      key={active}
                      className="ss-pill-progress"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ol>

        {STEPS.map((step, i) => (
          <div key={step.id} id={`${uid}-${step.id}`} className="ss-step" hidden={i !== active}>
            <div className="ss-text">
              <h3 className="ss-title">{step.title}</h3>
              <p className="ss-body">{step.body}</p>
            </div>
            {i === active && !reduceMotion ? (
              <motion.div
                key={active}
                className="ss-visual"
                initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                {step.visual}
              </motion.div>
            ) : (
              <div className="ss-visual">{step.visual}</div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .ss {
          max-width: 980px;
          margin: 0 auto;
          padding: clamp(48px, 7vw, 88px) clamp(16px, 4vw, 40px);
          color: #fff;
        }
        .ss-heading {
          margin: 0 0 24px;
          text-align: center;
          font-size: clamp(1.8rem, 3.6vw, 44px);
          font-weight: 700;
          letter-spacing: -0.03em;
          background-image: linear-gradient(180deg, #ffffff 0%, #b8bec8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          padding-bottom: 0.06em;
        }
        .ss-frame {
          border-radius: 28px;
          border: 6px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(600px 300px at 80% 100%, rgba(255, 138, 0, 0.14), transparent 70%),
            rgba(12, 12, 14, 0.78);
          padding: clamp(18px, 3vw, 32px);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .ss-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .ss-pill {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px 7px 8px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.6);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .ss-pill:focus-visible { outline: 2px solid #ff8a00; outline-offset: 2px; }
        .ss-pill-mark {
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          font-size: 11px;
        }
        .ss-pill--done { color: rgba(255, 255, 255, 0.78); }
        .ss-pill--done .ss-pill-mark { background: rgba(40, 200, 64, 0.22); color: #7ee29a; }
        .ss-pill--current { color: #ffb347; border-color: rgba(255, 138, 0, 0.55); background: rgba(255, 138, 0, 0.1); }
        .ss-pill--current .ss-pill-mark { background: #ff8a00; color: #111315; }
        .ss-pill-progress {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 2px;
          background: #ff8a00;
          transform-origin: left center;
        }
        .ss-step {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          align-items: center;
          gap: clamp(20px, 4vw, 48px);
          min-height: 260px;
          margin-top: 24px;
        }
        /* display:grid above would otherwise override the hidden attribute */
        .ss-step[hidden] { display: none; }
        .ss-title { margin: 0; font-size: clamp(22px, 2.6vw, 30px); font-weight: 650; letter-spacing: -0.02em; }
        .ss-body { margin: 12px 0 0; font-size: 16px; line-height: 1.65; color: rgba(255, 255, 255, 0.72); }
        .ss-visual { display: flex; justify-content: center; min-width: 0; }
        .ss-install { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 380px; }
        .ss-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 108px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }
        .ss-tile svg { color: #ffb347; }
        .ss-tile--soft { grid-column: span 2; min-height: 72px; flex-direction: row; color: rgba(255, 255, 255, 0.8); }
        .ss-connect {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          max-width: 340px;
          padding: 22px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
        }
        .ss-connect-label { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255, 255, 255, 0.55); }
        .ss-connect-field {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 48px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 138, 0, 0.6);
          background: rgba(0, 0, 0, 0.35);
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }
        .ss-caret { width: 2px; height: 22px; background: #ff8a00; animation: ssBlink 1s steps(1) infinite; }
        @keyframes ssBlink { 50% { opacity: 0; } }
        .ss-connect-btn {
          display: grid;
          place-items: center;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #ff8a00 0%, #f97316 100%);
          color: #111315;
          font-size: 15px;
          font-weight: 700;
        }
        .ss-connect-or { font-size: 13px; color: rgba(255, 255, 255, 0.55); text-align: center; }
        @media (max-width: 760px) {
          .ss-step { grid-template-columns: minmax(0, 1fr); min-height: 0; }
          .ss-visual { order: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ss-caret { animation: none; }
        }
      `}</style>
    </section>
  )
}
