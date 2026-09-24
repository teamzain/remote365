import React from 'react'
import { Box, Container, Grid, Typography, Card, CardContent, Stack, Button } from '@mui/material'
import { Description, Help, LibraryBooks, RateReview } from '@mui/icons-material'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const resources = [
  { title: 'Documentation', desc: 'Comprehensive guides and API reference.', icon: <Description fontSize="large" /> },
  { title: 'Support Hub', desc: 'Find answers and contact our team.', icon: <Help fontSize="large" /> },
  { title: 'Knowledge Base', desc: 'In-depth articles and tutorials.', icon: <LibraryBooks fontSize="large" /> },
  { title: 'Community', desc: 'Join our forums and user groups.', icon: <RateReview fontSize="large" /> },
]

const ResourceCards: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <StyledGrid container spacing={4}>
        {resources.map((r, i) => (
          <StyledGrid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Card sx={{ height: '100%', borderRadius: '20px', p: 1 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Stack spacing={2} alignItems="center">
                  <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: '50%', color: 'primary.main', display: 'flex' }}>
                    {r.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{r.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{r.desc}</Typography>
                  <Button variant="text" sx={{ fontWeight: 700, textTransform: 'none' }}>Learn More &rarr;</Button>
                </Stack>
              </CardContent>
            </Card>
          </StyledGrid>
        ))}
      </StyledGrid>
    </Container>
  )
}

export default ResourceCards
