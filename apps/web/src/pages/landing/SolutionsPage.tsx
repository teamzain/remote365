import React from 'react'
import { Typography, Container, Grid, Button, Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import SubPageHero from '../../components/landing/SubPageHero'
import { ScrollReveal } from '../../components/landing/ScrollReveal'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any;

const SolutionDetail: React.FC<{ title: string; description: string; image: string; reverse?: boolean }> = ({ title, description, image, reverse }) => (
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

const SolutionsPage: React.FC = () => {
  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Navbar />
      <Box component="main">
        <ScrollReveal delay={0.1}>
          <SubPageHero 
            title="Solutions for Every Business"
            subtitle="From IT departments to remote teams, Remote365 provides the infrastructure you need to stay connected and productive."
            image="/solutions_hero.png"
          />
        </ScrollReveal>

        <SolutionDetail 
          title="IT Support and Managed Services"
          description="Empower your IT team to solve problems faster. Remote365's ultra-secure, multi-session platform allows your techs to manage hundreds of endpoints simultaneously with central reporting and automated diagnostics. Reduce onsite visits and slash ticket resolution times."
          image="/solutions_industry_verticals_png_1774320004831.png"
        />

        <Box sx={{ bgcolor: 'grey.50' }}>
          <SolutionDetail 
            title="Modern Remote & Hybrid Teams"
            description="Give your team the freedom to work from anywhere without compromising on performance. Access heavy-duty workstations from a laptop on the beach. Remote365 handles graphics-intensive tasks like video editing and 3D rendering with ease, ensuring productivity never drops."
            image="/landing_hero_remote_desktop_1774319313320.png"
            reverse
          />
        </Box>

        <SolutionDetail 
          title="Education and Research"
          description="Break down the walls of the computer lab. Students and researchers can access high-performance campus hardware from their own devices. Enable remote learning for specialized software that can't run on standard consumer laptops, all while maintaining strict access controls."
          image="/hero.png"
        />
        
        <Box sx={{ py: 10, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
          <Container maxWidth="md">
            <ScrollReveal>
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 4 }}>
                Ready to transform your workflow?
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
                Start Your Free Trial
              </Button>
            </ScrollReveal>
          </Container>
        </Box>
      </Box>
      <Footer />
    </Box>
  )
}

export default SolutionsPage
