import React from 'react'
import { Box, Container, Grid, Typography, Card, CardContent } from '@mui/material'
import { Apartment, Devices, Settings, People } from '@mui/icons-material'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const solutions = [
  {
    title: 'Enterprise Support',
    desc: 'Scale your IT support across thousands of devices globally with bank-grade security.',
    icon: <Apartment fontSize="large" color="primary" />,
  },
  {
    title: 'Remote Working',
    desc: 'Empower your teams to work from anywhere with low-latency desktop access.',
    icon: <Devices fontSize="large" color="primary" />,
  },
  {
    title: 'Managed Services',
    desc: 'Streamline your MSP operations with advanced monitoring and management tools.',
    icon: <Settings fontSize="large" color="primary" />,
  },
  {
    title: 'Collaboration',
    desc: 'Work together seamlessly with multi-user sessions and shared screen access.',
    icon: <People fontSize="large" color="primary" />,
  },
]

const SolutionsGrid: React.FC = () => {
  return (
    <Box sx={{ py: 12, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '2px' }}>
            SOLUTIONS FOR EVERY NEED
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 900, mt: 1 }}>
            Tailored for your business
          </Typography>
        </Box>

        <StyledGrid container spacing={4}>
          {solutions.map((solution, index) => (
            <StyledGrid size={{ xs: 12, md: 6 }} key={index}>
              <Card sx={{ height: '100%', borderRadius: '20px', p: 2, transition: '0.3s', '&:hover': { boxShadow: '0 10px 30px rgba(0,0,0,0.1)' } }}>
                <CardContent sx={{ display: 'flex', gap: 3 }}>
                  <Box>{solution.icon}</Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                      {solution.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {solution.desc}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </StyledGrid>
          ))}
        </StyledGrid>
      </Container>
    </Box>
  )
}

export default SolutionsGrid
