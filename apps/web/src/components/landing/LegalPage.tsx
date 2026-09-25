'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import SiteContent from '@/components/site/SiteContent'

// Shared layout for legal documents (Privacy Policy, Terms of Service):
// gradient hero, sticky sidebar nav, white content card with sections.

export interface LegalBlock {
  /** Bold sub-heading inside a section (e.g. "2.1 Account Information") */
  sub?: string
  /** Body paragraph */
  text?: string
  /** Bulleted list */
  list?: string[]
}

export interface LegalSection {
  id: string
  navLabel: string
  Icon: LucideIcon
  heading: string
  blocks: LegalBlock[]
}

export interface LegalPageProps {
  title: string
  intro: string
  effectiveDate: string
  sections: LegalSection[]
}

const NAV_OFFSET = 120 // sticky navbar + breathing room

const LegalPage: React.FC<LegalPageProps> = ({ title, intro, effectiveDate, sections }) => {
  const [activeId, setActiveId] = useState(sections[0]?.id)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // Scroll spy — highlight the section currently under the header
  useEffect(() => {
    const onScroll = () => {
      let current = sections[0]?.id
      for (const s of sections) {
        const el = sectionRefs.current[s.id]
        if (el && el.getBoundingClientRect().top <= NAV_OFFSET + 40) current = s.id
      }
      setActiveId(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  const scrollTo = (id: string) => {
    setActiveId(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <SiteContent>

      {/* Gradient hero */}
      <section className="legal-hero">
        <h1 className="legal-title">{title}</h1>
        <p className="legal-intro">{intro}</p>
        <p className="legal-date">Effective Date: {effectiveDate}</p>
      </section>

      {/* Sidebar + content */}
      <main className="legal-main">
        <aside className="legal-sidebar">
          <nav className="legal-nav">
            {sections.map(s => (
              <button
                key={s.id}
                className={`legal-nav-btn${activeId === s.id ? ' is-active' : ''}`}
                onClick={() => scrollTo(s.id)}
              >
                <s.Icon size={16} strokeWidth={1.8} />
                <span>{s.navLabel}</span>
              </button>
            ))}
          </nav>
        </aside>

        <article className="legal-content">
          {sections.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && <div className="legal-divider" />}
              <section
                ref={el => { sectionRefs.current[s.id] = el }}
                style={{ scrollMarginTop: `${NAV_OFFSET}px` }}
              >
                <h2 className="legal-heading">{s.heading}</h2>
                {s.blocks.map((b, j) => (
                  <React.Fragment key={j}>
                    {b.sub && <p className="legal-sub">{b.sub}</p>}
                    {b.text && <p className="legal-p">{b.text}</p>}
                    {b.list && (
                      <ul className="legal-ul">
                        {b.list.map(item => <li key={item}>{item}</li>)}
                      </ul>
                    )}
                  </React.Fragment>
                ))}
              </section>
            </React.Fragment>
          ))}
        </article>
      </main>

      <style>{`
        .legal-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 86px clamp(20px, 5vw, 40px);
          background: linear-gradient(101.38deg, #FF8A00 39.92%, #FFB347 77.46%);
          text-align: center;
        }
        .legal-title {
          margin: 0;
          max-width: 782px;
          font-weight: 700;
          font-size: 32px;
          line-height: 45px;
          color: #000000;
        }
        .legal-intro {
          margin: 0;
          max-width: 782px;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          color: #000000;
        }
        .legal-date {
          margin: 0;
          font-weight: 500;
          font-size: 12px;
          line-height: 17px;
          color: #000000;
        }

        .legal-main {
          display: flex;
          align-items: flex-start;
          gap: 26px;
          width: 100%;
          max-width: 1218px;
          margin: 0 auto;
          padding: 56px clamp(16px, 3vw, 40px) 100px;
          box-sizing: border-box;
          flex: 1;
        }
        .legal-sidebar {
          position: sticky;
          top: 96px;
          width: 308px;
          flex-shrink: 0;
          background: #FFFFFF;
          border-radius: 12px;
          padding: 26px;
          box-sizing: border-box;
        }
        .legal-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .legal-nav-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          height: 40px;
          padding: 10px 16px;
          box-sizing: border-box;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: #111315;
          font-family: inherit;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          overflow: hidden;
        }
        .legal-nav-btn span {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .legal-nav-btn svg { flex-shrink: 0; }
        .legal-nav-btn:hover { background: #F3F4F6; }
        .legal-nav-btn.is-active {
          background: linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%);
          color: #FFFFFF;
        }

        .legal-content {
          flex: 1;
          min-width: 0;
          background: #FFFFFF;
          border-radius: 12px;
          padding: 52px clamp(24px, 5vw, 68px);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .legal-heading {
          margin: 0 0 8px;
          font-weight: 500;
          font-size: 18px;
          line-height: 25px;
          color: #000000;
        }
        .legal-sub {
          margin: 8px 0 0;
          font-weight: 600;
          font-size: 14px;
          line-height: 20px;
          color: #000000;
        }
        .legal-p {
          margin: 0;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          color: #000000;
        }
        .legal-p + .legal-p { margin-top: 8px; }
        .legal-ul {
          margin: 4px 0 0;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          color: #000000;
        }
        .legal-divider {
          border-top: 1px solid rgba(26, 29, 33, 0.3);
        }

        @media (max-width: 900px) {
          .legal-main {
            flex-direction: column;
            gap: 20px;
          }
          .legal-sidebar {
            position: static;
            width: 100%;
            padding: 16px;
          }
          .legal-nav {
            flex-direction: row;
            flex-wrap: wrap;
          }
          .legal-nav-btn { width: auto; }
          .legal-content { padding: 32px 20px; }
        }
      `}</style>
    </SiteContent>
  )
}

export default LegalPage
