import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// App screens (sign-in, dashboard, sessions, meeting and join links) are not
// search results. They are not blocked in robots.txt either, so crawlers can
// read this noindex, and link previews of meeting/join links still work.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return children
}
