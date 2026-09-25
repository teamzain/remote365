'use client'

import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { lightTheme } from '../theme'
import App from '../App'
import { installTextScale } from '../lib/textSize'
import { NotificationProvider } from '../components/NotificationProvider'
import ScrollToTop from '../components/ScrollToTop'

// Text size chosen in Settings → General applies before the first paint and
// follows window resizes. This module only ever loads in the browser (the
// app shell imports it with ssr: false), so running it at import is safe.
installTextScale()

// The React Router app (formerly src/main.tsx). Next mounts it client-only
// from the catch-all route; its routes, providers and state are unchanged.
const SpaRoot: React.FC = () => (
  <React.StrictMode>
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <BrowserRouter>
        <ScrollToTop />
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)

export default SpaRoot
