import React from 'react'
import { Box, Container, Grid, Typography, Stack } from '@mui/material'

const stats = [
  { label: 'Customers', value: '600,000+' },
  { label: 'Managed Devices', value: '2.5 Billion+' },
  { label: 'Downloads', value: '1.2 Billion+' },
  { label: 'Uptime', value: '99.9%' },
]

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const Stats: React.FC = () => {
  return (
    <Box sx={{ py: 8, bgcolor: 'primary.main', color: 'white' }}>
      <Container maxWidth="lg">
        <StyledGrid container spacing={4} sx={{ justifyContent: 'center' }}>
          {stats.map((stat, index) => (
            <StyledGrid size={{ xs: 6, md: 3 }} key={index}>
              <Stack alignItems="center" spacing={1}>
                <Typography variant="h3" sx={{ fontWeight: 900 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {stat.label}
                </Typography>
              </Stack>
            </StyledGrid>
          ))}
        </StyledGrid>
      </Container>
    </Box>
  )
}

export default Stats
