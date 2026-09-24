import React from 'react'
import { Box, Container, Typography, Grid } from '@mui/material'

interface SubPageHeroProps {
  title: string
  subtitle: string
  image: string
}

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const SubPageHero: React.FC<SubPageHeroProps> = ({ title, subtitle, image }) => {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <StyledGrid container spacing={8} sx={{ alignItems: 'center' }}>
          <StyledGrid size={{ xs: 12, md: 6 }}>
            <Typography variant="h2" sx={{ fontWeight: 900, mb: 3, lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Typography variant="h5" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {subtitle}
            </Typography>
          </StyledGrid>
          <StyledGrid size={{ xs: 12, md: 6 }}>
            <Box
              component="img"
              src={image}
              alt={title}
              sx={{
                width: '100%',
                height: 'auto',
                borderRadius: '20px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
              }}
            />
          </StyledGrid>
        </StyledGrid>
      </Container>
    </Box>
  )
}

export default SubPageHero
