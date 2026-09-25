import SiteContent from '@/components/site/SiteContent'
import ProductHero from '@/components/landing/ProductHero'
import ProductExplainer from '@/components/landing/ProductExplainer'
import AccessAnywhereSection from '@/components/landing/AccessAnywhereSection'
import GetInvolvedSection from '@/components/landing/GetInvolvedSection'
import GetStartedCta from '@/components/landing/GetStartedCta'
import { ScrollReveal } from '@/components/landing/ScrollReveal'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Product: remote access, support, meetings and chat',
  description:
    'What Remote365 does: unattended access to your own devices by ID, support sessions started with a code, video meetings, team chat and file transfer, with role-based access and two-factor authentication.',
  path: '/product',
})

export default function ProductPage() {
  return (
    <SiteContent>
      <main>
        <ScrollReveal delay={0.1}>
          <ProductHero
            heading="Remote access for everyone, everywhere"
            description="Connect to any device from anywhere — start a support session with a code, control machines by their ID, run video meetings, and chat with your team. Remote sessions are end-to-end encrypted, with no VPN or setup."
            ctaText="Start your free trial"
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
            linkLabel="See plans"
            linkTo="/pricing"
            image="/73c24a8b6ac291b698899b4f986d0ee1ea5bdaa8.png"
            illustration
            reverse
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <GetStartedCta />
        </ScrollReveal>
      </main>
    </SiteContent>
  )
}
