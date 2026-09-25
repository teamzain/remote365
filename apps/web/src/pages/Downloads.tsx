import React, { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import SiteLayout from '../components/landing/SiteLayout'

type PlatformId = 'macos' | 'ios' | 'windows' | 'android'

// Deployed builds serve /downloads from the same origin (prod and preprod each
// host their own tree); a dev build points at the API host it's configured for.
const DOWNLOADS_ORIGIN = import.meta.env.VITE_API_URL || ''
const DESKTOP_DOWNLOADS = `${DOWNLOADS_ORIGIN}/downloads/desktop`
// Used when latest.yml can't be fetched (it has no CORS header, so any
// cross-origin page — e.g. the prod site reading preprod's downloads — falls
// back). The publish flow retargets this shell-safe alias at every release,
// so unlike a versioned name it never goes stale.
const FALLBACK_INSTALLER = 'Remote365-Setup.exe'
// Stable aliases kept pointing at the newest APK by the publish scripts,
// so the page never hardcodes a mobile version.
const MOBILE_DOWNLOADS = `${DOWNLOADS_ORIGIN}/downloads/mobile`
const ANDROID_MOBILE_APK = `${MOBILE_DOWNLOADS}/Remote365-Mobile.apk`
const ANDROID_HOST_APK = `${MOBILE_DOWNLOADS}/Remote365-Host.apk`
// Set to the App Store page once the iOS app is published; null renders
// the iOS tile as "coming soon".
const IOS_APP_STORE_URL: string | null = null

// ── Platform icons ────────────────────────────────────────────────────────────

const AppleIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const WindowsIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
  </svg>
)

const AndroidIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={Math.round(size * 28 / 33)} height={size} viewBox="0 0 28 33" fill={color}>
    <path d="M18.408 3.02927L19.848 0.431275C19.8664 0.397985 19.8781 0.361393 19.8824 0.323589C19.8867 0.285784 19.8834 0.247508 19.8729 0.210945C19.8624 0.174382 19.8448 0.140248 19.8211 0.110493C19.7974 0.0807372 19.768 0.0559427 19.7347 0.0375248C19.7015 0.0191069 19.6649 0.00742628 19.6271 0.00314993C19.5893 -0.00112641 19.551 0.00208527 19.5144 0.0126015C19.4779 0.0231177 19.4437 0.0407326 19.414 0.0644404C19.3842 0.0881482 19.3594 0.117485 19.341 0.150775L17.886 2.77577C16.644 2.23111 15.3025 1.9499 13.9462 1.9499C12.59 1.9499 11.2485 2.23111 10.0065 2.77577L8.5515 0.150775C8.5143 0.0831446 8.45176 0.0330606 8.37764 0.0115408C8.30352 -0.00997902 8.22388 -0.00117192 8.15625 0.0360247C8.08862 0.0732213 8.03854 0.13576 8.01702 0.209884C7.9955 0.284008 8.0043 0.363644 8.0415 0.431275L9.4815 3.02927C8.11181 3.70555 6.95459 4.74564 6.13654 6.03569C5.31849 7.32573 4.87115 8.81598 4.8435 10.3433H23.049C23.0211 8.81566 22.5733 7.32519 21.7547 6.03512C20.9361 4.74505 19.7783 3.70514 18.408 3.02927ZM9.7455 7.01177C9.59502 7.01177 9.44793 6.96713 9.32283 6.8835C9.19774 6.79987 9.10026 6.68101 9.04275 6.54196C8.98523 6.40291 8.97026 6.24992 8.99972 6.10236C9.02919 5.95479 9.10177 5.81929 9.20828 5.71299C9.31479 5.60669 9.45043 5.53438 9.59806 5.5052C9.74568 5.47603 9.89864 5.49131 10.0376 5.5491C10.1765 5.60689 10.2952 5.70459 10.3786 5.82986C10.4619 5.95512 10.5063 6.1023 10.506 6.25277C10.5056 6.45421 10.4253 6.64726 10.2827 6.78956C10.1401 6.93186 9.94694 7.01177 9.7455 7.01177ZM18.1485 7.01177C17.998 7.01177 17.8509 6.96713 17.7258 6.8835C17.6007 6.79987 17.5033 6.68101 17.4457 6.54196C17.3882 6.40291 17.3733 6.24992 17.4027 6.10236C17.4322 5.95479 17.5048 5.81929 17.6113 5.71299C17.7178 5.60669 17.8534 5.53438 18.0011 5.5052C18.1487 5.47603 18.3016 5.49131 18.4406 5.5491C18.5795 5.60689 18.6982 5.70459 18.7816 5.82986C18.8649 5.95512 18.9093 6.1023 18.909 6.25277C18.9086 6.45421 18.8283 6.64726 18.6857 6.78956C18.5431 6.93186 18.3499 7.01177 18.1485 7.01177ZM4.8405 24.2573C4.8401 24.5469 4.89688 24.8337 5.00757 25.1013C5.11826 25.369 5.28069 25.6121 5.48554 25.8168C5.69039 26.0215 5.93364 26.1838 6.20133 26.2943C6.46902 26.4048 6.7559 26.4614 7.0455 26.4608H8.505V30.9608C8.505 31.502 8.72001 32.0211 9.10272 32.4038C9.48544 32.7865 10.0045 33.0015 10.5457 33.0015C11.087 33.0015 11.6061 32.7865 11.9888 32.4038C12.3715 32.0211 12.5865 31.502 12.5865 30.9608V26.4608H15.3075V30.9608C15.3075 31.5018 15.5224 32.0207 15.905 32.4033C16.2876 32.7858 16.8065 33.0008 17.3475 33.0008C17.8885 33.0008 18.4074 32.7858 18.79 32.4033C19.1726 32.0207 19.3875 31.5018 19.3875 30.9608V26.4608H20.8485C21.1377 26.461 21.4242 26.4042 21.6914 26.2936C21.9586 26.183 22.2015 26.0208 22.406 25.8163C22.6105 25.6117 22.7727 25.3689 22.8833 25.1017C22.9939 24.8344 23.0507 24.548 23.0505 24.2588V11.0633H4.8405V24.2573ZM2.04 10.7123C1.77198 10.7123 1.50658 10.7651 1.25898 10.8677C1.01138 10.9703 0.786423 11.1207 0.596972 11.3103C0.407521 11.4999 0.257287 11.725 0.154856 11.9726C0.0524242 12.2203 -0.000196524 12.4858 5.51521e-07 12.7538V21.2573C5.47529e-07 21.5252 0.0527666 21.7904 0.155286 22.0379C0.257806 22.2855 0.408071 22.5103 0.597503 22.6998C0.786934 22.8892 1.01182 23.0395 1.25933 23.142C1.50683 23.2445 1.7721 23.2973 2.04 23.2973C2.3079 23.2973 2.57317 23.2445 2.82067 23.142C3.06818 23.0395 3.29307 22.8892 3.4825 22.6998C3.67193 22.5103 3.8222 22.2855 3.92471 22.0379C4.02723 21.7904 4.08 21.5252 4.08 21.2573V12.7538C4.08 12.4859 4.02723 12.2206 3.92471 11.9731C3.8222 11.7256 3.67193 11.5007 3.4825 11.3113C3.29307 11.1218 3.06818 10.9716 2.82067 10.8691C2.57317 10.7665 2.3079 10.7138 2.04 10.7138M25.848 10.7138C25.58 10.7138 25.3146 10.7666 25.067 10.8692C24.8194 10.9718 24.5944 11.1222 24.405 11.3118C24.2155 11.5014 24.0653 11.7265 23.9629 11.9741C23.8604 12.2218 23.8078 12.4873 23.808 12.7553V21.2588C23.808 21.5267 23.8608 21.7919 23.9633 22.0394C24.0658 22.287 24.2161 22.5118 24.4055 22.7013C24.5949 22.8907 24.8198 23.041 25.0673 23.1435C25.3148 23.246 25.5801 23.2988 25.848 23.2988C26.1159 23.2988 26.3812 23.246 26.6287 23.1435C26.8762 23.041 27.1011 22.8907 27.2905 22.7013C27.4799 22.5118 27.6302 22.287 27.7327 22.0394C27.8352 21.7919 27.888 21.5267 27.888 21.2588V12.7538C27.888 12.2127 27.6731 11.6939 27.2905 11.3113C26.9079 10.9287 26.389 10.7138 25.848 10.7138Z" />
  </svg>
)

// ── Platform data ─────────────────────────────────────────────────────────────

interface Platform {
  id: PlatformId
  label: string
  Icon: React.FC<{ color: string; size: number }>
  requirement: string
}

const PLATFORMS: Platform[] = [
  { id: 'macos',   label: 'Mac OS',  Icon: AppleIcon,   requirement: 'Requires macOS 12 or later.' },
  { id: 'ios',     label: 'iOS',     Icon: AppleIcon,   requirement: 'Requires iOS 15 or later.' },
  { id: 'windows', label: 'Windows', Icon: WindowsIcon, requirement: 'Requires Windows 10 or later.' },
  { id: 'android', label: 'Android', Icon: AndroidIcon, requirement: 'Requires Android 8.0 or later.' },
]

interface DownloadEntry {
  label: string
  href: string | null
}

// The Android tile offers two apps behind one button.
const ANDROID_MENU = [
  {
    title: 'Remote365',
    sub: 'Access and control your devices from your phone.',
    href: ANDROID_MOBILE_APK,
  },
  {
    title: 'Remote365 Host',
    sub: 'Install on the Android device you want to control.',
    href: ANDROID_HOST_APK,
  },
]

// Preselect the tile matching the visitor's device — most mobile visitors
// land here specifically to grab the app for the phone in their hand.
const detectPlatform = (): PlatformId => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/mac os x/i.test(ua)) return 'macos'
  return 'windows'
}

// ── Download section ──────────────────────────────────────────────────────────

const DownloadHero: React.FC = () => {
  // Windows first, then the visitor's own platform once mounted: the server
  // can't see the user agent, and the first client render must match it.
  const [selected, setSelected] = useState<PlatformId>('windows')
  useEffect(() => { setSelected(detectPlatform()) }, [])
  const [installerUrl, setInstallerUrl] = useState(`${DESKTOP_DOWNLOADS}/${encodeURIComponent(FALLBACK_INSTALLER)}`)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = PLATFORMS.find(p => p.id === selected)!

  // Close the Android menu on any click outside it.
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const entries: DownloadEntry[] =
    selected === 'windows' ? [
      { label: 'Download Remote365 for Windows', href: installerUrl },
    ] :
    selected === 'ios' ? [
      IOS_APP_STORE_URL
        ? { label: 'Download Remote365 on the App Store', href: IOS_APP_STORE_URL }
        : { label: 'Coming soon on the App Store', href: null },
    ] : [
      { label: 'Coming soon for macOS', href: null },
    ]

  // electron-builder publishes latest.yml next to the installer; its `path`
  // field names the current setup exe, so the page always serves the newest
  // build without hardcoding a version.
  useEffect(() => {
    fetch(`${DESKTOP_DOWNLOADS}/latest.yml`)
      .then(res => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then(text => {
        const path = text.match(/^path:\s*(.+)$/m)?.[1]?.trim()
        if (path) setInstallerUrl(`${DESKTOP_DOWNLOADS}/${encodeURIComponent(path)}`)
      })
      .catch(() => { /* fallback URL already set */ })
  }, [])

  const triggerDownload = () => {
    const a = document.createElement('a')
    a.href = installerUrl
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const onTileClick = (p: Platform) => {
    setSelected(p.id)
    setMenuOpen(false)
    // Windows has exactly one artifact, so the tile itself downloads it.
    // Android offers two apps — let the user pick from the menu instead.
    if (p.id === 'windows') triggerDownload()
  }

  return (
    <section>
      <div className="dl-wrap">

        {/* Heading */}
        <div className="dl-heading">
          <h1 className="dl-title">Download</h1>
          <p className="dl-subtitle">Install the app and Sign in to get started.</p>
        </div>

        {/* Platform tiles */}
        <div className="dl-cards">
          {PLATFORMS.map(p => {
            const active = selected === p.id
            return (
              <button
                key={p.id}
                onClick={() => onTileClick(p)}
                className={`dl-card${active ? ' dl-card-active' : ''}`}
              >
                <p.Icon color={active ? '#FFFFFF' : '#111315'} size={active ? 40 : 36} />
                <span>{p.label}</span>
              </button>
            )
          })}
        </div>

        {/* Download button + requirement */}
        <div className="dl-actions">
          {selected === 'android' ? (
            <div className="dl-menu-anchor" ref={menuRef}>
              <button
                type="button"
                className="dl-btn-primary dl-btn-menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
              >
                Download Remote365 for Android
                <svg
                  className={`dl-caret${menuOpen ? ' dl-caret-open' : ''}`}
                  width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                >
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {menuOpen && (
                <div className="dl-menu" role="menu">
                  {ANDROID_MENU.map(item => (
                    <a
                      key={item.title}
                      role="menuitem"
                      href={item.href}
                      download
                      className="dl-menu-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="dl-menu-title">{item.title}</span>
                      <span className="dl-menu-sub">{item.sub}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            entries.map(entry =>
              entry.href ? (
                <a key={entry.label} href={entry.href} download className="dl-btn-primary">
                  {entry.label}
                </a>
              ) : (
                <span key={entry.label} className="dl-btn-primary dl-btn-disabled">{entry.label}</span>
              )
            )
          )}
          <span className="dl-requirement">{current.requirement}</span>
        </div>

      </div>

      <style>{`
        .dl-wrap {
          max-width: 1008px;
          margin: 0 auto;
          padding: 72px clamp(20px, 4vw, 40px) 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 58px;
        }
        .dl-heading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }
        .dl-title {
          margin: 0;
          font-weight: 600;
          font-size: clamp(2.2rem, 4.5vw, 55px);
          line-height: 1.42;
          color: #1A1D21;
        }
        .dl-subtitle {
          margin: 0;
          font-weight: 400;
          font-size: 18px;
          line-height: 25px;
          color: rgba(26, 29, 33, 0.8);
        }

        .dl-cards {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 22px;
          width: 100%;
        }
        .dl-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 20px;
          width: 180px;
          height: 128px;
          padding: 12px 36px;
          box-sizing: border-box;
          background: #F3F4F6;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          flex-shrink: 0;
          font-family: inherit;
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .dl-card:hover { background: #E9EAEC; }
        .dl-card span {
          font-weight: 500;
          font-size: 18px;
          line-height: 25px;
          color: #000000;
        }
        .dl-card-active,
        .dl-card-active:hover {
          width: 200px;
          height: 142px;
          background: linear-gradient(180deg, #FF8A00 0%, #FFB347 100%);
        }
        .dl-card-active span {
          font-weight: 600;
          font-size: 22px;
          line-height: 31px;
          color: #FFFFFF;
        }

        .dl-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 380px;
          max-width: 100%;
        }
        .dl-btn-primary {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 40px;
          padding: 10px 16px;
          box-sizing: border-box;
          background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
          border-radius: 4px;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: #FFFFFF;
          text-decoration: none;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .dl-btn-primary:hover { opacity: 0.9; }
        .dl-btn-disabled {
          background: rgba(26, 29, 33, 0.15);
          color: rgba(26, 29, 33, 0.55);
          cursor: default;
        }
        .dl-btn-disabled:hover { opacity: 1; }

        .dl-menu-anchor { position: relative; }
        .dl-btn-menu {
          width: 100%;
          border: none;
          font-family: inherit;
          gap: 8px;
        }
        .dl-caret { transition: transform 0.15s ease; }
        .dl-caret-open { transform: rotate(180deg); }
        .dl-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #FFFFFF;
          border: 1px solid rgba(26, 29, 33, 0.1);
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(16, 24, 40, 0.14);
          overflow: hidden;
          z-index: 20;
        }
        .dl-menu-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 12px 16px;
          text-decoration: none;
          text-align: left;
        }
        .dl-menu-item:hover { background: #F5F6F8; }
        .dl-menu-item + .dl-menu-item { border-top: 1px solid rgba(26, 29, 33, 0.08); }
        .dl-menu-title {
          font-weight: 600;
          font-size: 14px;
          line-height: 20px;
          color: #111315;
        }
        .dl-menu-sub {
          font-weight: 400;
          font-size: 12.5px;
          line-height: 18px;
          color: rgba(26, 29, 33, 0.65);
        }
        .dl-requirement {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 40px;
          padding: 10px 16px;
          box-sizing: border-box;
          border-radius: 4px;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: #111315;
        }

        @media (max-width: 640px) {
          .dl-wrap { padding: 48px 20px 80px; gap: 40px; }
          .dl-cards { gap: 14px; }
          .dl-card {
            width: calc(50% - 7px);
            min-width: 140px;
            height: 112px;
            padding: 12px 16px;
            gap: 14px;
          }
          .dl-card-active,
          .dl-card-active:hover {
            width: calc(50% - 7px);
            min-width: 140px;
            height: 112px;
          }
          .dl-card-active span { font-size: 18px; line-height: 25px; }
        }
      `}</style>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const Downloads: React.FC = () => (
  <SiteLayout>
    <Box component="main">
      <DownloadHero />
    </Box>
  </SiteLayout>
)

export default Downloads
