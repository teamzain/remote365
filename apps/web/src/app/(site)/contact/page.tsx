import Contact from '@/components/site/Contact'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Contact us',
  description:
    'Contact the Remote365 team about sales, plans for your organization, or product support. Send a message and we reply by email.',
  path: '/contact',
})

export default function ContactPage() {
  return <Contact />
}
