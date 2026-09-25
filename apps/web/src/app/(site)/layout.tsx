import type { ReactNode } from 'react'
import type { Viewport } from 'next'
import SiteFrame from '@/components/site/SiteFrame'

export const viewport: Viewport = {
  themeColor: '#000000',
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteFrame>{children}</SiteFrame>
}
