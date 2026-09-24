import React from 'react'
import { Typography, Container, Grid, Button, Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import SubPageHero from '../../components/landing/SubPageHero'
import { ScrollReveal } from '../../components/landing/ScrollReveal'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any;

const ResourceDetail: React.FC<{ title: string; description: string; image: string; reverse?: boolean }> = ({ title, description, image, reverse }) => (
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

const ResourcesPage: React.FC = () => {
  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Navbar />
      <Box component="main">
        <ScrollReveal delay={0.1}>
          <SubPageHero 
            title="Explore our Resources"
            subtitle="Get the most out of Remote365 with our detailed documentation, support hub, and professional insights."
            image="/resources_hero.png"
          />
        </ScrollReveal>

        <ResourceDetail 
          title="Knowledge Base"
          description="Everything you need to know about setting up and optimizing your Remote365 environment. From basic installation guides to advanced troubleshooting and performance tuning, our comprehensive hub is updated daily by our engineering team."
          image="/resources_knowledge_base_png_1774320133625.png"
        />

        <Box sx={{ bgcolor: 'grey.50' }}>
          <ResourceDetail 
            title="API & Developer Hub"
            description="Build custom integrations with Remote365's powerful REST and GraphQL APIs. Our developer portal provides full SDKs for Node.js, Python, and C#, along with sandbox environments to test your automations before going live."
            image="/landing_hero_remote_desktop_1774319313320.png"
            reverse
          />
        </Box>

        <ResourceDetail 
          title="Global Support Network"
          description="We're here when you need us. Access 24/7 priority support via chat, email, or phone. Our worldwide network of experts ensures that no matter where you are or what time it is, you have the help you need to keep your business running."
          image="/hero.png"
        />
        
        <Box sx={{ py: 10, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
          <Container maxWidth="md">
            <ScrollReveal>
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 4 }}>
                Need more specific help?
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
                Contact Support Hub
              </Button>
            </ScrollReveal>
          </Container>
        </Box>
      </Box>
      <Footer />
    </Box>
  )
}

export default ResourcesPage
