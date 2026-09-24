import React from 'react'
import { Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import PricingPlans from '../../components/landing/PricingPlans'
import PricingFAQ from '../../components/landing/PricingFAQ'

const PricingPage: React.FC = () => {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Pricing hero */}
      <section style={{
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 40px 72px',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontWeight: 600,
            fontSize: 'clamp(2.2rem, 4.5vw, 55px)',
            lineHeight: 1.42,
            color: '#1A1D21',
            margin: 0,
          }}>
            Plans that work
          </h1>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 16px',
            height: '63px',
            background: '#FF8A00',
            borderRadius: '4px',
          }}>
            <span style={{
              fontWeight: 600,
              fontSize: 'clamp(1.6rem, 3.7vw, 45px)',
              lineHeight: '63px',
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
            }}>
              for everyone
            </span>
          </div>
        </div>
      </section>

      <Box sx={{ flexGrow: 1 }}>
        <PricingPlans />
        <PricingFAQ />
      </Box>

      <Footer />
    </Box>
  )
}

export default PricingPage
