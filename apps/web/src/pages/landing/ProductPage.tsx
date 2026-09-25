import React from 'react'
import { Box } from '@mui/material'
import SiteLayout from '../../components/landing/SiteLayout'
import ProductHero from '../../components/landing/ProductHero'
import ProductExplainer from '../../components/landing/ProductExplainer'
import AccessAnywhereSection from '../../components/landing/AccessAnywhereSection'
import GetInvolvedSection from '../../components/landing/GetInvolvedSection'
import GetStartedCta from '../../components/landing/GetStartedCta'
import { ScrollReveal } from '../../components/landing/ScrollReveal'

const ProductPage: React.FC = () => (
  <SiteLayout>
    <Box component="main">
      <ScrollReveal delay={0.1}>
        <ProductHero
          heading="Remote access for everyone, everywhere"
          description="Connect to any device from anywhere — start a support session with a code, control machines by their ID, run video meetings, and chat with your team. Remote sessions are end-to-end encrypted, with no VPN or setup."
          ctaText="Get started free"
          image="/product.png"
          imageAlt="Remote365 Dashboard"
        />
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <ProductExplainer />
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <AccessAnywhereSection
          title="Share with friends and family"
          subtitle="Grant access to specific machines for the people you trust — so they can reach that one computer, without exposing anything else you own."
          linkLabel=""
          image="/37e0e57e97f1972d3a302e6e086d8b5f1b920cad.png"
        />
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <GetInvolvedSection />
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <AccessAnywhereSection
          title="Our commitment to security"
          subtitle="Every remote session is end-to-end encrypted. Role-based access control, forced two-factor authentication, and full audit logs keep your team and every device protected."
          linkLabel="Learn more"
          linkTo="/product"
          image="/73c24a8b6ac291b698899b4f986d0ee1ea5bdaa8.png"
          illustration
          reverse
        />
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <GetStartedCta />
      </ScrollReveal>
    </Box>
  </SiteLayout>
)

export default ProductPage
