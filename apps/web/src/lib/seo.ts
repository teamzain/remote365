import type { Metadata } from 'next'

export const SITE_URL = 'https://remote365.ai'
export const SITE_NAME = 'Remote365'
export const DEFAULT_TITLE = 'Remote365 – Secure Remote Desktop & Support'

interface PageSeo {
  /** Page title without the brand; the root layout's template appends " | Remote365". */
  title: string
  description: string
  /** Root-relative canonical path, e.g. "/pricing". */
  path: string
  /** Use `title` as-is (no " | Remote365"), for the home page. */
  absoluteTitle?: boolean
  /** Root-relative OG image; defaults to the section's opengraph-image. */
  image?: string
}

// Title, description, canonical URL and social cards for a public page, so
// every page states the same facts to search engines and link previews.
export function pageMetadata({ title, description, path, absoluteTitle, image }: PageSeo): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: path,
      title: fullTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}
