// schema.org structured data (JSON-LD). One @graph per page; entities refer
// to each other by @id. Facts only: no ratings or reviews, and sameAs only
// lists real profiles (content/site.ts).
import { ORGANIZATION, PLATFORMS_SUMMARY, FEATURES, CONTENT_UPDATED } from '@/content/site'
import type { ApiPlan } from '@/lib/plans'
import type { Faq } from '@/content/faq'
import { SITE_URL, SITE_NAME } from '@/lib/seo'

type Thing = Record<string, unknown>

const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`
const APP_ID = `${SITE_URL}/#software`

const abs = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path === '/' ? '' : path}`)

export function organization(): Thing {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: abs(ORGANIZATION.logo), width: 500, height: 500 },
    email: ORGANIZATION.email,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: ORGANIZATION.email,
      url: abs('/contact'),
      availableLanguage: ['English'],
    },
    ...(ORGANIZATION.sameAs.length ? { sameAs: ORGANIZATION.sameAs } : {}),
  }
}

export function website(): Thing {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  }
}

/** The product, with the public plans as offers (prices in USD per month). */
export function softwareApplication(plans?: ApiPlan[]): Thing {
  const offers = (plans ?? [])
    .filter(p => typeof p.price === 'number')
    .map(p => ({
      '@type': 'Offer',
      name: p.name,
      description: p.description,
      price: String(p.price),
      priceCurrency: 'USD',
      url: abs('/pricing'),
      ...(p.price === 0
        ? {}
        : {
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: String(p.price),
              priceCurrency: 'USD',
              unitCode: 'MON',
              referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
            },
          }),
    }))
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Remote desktop software',
    operatingSystem: 'Windows, Android, Web browser',
    description:
      'Remote desktop and remote support app: support sessions with a one-time code, unattended access by device ID, video meetings and team chat, with end-to-end encrypted remote sessions.',
    featureList: FEATURES,
    softwareRequirements: PLATFORMS_SUMMARY,
    downloadUrl: abs('/downloads'),
    publisher: { '@id': ORG_ID },
    ...(offers.length ? { offers } : {}),
  }
}

export function faqPage(faqs: Faq[], path: string): Thing {
  return {
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

export function breadcrumbs(items: { name: string; path: string }[]): Thing {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  }
}

export function webPage({ path, name, description, type = 'WebPage', dateModified = CONTENT_UPDATED }: {
  path: string
  name: string
  description: string
  type?: string
  dateModified?: string
}): Thing {
  return {
    '@type': type,
    '@id': abs(path),
    url: abs(path),
    name,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': SITE_ID },
    about: { '@id': APP_ID },
    dateModified,
  }
}

/** Remote access offered in one country (region pages). */
export function service({ path, name, areaServed, description }: {
  path: string
  name: string
  areaServed: string
  description: string
}): Thing {
  return {
    '@type': 'Service',
    '@id': `${abs(path)}#service`,
    name,
    serviceType: 'Remote desktop and remote support software',
    description,
    provider: { '@id': ORG_ID },
    areaServed: { '@type': 'Country', name: areaServed },
    url: abs(path),
    isRelatedTo: { '@id': APP_ID },
  }
}

export function graph(...nodes: Thing[]): Thing {
  return { '@context': 'https://schema.org', '@graph': nodes }
}
