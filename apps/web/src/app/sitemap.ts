import type { MetadataRoute } from 'next'
import { SITE_PAGES } from '@/lib/sitePages'
import { SITE_URL } from '@/lib/seo'
import { CONTENT_UPDATED } from '@/content/site'

// Public pages only; app screens (sign-in, dashboard, meeting links) are
// noindex and stay out.
export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_PAGES.map(page => ({
    url: `${SITE_URL}${page.path === '/' ? '' : page.path}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))
}
