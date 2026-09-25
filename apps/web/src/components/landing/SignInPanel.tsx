'use client'

import React, { useEffect, useId, useState } from 'react'
import {
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
  Loader2,
  LockKeyhole,
  MessagesSquare,
  MonitorSmartphone,
  ShieldCheck,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { oauthStartUrl, useSignIn } from '@/lib/signIn'
import { useSignedIn } from '@/lib/useSignedIn'

// Content of the sign-in expandable screen (loaded on demand by
// SignInScreen). Left: the same sign-in the /login page does (email and
// password, remember me, inline two-factor step, Google and Microsoft).
// Right: a vertical marquee of what the product does. Success is a full page
// load into the app, which also sends a super admin on to /admin.

interface Capability {
  Icon: LucideIcon
  title: string
  text: string
}

const CAPABILITIES: Capability[] = [
  { Icon: KeyRound, title: 'Support with a code', text: 'Share a one-time session code; they join in the Remote365 app, no account needed.' },
  { Icon: MonitorSmartphone, title: 'Unattended access', text: 'Reach your own computers and Android devices by ID, even when nobody is there.' },
  { Icon: LockKeyhole, title: 'End-to-end encrypted', text: 'Every remote session is encrypted end to end. No VPN or port forwarding.' },
  { Icon: Video, title: 'Meetings built in', text: 'Video meetings with screen sharing, joined by code or link.' },
  { Icon: MessagesSquare, title: 'Team chat', text: 'Messages, files and voice notes between sessions.' },
  { Icon: FileUp, title: 'File transfer', text: 'Move files both ways and keep the clipboard in sync.' },
  { Icon: Users, title: 'Roles and device access', text: 'Decide who can reach which machine, member by member.' },
  { Icon: ShieldCheck, title: 'Two-factor sign-in', text: 'Protect every account, or require it for your whole team.' },
]

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

const MicrosoftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
)

function goToApp() {
  // A full page load on purpose: the dashboard is the client-side app, a
  // separate React tree from the site.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/dashboard')
}

function SignInForm() {
  const {
    email, setEmail, password, setPassword, rememberMe, setRememberMe,
    totpCode, setTotpCode, awaitingTwoFactor, pending, error,
    signIn, submitTwoFactor, cancelTwoFactor,
  } = useSignIn()
  const [showPassword, setShowPassword] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const ids = useId()

  // Closing the panel mid-way abandons a started two-factor step.
  useEffect(() => cancelTwoFactor, [cancelTwoFactor])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (awaitingTwoFactor) {
      if (await submitTwoFactor()) { setLeaving(true); goToApp() }
      return
    }
    if ((await signIn()) === 'signed-in') { setLeaving(true); goToApp() }
  }

  const busy = pending || leaving

  return (
    <form className="si-form" onSubmit={onSubmit} noValidate>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={44} height={44} className="si-logo" />
      <h2 className="si-title" id="si-title">{awaitingTwoFactor ? 'Two-factor check' : 'Welcome back'}</h2>
      <p className="si-sub">
        {awaitingTwoFactor
          ? 'Enter the 6-digit code from your authenticator app.'
          : 'Sign in to reach your devices, sessions and meetings.'}
      </p>

      {!awaitingTwoFactor && (
        <>
          <div className="si-oauth">
            <a className="si-oauth-btn" href="/login" onClick={e => { e.preventDefault(); window.location.assign(oauthStartUrl('google')) }}>
              <GoogleIcon /> Google
            </a>
            <a className="si-oauth-btn" href="/login" onClick={e => { e.preventDefault(); window.location.assign(oauthStartUrl('microsoft')) }}>
              <MicrosoftIcon /> Microsoft
            </a>
          </div>
          <div className="si-or" role="separator"><span>or with email</span></div>

          <label className="si-label" htmlFor={`${ids}-email`}>Email</label>
          <input
            id={`${ids}-email`}
            className="si-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label className="si-label" htmlFor={`${ids}-password`}>Password</label>
          <div className="si-password">
            <input
              id={`${ids}-password`}
              className="si-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="si-eye"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="si-row">
            <label className="si-check">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              Remember me
            </label>
            <a className="si-link" href="/forgot-password">Forgot password?</a>
          </div>
        </>
      )}

      {awaitingTwoFactor && (
        <>
          <label className="si-label" htmlFor={`${ids}-code`}>Authentication code</label>
          <input
            id={`${ids}-code`}
            className="si-input si-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            value={totpCode}
            onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
          />
        </>
      )}

      {error && (
        <p className="si-error" role="alert">
          <strong>{error.title}.</strong> {error.message}
        </p>
      )}

      <button
        type="submit"
        className="si-submit"
        disabled={busy || (awaitingTwoFactor ? totpCode.length !== 6 : !email || !password)}
      >
        {busy && <Loader2 size={18} className="si-spin" aria-hidden="true" />}
        {leaving ? 'Opening your dashboard…' : awaitingTwoFactor ? 'Verify and sign in' : 'Sign in'}
      </button>

      {awaitingTwoFactor ? (
        <button type="button" className="si-back" onClick={cancelTwoFactor}>Use a different account</button>
      ) : (
        <p className="si-new">
          New to Remote365? <a className="si-link" href="/register">Create a free account</a>
        </p>
      )}

      <p className="si-legal">
        By signing in you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
      </p>
    </form>
  )
}

function SignedInNotice() {
  return (
    <div className="si-form">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={44} height={44} className="si-logo" />
      <h2 className="si-title" id="si-title">You’re signed in</h2>
      <p className="si-sub">Your devices, sessions and meetings are in the dashboard.</p>
      <a className="si-submit" href="/dashboard">Open your dashboard</a>
      <p className="si-new">Need the app? <a className="si-link" href="/downloads">Download Remote365</a></p>
    </div>
  )
}

function CapabilityColumn({ items, reverse }: { items: Capability[]; reverse?: boolean }) {
  // Rendered twice so the loop has no seam; the copy is hidden from screen readers.
  return (
    <div className={`si-col${reverse ? ' si-col--reverse' : ''}`}>
      <div className="si-track">
        {[0, 1].map(copy => (
          <ul key={copy} className="si-list" aria-hidden={copy === 1 || undefined}>
            {items.map(({ Icon, title, text }) => (
              <li key={title} className="si-card">
                <span className="si-card-icon"><Icon size={20} strokeWidth={2} /></span>
                <span className="si-card-title">{title}</span>
                <span className="si-card-text">{text}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

export default function SignInPanel() {
  const signedIn = useSignedIn()
  return (
    <div className="si">
      <div className="si-left">
        {signedIn ? <SignedInNotice /> : <SignInForm />}
      </div>
      <aside className="si-right" aria-label="What you can do with Remote365">
        <CapabilityColumn items={CAPABILITIES.slice(0, 4).concat(CAPABILITIES.slice(4, 6))} />
        <CapabilityColumn items={CAPABILITIES.slice(4).concat(CAPABILITIES.slice(0, 2))} reverse />
      </aside>

      <style>{`
        .si {
          box-sizing: border-box;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
          min-height: 100%;
          color: #fff;
          font-family: var(--font-body);
        }
        /* The panel is portalled outside .site-dark, so it sets its own heading font. */
        .si-title,
        .si-card-title { font-family: var(--font-heading); }
        .si-left {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(56px, 7vw, 88px) clamp(20px, 5vw, 72px) 40px;
        }
        .si-form {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
        }
        .si-logo { width: 44px; height: 44px; }
        .si-title {
          margin: 20px 0 0;
          font-size: clamp(28px, 3vw, 36px);
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }
        .si-sub {
          margin: 8px 0 24px;
          font-size: 15px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.62);
        }
        .si-oauth { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .si-oauth-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .si-oauth-btn:hover { background: rgba(255, 255, 255, 0.09); border-color: rgba(255, 255, 255, 0.28); }
        .si-or {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0 16px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }
        .si-or::before, .si-or::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.12); }
        .si-label {
          margin: 12px 0 6px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }
        .si-input {
          box-sizing: border-box;
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(0, 0, 0, 0.35);
          color: #fff;
          font: inherit;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .si-input::placeholder { color: rgba(255, 255, 255, 0.35); }
        .si-input:focus { border-color: #ff8a00; box-shadow: 0 0 0 3px rgba(255, 138, 0, 0.25); }
        .si-code { letter-spacing: 0.4em; font-size: 20px; text-align: center; }
        .si-password { position: relative; }
        .si-password .si-input { padding-right: 46px; }
        .si-eye {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
        }
        .si-eye:hover { color: #fff; }
        .si-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          font-size: 14px;
        }
        .si-check { display: inline-flex; align-items: center; gap: 8px; color: rgba(255, 255, 255, 0.75); cursor: pointer; }
        .si-check input { width: 16px; height: 16px; accent-color: #ff8a00; }
        .si-link { color: #ff8a00; font-weight: 600; text-decoration: none; }
        .si-link:hover { text-decoration: underline; }
        .si-error {
          margin: 16px 0 0;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(248, 113, 113, 0.4);
          background: rgba(127, 29, 29, 0.35);
          font-size: 14px;
          line-height: 1.45;
          color: #fecaca;
        }
        .si-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 50px;
          margin-top: 20px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #ff8a00 0%, #f97316 100%);
          color: #111315;
          font: inherit;
          font-size: 16px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 16px 40px rgba(255, 138, 0, 0.25);
          transition: opacity 0.2s, transform 0.2s;
        }
        .si-submit:hover:not(:disabled) { transform: translateY(-1px); }
        .si-submit:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
        .si-spin { animation: siSpin 0.9s linear infinite; }
        @keyframes siSpin { to { transform: rotate(360deg); } }
        .si-back {
          margin-top: 12px;
          border: 0;
          background: none;
          color: rgba(255, 255, 255, 0.7);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
        }
        .si-back:hover { color: #fff; }
        .si-new { margin: 18px 0 0; text-align: center; font-size: 14px; color: rgba(255, 255, 255, 0.65); }
        .si-legal { margin: 14px 0 0; text-align: center; font-size: 12px; color: rgba(255, 255, 255, 0.45); }
        .si-legal a { color: rgba(255, 255, 255, 0.7); }

        .si-right {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 0 clamp(16px, 2.5vw, 32px);
          overflow: hidden;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          background: radial-gradient(600px 420px at 70% 30%, rgba(255, 138, 0, 0.16), transparent 65%);
          /* Fade the cards in and out at the top and bottom edges. */
          -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
          mask-image: linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
        }
        /* The tracks are taken out of the flow, so the form alone sets the
           panel's height and the columns just clip their cards to it. */
        .si-col { position: relative; overflow: hidden; }
        .si-track {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          animation: siScroll 38s linear infinite;
        }
        .si-col--reverse .si-track { animation-direction: reverse; animation-duration: 44s; }
        .si-right:hover .si-track { animation-play-state: paused; }
        @keyframes siScroll {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        .si-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin: 0;
          padding: 0 0 16px;
          list-style: none;
        }
        .si-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 20px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .si-card-icon {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255, 138, 0, 0.14);
          color: #ff8a00;
        }
        .si-card-title { font-size: 16px; font-weight: 650; }
        .si-card-text { font-size: 14px; line-height: 1.5; color: rgba(255, 255, 255, 0.62); }

        @media (prefers-reduced-motion: reduce) {
          .si-track { animation: none; }
        }
        /* Narrow screens: the form alone. */
        @media (max-width: 900px) {
          .si { grid-template-columns: minmax(0, 1fr); }
          .si-right { display: none; }
          .si-left { padding: 72px 20px 32px; align-items: flex-start; }
        }
      `}</style>
    </div>
  )
}
