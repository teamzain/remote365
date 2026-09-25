import { OG_SIZE, renderOgImage } from '@/lib/ogImage'
import { REGIONS, getRegion } from '@/content/regions'

export const alt = 'Remote365 remote desktop'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return REGIONS.map(r => ({ slug: r.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const region = getRegion((await params).slug)
  return renderOgImage({
    eyebrow: region ? `Remote365 in ${region.areaServed}` : 'Remote365',
    title: region?.h1 ?? 'Remote desktop and remote support',
  })
}
