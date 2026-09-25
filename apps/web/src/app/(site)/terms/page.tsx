import TermsOfService from '@/components/site/legal/TermsOfService'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'The terms that govern use of Remote365: accounts, acceptable use of remote access, subscriptions and billing, and the responsibilities of both parties.',
  path: '/terms',
})

export default function TermsPage() {
  return <TermsOfService />
}
