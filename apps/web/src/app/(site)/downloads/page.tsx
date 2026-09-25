import Downloads from '@/components/site/Downloads'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Download Remote365 for Windows and Android',
  description:
    'Download Remote365: the Windows desktop app and two Android apps, one to control other devices and a host app to be controlled. macOS and iOS apps are coming soon; any modern browser works for the web app.',
  path: '/downloads',
})

export default function DownloadsPage() {
  return <Downloads />
}
