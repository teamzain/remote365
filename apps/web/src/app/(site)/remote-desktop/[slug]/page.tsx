import { notFound } from 'next/navigation'
import ContentPage from '@/components/site/ContentPage'
import JsonLd from '@/components/site/JsonLd'
import { REGIONS, getRegion } from '@/content/regions'
import { breadcrumbs, faqPage, graph, organization, service, webPage } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

export const dynamicParams = false

export function generateStaticParams() {
  return REGIONS.map(r => ({ slug: r.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const region = getRegion((await params).slug)
  if (!region) return {}
  const meta = pageMetadata({
    title: region.metaTitle,
    description: region.metaDescription,
    path: `/remote-desktop/${region.slug}`,
  })
  return { ...meta, openGraph: { ...meta.openGraph, locale: region.ogLocale } }
}

export default async function RegionPage({ params }: Props) {
  const region = getRegion((await params).slug)
  if (!region) notFound()

  const path = `/remote-desktop/${region.slug}`
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Remote desktop by country', path: '/remote-desktop' },
    { name: region.areaServed, path },
  ]

  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          webPage({ path, name: region.h1, description: region.metaDescription }),
          service({ path, name: `Remote365 in ${region.areaServed}`, areaServed: region.areaServed, description: region.answer }),
          breadcrumbs(crumbs),
          faqPage(region.faqs, path),
        )}
      />
      <ContentPage
        breadcrumbs={crumbs}
        eyebrow={`Remote365 in ${region.name}`}
        title={region.h1}
        answer={region.answer}
        facts={[
          { label: 'Time zone', value: region.timeZones },
          { label: 'Pricing', value: '15-day free trial, then monthly plans in US dollars' },
          { label: 'Works on', value: 'Windows, Android and any modern browser' },
          { label: 'Use it from', value: `${region.cities.slice(0, 4).join(', ')}, or anywhere with internet` },
        ]}
        sections={region.sections}
        faqs={region.faqs}
        relatedTitle="Remote365 in other countries"
        related={REGIONS.filter(r => r.slug !== region.slug).map(r => ({
          title: r.areaServed,
          text: r.metaTitle,
          href: `/remote-desktop/${r.slug}`,
        }))}
      />
    </>
  )
}
