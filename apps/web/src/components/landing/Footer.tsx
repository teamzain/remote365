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
//
// The <style> below is global and this footer is on every page, so its
// classes carry the full site-footer- prefix: as .ft-* they shared names with
// FeatureTabs, and on /product each component took on the other's styles.

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
  <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <SiteLink href="/" className="site-footer-logo">
            <img src="/logo.png" alt="" width={28} height={28} loading="lazy" />
            <span>Remote365</span>
          </SiteLink>
          <p className="site-footer-copy">© {new Date().getFullYear()} TechVision365 Inc. All rights reserved.</p>
        </div>

        <nav className="site-footer-cols" aria-label="Footer">
          {COLUMNS.map(column => (
            <div key={column.heading} className="site-footer-col">
              <p className="site-footer-heading">{column.heading}</p>
              <ul className="site-footer-links">
                {column.links.map(link => (
                  <li key={link.to}>
                    <SiteLink href={link.to} className="site-footer-link">{link.label}</SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="site-footer-wordmark" aria-hidden="true">Remote365</div>
    </div>

    <style>{`
      .site-footer {
        position: relative;
        overflow: hidden;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: #fff;
        font-family: var(--font-body);
      }
      .site-footer-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: clamp(48px, 7vw, 80px) clamp(20px, 4vw, 48px) clamp(20px, 3vw, 36px);
        box-sizing: border-box;
        container-type: inline-size;
      }
      .site-footer-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 40px 64px;
      }
      .site-footer-brand {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 320px;
      }
      .site-footer-logo {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        align-self: flex-start;
        font-family: var(--font-heading);
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        text-decoration: none;
      }
      .site-footer-logo img { width: 28px; height: 28px; object-fit: contain; }
      .site-footer-copy {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.55);
      }
      .site-footer-cols {
        display: grid;
        grid-template-columns: repeat(4, auto);
        gap: 36px clamp(32px, 4.5vw, 64px);
      }
      .site-footer-heading {
        margin: 0 0 18px;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
      }
      .site-footer-links {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .site-footer-link {
        font-size: 14px;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.6);
        text-decoration: none;
        transition: color 0.2s;
      }
      .site-footer-link:hover,
      .site-footer-logo:hover span { color: #fff; }
      .site-footer-link:focus-visible,
      .site-footer-logo:focus-visible { outline: 2px solid #ff8a00; outline-offset: 3px; border-radius: 4px; }

      /* The name across the full width: sized to the container (fallback:
         the viewport), faint at the top and a little stronger at the foot.
         "Remote365" in Poppins Bold at -0.04em is 5.52 × its font size
         wide; 5.65 leaves a sliver of room either side. */
      .site-footer-wordmark {
        margin-top: clamp(48px, 8vw, 96px);
        font-family: var(--font-heading);
        font-size: clamp(52px, 15vw, 200px);
        font-size: calc(100cqw / 5.65);
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
        .site-footer-top { flex-direction: column; }
        .site-footer-brand { max-width: none; }
        .site-footer-cols { width: 100%; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .site-footer-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 16px; }
      }
    `}</style>
  </footer>
)

export default Footer
