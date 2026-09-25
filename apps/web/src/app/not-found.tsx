import type { Metadata } from 'next'
import SiteFrame from '@/components/site/SiteFrame'
import SiteContent from '@/components/site/SiteContent'
import SiteLink from '@/components/site/SiteLink'

// Next adds <meta name="robots" content="noindex"> to 404 responses itself.
export const metadata: Metadata = {
  title: 'Page not found',
}

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/product', label: 'Product' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/downloads', label: 'Download' },
  { href: '/docs', label: 'Docs' },
]

export default function NotFound() {
  return (
    <SiteFrame>
      <SiteContent>
        <main className="nf">
          <p className="nf-code">404</p>
          <h1 className="nf-title">This page doesn’t exist</h1>
          <p className="nf-text">
            The link may be old or mistyped. These pages are a good place to start:
          </p>
          <nav className="nf-links" aria-label="Site pages">
            {LINKS.map(link => (
              <SiteLink key={link.href} href={link.href} className="nf-link">{link.label}</SiteLink>
            ))}
          </nav>
        </main>
        <style>{`
          .nf {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 12vh 24px 16vh;
          }
          .nf-code {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.2em;
            color: #ff8a00;
          }
          .nf-title {
            margin: 12px 0 0;
            font-size: clamp(2rem, 5vw, 56px);
            font-weight: 700;
            letter-spacing: -0.03em;
            line-height: 1.1;
            background-image: linear-gradient(180deg, #ffffff 0%, #9ca3af 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }
          .nf-text {
            margin: 16px 0 0;
            max-width: 520px;
            font-size: 17px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.64);
          }
          .nf-links {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
            margin-top: 32px;
          }
          .nf-link {
            padding: 10px 18px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            transition: background 0.3s, border-color 0.3s;
          }
          .nf-link:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 138, 0, 0.6);
          }
        `}</style>
      </SiteContent>
    </SiteFrame>
  )
}
