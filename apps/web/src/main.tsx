import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { lightTheme } from './theme'
import App from './App.tsx'
import './index.css'
import { installTextScale } from './lib/textSize'

// Text size chosen in Settings → General applies before the first paint
// and follows window resizes (the factor is capped on narrow windows).
installTextScale()

import { NotificationProvider } from './components/NotificationProvider'
import ScrollToTop from './components/ScrollToTop'

ReactDOM.createRoot(document.getElementById('root')!).render(
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
  </React.StrictMode>,
)
