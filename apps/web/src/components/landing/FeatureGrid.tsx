import React from 'react'
import { Box, Container, Grid, Typography, Card, CardContent } from '@mui/material'
import { Security, Speed, Devices, Cloud, Support, Code } from '@mui/icons-material'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const features = [
  { title: 'Security First', desc: 'Secure sessions with 256-bit AES end-to-end encryption.', icon: <Security color="primary" fontSize="large" /> },
  { title: 'Blazing Fast', desc: 'Low-latency connections with proprietary frame protocols.', icon: <Speed color="primary" fontSize="large" /> },
  { title: 'Multi-Platform', desc: 'Connect from Windows, macOS, Linux, iOS, and Android.', icon: <Devices color="primary" fontSize="large" /> },
  { title: 'Cloud Powered', desc: 'Global server network ensures optimal routing anywhere.', icon: <Cloud color="primary" fontSize="large" /> },
  { title: 'Premium Support', desc: 'Our experts are here to help you 24/7.', icon: <Support color="primary" fontSize="large" /> },
  { title: 'API Integration', desc: 'Automate your workflows with our robust REST API.', icon: <Code color="primary" fontSize="large" /> },
]

const FeatureGrid: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <StyledGrid container spacing={4}>
        {features.map((f, i) => (
          <StyledGrid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
            <Card sx={{ height: '100%', borderRadius: '20px', transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' } }}>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Box sx={{ mb: 2 }}>{f.icon}</Box>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{f.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{f.desc}</Typography>
              </CardContent>
            </Card>
          </StyledGrid>
        ))}
      </StyledGrid>
    </Container>
  )
}

export default FeatureGrid
