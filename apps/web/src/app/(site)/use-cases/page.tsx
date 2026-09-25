import ContentPage from '@/components/site/ContentPage'
import JsonLd from '@/components/site/JsonLd'
import { USE_CASES } from '@/content/useCases'
import { breadcrumbs, graph, organization, webPage } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

const TITLE = 'How people use Remote365'
const DESCRIPTION =
  'Four common ways to use Remote365: IT help desks supporting colleagues, managed service providers looking after client machines, remote teams, and families helping relatives from another city or country.'

export const metadata = pageMetadata({ title: 'Use cases', description: DESCRIPTION, path: '/use-cases' })

export default function UseCasesPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Use cases', path: '/use-cases' },
  ]
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          webPage({ path: '/use-cases', name: TITLE, description: DESCRIPTION, type: 'CollectionPage' }),
          breadcrumbs(crumbs),
        )}
      />
      <ContentPage
        breadcrumbs={crumbs}
        eyebrow="Use cases"
        title={TITLE}
        answer="Remote365 is used for four main jobs: supporting colleagues from an IT help desk, managing client devices as a service provider, keeping a remote team connected, and helping family with their phone or PC from anywhere. Each uses the same app: support sessions, unattended access, meetings and chat."
        sections={[]}
        relatedTitle="Pick your situation"
        related={USE_CASES.map(u => ({ title: u.eyebrow, text: u.title, href: `/use-cases/${u.slug}` }))}
      />
    </>
  )
}
