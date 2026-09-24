import React from 'react'
import { Card, Box, Typography, Link } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  helperText?: string
  helperLink?: string
  helperLinkText?: string
}

// Using any to bypass structural type mismatches between MUI and React 18/19 in this monorepo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledCard = Card as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledLink = Link as any

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  helperText,
  helperLink,
  helperLinkText,
}) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <StyledCard
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 4,
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: 'primary.main',
              letterSpacing: '-0.5px',
              mb: 1,
            }}
          >
            Remote365
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {title}
          </Typography>
        </Box>

        {children}
      </StyledCard>

      {(helperText || helperLink) && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {helperText}{' '}
            {helperLink && helperLinkText && (
              <StyledLink
                component={RouterLink}
                to={helperLink}
                color="primary"
                sx={{ fontWeight: 600, textDecoration: 'none' }}
              >
                {helperLinkText}
              </StyledLink>
            )}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default AuthLayout
