import { connection } from 'next/server'
import { getPublicPlans } from '@/lib/plans'
import { SITE_URL } from '@/lib/seo'
import { SITE_PAGES } from '@/lib/sitePages'
import { FEATURES, ORGANIZATION, PLATFORMS_SUMMARY, CONTENT_UPDATED } from '@/content/site'
import { ALL_FAQS } from '@/content/faq'

// /llms.txt (llmstxt.org): a plain-markdown summary of Remote365 for AI
// assistants, built from the same content as the pages. Prices come from the
// live plan catalogue.
const url = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`
const link = (path: string) => {
  const page = SITE_PAGES.find(p => p.path === path)
  return page ? `- [${page.title}](${url(page.path)}): ${page.description}` : ''
}

export async function GET() {
  await connection()
  const plans = await getPublicPlans()

  const planLines = plans.map(p => {
    const price = p.price === 0 ? `free (${p.priceLabel})` : `$${p.price} per month`
    const limits = [
      p.maxUsers == null ? 'unlimited members' : `${p.maxUsers} member${p.maxUsers === 1 ? '' : 's'}`,
      p.maxDevices == null ? 'unlimited devices' : `${p.maxDevices} devices`,
    ].join(', ')
    return `- ${p.name}: ${price}; ${limits}. ${p.description}`
  })

  const section = (title: string, prefix: string) =>
    [`## ${title}`, '', ...SITE_PAGES.filter(p => p.path.startsWith(prefix) && p.path !== prefix).map(p => link(p.path)), '']

  const body = [
    '# Remote365',
    '',
    '> Remote365 is a remote desktop and remote support app for Windows, Android and the web. Connect with a one-time session code or to your own devices by permanent ID, run video meetings and team chat, with end-to-end encrypted remote sessions and no VPN or port forwarding.',
    '',
    `Made by ${ORGANIZATION.legalName}, contact ${ORGANIZATION.email}. Updated ${CONTENT_UPDATED}.`,
    '',
    '## Key facts',
    '',
    `- Platforms: ${PLATFORMS_SUMMARY}`,
    ...FEATURES.map(f => `- ${f}`),
    '',
    '## Pricing (US dollars, billed monthly per workspace)',
    '',
    ...planLines,
    `- Larger organizations can ask for a custom plan: ${url('/contact')}`,
    `- Current plans and limits: ${url('/pricing')}`,
    '',
    '## Main pages',
    '',
    ...['/', '/product', '/pricing', '/downloads', '/docs', '/faq'].map(link),
    '',
    ...section('Use cases', '/use-cases'),
    ...section('Remote desktop by country', '/remote-desktop'),
    '## Common questions',
    '',
    ...ALL_FAQS.map(f => `- ${f.question} ${f.answer}`),
    '',
    '## Optional',
    '',
    ...['/contact', '/privacy', '/terms', '/delete-account'].map(link),
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
