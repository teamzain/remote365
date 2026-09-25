'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import SiteLink from '@/components/site/SiteLink'
import { useSignedIn } from '@/lib/useSignedIn'
import GetStartedScreen from './GetStartedScreen'

const NAV_LINKS = [
  { label: 'Product',  path: '/product'   },
  { label: 'Docs',     path: '/docs'      },
  { label: 'Pricing',  path: '/pricing'   },
  { label: 'Download', path: '/downloads' },
  { label: 'Contact',  path: '/contact'   },
]

export interface NavbarProps {
  heroBg?: string
  heroDark?: boolean
  // 'glass': fixed header for the dark video landing page — centred blurred
  // pill menu, outline "Sign In" pill, and a dark frosted bar once scrolled.
  variant?: 'default' | 'glass'
}

const Navbar: React.FC<NavbarProps> = ({ heroBg = '#FFFFFF', heroDark = false, variant = 'default' }) => {
  const signedIn = useSignedIn()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const glass = variant === 'glass'
  const links = glass ? [{ label: 'Home', path: '/' }, ...NAV_LINKS] : NAV_LINKS

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // The glass variant sits on a dark page throughout, so it never goes light.
  const isLight = !glass && !menuOpen && (scrolled || !heroDark)
  const fg = isLight ? '#111315' : 'rgba(255, 255, 255, 0.9)'
  const logoColor = menuOpen ? '#FFFFFF' : (isLight ? '#111315' : '#FFFFFF')

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/')

  return (
    <>
      <header
        // Glass: its look lives in CSS (.navbar-glass) so media queries can
        // float it on desktop; the default bar keeps its inline styles.
        className={glass ? `navbar-glass${scrolled && !menuOpen ? ' is-scrolled' : ''}` : undefined}
        style={glass ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 } : {
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: menuOpen ? 'transparent' : (scrolled ? '#FFFFFF' : heroBg),
          borderBottom: (!menuOpen && scrolled) ? '1px solid rgba(26,29,33,0.1)' : 'none',
          boxShadow: (!menuOpen && scrolled) ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
          transition: 'background 0.3s ease, border-bottom 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <div className={glass ? 'navbar-inner navbar-inner-glass' : 'navbar-inner'}>

          {/* Logo + links */}
          <div className="navbar-left">
            <SiteLink href="/" className={glass ? 'navbar-brand navbar-brand-glass' : 'navbar-brand'}>
              <img src="/logo.png" alt="Remote365" width={36} height={36} />
              <span style={{ color: logoColor }}>Remote365</span>
            </SiteLink>

            {!glass && (
              <nav className="navbar-links">
                {links.map(item => (
                  <SiteLink
                    key={item.label}
                    href={item.path}
                    className="navbar-link"
                    style={{ color: isActive(item.path) ? '#FF8A00' : fg }}
                  >
                    {item.label}
                  </SiteLink>
                ))}
              </nav>
            )}
          </div>

          {/* Centred glass pill menu */}
          {glass && (
            <nav className="navbar-links navbar-pill">
              {links.map(item => (
                <SiteLink
                  key={item.label}
                  href={item.path}
                  className="navbar-link"
                  style={{ color: isActive(item.path) ? '#FF8A00' : fg }}
                >
                  {item.label}
                </SiteLink>
              ))}
            </nav>
          )}

          {/* Actions */}
          <div className="navbar-actions">
            {signedIn ? (
              <SiteLink
                href="/dashboard"
                className={glass ? 'navbar-btn navbar-btn-pill navbar-btn-pill-outline' : 'navbar-btn navbar-btn-outline'}
              >
                Dashboard
              </SiteLink>
            ) : (
              <SiteLink
                href="/login"
                className={glass ? 'navbar-btn navbar-btn-pill navbar-btn-pill-outline' : 'navbar-btn navbar-btn-outline'}
              >
                {glass ? 'Sign In' : 'Login'}
              </SiteLink>
            )}
            {glass ? (
              // Morphs into the full-screen "Get started" chooser
              <GetStartedScreen variant="nav" />
            ) : (
              <SiteLink href="/register" className="navbar-btn navbar-btn-primary">
                Get Started
              </SiteLink>
            )}
          </div>

          {/* Hamburger / close button (mobile) */}
          <button
            className={`navbar-hamburger${menuOpen ? ' is-open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span style={{ background: menuOpen ? '#FFFFFF' : logoColor }} />
            <span style={{ background: menuOpen ? '#FFFFFF' : logoColor }} />
            <span style={{ background: menuOpen ? '#FFFFFF' : logoColor }} />
          </button>
        </div>
      </header>

      {/* Triangle mobile overlay */}
      {menuOpen && (
        <div className="tri-overlay">
          <div className="tri-top-right" />
          <div className="tri-bottom-left" />

          {/* CTA buttons — in the top-right dark zone */}
          <div className="tri-top-right-content">
            <SiteLink
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="tri-link-btn tri-link-outline"
            >
              {glass ? 'Sign In' : 'Login'}
            </SiteLink>
            <SiteLink
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="tri-link-btn tri-link-filled"
            >
              Get Started
            </SiteLink>
          </div>

          {/* Nav links — in the bottom-left orange zone */}
          <div className="tri-bottom-left-content">
            {links.map(item => (
              <SiteLink
                key={item.label}
                href={item.path}
                onClick={() => setMenuOpen(false)}
                className="tri-nav-link"
              >
                {item.label}
              </SiteLink>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .navbar-inner {
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
          padding: 20px clamp(20px, 4vw, 48px);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .navbar-left {
          display: flex;
          align-items: center;
          gap: 58px;
          min-width: 0;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .navbar-brand img {
          width: 36px;
          height: 36px;
          object-fit: contain;
        }
        .navbar-brand span {
          font-weight: 600;
          font-size: 16px;
          line-height: 23px;
          white-space: nowrap;
          transition: color 0.25s ease;
        }
        .navbar-links {
          display: flex;
          align-items: center;
          gap: 30px;
        }
        .navbar-link {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.2s ease;
        }
        .navbar-link:hover { color: #FF8A00 !important; }
        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }
        .navbar-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 4px;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          white-space: nowrap;
          text-decoration: none;
          transition: opacity 0.15s, background 0.15s;
        }
        .navbar-btn-outline {
          background: #FFFFFF;
          border: 1px solid rgba(26, 29, 33, 0.3);
          color: #111315;
        }
        .navbar-btn-outline:hover { background: #F3F4F6; }
        .navbar-btn-primary {
          background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
          color: #FFFFFF;
        }
        .navbar-btn-primary:hover { opacity: 0.9; }

        /* ── Glass variant (the public website over the video backdrop) ── */
        .navbar-glass {
          box-sizing: border-box;
          border-bottom: 1px solid transparent;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .navbar-inner-glass {
          max-width: 80rem;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          padding: 14px 24px;
        }
        .navbar-inner-glass .navbar-left { gap: 0; grid-column: 1; }
        .navbar-inner-glass .navbar-pill { grid-column: 2; }
        .navbar-inner-glass .navbar-actions { grid-column: 3; justify-self: end; }
        .navbar-inner-glass .navbar-hamburger {
          grid-column: 3;
          justify-self: end;
          margin-left: 0;
        }
        .navbar-brand-glass span {
          font-size: 17px;
          letter-spacing: -0.04em;
        }
        .navbar-pill {
          gap: 2px;
          padding: 5px 6px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .navbar-pill .navbar-link {
          padding: 8px 14px;
          border-radius: 9999px;
          transition: color 0.3s ease, background 0.3s ease;
        }
        .navbar-pill .navbar-link:hover { background: rgba(255, 255, 255, 0.08); }
        .navbar-btn-pill {
          padding: 9px 18px;
          border-radius: 9999px;
          transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease, opacity 0.3s ease;
        }
        .navbar-btn-pill-outline {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
        }
        .navbar-btn-pill-outline:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.45);
        }
        .navbar-btn-pill-primary {
          background: linear-gradient(90deg, #FF8A00 0%, #EA580C 100%);
          color: #FFFFFF;
        }
        .navbar-btn-pill-primary:hover { opacity: 0.9; }

        .navbar-hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          margin-left: auto;
        }
        .navbar-hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          border-radius: 2px;
          transition: background 0.25s, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s;
        }
        .navbar-hamburger.is-open span:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }
        .navbar-hamburger.is-open span:nth-child(2) {
          opacity: 0;
          transform: scaleX(0);
        }
        .navbar-hamburger.is-open span:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        /* ── Triangle overlay ── */
        .tri-overlay {
          position: fixed;
          inset: 0;
          z-index: 98;
          overflow: hidden;
        }
        .tri-top-right {
          position: absolute;
          inset: 0;
          background: #111315;
          clip-path: polygon(0% 0%, 100% 0%, 100% 100%);
          animation: slideInTopRight 0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .tri-bottom-left {
          position: absolute;
          inset: 0;
          background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
          clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
          animation: slideInBottomLeft 0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* CTA buttons — top-right safe zone */
        .tri-top-right-content {
          position: absolute;
          top: 90px;
          right: 36px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          z-index: 10;
          animation: fadeUpIn 0.35s 0.18s ease-out both;
        }
        .tri-link-btn {
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          padding: 11px 28px;
          border-radius: 4px;
          min-width: 140px;
          text-align: center;
          display: block;
        }
        .tri-link-outline {
          color: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.22);
        }
        .tri-link-filled {
          background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
          color: #FFFFFF;
        }

        /* Nav links — bottom-left orange zone */
        .tri-bottom-left-content {
          position: absolute;
          bottom: 56px;
          left: 36px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
          z-index: 10;
          animation: fadeUpIn 0.35s 0.18s ease-out both;
        }
        .tri-nav-link {
          font-weight: 600;
          font-size: 21px;
          letter-spacing: -0.5px;
          color: rgba(255, 255, 255, 0.9);
          text-decoration: none;
          padding: 9px 0;
          display: block;
          transition: color 0.15s;
        }
        .tri-nav-link:hover { color: #FFFFFF; }

        @keyframes slideInTopRight {
          from { transform: translate(65%, -65%); }
          to   { transform: translate(0, 0); }
        }
        @keyframes slideInBottomLeft {
          from { transform: translate(-65%, 65%); }
          to   { transform: translate(0, 0); }
        }
        @keyframes fadeUpIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1024px) {
          .navbar-links { display: none; }
          .navbar-left { gap: 0; }
        }
        @media (max-width: 768px) {
          .navbar-inner { padding: 16px 20px; }
          .navbar-actions { display: none; }
          .navbar-hamburger { display: flex; }
        }

        /* Glass, desktop and tablet: the bar floats as an inset glass capsule. */
        @media (min-width: 769px) {
          .navbar-glass { padding: 14px 24px 0; }
          .navbar-glass .navbar-inner-glass {
            max-width: 1200px;
            padding: 8px 8px 8px 20px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(14, 14, 16, 0.42);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
            transition: background 0.3s ease, box-shadow 0.3s ease;
          }
          .navbar-glass.is-scrolled .navbar-inner-glass {
            background: rgba(10, 10, 12, 0.72);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
          }
          /* The capsule is the glass now; the link group drops its own pill. */
          .navbar-glass .navbar-pill {
            border-color: transparent;
            background: transparent;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
        }
        /* Glass, below the width where the links fit: logo left, actions and
           the menu button right (the grid would otherwise centre the actions). */
        @media (max-width: 1024px) {
          .navbar-inner-glass { display: flex; align-items: center; }
          .navbar-inner-glass .navbar-actions { margin-left: auto; }
          .navbar-inner-glass .navbar-hamburger { display: flex; margin-left: 12px; }
        }
        /* Glass, phones: full-width bar, frosted once scrolled. */
        @media (max-width: 768px) {
          .navbar-inner-glass .navbar-hamburger { margin-left: auto; }
          .navbar-glass.is-scrolled {
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border-bottom-color: rgba(255, 255, 255, 0.08);
          }
        }
      `}</style>
    </>
  )
}

export default Navbar
