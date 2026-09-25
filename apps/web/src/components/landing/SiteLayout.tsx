import React from 'react'
import Navbar from './Navbar'
import Footer from './Footer'
import LandingBackdrop from './LandingBackdrop'
import './site-dark.css'

interface SiteLayoutProps {
  children: React.ReactNode
  // The home hero fills the screen and starts under the floating header;
  // every other page starts its content below the header instead.
  heroUnderNav?: boolean
}

// Frame for every public website page: the looping video backdrop, the glass
// navbar and the frosted footer. The shared section components are light by
// default; site-dark.css recolours them inside .site-dark, so they still
// render light anywhere outside this layout.
const SiteLayout: React.FC<SiteLayoutProps> = ({ children, heroUnderNav = false }) => (
  <div className="site-dark">
    {/* Outside the content layer on purpose: a transformed ancestor (e.g. a
        ScrollReveal) would turn its position: fixed into scrolling. */}
    <LandingBackdrop dim={heroUnderNav ? 'hero' : 'content'} />
    <Navbar variant="glass" />
    <div className={heroUnderNav ? 'site-content' : 'site-content site-content--below-nav'}>
      {children}
    </div>
    <Footer />
  </div>
)

export default SiteLayout
