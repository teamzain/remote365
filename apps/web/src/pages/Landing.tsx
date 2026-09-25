import React from 'react'
import { Box } from '@mui/material'
import SiteLayout from '../components/landing/SiteLayout'
import HeroVideo from '../components/landing/HeroVideo'
import CompanyMarquee from '../components/landing/CompanyMarquee'
import DeviceOrbitSection from '../components/landing/DeviceOrbitSection'
import EasyAccessSection from '../components/landing/EasyAccessSection'
import AccessAnywhereSection from '../components/landing/AccessAnywhereSection'
import CloudOrbitSection from '../components/landing/CloudOrbitSection'
import ShowcaseImage from '../components/landing/ShowcaseImage'
import HomeAwaySection from '../components/landing/HomeAwaySection'
import SimpleReliableSection from '../components/landing/SimpleReliableSection'
import StatsCounterSection from '../components/landing/StatsCounterSection'
import GetStartedCta from '../components/landing/GetStartedCta'
import { ScrollReveal } from '../components/landing/ScrollReveal'

const Landing: React.FC = () => {
  return (
    <SiteLayout heroUnderNav>
      <Box component="main">
        <HeroVideo />

        <ScrollReveal delay={0.1}>
          <Box sx={{ pt: { xs: 6, md: 9 } }}>
            <CompanyMarquee />
          </Box>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <DeviceOrbitSection />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <EasyAccessSection />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <AccessAnywhereSection />
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
          <StatsCounterSection />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <AccessAnywhereSection
            title="Security you can trust"
            subtitle="Every session is end-to-end encrypted. Role-based access control, forced two-factor authentication, and full audit logs keep your team and every device protected."
            linkLabel="Learn more"
            linkTo="/product"
            image="/c460f6a065169b1b08853ed8eb897298d1e73c19.png"
            illustration
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <GetStartedCta />
        </ScrollReveal>

      </Box>
    </SiteLayout>
  )
}

export default Landing
