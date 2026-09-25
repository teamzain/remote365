import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { preload } from 'react-dom'

// App screens (sign-in, dashboard, sessions, meeting and join links) are not
// search results. They are not blocked in robots.txt either, so crawlers can
// read this noindex, and link previews of meeting/join links still work.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AppLayout({ children }: { children: ReactNode }) {
  // The app keeps Mona Sans (self-hosted, @font-face in index.css); fetch
  // the latin file with the HTML instead of after the CSS is parsed.
  preload('/fonts/mona-sans-latin.v4.woff2', { as: 'font', type: 'font/woff2', crossOrigin: '' })
  return children
}
