import { AppShell } from './app-shell'

// Every route, for now: the existing React Router app mounted client-only
// (Next's "migrate from Vite" starting point). Public pages move to real
// server-rendered routes next.
export default function Page() {
  return (
    <>
      <AppShell />
      {/* Fallback for no-JS fetches and app-verification reviews. */}
      <noscript>
        <div style={{ fontFamily: "'Mona Sans', 'Segoe UI', system-ui, sans-serif", maxWidth: 720, margin: '15vh auto 0', padding: '0 24px', color: '#111315' }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Remote365</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 16px' }}>
            Remote365 is a secure remote desktop application for accessing and
            supporting computers from anywhere: unattended device access, live
            remote support sessions, video meetings, team chat, and file
            transfer, with end-to-end encrypted remote sessions. Sign in on the
            web or download the desktop app to manage your device fleet.
          </p>
          <p style={{ fontSize: 14, margin: 0 }}>
            <a href="/downloads" style={{ color: '#FF8A00' }}>Downloads</a> ·{' '}
            <a href="/privacy" style={{ color: '#FF8A00' }}>Privacy Policy</a> ·{' '}
            <a href="/terms" style={{ color: '#FF8A00' }}>Terms of Service</a>
          </p>
        </div>
      </noscript>
    </>
  )
}
