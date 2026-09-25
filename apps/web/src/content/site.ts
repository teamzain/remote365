// Facts about Remote365 shared by the pages, structured data and llms.txt.

/** Shown as "Updated …" on content pages and used as their dateModified. */
export const CONTENT_UPDATED = '2026-09-25'

export const ORGANIZATION = {
  name: 'Remote365',
  legalName: 'TechVision365 Inc.',
  email: 'support@remote365.ai',
  logo: '/logo.png',
  // Real profile URLs go here once they exist; never placeholders.
  sameAs: [] as string[],
}

export const PLATFORMS_SUMMARY =
  'Windows desktop app, Android app, Remote365 Host app for Android devices you want to control, and the web app in any modern browser. macOS and iOS apps are coming soon.'

export const FEATURES = [
  'Support sessions started with a one-time code or link, joinable from a browser without installing anything',
  'Unattended access to your own devices by permanent 9-digit ID and password',
  'Full keyboard and mouse control, multiple monitors, view-only mode',
  'Two-way file transfer and clipboard sync',
  'Video meetings with screen sharing, joinable by code or link',
  'Team chat with files and voice notes',
  'Role-based access control and per-member device access',
  'Two-factor authentication, enforceable for a whole organization on Business and Enterprise',
  'End-to-end encrypted remote sessions; no VPN or port forwarding',
]

export function formatUpdated(date = CONTENT_UPDATED): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
