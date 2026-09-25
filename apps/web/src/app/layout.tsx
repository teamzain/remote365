import type { Metadata, Viewport } from 'next'
import { DEFAULT_TITLE, SITE_NAME, SITE_URL } from '@/lib/seo'
import '../index.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: `%s | ${SITE_NAME}` },
  description:
    'Remote365 is a secure remote desktop application for teams: unattended device access, live remote support sessions, video meetings, chat, and file transfer from anywhere, with end-to-end encrypted remote sessions.',
  applicationName: SITE_NAME,
  // Icons: app/favicon.ico, app/icon.png and app/apple-icon.png.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    title: DEFAULT_TITLE,
    description:
      'Access and support any computer from anywhere with end-to-end encrypted remote sessions, meetings, chat, and file transfer.',
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts are preloaded per section: (site)/layout.tsx for the
            website's Poppins and Lato, (app)/layout.tsx for the app's Mona Sans. */}
        {/* Without JavaScript, scroll-reveal sections never animate in. */}
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  )
}
