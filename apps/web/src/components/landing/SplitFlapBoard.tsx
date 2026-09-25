'use client'

import React, { useEffect, useRef, useState } from 'react'

// Port of Componentry's "Split Flap Display" (componentry.dev,
// `shadcn add @componentry/split-flap-display`): airport-board cells that
// flap through characters to the target. Changed for this site:
//  - digits only, so a change is at most ten short flaps per cell
//  - one timer chain per cell (the original set state inside a state
//    updater); flaps are CSS animations restarted per step
//  - the first render already shows the value (server HTML and no-JS
//    visitors see the real digits); flipping only happens on change
//  - spaces are gaps, not cells; orange indicator strips; keyframes live in
//    the component's own <style>

const CHARS = ' 0123456789'
const nextChar = (c: string) => CHARS[(CHARS.indexOf(c) + 1) % CHARS.length] ?? ' '

function FlapCell({ target, delay, speed, animated }: { target: string; delay: number; speed: number; animated: boolean }) {
  const [shown, setShown] = useState(target)
  const [prev, setPrev] = useState(target)
  const [step, setStep] = useState(0)
  const shownRef = useRef(target)

  useEffect(() => {
    if (!animated || shownRef.current === target) return
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const from = shownRef.current
      const to = nextChar(from)
      shownRef.current = to
      setPrev(from)
      setShown(to)
      setStep(s => s + 1)
      if (to !== target) timer = setTimeout(tick, speed)
    }
    timer = setTimeout(tick, delay)
    return () => clearTimeout(timer)
  }, [target, animated, delay, speed])

  // Without animation the cell simply shows the target.
  const now = animated ? shown : target
  const before = animated ? prev : target

  return (
    <span className="sf-cell" style={{ ['--sf-speed' as string]: `${speed}ms` }}>
      <span className="sf-half sf-top"><span>{now}</span></span>
      <span className="sf-half sf-bottom"><span>{before}</span></span>
      {animated && step > 0 && (
        <React.Fragment key={step}>
          <span className="sf-half sf-top sf-flap-top"><span>{before}</span></span>
          <span className="sf-half sf-bottom sf-flap-bottom"><span>{now}</span></span>
        </React.Fragment>
      )}
      <span className="sf-divider" />
    </span>
  )
}

interface SplitFlapBoardProps {
  /** Digits and spaces, e.g. "123 456 789". */
  value: string
  /** Read out instead of the individual cells. */
  label: string
  animated?: boolean
  speed?: number
  stagger?: number
}

export default function SplitFlapBoard({ value, label, animated = true, speed = 55, stagger = 45 }: SplitFlapBoardProps) {
  let cellIndex = 0
  return (
    <span className="sf" role="img" aria-label={label}>
      <span className="sf-strip" aria-hidden="true" />
      <span className="sf-cells" aria-hidden="true">
        {value.split('').map((ch, i) =>
          ch === ' '
            ? <span key={i} className="sf-gap" />
            : <FlapCell key={i} target={ch} delay={cellIndex++ * stagger} speed={speed} animated={animated} />,
        )}
      </span>
      <span className="sf-strip" aria-hidden="true" />

      <style>{`
        .sf {
          display: inline-flex;
          align-items: stretch;
          gap: 8px;
          padding: 12px;
          border-radius: 16px;
          background: linear-gradient(145deg, #0c0c0c 0%, #080808 50%, #0a0a0a 100%);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.04);
          --sf-w: 34px;
          --sf-h: 48px;
          --sf-font: 28px;
        }
        .sf-strip {
          width: 5px;
          border-radius: 2px;
          background: linear-gradient(180deg, #ff8a00 0%, rgba(255, 138, 0, 0.6) 40%, rgba(255, 138, 0, 0.4) 60%, rgba(255, 138, 0, 0.6) 100%);
          box-shadow: 0 0 10px rgba(255, 138, 0, 0.35);
        }
        .sf-cells { display: inline-flex; gap: 3px; }
        .sf-gap { width: calc(var(--sf-w) * 0.35); }
        .sf-cell {
          position: relative;
          width: var(--sf-w);
          height: var(--sf-h);
          perspective: 400px;
          font-family: 'SF Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace;
          font-size: var(--sf-font);
          font-weight: 700;
          user-select: none;
        }
        .sf-half {
          position: absolute;
          left: 0;
          right: 0;
          height: 50%;
          overflow: hidden;
        }
        .sf-half > span {
          position: absolute;
          left: 50%;
          line-height: 1;
          transform: translateX(-50%);
        }
        .sf-top {
          top: 0;
          border-radius: 4px 4px 0 0;
          background: linear-gradient(180deg, #1f1f1f 0%, #191919 100%);
        }
        .sf-top > span { bottom: 0; transform: translate(-50%, 50%); color: #f2efe9; }
        .sf-bottom {
          bottom: 0;
          border-radius: 0 0 4px 4px;
          background: linear-gradient(180deg, #161616 0%, #111 100%);
        }
        .sf-bottom > span { top: 0; transform: translate(-50%, -50%); color: #dcd9d3; }
        .sf-flap-top {
          z-index: 2;
          transform-origin: bottom center;
          background: linear-gradient(180deg, #232323 0%, #1b1b1b 100%);
          animation: sfTop calc(var(--sf-speed) * 0.5) ease-in forwards;
        }
        .sf-flap-bottom {
          z-index: 2;
          transform-origin: top center;
          transform: rotateX(90deg);
          animation: sfBottom calc(var(--sf-speed) * 0.5) ease-out calc(var(--sf-speed) * 0.5) forwards;
        }
        .sf-divider {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          z-index: 3;
          height: 2px;
          transform: translateY(-50%);
          background: rgba(0, 0, 0, 0.85);
        }
        @keyframes sfTop { from { transform: rotateX(0deg); } to { transform: rotateX(-90deg); } }
        @keyframes sfBottom { from { transform: rotateX(90deg); } to { transform: rotateX(0deg); } }
        @media (max-width: 480px) {
          .sf { --sf-w: 22px; --sf-h: 34px; --sf-font: 19px; gap: 6px; padding: 10px; }
        }
      `}</style>
    </span>
  )
}
