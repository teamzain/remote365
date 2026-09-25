import type { ReactNode } from 'react'
import type { Viewport } from 'next'
import { preload } from 'react-dom'
import SiteFrame from '@/components/site/SiteFrame'

export const viewport: Viewport = {
  themeColor: '#000000',
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  // The fonts the first screen needs (the hero heading in Poppins Bold, text
  // in Lato), fetched with the HTML instead of after the CSS is parsed.
  preload('/fonts/poppins-700-latin.v1.woff2', { as: 'font', type: 'font/woff2', crossOrigin: '' })
  preload('/fonts/lato-400-latin.v1.woff2', { as: 'font', type: 'font/woff2', crossOrigin: '' })
  return <SiteFrame>{children}</SiteFrame>
}
