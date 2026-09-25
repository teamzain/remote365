import { OG_SIZE, renderOgImage } from '@/lib/ogImage'
import { USE_CASES, getUseCase } from '@/content/useCases'

export const alt = 'How people use Remote365'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return USE_CASES.map(u => ({ slug: u.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const useCase = getUseCase((await params).slug)
  return renderOgImage({
    eyebrow: useCase?.eyebrow ?? 'Use cases',
    title: useCase?.title ?? 'How people use Remote365',
  })
}
