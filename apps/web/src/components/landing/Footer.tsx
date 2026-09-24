import React from 'react'
import { Link as RouterLink } from 'react-router-dom'

type Section = { heading: string; links: { label: string; to: string }[] }

const PRODUCT: Section = {
  heading: 'Product',
  links: [
    { label: 'Product',  to: '/product' },
    { label: 'Pricing',  to: '/pricing' },
    { label: 'Download', to: '/downloads' },
  ],
}

const RESOURCES: Section = {
  heading: 'Resources',
  links: [
    { label: 'Docs',    to: '/docs' },
    { label: 'Contact', to: '/contact' },
  ],
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
  [ACCOUNT],
]

const IconFacebook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
  </svg>
)
const IconLinkedIn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.836L2.25 2.25h6.986l4.265 5.64L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
  </svg>
)
const IconYouTube = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

const IconCopyright = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1.92-9.14c.05-.33.16-.62.3-.87.15-.25.34-.46.59-.62.24-.15.54-.22.91-.23.23.01.44.05.63.13.2.09.38.21.52.36s.25.33.34.53.13.42.14.64h1.79c-.02-.47-.11-.9-.28-1.29s-.4-.73-.7-1.01-.66-.5-1.08-.66-.88-.23-1.39-.23c-.65 0-1.22.11-1.7.34s-.88.53-1.2.92-.56.84-.71 1.36S8 11.29 8 11.87v.27c0 .58.08 1.12.23 1.64s.39.97.71 1.35.72.69 1.2.91 1.05.34 1.7.34c.47 0 .91-.08 1.32-.23s.77-.36 1.08-.63.56-.58.74-.94.29-.74.3-1.15h-1.79c-.01.21-.06.4-.15.58s-.21.33-.36.46-.32.23-.52.3c-.19.07-.39.09-.6.1-.36-.01-.66-.08-.89-.23-.25-.16-.45-.37-.59-.62s-.25-.55-.3-.88-.08-.67-.08-1v-.27c0-.35.03-.68.08-1.01z" />
  </svg>
)

const SOCIALS = [
  { label: 'Facebook', href: '#', Icon: IconFacebook },
  { label: 'LinkedIn', href: '#', Icon: IconLinkedIn },
  { label: 'Twitter',  href: '#', Icon: IconX },
  { label: 'YouTube',  href: '#', Icon: IconYouTube },
]

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
                    <RouterLink key={link.label} to={link.to} className="lf-link">
                      {link.label}
                    </RouterLink>
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
          <img src="/logo.png" alt="Remote365" width={32} height={32} />
          <span>Remote365</span>
        </div>
        <div className="lf-socials">
          {SOCIALS.map(({ label, href, Icon }) => (
            <a key={label} href={href} aria-label={label} className="lf-socialBtn">
              <Icon />
            </a>
          ))}
        </div>
      </div>

      <div className="lf-divider" />

      {/* Legal bar */}
      <div className="lf-legalRow">
        <div className="lf-legalLinks">
          <RouterLink to="/terms" className="lf-legalLink">Terms of Service</RouterLink>
          <RouterLink to="/privacy" className="lf-legalLink">Privacy Policy</RouterLink>
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
      .lf-socials {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lf-socialBtn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #F3F4F6;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #111315;
        transition: background 0.15s;
      }
      .lf-socialBtn:hover { background: #E4E6E9; }

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
