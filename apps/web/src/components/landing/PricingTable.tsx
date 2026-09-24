import React from 'react'
import { Box, Container, Grid, Typography, Card, CardContent, Button, List, ListItem, ListItemIcon, ListItemText } from '@mui/material'
import { CheckCircle } from '@mui/icons-material'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const tiers = [
  {
    title: 'Free',
    price: '$0',
    subtitle: 'For personal use',
    features: ['1 Concurrent Session', 'Best-effort performance', 'Basic Security', 'Community Support'],
    cta: 'Get Started',
    popular: false,
  },
  {
    title: 'Business',
    price: '$29.90',
    subtitle: 'Per month, billed annual',
    features: ['Unlimited Managed Devices', 'Commercial Use', 'High Performance Scaling', 'Priority Support'],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    title: 'Enterprise',
    price: 'Custom',
    subtitle: 'Tailored for large teams',
    features: ['Active Directory Integration', 'Bulk Deployment', 'Team Management', 'SLA & 24/7 Support'],
    cta: 'Contact Sales',
    popular: false,
  },
]

const PricingTable: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <StyledGrid container spacing={4} sx={{ alignItems: 'stretch' }}>
        {tiers.map((tier, index) => (
          <StyledGrid size={{ xs: 12, md: 4 }} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                borderRadius: '24px', 
                position: 'relative',
                border: tier.popular ? '2px solid' : '1px solid',
                borderColor: tier.popular ? 'primary.main' : 'divider',
                boxShadow: tier.popular ? '0 10px 40px rgba(30,64,175,0.1)' : 'none',
              }}
            >
              {tier.popular && (
                <Box sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'primary.main', color: 'white', px: 1.5, py: 0.5, borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900 }}>
                  MOST POPULAR
                </Box>
              )}
              <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
                  {tier.title}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, color: tier.popular ? 'primary.main' : 'text.primary' }}>
                  {tier.price}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                  {tier.subtitle}
                </Typography>
                
                <Box sx={{ flexGrow: 1 }}>
                  <List>
                    {tier.features.map((feature) => (
                      <ListItem key={feature} disableGutters sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={feature} primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Button 
                  variant={tier.popular ? 'contained' : 'outlined'} 
                  fullWidth 
                  size="large" 
                  sx={{ mt: 4, borderRadius: '30px', py: 1.5, textTransform: 'none', fontWeight: 700 }}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          </StyledGrid>
        ))}
      </StyledGrid>
    </Container>
  )
}

export default PricingTable
