import React from 'react'
import { Typography, Container, Grid, Button, Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import ProductHero from '../../components/landing/ProductHero'
import ProductExplainer from '../../components/landing/ProductExplainer'
import { ScrollReveal } from '../../components/landing/ScrollReveal'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any;

const FeatureDetail: React.FC<{ title: string; description: string; image: string; reverse?: boolean }> = ({ title, description, image, reverse }) => (
  <Container maxWidth="lg" sx={{ py: 10 }}>
    <StyledGrid container spacing={8} alignItems="center" direction={reverse ? 'row-reverse' : 'row'}>
      <StyledGrid size={{ xs: 12, md: 6 }}>
        <ScrollReveal delay={0.2}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 3, letterSpacing: '-1px' }}>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.2rem', lineHeight: 1.8 }}>
            {description}
          </Typography>
        </ScrollReveal>
      </StyledGrid>
      <StyledGrid size={{ xs: 12, md: 6 }}>
        <ScrollReveal delay={0.3}>
          <Box 
            component="img" 
            src={image} 
            sx={{ 
              width: '100%', 
              borderRadius: '24px', 
              boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.05)'
            }} 
          />
        </ScrollReveal>
      </StyledGrid>
    </StyledGrid>
  </Container>
)

const FeaturesPage: React.FC = () => {
  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Navbar />
      <Box component="main">
        <ProductHero
          heading="Remote access for everyone, everywhere"
          description="Connect to any device, from anywhere. Unique 9-digit device IDs, end-to-end encrypted sessions, and one-click remote support — no VPN, no port forwarding, no setup."
          ctaText="Get started free"
          image="/product.png"
          imageAlt="Remote365 Dashboard"
        />
        <ProductExplainer />

        <FeatureDetail 
          title="Remote Administration"
          description="Take full control of your infrastructure with our enterprise-grade remote administration tools. Manage servers, workstations, and IoT devices with zero latency and absolute security. Our proprietary streaming protocol ensures you feel like you're sitting right in front of the machine."
          image="/features_graphics_remote_admin_png_1774319950155.png"
        />

        <Box sx={{ bgcolor: 'grey.50' }}>
          <FeatureDetail 
            title="Lighting Fast File Transfer"
            description="Move gigabytes in seconds. Our optimized file transfer protocol uses peer-to-peer acceleration to bypass traditional bottlenecks, ensuring your data reaches its destination with military-grade encryption and perfect integrity."
            image="/landing_hero_remote_desktop_1774319313320.png"
            reverse
          />
        </Box>

        <FeatureDetail 
          title="Multi-Monitor Mastery"
          description="Don't be limited by a single screen. Remote365 supports unlimited monitor setups, allowing you to view and control complex multi-display environments just as if you were there. Toggle between screens or view them all at once on your local setup."
          image="/hero.png"
        />
        
        <Box sx={{ py: 10, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
          <Container maxWidth="md">
            <ScrollReveal>
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 4 }}>
                Ready to experience the future?
              </Typography>
              <Button 
                variant="contained" 
                color="secondary" 
                size="large" 
                sx={{ 
                  borderRadius: '30px', 
                  px: 6, 
                  py: 2, 
                  fontWeight: 900, 
                  fontSize: '1.1rem',
                  textTransform: 'none'
                }}
              >
                Get Started for Free
              </Button>
            </ScrollReveal>
          </Container>
        </Box>
      </Box>
      <Footer />
    </Box>
  )
}

export default FeaturesPage
