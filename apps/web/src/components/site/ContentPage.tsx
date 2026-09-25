import type { ReactNode } from 'react'
import Image from 'next/image'
import SiteContent from './SiteContent'
import SiteLink from './SiteLink'
import FaqList from '@/components/landing/FaqList'
import GetStartedCta from '@/components/landing/GetStartedCta'
import type { Faq } from '@/content/faq'
import { CONTENT_UPDATED, formatUpdated } from '@/content/site'

export interface ContentSection {
  heading: string
  body: string
  points?: string[]
}

interface ContentPageProps {
  breadcrumbs: { name: string; path: string }[]
  eyebrow: string
  title: string
  /** Direct answer under the H1 (the passage AI answers quote). */
  answer: string
  image?: { src: string; alt: string }
  facts?: { label: string; value: string }[]
  sections: ContentSection[]
  faqs?: Faq[]
  related?: { title: string; text: string; href: string }[]
  relatedTitle?: string
  children?: ReactNode
}

// Layout for the answer-first content pages (use cases, regions): breadcrumb,
// H1 with a direct answer, a visible "Updated" date, question-style H2
// sections, an FAQ and related pages.
export default function ContentPage({
  breadcrumbs, eyebrow, title, answer, image, facts, sections, faqs, related, relatedTitle = 'Related', children,
}: ContentPageProps) {
  return (
    <SiteContent>
      <main className="cp">
        <nav className="cp-crumbs" aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((c, i) => (
              <li key={c.path}>
                {i < breadcrumbs.length - 1
                  ? <SiteLink href={c.path}>{c.name}</SiteLink>
                  : <span aria-current="page">{c.name}</span>}
              </li>
            ))}
          </ol>
        </nav>

        <header className="cp-hero">
          <p className="cp-eyebrow">{eyebrow}</p>
          <h1 className="cp-title">{title}</h1>
          <p className="cp-answer">{answer}</p>
          <p className="cp-updated">
            Updated <time dateTime={CONTENT_UPDATED}>{formatUpdated()}</time>
          </p>
        </header>

        {image && (
          <div className="cp-image">
            <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1000px) 960px, 100vw" priority />
          </div>
        )}

        {facts && facts.length > 0 && (
          <dl className="cp-facts">
            {facts.map(f => (
              <div key={f.label} className="cp-fact">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="cp-sections">
          {sections.map(s => (
            <section key={s.heading} className="cp-section">
              <h2>{s.heading}</h2>
              <p>{s.body}</p>
              {s.points && (
                <ul>
                  {s.points.map(p => <li key={p}>{p}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        {children}

        {faqs && faqs.length > 0 && <FaqList items={faqs} title="Questions and answers" />}

        {related && related.length > 0 && (
          <section className="cp-related" aria-labelledby="cp-related-title">
            <h2 id="cp-related-title">{relatedTitle}</h2>
            <div className="cp-related-grid">
              {related.map(r => (
                <SiteLink key={r.href} href={r.href} className="cp-card">
                  <span className="cp-card-title">{r.title}</span>
                  <span className="cp-card-text">{r.text}</span>
                </SiteLink>
              ))}
            </div>
          </section>
        )}
      </main>

      <GetStartedCta />

      <style>{`
        .cp {
          box-sizing: border-box;
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          padding: 32px clamp(16px, 4vw, 40px) 24px;
          color: #fff;
        }
        .cp-crumbs ol {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 0;
          padding: 0;
          list-style: none;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
        }
        .cp-crumbs li + li::before { content: '›'; margin-right: 6px; }
        .cp-crumbs a { color: rgba(255, 255, 255, 0.72); text-decoration: none; }
        .cp-crumbs a:hover { color: #ff8a00; }
        .cp-hero { margin-top: 28px; }
        .cp-eyebrow {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #ff8a00;
        }
        .cp-title {
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
        .cp-answer {
          margin: 18px 0 0;
          max-width: 760px;
          font-size: clamp(17px, 1.6vw, 19px);
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.82);
        }
        .cp-updated {
          margin: 14px 0 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }
        .cp-image {
          position: relative;
          margin-top: 36px;
          aspect-ratio: 16 / 9;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cp-image img { object-fit: cover; }
        .cp-facts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
          gap: 12px;
          margin: 36px 0 0;
        }
        .cp-fact {
          padding: 16px 18px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
        }
        .cp-fact dt {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
        }
        .cp-fact dd {
          margin: 6px 0 0;
          font-size: 15px;
          line-height: 1.5;
          color: #fff;
        }
        .cp-sections {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 40px;
        }
        .cp-section {
          padding: clamp(20px, 3vw, 32px);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 12, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .cp-section h2 {
          margin: 0;
          font-size: clamp(20px, 2.2vw, 26px);
          font-weight: 650;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .cp-section p {
          margin: 12px 0 0;
          font-size: 16px;
          line-height: 1.65;
          color: rgba(255, 255, 255, 0.75);
        }
        .cp-section ul {
          margin: 14px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cp-section li {
          position: relative;
          padding-left: 26px;
          font-size: 15.5px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.82);
        }
        .cp-section li::before {
          content: '';
          position: absolute;
          left: 2px;
          top: 0.45em;
          width: 12px;
          height: 7px;
          border-left: 2px solid #ff8a00;
          border-bottom: 2px solid #ff8a00;
          transform: rotate(-45deg);
        }
        .cp .faq-section { padding-left: 0; padding-right: 0; padding-bottom: 40px; }
        .cp-related { margin-top: 8px; }
        .cp-related h2 {
          margin: 0 0 16px;
          font-size: 22px;
          font-weight: 650;
        }
        .cp-related-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
          gap: 12px;
        }
        .cp-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 18px 20px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
          text-decoration: none;
          transition: border-color 0.3s, background 0.3s;
        }
        .cp-card:hover { border-color: rgba(255, 138, 0, 0.55); background: rgba(255, 255, 255, 0.07); }
        .cp-card-title { font-size: 16px; font-weight: 600; }
        .cp-card-text { font-size: 14px; line-height: 1.5; color: rgba(255, 255, 255, 0.62); }
      `}</style>
    </SiteContent>
  )
}
