import Docs from '@/components/site/Docs'
import JsonLd from '@/components/site/JsonLd'
import { breadcrumbs, graph, organization, webPage } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

const TITLE = 'Docs & Help Center'
const DESCRIPTION =
  'How to use Remote365: install and sign in, start or join a support session, connect by device ID, set up unattended access, run video meetings and team chat, and manage members, roles and two-factor authentication.'

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: '/docs' })

export default function DocsPage() {
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          webPage({ path: '/docs', name: TITLE, description: DESCRIPTION }),
          breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Docs', path: '/docs' }]),
        )}
      />
      <Docs />
    </>
  )
}
