import Downloads from '@/components/site/Downloads'
import JsonLd from '@/components/site/JsonLd'
import { breadcrumbs, graph, organization, softwareApplication } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Download Remote365 for Windows and Android',
  description:
    'Download Remote365: the Windows desktop app and two Android apps, one to control other devices and a host app to be controlled. macOS and iOS apps are coming soon; any modern browser works for the web app.',
  path: '/downloads',
})

export default function DownloadsPage() {
  return (
    <>
      <JsonLd data={graph(organization(), softwareApplication(), breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Download', path: '/downloads' }]))} />
      <Downloads />
    </>
  )
}
