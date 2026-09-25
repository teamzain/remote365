import Docs from '@/components/site/Docs'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Docs & Help Center',
  description:
    'How to use Remote365: install and sign in, start or join a support session, connect by device ID, set up unattended access, run video meetings and team chat, and manage members, roles and two-factor authentication.',
  path: '/docs',
})

export default function DocsPage() {
  return <Docs />
}
