// Facts about Remote365 shared by the pages, structured data and llms.txt.

/** Shown as "Updated …" on content pages and used as their dateModified. */
export const CONTENT_UPDATED = '2026-09-25'

export const ORGANIZATION = {
  name: 'Remote365',
  legalName: 'TechVision365 Inc.',
  email: 'support@remote365.ai',
  logo: '/logo.png',
  // Real profile URLs only; never placeholders.
  sameAs: [
    'https://www.linkedin.com/company/remote365ai',
    'https://www.facebook.com/remote365ai',
    'https://www.instagram.com/remote365.ai/',
  ],
}

/** The developer who built Remote365; credited in the footer and as the
 *  creator in the SoftwareApplication JSON-LD. */
export const CREATOR = {
  name: 'Zain Ul Abidden',
  jobTitle: 'Software Developer',
  description:
    'Developer of Remote365, who built the platform brick by brick: the Windows and Android apps, the web app and the servers behind them.',
  linkedin: 'https://www.linkedin.com/in/zain-ul-abidden-85219b285',
  instagram: 'https://www.instagram.com/__zayn.ulabidden__/',
}

export const PLATFORMS_SUMMARY =
  'Windows desktop app, Android app, Remote365 Host app for Android devices you want to control, and the web app in any modern browser. macOS and iOS apps are coming soon.'

export const FEATURES = [
  'Support sessions started with a one-time code or link; the person being helped joins in the Remote365 app, no account needed',
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
