import React from 'react'
import { Box, Container, Typography, Button, Stack } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledButton = Button as any

const FinalCTA: React.FC = () => {
  return (
    <Box sx={{ py: 12, bgcolor: 'primary.main', color: 'white' }}>
      <Container maxWidth="md">
        <Stack spacing={4} alignItems="center" sx={{ textAlign: 'center' }}>
          <Typography variant="h2" sx={{ fontWeight: 900 }}>
            Join 600,000+ businesses worldwide
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9 }}>
            Connect to any device, any time, from anywhere. Experience the most trusted remote access solution.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <StyledButton
              component={RouterLink}
              to="/register"
              variant="contained"
              size="large"
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                borderRadius: '40px',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
              }}
            >
              Get Started for Free
            </StyledButton>
            <Button
              variant="outlined"
              size="large"
              sx={{
                borderColor: 'white',
                color: 'white',
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                borderRadius: '40px',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Contact Sales
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}

export default FinalCTA
