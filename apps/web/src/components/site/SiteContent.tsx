import type { ReactNode } from 'react'

// A page's content layer inside the site frame (site-dark.css stacks it above
// the fixed video backdrop). The home hero fills the screen and starts under
// the floating header; every other page starts below the header instead.
export default function SiteContent({ children, heroUnderNav = false }: { children: ReactNode; heroUnderNav?: boolean }) {
  return (
    <div className={heroUnderNav ? 'site-content' : 'site-content site-content--below-nav'}>
      {children}
    </div>
  )
}
