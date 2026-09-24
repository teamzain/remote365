import React, { useEffect, useRef, useState } from 'react'

interface Stat {
  target: number
  decimals: number
  suffix: string
  label: string
}

const STATS: Stat[] = [
  { target: 3,   decimals: 0, suffix: ' mins', label: 'To setup Remote access' },
  { target: 2.5, decimals: 1, suffix: 'm',     label: 'Remote sessions monthly' },
  { target: 4,   decimals: 0, suffix: 'k+',    label: 'Teams using Remote365' },
]

const DURATION = 1600 // ms

// easeOutCubic — fast start, gentle finish
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

const StatValue: React.FC<{ stat: Stat; run: boolean }> = ({ stat, run }) => {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!run) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION, 1)
      setValue(stat.target * easeOut(progress))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, stat.target])

  return (
    <span className="stat-value">
      {value.toFixed(stat.decimals)}{stat.suffix}
    </span>
  )
}

const StatsCounterSection: React.FC = () => {
  const [run, setRun] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRun(true)
          observer.disconnect() // run once
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="stats-section">
      {STATS.map(stat => (
        <div key={stat.label} className="stat-item">
          <StatValue stat={stat} run={run} />
          <p className="stat-label">{stat.label}</p>
        </div>
      ))}

      <style>{`
        .stats-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 40px 89px;
          padding: 52px clamp(24px, 8vw, 113px);
          background: #F3F4F6;
        }
        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          flex: 1 1 240px;
          text-align: center;
        }
        .stat-value {
          font-weight: 600;
          font-size: clamp(2.4rem, 4.5vw, 55px);
          line-height: 1.42;
          color: #000000;
          font-variant-numeric: tabular-nums;
        }
        .stat-label {
          margin: 0;
          font-weight: 500;
          font-size: clamp(18px, 2vw, 24px);
          line-height: 34px;
          color: #000000;
        }
      `}</style>
    </section>
  )
}

export default StatsCounterSection
