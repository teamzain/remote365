import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { SITE_URL } from '@/lib/seo'

const CANONICAL_HOST = new URL(SITE_URL).host

// The same build serves production and preprod, so this answers per host:
// only remote365.ai may be crawled. Search engines and AI assistants
// (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended …) are
// all welcome there; the "*" group covers them.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host')?.split(':')[0]
  if (host !== CANONICAL_HOST) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Signed-in areas. Sign-in, meeting and join pages stay crawlable so
      // crawlers see their noindex and link previews keep working.
      disallow: ['/api/', '/dashboard', '/admin', '/session/', '/auth/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
