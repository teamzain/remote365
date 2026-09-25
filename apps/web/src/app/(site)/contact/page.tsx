import Contact from '@/components/site/Contact'
import JsonLd from '@/components/site/JsonLd'
import { breadcrumbs, graph, organization, webPage } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Contact us',
  description:
    'Contact the Remote365 team about sales, plans for your organization, or product support. Send a message and we reply by email.',
  path: '/contact',
})

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          webPage({ path: '/contact', name: 'Contact Remote365', description: 'Contact the Remote365 team about sales, plans or product support.', type: 'ContactPage' }),
          breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }]),
        )}
      />
      <Contact />
    </>
  )
}
