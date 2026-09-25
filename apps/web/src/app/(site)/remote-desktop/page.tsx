import ContentPage from '@/components/site/ContentPage'
import JsonLd from '@/components/site/JsonLd'
import { REGIONS } from '@/content/regions'
import { breadcrumbs, graph, organization, webPage } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

const TITLE = 'Remote desktop software by country'
const DESCRIPTION =
  'Remote365 for Pakistan, Saudi Arabia, the UAE, the United States and Canada: remote support, unattended access, meetings and chat, with time-zone notes and pricing for each country.'

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: '/remote-desktop' })

export default function RegionsPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Remote desktop by country', path: '/remote-desktop' },
  ]
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          webPage({ path: '/remote-desktop', name: TITLE, description: DESCRIPTION, type: 'CollectionPage' }),
          breadcrumbs(crumbs),
        )}
      />
      <ContentPage
        breadcrumbs={crumbs}
        eyebrow="Remote desktop by country"
        title={TITLE}
        answer="Remote365 works in any country with an internet connection. These pages cover Pakistan, Saudi Arabia, the UAE, the United States and Canada, with the time differences, typical uses and pricing that matter to people supporting colleagues, clients and family there and across borders."
        sections={[
          {
            heading: 'Is Remote365 the same in every country?',
            body: 'Yes. The app, the features and the prices (in US dollars) are the same everywhere. What changes is how people use it, like supporting branches across Saudi cities, or helping parents in Pakistan from Toronto across a 10-hour time difference.',
          },
        ]}
        relatedTitle="Choose a country"
        related={REGIONS.map(r => ({ title: r.areaServed, text: r.metaTitle, href: `/remote-desktop/${r.slug}` }))}
      />
    </>
  )
}
