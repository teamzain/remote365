// Every public page, for the sitemap and llms.txt.
import { USE_CASES } from '@/content/useCases'
import { REGIONS } from '@/content/regions'

export interface SitePage {
  path: string
  title: string
  description: string
  priority: number
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export const SITE_PAGES: SitePage[] = [
  { path: '/', title: 'Remote365 home', description: 'Remote access, remote support, meetings and chat in one app.', priority: 1, changeFrequency: 'weekly' },
  { path: '/product', title: 'Product', description: 'What Remote365 does: support sessions, unattended access, meetings, chat, file transfer and access control.', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', title: 'Pricing', description: 'Plans and prices in US dollars, with the limits of each plan and a 15-day free trial.', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/downloads', title: 'Download', description: 'Windows app, Android app and Android Host app downloads.', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/use-cases', title: 'Use cases', description: 'IT help desks, managed service providers, remote teams and family support.', priority: 0.8, changeFrequency: 'monthly' },
  ...USE_CASES.map(u => ({
    path: `/use-cases/${u.slug}`,
    title: `${u.eyebrow}: ${u.title}`,
    description: u.summary,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
  })),
  { path: '/remote-desktop', title: 'Remote desktop by country', description: 'Remote365 in Pakistan, Saudi Arabia, the UAE, the United States and Canada.', priority: 0.7, changeFrequency: 'monthly' },
  ...REGIONS.map(r => ({
    path: `/remote-desktop/${r.slug}`,
    title: r.metaTitle,
    description: r.metaDescription,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
  })),
  { path: '/faq', title: 'FAQ', description: 'Answers about sessions, devices, security, meetings and billing.', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/docs', title: 'Docs & Help Center', description: 'How to install, connect, set up unattended access and manage members.', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', title: 'Contact', description: 'Sales and support contact.', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/privacy', title: 'Privacy Policy', description: 'How Remote365 handles personal information.', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', title: 'Terms of Service', description: 'The terms for using Remote365.', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/delete-account', title: 'Delete your account', description: 'How to delete a Remote365 account and its data.', priority: 0.3, changeFrequency: 'yearly' },
]
