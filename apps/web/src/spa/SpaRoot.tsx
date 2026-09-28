'use client'

import React, { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { darkTheme, lightTheme } from '../theme'
import App from '../App'
import { installTextScale } from '../lib/textSize'
import { NotificationProvider } from '../components/NotificationProvider'
import ScrollToTop from '../components/ScrollToTop'

// Text size chosen in Settings → General applies before the first paint and
// follows window resizes. This module only ever loads in the browser (the
// app shell imports it with ssr: false), so running it at import is safe.
installTextScale()

// Settings → Customization toggles the `dark` class on <html> (see
// lib/customizationPreferences). CssBaseline paints <body> from the MUI
// theme, so the theme has to follow that class or the page keeps the light
// body colour and ink text underneath every dark surface.
const isDarkClass = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

function useThemeFromDarkClass() {
  const [dark, setDark] = useState(isDarkClass)
  useEffect(() => {
    setDark(isDarkClass())
    const observer = new MutationObserver(() => setDark(isDarkClass()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return dark ? darkTheme : lightTheme
}

// The React Router app (formerly src/main.tsx). Next mounts it client-only
// from the catch-all route; its routes, providers and state are unchanged.
const SpaRoot: React.FC = () => {
  const theme = useThemeFromDarkClass()
  return (
    <React.StrictMode>
      <ThemeProvider theme={theme}>
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
}

export default SpaRoot
