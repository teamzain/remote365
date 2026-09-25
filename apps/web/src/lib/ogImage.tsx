import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

let logoData: Promise<string> | undefined
function logo() {
  logoData ??= readFile(path.join(process.cwd(), 'public/logo.png')).then(b => `data:image/png;base64,${b.toString('base64')}`)
  return logoData
}

// Link-preview card in the site's look: near-black with an orange glow, the
// logo, an eyebrow and a title.
export async function renderOgImage({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const src = await logo()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'radial-gradient(900px 520px at 0% 0%, rgba(255,138,0,0.35), transparent 62%), radial-gradient(700px 480px at 100% 100%, rgba(234,88,12,0.22), transparent 60%), #0b0b0d',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={64} height={64} alt="" />
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}>Remote365</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {eyebrow && <span style={{ fontSize: 28, fontWeight: 600, color: '#ff8a00' }}>{eyebrow}</span>}
          <span style={{ fontSize: title.length > 48 ? 58 : 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.03em', maxWidth: 1000 }}>
            {title}
          </span>
          {subtitle && <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.7)', maxWidth: 980, lineHeight: 1.4 }}>{subtitle}</span>}
        </div>
        <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.55)' }}>remote365.ai</span>
      </div>
    ),
    OG_SIZE,
  )
}
