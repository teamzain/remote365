import React from 'react'
import { Box } from '@mui/material'
import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import DeviceOrbitSection from '../components/landing/DeviceOrbitSection'
import EasyAccessSection from '../components/landing/EasyAccessSection'
import AccessAnywhereSection from '../components/landing/AccessAnywhereSection'
import CloudOrbitSection from '../components/landing/CloudOrbitSection'
import ShowcaseImage from '../components/landing/ShowcaseImage'
import HomeAwaySection from '../components/landing/HomeAwaySection'
import SimpleReliableSection from '../components/landing/SimpleReliableSection'
import StatsCounterSection from '../components/landing/StatsCounterSection'
import GetStartedCta from '../components/landing/GetStartedCta'
import Footer from '../components/landing/Footer'
import { ScrollReveal } from '../components/landing/ScrollReveal'

const Landing: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#FFFFFF' }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <ScrollReveal delay={0.1}>
          <Hero heroImage="/hero.png" />
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

        <ScrollReveal delay={0.15}>
          <SimpleReliableSection />
        </ScrollReveal>

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
      <Footer />
    </Box>
  )
}

export default Landing
