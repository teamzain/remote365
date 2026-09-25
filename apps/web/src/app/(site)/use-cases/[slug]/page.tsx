import { notFound } from 'next/navigation'
import ContentPage from '@/components/site/ContentPage'
import JsonLd from '@/components/site/JsonLd'
import { USE_CASES, getUseCase } from '@/content/useCases'
import { breadcrumbs, faqPage, graph, organization, webPage } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

export const dynamicParams = false

export function generateStaticParams() {
  return USE_CASES.map(u => ({ slug: u.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const useCase = getUseCase((await params).slug)
  if (!useCase) return {}
  return pageMetadata({
    title: `${useCase.eyebrow}: ${useCase.title}`,
    description: useCase.summary,
    path: `/use-cases/${useCase.slug}`,
  })
}

export default async function UseCasePage({ params }: Props) {
  const useCase = getUseCase((await params).slug)
  if (!useCase) notFound()

  const path = `/use-cases/${useCase.slug}`
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Use cases', path: '/use-cases' },
    { name: useCase.eyebrow, path },
  ]

  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          webPage({ path, name: useCase.title, description: useCase.summary }),
          breadcrumbs(crumbs),
          faqPage(useCase.faqs, path),
        )}
      />
      <ContentPage
        breadcrumbs={crumbs}
        eyebrow={useCase.eyebrow}
        title={useCase.title}
        answer={useCase.answer}
        image={{ src: useCase.image, alt: useCase.imageAlt }}
        sections={useCase.sections}
        faqs={useCase.faqs}
        relatedTitle="More ways teams use Remote365"
        related={USE_CASES.filter(u => u.slug !== useCase.slug).map(u => ({
          title: u.eyebrow,
          text: u.title,
          href: `/use-cases/${u.slug}`,
        }))}
      />
    </>
  )
}
