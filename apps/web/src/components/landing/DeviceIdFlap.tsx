'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import SplitFlapBoard from './SplitFlapBoard'

// "Every device gets its own ID": an airport-style board that flips between
// example device IDs (the same ones as the orbit above) while on screen.
const IDS = ['123 456 789', '987 654 321', '456 789 123', '789 123 456']
// The first flip comes right after the board appears (once the section's
// fade-in has mostly run), not a whole cycle later.
const FIRST_FLIP_MS = 400
const CYCLE_MS = 3200

export default function DeviceIdFlap() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5 })
  const reduceMotion = useReducedMotion() ?? false
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!inView || reduceMotion) return
    const next = () => setIndex(i => (i + 1) % IDS.length)
    let cycle: ReturnType<typeof setInterval> | undefined
    const first = setTimeout(() => {
      next()
      cycle = setInterval(next, CYCLE_MS)
    }, FIRST_FLIP_MS)
    return () => {
      clearTimeout(first)
      clearInterval(cycle)
    }
  }, [inView, reduceMotion])

  return (
    <div ref={ref} className="dif">
      <span className="dif-label">Example device ID</span>
      <SplitFlapBoard value={IDS[index]} label={`Example device ID ${IDS[index]}`} animated={!reduceMotion} />
      <style>{`
        .dif {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        .dif-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
        }
      `}</style>
    </div>
  )
}
