import { notFound } from 'next/navigation'
import { isAppPath } from '@/lib/routes'
import { AppShell } from './app-shell'

// The client-side app (dashboard, admin, remote sessions, meetings, sign-in):
// React Router mounted in the browser only. Only the app's own first path
// segments get here; any other unknown URL is a real 404, not an empty shell.
export default async function AppPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  if (!isAppPath(`/${slug.join('/')}`)) notFound()

  return (
    <>
      <AppShell />
      {/* For fetches without JavaScript (link previews, store reviews). */}
      <noscript>
        <div style={{ fontFamily: "'Mona Sans', 'Segoe UI', system-ui, sans-serif", maxWidth: 720, margin: '15vh auto 0', padding: '0 24px', color: 'var(--ink)' }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Remote365</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 16px' }}>
            This part of Remote365 needs JavaScript. Remote365 is a secure
            remote desktop application for accessing and supporting computers
            from anywhere: unattended device access, live remote support
            sessions, video meetings, team chat and file transfer.
          </p>
          <p style={{ fontSize: 14, margin: 0 }}>
            <a href="/" style={{ color: '#FF8A00' }}>Home</a> ·{' '}
            <a href="/downloads" style={{ color: '#FF8A00' }}>Downloads</a> ·{' '}
            <a href="/privacy" style={{ color: '#FF8A00' }}>Privacy Policy</a> ·{' '}
            <a href="/terms" style={{ color: '#FF8A00' }}>Terms of Service</a>
          </p>
        </div>
      </noscript>
    </>
  )
}
