import React from 'react'
import SiteLink from '@/components/site/SiteLink'
import { REGIONS } from '@/content/regions'

type Section = { heading: string; links: { label: string; to: string }[] }

const PRODUCT: Section = {
  heading: 'Product',
  links: [
    { label: 'Product',  to: '/product' },
    { label: 'Pricing',  to: '/pricing' },
    { label: 'Download', to: '/downloads' },
    { label: 'Use cases', to: '/use-cases' },
  ],
}

const RESOURCES: Section = {
  heading: 'Resources',
  links: [
    { label: 'Docs',    to: '/docs' },
    { label: 'FAQ',     to: '/faq' },
    { label: 'Contact', to: '/contact' },
  ],
}

const REGION_LINKS: Section = {
  heading: 'Regions',
  links: REGIONS.map(r => ({ label: r.areaServed, to: `/remote-desktop/${r.slug}` })),
}

const ACCOUNT: Section = {
  heading: 'Account',
  links: [
    { label: 'Log in',      to: '/login' },
    { label: 'Get started', to: '/register' },
  ],
}

/* Only the pages that actually work (mirrors the navbar) */
const COLUMNS: Section[][] = [
  [PRODUCT],
  [RESOURCES],
  [REGION_LINKS],
  [ACCOUNT],
]

const IconCopyright = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1.92-9.14c.05-.33.16-.62.3-.87.15-.25.34-.46.59-.62.24-.15.54-.22.91-.23.23.01.44.05.63.13.2.09.38.21.52.36s.25.33.34.53.13.42.14.64h1.79c-.02-.47-.11-.9-.28-1.29s-.4-.73-.7-1.01-.66-.5-1.08-.66-.88-.23-1.39-.23c-.65 0-1.22.11-1.7.34s-.88.53-1.2.92-.56.84-.71 1.36S8 11.29 8 11.87v.27c0 .58.08 1.12.23 1.64s.39.97.71 1.35.72.69 1.2.91 1.05.34 1.7.34c.47 0 .91-.08 1.32-.23s.77-.36 1.08-.63.56-.58.74-.94.29-.74.3-1.15h-1.79c-.01.21-.06.4-.15.58s-.21.33-.36.46-.32.23-.52.3c-.19.07-.39.09-.6.1-.36-.01-.66-.08-.89-.23-.25-.16-.45-.37-.59-.62s-.25-.55-.3-.88-.08-.67-.08-1v-.27c0-.35.03-.68.08-1.01z" />
  </svg>
)

const Footer: React.FC = () => (
  <footer className="lf-footer">
    <div className="lf-inner">

      {/* Link columns */}
      <div className="lf-cols">
        {COLUMNS.map((stack, i) => (
          <div key={i} className="lf-stack">
            {stack.map(section => (
              <div key={section.heading} className="lf-section">
                <p className="lf-heading">{section.heading}</p>
                <div className="lf-links">
                  {section.links.map(link => (
                    <SiteLink key={link.label} href={link.to} className="lf-link">
                      {link.label}
                    </SiteLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="lf-divider" />

      {/* Brand + socials */}
      <div className="lf-brandRow">
        <div className="lf-brand">
          <img src="/logo.png" alt="Remote365" width={32} height={32} loading="lazy" />
          <span>Remote365</span>
        </div>
        {/* Social profiles go here once the accounts exist (and into the
            Organization JSON-LD as sameAs). */}
      </div>

      <div className="lf-divider" />

      {/* Legal bar */}
      <div className="lf-legalRow">
        <div className="lf-legalLinks">
          <SiteLink href="/terms" className="lf-legalLink">Terms of Service</SiteLink>
          <SiteLink href="/privacy" className="lf-legalLink">Privacy Policy</SiteLink>
        </div>
        <div className="lf-copy">
          <IconCopyright />
          <span>{new Date().getFullYear()} TechVision365 Inc., All rights reserved</span>
        </div>
      </div>

    </div>

    <style>{`
      .lf-footer {
        background: #F3F4F6;
        font-family: 'Mona Sans', system-ui, -apple-system, sans-serif;
      }
      .lf-inner {
        max-width: 1440px;
        margin: 0 auto;
        padding: 50px clamp(20px, 4vw, 48px);
        box-sizing: border-box;
      }

      .lf-cols {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 40px 60px;
      }
      .lf-stack {
        display: flex;
        flex-direction: column;
        gap: 60px;
        min-width: 117px;
      }
      .lf-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .lf-heading {
        margin: 0;
        font-weight: 600;
        font-size: 16px;
        line-height: 23px;
        color: #111315;
      }
      .lf-links {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .lf-link {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: rgba(26, 29, 33, 0.75);
        text-decoration: none;
        transition: color 0.15s;
      }
      .lf-link:hover { color: #111315; }

      .lf-divider {
        border-top: 1px solid rgba(26, 29, 33, 0.3);
        margin-top: 40px;
      }

      .lf-brandRow {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 20px 60px;
        margin-top: 40px;
      }
      .lf-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lf-brand img {
        width: 32px;
        height: 32px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .lf-brand span {
        font-weight: 600;
        font-size: 16px;
        line-height: 23px;
        color: #111315;
      }
      .lf-legalRow {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px 50px;
        margin-top: 22px;
      }
      .lf-legalLinks {
        display: flex;
        align-items: center;
        gap: 50px;
      }
      .lf-legalLink {
        font-weight: 500;
        font-size: 12px;
        line-height: 17px;
        color: #000000;
        text-decoration: none;
      }
      .lf-legalLink:hover { text-decoration: underline; }
      .lf-copy {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
        font-size: 12px;
        line-height: 17px;
        color: #000000;
      }

      @media (max-width: 1100px) {
        .lf-inner { padding: 50px 40px; }
        .lf-cols { justify-content: flex-start; gap: 40px 64px; }
      }
      @media (max-width: 640px) {
        .lf-inner { padding: 40px 20px; }
        .lf-cols {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px 16px;
        }
        .lf-stack { gap: 32px; }
        .lf-brandRow {
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
        }
        .lf-legalRow {
          flex-direction: column;
          align-items: flex-start;
        }
        .lf-legalLinks { gap: 24px; }
      }
    `}</style>
  </footer>
)

export default Footer
