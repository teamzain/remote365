import type { ReactNode } from 'react'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'
import LandingBackdrop from '@/components/landing/LandingBackdrop'
import LegacyTokenHandoff from './LegacyTokenHandoff'
import '@/components/landing/site-dark.css'

// Frame for every public website page: the looping video backdrop, the glass
// navbar and the frosted footer. Rendered once by the (site) layout, so the
// backdrop keeps playing while visitors move between pages. The shared
// section components are light by default; site-dark.css recolours them
// inside .site-dark.
export default function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="site-dark">
      {/* Outside the content layer on purpose: a transformed ancestor (e.g. a
          ScrollReveal) would turn its position: fixed into scrolling. */}
      <LandingBackdrop />
      <Navbar variant="glass" />
      {children}
      <Footer />
      <LegacyTokenHandoff />
    </div>
  )
}
