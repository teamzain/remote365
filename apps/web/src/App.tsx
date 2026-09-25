import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useChatStore } from './store/chatStore'
import Landing from './pages/Landing'
import Downloads from './pages/Downloads'
import PricingPage from './pages/landing/PricingPage'
import ProductPage from './pages/landing/ProductPage'
import WebDashboardPage from './pages/dashboard/WebDashboardPage'
import SessionViewer from './pages/session/SessionViewer'
import AuthScreen from './pages/auth/AuthScreen'
import AuthCallback from './pages/auth/AuthCallback'
import Onboard from './pages/auth/Onboard'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import TermsOfService from './pages/legal/TermsOfService'
import DeleteAccount from './pages/legal/DeleteAccount'
import Docs from './pages/Docs'
import Contact from './pages/Contact'
import PublicMeetingPage from './pages/meeting/PublicMeetingPage'
import PublicSessionJoinPage from './pages/session/PublicSessionJoinPage'
import SuperAdminPage from './pages/admin/SuperAdminPage'
import { WebSplashScreen } from './components/web/WebSplashScreen'
import HostMachineLockOverlay from './components/HostMachineLockOverlay'

import React, { useEffect } from 'react'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const isInitialized = useAuthStore((state) => state.isInitialized)
  const location = useLocation()

  if (isLoading || !isInitialized) return null
  if (!token) return <Navigate to="/login" />
  // The org dashboard is meaningless for the platform Super Admin (no org,
  // org-scoped APIs 403) — land them on the /admin console instead, mirroring
  // the desktop app which swaps the whole shell for SuperAdminConsole.
  if (
    String(user?.role || '').toUpperCase() === 'SUPER_ADMIN' &&
    location.pathname.startsWith('/dashboard')
  ) {
    return <Navigate to="/admin" replace />
  }
  return <>{children}</>
}

function App() {
  const location = useLocation()
  const initialize = useAuthStore((state) => state.initialize)
  const setAuth = useAuthStore((state) => state.setAuth)
  const accessToken = useAuthStore((state) => state.accessToken)
  const isInitialized = useAuthStore((state) => state.isInitialized)
  const [showDashboardSplash, setShowDashboardSplash] = React.useState(false)

  useEffect(() => {
    initialize()
    // Re-apply saved customization (dark mode, font size) on boot — the
    // Settings page persists them to localStorage but a fresh tab never
    // applied them, so they only lasted until the next reload.
    import('./lib/customizationPreferences').then(({ applyCustomizationPreferences, readCustomizationPreferences }) => {
      applyCustomizationPreferences(readCustomizationPreferences())
    }).catch(() => undefined)
  }, [initialize])

  useEffect(() => {
    if (!isInitialized || !accessToken || !location.pathname.startsWith('/dashboard')) return
    const key = 'remote365_dashboard_splash_shown'
    if (sessionStorage.getItem(key) === '1') return
    sessionStorage.setItem(key, '1')
    setShowDashboardSplash(true)
  }, [accessToken, isInitialized, location.pathname])

  useEffect(() => {
    if (!showDashboardSplash) return
    const fallbackTimer = window.setTimeout(() => setShowDashboardSplash(false), 3500)
    return () => window.clearTimeout(fallbackTimer)
  }, [showDashboardSplash])

  // Keep the chat WebSocket (real-time messages, presence, typing) connected
  // app-wide while signed in — mirrors the desktop App, which SnowChat relies on.
  useEffect(() => {
    if (!accessToken) return
    useChatStore.getState().connectWebSocket()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined)
    }
    return () => useChatStore.getState().disconnectWebSocket()
  }, [accessToken])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    if (!accessToken || !refreshToken) return

    const completeLegacyOAuthRedirect = async () => {
      try {
        const { default: api } = await import('./lib/api')
        const { data } = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        setAuth(data.user || data, accessToken, refreshToken)
        window.history.replaceState({}, '', window.location.pathname)
      } catch (error) {
        console.error('OAuth dashboard token handoff failed', error)
      }
    }

    completeLegacyOAuthRedirect()
  }, [setAuth])

  return (
    <>
    {/* Locks the whole web app while THIS machine is being remote-controlled
        (the desktop host answers on loopback). Invisible everywhere else. */}
    <HostMachineLockOverlay />
    {showDashboardSplash && (
      <WebSplashScreen isReady={isInitialized} onFinished={() => setShowDashboardSplash(false)} />
    )}
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/downloads" element={<Downloads />} />
      {/* Retired pages. Temporary client redirects until the server sends 301s. */}
      <Route path="/features" element={<Navigate to="/product" replace />} />
      <Route path="/solutions" element={<Navigate to="/product" replace />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/resources" element={<Navigate to="/docs" replace />} />
      <Route path="/enterprise" element={<Navigate to="/pricing" replace />} />
      <Route path="/customers" element={<Navigate to="/" replace />} />
      <Route path="/product" element={<ProductPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      {/* Linked from Google Play Data safety as the account-deletion request URL. */}
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/meeting/:meetingId" element={<PublicMeetingPage />} />
      {/* Support-session invite link (email "Join session", Share) */}
      <Route path="/join/:code" element={<PublicSessionJoinPage />} />
      <Route path="/join" element={<PublicSessionJoinPage />} />

      {/* Dashboard Routes (Protected) */}
      {/* Land signed-in users straight on Devices — the greeting/home page is not
          a sidebar destination, so it should never be the post-login screen. */}
      <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/dashboard/devices" replace /></ProtectedRoute>} />
      <Route path="/dashboard/devices" element={<ProtectedRoute><WebDashboardPage view="devices" title="Devices" /></ProtectedRoute>} />
      <Route path="/dashboard/sessions" element={<ProtectedRoute><WebDashboardPage view="connect" title="Remote Support" /></ProtectedRoute>} />
      <Route path="/dashboard/meetings" element={<ProtectedRoute><WebDashboardPage view="meetings" title="Meetings" /></ProtectedRoute>} />
      <Route path="/dashboard/billing" element={<ProtectedRoute><WebDashboardPage view="billing" title="Billing" /></ProtectedRoute>} />
      <Route path="/dashboard/settings" element={<ProtectedRoute><WebDashboardPage view="settings" title="Settings" /></ProtectedRoute>} />
      <Route path="/dashboard/profile" element={<ProtectedRoute><WebDashboardPage view="profile" title="Profile" /></ProtectedRoute>} />
      <Route path="/dashboard/support" element={<ProtectedRoute><WebDashboardPage view="support" title="Support" /></ProtectedRoute>} />
      <Route path="/dashboard/documentation" element={<ProtectedRoute><WebDashboardPage view="support" title="Documentation" /></ProtectedRoute>} />
      <Route path="/dashboard/members" element={<ProtectedRoute><WebDashboardPage view="members" title="Members" /></ProtectedRoute>} />
      <Route path="/dashboard/chat" element={<ProtectedRoute><WebDashboardPage view="chat" title="Chat" /></ProtectedRoute>} />
      <Route path="/dashboard/admin-settings" element={<ProtectedRoute><WebDashboardPage view="admin_settings" title="Admin Settings" /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><SuperAdminPage /></ProtectedRoute>} />
      <Route path="/session/:deviceId" element={<ProtectedRoute><SessionViewer /></ProtectedRoute>} />

      {/* Auth Routes — single desktop-matched auth screen (sign in / sign up / recover) */}
      <Route path="/login" element={<AuthScreen initialMode="login" />} />
      <Route path="/register" element={<AuthScreen initialMode="signup" />} />
      <Route path="/forgot-password" element={<AuthScreen initialMode="forgot" />} />
      <Route path="/reset-password" element={<AuthScreen initialMode="reset" />} />
      <Route path="/2fa" element={<AuthScreen initialMode="login" />} />
      <Route path="/onboard" element={<Onboard />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
    </>
  )
}

export default App
