import React, { useState, useEffect } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

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
}

const Navbar: React.FC<NavbarProps> = ({ heroBg = '#FFFFFF', heroDark = false }) => {
  const { accessToken, user } = useAuthStore()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isLight = !menuOpen && (scrolled || !heroDark)
  const fg = isLight ? '#111315' : 'rgba(255, 255, 255, 0.9)'
  const logoColor = menuOpen ? '#FFFFFF' : (isLight ? '#111315' : '#FFFFFF')

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/')

  return (
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: menuOpen ? 'transparent' : (scrolled ? '#FFFFFF' : heroBg),
        borderBottom: (!menuOpen && scrolled) ? '1px solid rgba(26,29,33,0.1)' : 'none',
        boxShadow: (!menuOpen && scrolled) ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
        transition: 'background 0.25s ease, border-bottom 0.25s ease, box-shadow 0.25s ease',
      }}>
        <div className="navbar-inner">

          {/* Logo + links */}
          <div className="navbar-left">
            <RouterLink to="/" className="navbar-brand">
              <img src="/logo.png" alt="Remote365" width={36} height={36} />
              <span style={{ color: logoColor }}>Remote365</span>
            </RouterLink>

            <nav className="navbar-links">
              {NAV_LINKS.map(item => (
                <RouterLink
                  key={item.label}
                  to={item.path}
                  className="navbar-link"
                  style={{ color: isActive(item.path) ? '#FF8A00' : fg }}
                >
                  {item.label}
                </RouterLink>
              ))}
            </nav>
          </div>

          {/* Actions */}
          <div className="navbar-actions">
            {accessToken ? (
              <RouterLink to="/dashboard" className="navbar-btn navbar-btn-outline">
                {user?.name ? user.name : 'Dashboard'}
              </RouterLink>
            ) : (
              <RouterLink to="/login" className="navbar-btn navbar-btn-outline">
                Login
              </RouterLink>
            )}
            <RouterLink to="/register" className="navbar-btn navbar-btn-primary">
              Get Started
            </RouterLink>
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
            <RouterLink
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="tri-link-btn tri-link-outline"
            >
              Login
            </RouterLink>
            <RouterLink
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="tri-link-btn tri-link-filled"
            >
              Get Started
            </RouterLink>
          </div>

          {/* Nav links — in the bottom-left orange zone */}
          <div className="tri-bottom-left-content">
            {NAV_LINKS.map(item => (
              <RouterLink
                key={item.label}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className="tri-nav-link"
              >
                {item.label}
              </RouterLink>
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
      `}</style>
    </>
  )
}

export default Navbar
