import SiteContent from '@/components/site/SiteContent'
import SiteLink from '@/components/site/SiteLink'
import JsonLd from '@/components/site/JsonLd'
import FaqList from '@/components/landing/FaqList'
import GetStartedCta from '@/components/landing/GetStartedCta'
import { ALL_FAQS, FAQ_GROUPS } from '@/content/faq'
import { CONTENT_UPDATED, formatUpdated } from '@/content/site'
import { breadcrumbs, faqPage, graph, organization, webPage } from '@/lib/jsonld'
import { pageMetadata } from '@/lib/seo'

const TITLE = 'Remote365 questions and answers'
const DESCRIPTION =
  'Answers about Remote365: how support sessions and unattended access work, which devices it runs on, how remote sessions are secured, meetings and chat, and plans, trials and billing.'

export const metadata = pageMetadata({ title: 'FAQ', description: DESCRIPTION, path: '/faq' })

export default function FaqPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'FAQ', path: '/faq' },
  ]
  return (
    <SiteContent>
      <JsonLd
        data={graph(
          organization(),
          webPage({ path: '/faq', name: TITLE, description: DESCRIPTION }),
          breadcrumbs(crumbs),
          faqPage(ALL_FAQS, '/faq'),
        )}
      />
      <main className="fq">
        <header className="fq-hero">
          <p className="fq-eyebrow">FAQ</p>
          <h1 className="fq-title">{TITLE}</h1>
          <p className="fq-answer">
            Remote365 is a remote access and support app for Windows, Android and the web:
            connect with a one-time session code or to your own devices by ID, with
            end-to-end encrypted remote sessions, meetings and team chat. Below are
            answers to common questions, grouped by topic.
          </p>
          <p className="fq-updated">Updated <time dateTime={CONTENT_UPDATED}>{formatUpdated()}</time></p>
          <nav className="fq-toc" aria-label="Topics">
            {FAQ_GROUPS.map(g => <SiteLink key={g.id} href={`#${g.id}-title`}>{g.title}</SiteLink>)}
          </nav>
        </header>

        {FAQ_GROUPS.map(g => <FaqList key={g.id} id={g.id} title={g.title} items={g.items} />)}

        <p className="fq-more">
          Didn’t find your answer? Read the <SiteLink href="/docs">Docs</SiteLink> or{' '}
          <SiteLink href="/contact">contact the team</SiteLink>.
        </p>
      </main>
      <GetStartedCta />

      <style>{`
        .fq {
          box-sizing: border-box;
          max-width: 1030px;
          margin: 0 auto;
          padding: 40px clamp(16px, 4vw, 40px) 24px;
          color: #fff;
        }
        .fq-hero { max-width: 760px; margin: 0 auto; text-align: center; }
        .fq-eyebrow { margin: 0; font-size: 14px; font-weight: 600; color: #ff8a00; }
        .fq-title {
          margin: 10px 0 0;
          font-size: clamp(2rem, 4.5vw, 52px);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.03em;
          background-image: linear-gradient(180deg, #ffffff 0%, #b8bec8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          padding-bottom: 0.06em;
        }
        .fq-answer {
          margin: 18px 0 0;
          font-size: 17px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.8);
        }
        .fq-updated { margin: 12px 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.5); }
        .fq-toc {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
        }
        .fq-toc a {
          padding: 8px 14px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          font-size: 14px;
          text-decoration: none;
        }
        .fq-toc a:hover { border-color: rgba(255, 138, 0, 0.6); }
        .fq .faq-section { padding-top: 56px; padding-bottom: 0; scroll-margin-top: var(--site-nav-h); }
        .fq .faq-title { scroll-margin-top: calc(var(--site-nav-h) + 16px); }
        .fq-more {
          margin: 56px 0 0;
          text-align: center;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
        }
        .fq-more a { color: #ff8a00; font-weight: 600; text-decoration: none; }
        .fq-more a:hover { text-decoration: underline; }
      `}</style>
    </SiteContent>
  )
}
