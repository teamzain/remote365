import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isAppPath } from '../lib/routes'

// Fallback route of the client-side app. A link inside the app to a website
// page ("/", "/pricing" …) lands here: those pages are server-rendered by
// Next, so load them for real. An unknown path under an app prefix
// (/dashboard/nope) gets an in-app 404 instead — reloading it would come
// straight back here.
export default function ExitToSite() {
  const { pathname, search, hash } = useLocation()
  const inApp = isAppPath(pathname)

  useEffect(() => {
    if (!inApp) window.location.replace(`${pathname}${search}${hash}`)
  }, [inApp, pathname, search, hash])

  if (!inApp) return null
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, fontFamily: "'Mona Sans', system-ui, sans-serif", color: 'var(--ink)', textAlign: 'center' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Page not found</h1>
      <p style={{ margin: 0, color: 'var(--ink-70)' }}>This page doesn’t exist in Remote365.</p>
      <Link to="/dashboard" style={{ color: '#FF8A00', fontWeight: 600 }}>Go to your dashboard</Link>
    </div>
  )
}
