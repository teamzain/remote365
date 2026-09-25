import React from 'react'
import SiteLink from '@/components/site/SiteLink'
import { REGIONS } from '@/content/regions'

// Site footer, laid out after Aceternity UI's "Simple Footer With Four
// Grids" block (ui.aceternity.com/blocks/footers): brand and copyright on
// the left, four link columns on the right, the name in huge faded letters
// underneath. Written from scratch for the dark site (the block's own code is
// part of Aceternity UI Pro). Only pages that exist are linked; the block's
// Socials column became Regions until real social profiles exist (they would
// also go into the Organization JSON-LD as sameAs).

type Column = { heading: string; links: { label: string; to: string }[] }

const COLUMNS: Column[] = [
  {
    heading: 'Pages',
    links: [
      { label: 'Product', to: '/product' },
      { label: 'Use Cases', to: '/use-cases' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Download', to: '/downloads' },
      { label: 'Docs', to: '/docs' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    heading: 'Regions',
    links: REGIONS.map(r => ({ label: r.areaServed, to: `/remote-desktop/${r.slug}` })),
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign Up', to: '/register' },
      { label: 'Sign In', to: '/login' },
      { label: 'Forgot Password', to: '/forgot-password' },
    ],
  },
]

const Footer: React.FC = () => (
  <footer className="ft">
    <div className="ft-inner">
      <div className="ft-top">
        <div className="ft-brand">
          <SiteLink href="/" className="ft-logo">
            <img src="/logo.png" alt="" width={28} height={28} loading="lazy" />
            <span>Remote365</span>
          </SiteLink>
          <p className="ft-copy">© {new Date().getFullYear()} TechVision365 Inc. All rights reserved.</p>
        </div>

        <nav className="ft-cols" aria-label="Footer">
          {COLUMNS.map(column => (
            <div key={column.heading} className="ft-col">
              <p className="ft-heading">{column.heading}</p>
              <ul className="ft-links">
                {column.links.map(link => (
                  <li key={link.to}>
                    <SiteLink href={link.to} className="ft-link">{link.label}</SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="ft-wordmark" aria-hidden="true">Remote365</div>
    </div>

    <style>{`
      .ft {
        position: relative;
        overflow: hidden;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: #fff;
        font-family: 'Mona Sans', system-ui, -apple-system, sans-serif;
      }
      .ft-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: clamp(48px, 7vw, 80px) clamp(20px, 4vw, 48px) clamp(20px, 3vw, 36px);
        box-sizing: border-box;
        container-type: inline-size;
      }
      .ft-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 40px 64px;
      }
      .ft-brand {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 320px;
      }
      .ft-logo {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        align-self: flex-start;
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        text-decoration: none;
      }
      .ft-logo img { width: 28px; height: 28px; object-fit: contain; }
      .ft-copy {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.55);
      }
      .ft-cols {
        display: grid;
        grid-template-columns: repeat(4, auto);
        gap: 36px clamp(32px, 4.5vw, 64px);
      }
      .ft-heading {
        margin: 0 0 18px;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
      }
      .ft-links {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .ft-link {
        font-size: 14px;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.6);
        text-decoration: none;
        transition: color 0.2s;
      }
      .ft-link:hover,
      .ft-logo:hover span { color: #fff; }
      .ft-link:focus-visible,
      .ft-logo:focus-visible { outline: 2px solid #ff8a00; outline-offset: 3px; border-radius: 4px; }

      /* The name across the full width: sized to the container (fallback:
         the viewport), faint at the top and a little stronger at the foot.
         "Remote365" in Mona Sans Bold at -0.04em is 5.33 × its font size
         wide; 5.45 leaves a sliver of room either side. */
      .ft-wordmark {
        margin-top: clamp(48px, 8vw, 96px);
        font-size: clamp(52px, 15vw, 200px);
        font-size: calc(100cqw / 5.45);
        font-weight: 700;
        line-height: 0.82;
        letter-spacing: -0.04em;
        text-align: center;
        white-space: nowrap;
        background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.16) 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        user-select: none;
        pointer-events: none;
      }

      @media (max-width: 1023px) {
        .ft-top { flex-direction: column; }
        .ft-brand { max-width: none; }
        .ft-cols { width: 100%; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .ft-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 16px; }
      }
    `}</style>
  </footer>
)

export default Footer
