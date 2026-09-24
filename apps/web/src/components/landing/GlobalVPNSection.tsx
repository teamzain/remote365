import React, { useEffect, useRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import createGlobe from 'cobe'

type LatLon = [number, number]

const MARKERS: { location: LatLon; size: number }[] = [
  { location: [37.78,  -122.44], size: 0.04 },
  { location: [40.71,   -74.01], size: 0.04 },
  { location: [51.51,    -0.13], size: 0.04 },
  { location: [48.86,    2.35 ], size: 0.03 },
  { location: [52.52,   13.41 ], size: 0.03 },
  { location: [25.20,   55.27 ], size: 0.03 },
  { location: [28.61,   77.21 ], size: 0.03 },
  { location: [31.23,  121.47 ], size: 0.04 },
  { location: [35.68,  139.65 ], size: 0.04 },
  { location: [-33.87, 151.21 ], size: 0.04 },
  { location: [-23.55,  -46.63], size: 0.03 },
  { location: [  1.35, 103.82 ], size: 0.03 },
]

const ARCS: { from: LatLon; to: LatLon }[] = [
  { from: [37.78, -122.44], to: [51.51,  -0.13 ] },
  { from: [40.71,  -74.01], to: [51.51,  -0.13 ] },
  { from: [51.51,   -0.13], to: [25.20,  55.27  ] },
  { from: [25.20,   55.27], to: [28.61,  77.21  ] },
  { from: [28.61,   77.21], to: [31.23, 121.47  ] },
  { from: [31.23,  121.47], to: [35.68, 139.65  ] },
  { from: [35.68,  139.65], to: [-33.87, 151.21 ] },
  { from: [37.78, -122.44], to: [-23.55,  -46.63] },
  { from: [40.71,  -74.01], to: [-23.55,  -46.63] },
  { from: [31.23,  121.47], to: [  1.35, 103.82  ] },
]

const GlobeCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.width = 600 * 2
    canvas.height = 600 * 2
    Object.assign(canvas.style, {
      width: '600px',
      height: '600px',
      maxWidth: '100%',
      opacity: '0',
      transition: 'opacity 1s ease',
    })
    container.appendChild(canvas)

    let phi = 0
    let rafId: number

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width:  600 * 2,
      height: 600 * 2,
      phi:    0,
      theta:  0.25,
      dark:   1,
      diffuse:       1.2,
      mapSamples:    16000,
      mapBrightness: 6,
      baseColor:   [0.1, 0.15, 0.28],
      markerColor: [0.776, 0.345, 0.208],
      glowColor:   [0.8, 0.88, 1.0],
      markers:  MARKERS,
      arcs:     ARCS,
      arcColor: [0.776, 0.345, 0.208],
      arcWidth:  0.5,
      arcHeight: 0.3,
    })

    const animate = () => {
      globe.update({ phi })
      phi += 0.004
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    setTimeout(() => { canvas.style.opacity = '1' }, 200)

    return () => {
      cancelAnimationFrame(rafId)
      globe.destroy()
      container.innerHTML = ''
    }
  }, [])

  return <div ref={containerRef} style={{ width: 600, height: 600, maxWidth: '100%' }} />
}

const GlobalVPNSection: React.FC = () => (
  <section style={{ background: '#FFFFFF' }}>
    <div className="globalvpn-container">

      {/* Left: text */}
      <div className="globalvpn-text">
        <h2 style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 500,
          fontSize: 'clamp(1.8rem, 3vw, 48px)',
          lineHeight: '1.18',
          letterSpacing: '-0.96px',
          color: '#000000',
          margin: '0 0 20px 0',
        }}>
          Access your devices from anywhere in the world
        </h2>

        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: 'clamp(16px, 1.5vw, 18px)',
          lineHeight: '1.5',
          letterSpacing: '-0.18px',
          color: 'rgba(26, 29, 33, 0.65)',
          margin: '0 0 32px 0',
        }}>
          Connect to any registered device using a unique 9-digit ID — from your browser, desktop app, or mobile. No VPN, no port forwarding, no firewall rules.
        </p>

        <RouterLink to="/remote-access" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          textDecoration: 'none',
        }}>
          <span style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: '16px',
            lineHeight: '23px',
            letterSpacing: '-0.17px',
            color: '#000000',
          }}>
            Learn more
          </span>
          <ExternalLink size={17} color="#000000" />
        </RouterLink>
      </div>

      {/* Right: animated globe */}
      <div className="globalvpn-globe">
        <GlobeCanvas />
      </div>

    </div>

    <style>{`
      .globalvpn-container {
        max-width: 1360px;
        margin: 0 auto;
        padding: clamp(60px, 8vw, 112px) clamp(20px, 5vw, 67px) clamp(40px, 6vw, 80px);
        display: flex;
        align-items: center;
        gap: clamp(32px, 5vw, 80px);
      }
      .globalvpn-text {
        flex: 0 0 420px;
        max-width: 420px;
      }
      .globalvpn-globe {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        margin-top: -40px;
      }
      @media (max-width: 900px) {
        .globalvpn-container {
          flex-direction: column;
          padding-bottom: 60px;
        }
        .globalvpn-text {
          flex: none;
          max-width: 100%;
          width: 100%;
        }
        .globalvpn-globe {
          margin-top: 0;
          width: 100%;
        }
        .globalvpn-globe > div {
          width: 100% !important;
          max-width: 400px;
        }
      }
    `}</style>
  </section>
)

export default GlobalVPNSection
