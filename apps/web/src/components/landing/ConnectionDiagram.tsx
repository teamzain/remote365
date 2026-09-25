'use client'

import React, { useId, useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { Laptop, Monitor, Radio } from 'lucide-react'

// How a Remote365 connection works, drawn with a port of Componentry's
// "Circuit Board" (componentry.dev, `shadcn add @componentry/circuit-board`):
// right-angled traces with light pulses running between nodes. Changed for
// this site:
//  - fixed content (the real connection path) instead of generic props
//  - scales with its container (SVG viewBox + %-positioned nodes)
//  - brand colours on the dark site; ids from useId (two diagrams can share a page)
//  - pulses only run while the diagram is on screen, and not at all under
//    prefers-reduced-motion
//  - labels are real text, and a caption explains the picture
//
// What it shows is how the product connects (WebRTC): Remote365 introduces
// the two devices, then the session runs directly between them, encrypted end
// to end; when no direct path exists, an encrypted relay carries it.

const W = 640
const H = 380

interface Node {
  id: string
  x: number
  y: number
  label: string
  sub?: string
  icon: React.ReactNode
  accent?: boolean
}

interface Link {
  from: string
  to: string
  kind: 'direct' | 'signal' | 'relay'
}

const NODES: Node[] = [
  { id: 'you', x: 96, y: 190, label: 'Your device', icon: <Laptop size={22} strokeWidth={1.8} /> },
  // eslint-disable-next-line @next/next/no-img-element
  { id: 'r365', x: 320, y: 90, label: 'Remote365', sub: 'Sign-in and introduction', icon: <img src="/logo.png" alt="" width={26} height={26} />, accent: true },
  { id: 'relay', x: 320, y: 290, label: 'Encrypted relay', sub: 'Only if needed', icon: <Radio size={20} strokeWidth={1.8} /> },
  { id: 'them', x: 544, y: 190, label: 'Their device', icon: <Monitor size={22} strokeWidth={1.8} /> },
]

const LINKS: Link[] = [
  { from: 'you', to: 'r365', kind: 'signal' },
  { from: 'them', to: 'r365', kind: 'signal' },
  { from: 'you', to: 'them', kind: 'direct' },
  { from: 'you', to: 'relay', kind: 'relay' },
  { from: 'relay', to: 'them', kind: 'relay' },
]

const NODE_R = 30 // half the node box, plus a little air for the trace ends

// Right-angled "circuit" path between two node centres (from the original).
function tracePath(a: Node, b: Node) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) > Math.abs(dy)) {
    const sx = a.x + (dx > 0 ? NODE_R : -NODE_R)
    const ex = b.x + (dx > 0 ? -NODE_R : NODE_R)
    const mx = a.x + dx / 2
    return `M ${sx} ${a.y} H ${mx} V ${b.y} H ${ex}`
  }
  const sy = a.y + (dy > 0 ? NODE_R : -NODE_R)
  const ey = b.y + (dy > 0 ? -NODE_R : NODE_R)
  const my = a.y + dy / 2
  return `M ${a.x} ${sy} V ${my} H ${b.x} V ${ey}`
}

const STYLE: Record<Link['kind'], { trace: string; pulse: string; width: number; dash?: string; speed: number }> = {
  direct: { trace: 'rgba(255, 138, 0, 0.45)', pulse: '#ffb347', width: 2.5, speed: 1.8 },
  signal: { trace: 'rgba(255, 255, 255, 0.18)', pulse: 'rgba(255, 255, 255, 0.85)', width: 1.5, dash: '4 6', speed: 2.6 },
  relay: { trace: 'rgba(255, 138, 0, 0.22)', pulse: 'rgba(255, 179, 71, 0.8)', width: 1.5, dash: '2 6', speed: 3.2 },
}

const PULSE_LEN = 500 // approximate path length used for the dash animation

export default function ConnectionDiagram({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const reduceMotion = useReducedMotion() ?? false
  const animate = inView && !reduceMotion
  const nodeById = new Map(NODES.map(n => [n.id, n]))
  const direct = nodeById.get('you')!
  const directTo = nodeById.get('them')!

  return (
    <figure className={`cd ${className}`}>
      <div ref={ref} className="cd-board" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="cd-svg" aria-hidden="true">
          <defs>
            <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id={`${uid}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.7" fill="rgba(255,255,255,0.09)" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill={`url(#${uid}-grid)`} />

          {LINKS.map((link, i) => {
            const a = nodeById.get(link.from)!
            const b = nodeById.get(link.to)!
            const d = tracePath(a, b)
            const s = STYLE[link.kind]
            return (
              <g key={`${link.from}-${link.to}`}>
                <path d={d} fill="none" stroke={s.trace} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" />
                {animate && (
                  <>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={s.pulse}
                      strokeWidth={s.width + 1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter={`url(#${uid}-glow)`}
                      strokeDasharray={`${PULSE_LEN * 0.08} ${PULSE_LEN * 0.92}`}
                      initial={{ strokeDashoffset: PULSE_LEN }}
                      animate={{ strokeDashoffset: -PULSE_LEN }}
                      transition={{ duration: s.speed, repeat: Infinity, ease: 'linear', delay: i * 0.35 }}
                    />
                    {/* Data flows both ways in a session */}
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={s.pulse}
                      strokeWidth={s.width + 1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter={`url(#${uid}-glow)`}
                      strokeDasharray={`${PULSE_LEN * 0.08} ${PULSE_LEN * 0.92}`}
                      initial={{ strokeDashoffset: -PULSE_LEN }}
                      animate={{ strokeDashoffset: PULSE_LEN }}
                      transition={{ duration: s.speed, repeat: Infinity, ease: 'linear', delay: i * 0.35 + s.speed / 2 }}
                    />
                  </>
                )}
              </g>
            )
          })}
        </svg>

        {/* The direct link's label sits on the trace between the two devices. */}
        <span
          className="cd-direct-label"
          style={{ left: `${((direct.x + directTo.x) / 2 / W) * 100}%`, top: `${(direct.y / H) * 100}%` }}
        >
          End-to-end encrypted
        </span>

        {NODES.map(node => (
          <div
            key={node.id}
            className={`cd-node${node.accent ? ' cd-node--accent' : ''}`}
            style={{ left: `${(node.x / W) * 100}%`, top: `${(node.y / H) * 100}%` }}
          >
            <span className="cd-node-box">{node.icon}</span>
            <span className="cd-node-label">
              {node.label}
              {node.sub && <span className="cd-node-sub">{node.sub}</span>}
            </span>
          </div>
        ))}
      </div>

      <figcaption className="cd-caption">
        Remote365 signs both devices in and introduces them. The session itself then runs
        directly between them, end-to-end encrypted. When no direct path exists, an
        encrypted relay carries it, so there is still no VPN or port forwarding to set up.
      </figcaption>

      <style>{`
        .cd { margin: 0; width: 100%; color: #fff; }
        .cd-board {
          position: relative;
          width: 100%;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(420px 220px at 50% 50%, rgba(255, 138, 0, 0.1), transparent 70%),
            rgba(10, 10, 12, 0.6);
          overflow: hidden;
        }
        .cd-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .cd-node {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translate(-50%, -50%);
        }
        .cd-node-box {
          display: grid;
          place-items: center;
          width: clamp(40px, 7.5vw, 52px);
          height: clamp(40px, 7.5vw, 52px);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(20, 20, 24, 0.92);
          color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        }
        .cd-node--accent .cd-node-box {
          border-color: rgba(255, 138, 0, 0.7);
          box-shadow: 0 0 24px rgba(255, 138, 0, 0.35), 0 8px 24px rgba(0, 0, 0, 0.45);
        }
        .cd-node-box img { width: 60%; height: 60%; object-fit: contain; }
        .cd-node-label {
          position: absolute;
          top: calc(100% + 6px);
          display: flex;
          flex-direction: column;
          align-items: center;
          white-space: nowrap;
          font-size: clamp(10px, 1.5vw, 13px);
          font-weight: 600;
          color: #fff;
          text-align: center;
        }
        .cd-node-sub {
          font-size: clamp(9px, 1.25vw, 11px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
        }
        /* Labels of the top node sit above it, clear of the traces below. */
        .cd-node--accent .cd-node-label { top: auto; bottom: calc(100% + 6px); }
        /* Phones: one-line labels; the caption carries the detail. */
        @media (max-width: 520px) {
          .cd-node-sub { display: none; }
        }
        .cd-direct-label {
          position: absolute;
          transform: translate(-50%, calc(-100% - 8px));
          padding: 3px 10px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 138, 0, 0.45);
          background: rgba(20, 12, 4, 0.9);
          font-size: clamp(9px, 1.3vw, 12px);
          font-weight: 600;
          color: #ffb347;
          white-space: nowrap;
        }
        .cd-caption {
          margin: 14px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.62);
        }
      `}</style>
    </figure>
  )
}
