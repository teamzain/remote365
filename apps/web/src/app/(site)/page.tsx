import SiteContent from '@/components/site/SiteContent'
import HeroVideo from '@/components/landing/HeroVideo'
import CapabilityConverge from '@/components/landing/CapabilityConverge'
import CaseStudyFlipStack from '@/components/landing/CaseStudyFlipStack'
import DeviceOrbitSection from '@/components/landing/DeviceOrbitSection'
import EasyAccessSection from '@/components/landing/EasyAccessSection'
import AccessAnywhereSection from '@/components/landing/AccessAnywhereSection'
import CloudOrbitSection from '@/components/landing/CloudOrbitSection'
import ShowcaseImage from '@/components/landing/ShowcaseImage'
import HomeAwaySection from '@/components/landing/HomeAwaySection'
import SimpleReliableSection from '@/components/landing/SimpleReliableSection'
import GetStartedCta from '@/components/landing/GetStartedCta'
import DeviceIdFlap from '@/components/landing/DeviceIdFlap'
import RegionGlobe from '@/components/landing/RegionGlobe'
import ConnectionDiagram from '@/components/landing/ConnectionDiagram'
import { ScrollReveal } from '@/components/landing/ScrollReveal'
import JsonLd from '@/components/site/JsonLd'
import { graph, organization, softwareApplication, website } from '@/lib/jsonld'
import { DEFAULT_TITLE, pageMetadata } from '@/lib/seo'
import { USE_CASES } from '@/content/useCases'

export const metadata = pageMetadata({
  title: DEFAULT_TITLE,
  absoluteTitle: true,
  description:
    'Remote365 is remote desktop software for teams and families: reach unattended Windows and Android devices, run support sessions with a code, host video meetings and chat, with end-to-end encrypted remote sessions.',
  path: '/',
})

export default function HomePage() {
  return (
    <SiteContent heroUnderNav>
      <JsonLd data={graph(organization(), website(), softwareApplication())} />
      <main>
        <HeroVideo />

        {/* Scroll-driven: no ScrollReveal (its fade would hide the letters
            flying in). */}
        <CapabilityConverge />

        {/* Scroll-driven and pinned: no ScrollReveal (its transform would
            break the sticky stage). */}
        <CaseStudyFlipStack
          eyebrow="Use cases"
          heading="One app for every kind of remote help"
          intro="From the office help desk to a parent’s phone in another country: how people use Remote365 today."
          items={USE_CASES.map(u => ({
            href: `/use-cases/${u.slug}`,
            eyebrow: u.eyebrow,
            title: u.title,
            description: u.summary,
            image: u.image,
            imageAlt: u.imageAlt,
            background: u.background,
            foreground: u.foreground,
          }))}
        />

        <ScrollReveal delay={0.15}>
          <DeviceOrbitSection />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <EasyAccessSection extra={<DeviceIdFlap />} />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <AccessAnywhereSection visual={<RegionGlobe />} />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <EasyAccessSection
            title="Support, meet, and chat — in one app"
            subtitle="Start a support session with a code, host a live video meeting, or message your team in built-in chat — with file transfer everywhere. Everything you need to work together remotely."
            linkLabel="Explore collaboration"
            linkTo="/product"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <ShowcaseImage
            src="/b83a6130ee1316b5433f5fb72198938b2c5f00a7.jpg"
            alt="Remote365 video meeting"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <CloudOrbitSection />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <HomeAwaySection />
        </ScrollReveal>

        {/* Scroll-driven and several screens tall: no ScrollReveal here. */}
        <SimpleReliableSection />

        <ScrollReveal delay={0.15}>
          <AccessAnywhereSection
            title="Security you can trust"
            subtitle="Every remote session is end-to-end encrypted. Role-based access control, forced two-factor authentication, and full audit logs keep your team and every device protected."
            linkLabel="Learn more"
            linkTo="/product"
            visual={<ConnectionDiagram />}
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <GetStartedCta />
        </ScrollReveal>
      </main>
    </SiteContent>
  )
}
