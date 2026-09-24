import { Box, Container, Typography, Card, CardContent, Stack, Grid } from '@mui/material'
import { Devices, Security, Speed, SettingsRemote } from '@mui/icons-material'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const features = [
  {
    title: 'Remote Support',
    desc: 'Support, assist, and interact with customers and employees in real-time.',
    icon: <SettingsRemote fontSize="large" color="primary" />,
  },
  {
    title: 'Anywhere Access',
    desc: 'Access your office computer from home, a airport, or anywhere else.',
    icon: <Devices fontSize="large" color="primary" />,
  },
  {
    title: 'Bank-Grade Security',
    desc: '256-bit AES end-to-end encryption for the highest security standards.',
    icon: <Security fontSize="large" color="primary" />,
  },
  {
    title: 'High Performance',
    desc: 'Low latency and high frame rates even on low-bandwidth connections.',
    icon: <Speed fontSize="large" color="primary" />,
  },
]

const Features: React.FC = () => {
  return (
    <Box sx={{ py: 12, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '2px' }}>
            WHY CHOOSE US
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 900, mt: 1 }}>
            Trusted by Professionals Worldwide
          </Typography>
        </Box>

        <StyledGrid container spacing={4}>
          {features.map((feature, index) => (
            <StyledGrid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
              <Card sx={{ height: '100%', borderRadius: '16px', transition: 'transform 0.3s', '&:hover': { transform: 'translateY(-8px)' } }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack spacing={2}>
                    {feature.icon}
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {feature.desc}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </StyledGrid>
          ))}
        </StyledGrid>
      </Container>
    </Box>
  )
}

export default Features
