import type { Metadata, Viewport } from 'next'
import '../index.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://remote365.ai'),
  title: 'Remote365 – Secure Remote Desktop & Support',
  description:
    'Remote365 is a secure remote desktop application for teams: unattended device access, live remote support sessions, video meetings, chat, and file transfer from anywhere, with end-to-end encrypted remote sessions.',
  icons: { icon: '/logo.png' },
  openGraph: {
    type: 'website',
    siteName: 'Remote365',
    title: 'Remote365 – Secure Remote Desktop & Support',
    description:
      'Access and support any computer from anywhere with end-to-end encrypted remote sessions, meetings, chat, and file transfer.',
    url: '/',
    images: ['/logo.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Replaced by next/font in the technical-SEO phase. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
