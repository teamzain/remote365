'use client'

import { useEffect, useRef, useState } from 'react'
import type { Globe } from 'cobe'

// A dotted WebGL globe (cobe, ~13 KB, loaded only when it nears the screen)
// with the cities the region pages talk about and arcs for the everyday
// cross-border help between them: Pakistan, the Gulf and North America.
// It starts facing Pakistan and the Gulf, turns slowly while on screen, can
// be dragged, and holds still under prefers-reduced-motion. Without WebGL the
// fallback (the city list below it) is all that shows.

type LatLng = [number, number]

const CITIES: { name: string; at: LatLng }[] = [
  { name: 'Karachi', at: [24.86, 67.01] },
  { name: 'Lahore', at: [31.55, 74.34] },
  { name: 'Islamabad', at: [33.68, 73.05] },
  { name: 'Riyadh', at: [24.71, 46.68] },
  { name: 'Jeddah', at: [21.49, 39.19] },
  { name: 'Dubai', at: [25.2, 55.27] },
  { name: 'Abu Dhabi', at: [24.45, 54.38] },
  { name: 'Toronto', at: [43.65, -79.38] },
  { name: 'Vancouver', at: [49.28, -123.12] },
  { name: 'New York', at: [40.71, -74.01] },
  { name: 'Houston', at: [29.76, -95.37] },
]

const at = (name: string) => CITIES.find(c => c.name === name)!.at

const ARCS: [string, string][] = [
  ['Toronto', 'Lahore'],
  ['Houston', 'Karachi'],
  ['Dubai', 'Islamabad'],
  ['Riyadh', 'Karachi'],
  ['New York', 'Dubai'],
  ['Vancouver', 'Toronto'],
]

// cobe's angles for putting a location in front of the camera.
const facing = (lat: number, lng: number): [number, number] => [
  Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2),
  (lat * Math.PI) / 180,
]

const [START_PHI] = facing(28, 62)

export default function RegionGlobe({ className = '' }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    let globe: Globe | null = null
    let raf = 0
    let visible = false
    let phi = START_PHI
    let dragX: number | null = null
    let dragPhi = 0
    let cancelled = false
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const size = () => Math.max(1, Math.round(wrap.getBoundingClientRect().width))

    const frame = () => {
      raf = 0
      if (!globe || !visible) return
      if (dragX === null && !reduceMotion) phi += 0.0028
      globe.update({ phi, width: size(), height: size() })
      if (!reduceMotion || dragX !== null) raf = requestAnimationFrame(frame)
    }
    const kick = () => { if (!raf && globe && visible) raf = requestAnimationFrame(frame) }

    const start = async () => {
      if (globe || cancelled) return
      try {
        const { default: createGlobe } = await import('cobe')
        if (cancelled) return
        // cobe multiplies width/height by devicePixelRatio itself.
        globe = createGlobe(canvas, {
          devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
          width: size(),
          height: size(),
          phi,
          theta: 0.32,
          dark: 1,
          diffuse: 1.15,
          mapSamples: 16000,
          mapBrightness: 5.5,
          mapBaseBrightness: 0.02,
          baseColor: [0.22, 0.22, 0.25],
          markerColor: [1, 0.54, 0],
          glowColor: [0.55, 0.3, 0.08],
          arcColor: [1, 0.62, 0.2],
          arcWidth: 0.6,
          arcHeight: 0.28,
          markerElevation: 0.015,
          opacity: 0.92,
          markers: CITIES.map(c => ({ location: c.at, size: 0.045 })),
          arcs: ARCS.map(([from, to]) => ({ from: at(from), to: at(to) })),
        })
        canvas.style.opacity = '1'
        kick()
        if (reduceMotion) globe.update({ phi })
      } catch {
        setFailed(true)
      }
    }

    const io = new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting)
      if (visible) { start(); kick() }
    }, { rootMargin: '200px' })
    io.observe(wrap)

    const onDown = (e: PointerEvent) => { dragX = e.clientX; dragPhi = phi; canvas.setPointerCapture(e.pointerId); kick() }
    const onMove = (e: PointerEvent) => { if (dragX !== null) phi = dragPhi + (e.clientX - dragX) / 180 }
    const onUp = () => { dragX = null; kick() }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    const onResize = () => { if (globe) { globe.update({ width: size(), height: size() }); kick() } }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      io.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      globe?.destroy()
    }
  }, [])

  return (
    <figure className={`rg ${className}`}>
      <div ref={wrapRef} className="rg-stage">
        {!failed && (
          <canvas
            ref={canvasRef}
            className="rg-canvas"
            aria-label="Globe with Pakistan, the Gulf and North America connected"
            role="img"
          />
        )}
      </div>
      <figcaption className="rg-cities">
        {CITIES.map(c => <span key={c.name}>{c.name}</span>)}
      </figcaption>
      <style>{`
        .rg { margin: 0; width: 100%; max-width: 560px; }
        .rg-stage {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 50%;
          background: radial-gradient(closest-side, rgba(255, 138, 0, 0.12), transparent 70%);
        }
        .rg-canvas {
          width: 100%;
          height: 100%;
          opacity: 0;
          transition: opacity 0.8s ease;
          cursor: grab;
          touch-action: pan-y;
          contain: layout paint size;
        }
        .rg-canvas:active { cursor: grabbing; }
        .rg-cities {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px;
          margin-top: 12px;
        }
        .rg-cities span {
          padding: 4px 10px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          font-size: 12px;
          color: rgba(255, 255, 255, 0.72);
        }
      `}</style>
    </figure>
  )
}
