import PrivacyPolicy from '@/components/site/legal/PrivacyPolicy'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How Remote365 collects, uses, stores and protects personal information across the website, the desktop and mobile apps, and remote support sessions.',
  path: '/privacy',
})

export default function PrivacyPage() {
  return <PrivacyPolicy />
}
