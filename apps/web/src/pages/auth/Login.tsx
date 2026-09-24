import React from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

// ── Logo mark ─────────────────────────────────────────────────────────────────
const LogoMark: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <svg width="24" height="14" viewBox="0 0 24 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="12" rx="6" stroke="#242424" strokeWidth="2"/>
      <rect x="14" y="1" width="9" height="12" rx="6" stroke="#242424" strokeWidth="2"/>
      <line x1="10" y1="7" x2="14" y2="7" stroke="#242424" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <span style={{
      fontFamily: "'Mona Sans', sans-serif",
      fontWeight: 700,
      fontSize: '15px',
      letterSpacing: '-0.3px',
      color: '#242424',
    }}>
      Remote365
    </span>
  </div>
)

// ── Provider icon: Google ──────────────────────────────────────────────────────
const GoogleIcon: React.FC = () => (
  <svg width="19" height="18" viewBox="0 0 19 18" fill="none">
    <path d="M18.5 9.2c0-.63-.06-1.25-.17-1.84H9.7v3.48h4.94c-.21 1.07-.86 1.98-1.84 2.59v2.15h2.98C17.43 13.93 18.5 11.77 18.5 9.2z" fill="#4285F4"/>
    <path d="M9.7 18c2.48 0 4.56-.82 6.08-2.22l-2.98-2.31c-.82.55-1.88.88-3.1.88-2.39 0-4.4-1.61-5.12-3.77H1.5v2.38C3.01 16.1 6.14 18 9.7 18z" fill="#34A853"/>
    <path d="M4.58 10.58A5.41 5.41 0 0 1 4.3 9c0-.55.09-1.08.27-1.58V5.04H1.5A9 9 0 0 0 .5 9c0 1.45.35 2.82.98 4.04l3.1-2.46z" fill="#FBBC04"/>
    <path d="M9.7 3.58c1.34 0 2.55.46 3.5 1.37l2.62-2.62C14.25.89 12.18 0 9.7 0 6.14 0 3.01 1.9 1.5 4.96l3.08 2.38C5.3 5.2 7.31 3.58 9.7 3.58z" fill="#EA4335"/>
  </svg>
)

// ── Provider icon: Microsoft ───────────────────────────────────────────────────
const MicrosoftIcon: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="0"   y="0"   width="8" height="8" fill="#F25022"/>
    <rect x="0"   y="9"   width="8" height="8" fill="#00A4EF"/>
    <rect x="9"   y="0"   width="8" height="8" fill="#7FBA00"/>
    <rect x="9"   y="9"   width="8" height="8" fill="#FFB900"/>
  </svg>
)

// ── Provider icon: GitHub ──────────────────────────────────────────────────────
const GitHubIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 19 19" fill="none">
    <path fillRule="evenodd" clipRule="evenodd"
      d="M9.5 0C4.25 0 0 4.36 0 9.75c0 4.31 2.72 7.96 6.49 9.25.48.09.65-.21.65-.47v-1.64c-2.64.59-3.2-1.3-3.2-1.3-.43-1.12-1.06-1.41-1.06-1.41-.87-.61.07-.6.07-.6.96.07 1.46 1.01 1.46 1.01.85 1.49 2.23 1.06 2.78.81.08-.63.33-1.06.6-1.3-2.11-.24-4.33-1.08-4.33-4.81 0-1.06.37-1.93 1-2.61-.1-.25-.43-1.23.09-2.57 0 0 .82-.27 2.67 1.02a9.1 9.1 0 0 1 2.43-.34c.83 0 1.66.11 2.44.34 1.85-1.29 2.67-1.02 2.67-1.02.52 1.34.19 2.32.09 2.57.62.68 1 1.55 1 2.61 0 3.74-2.23 4.57-4.35 4.81.34.3.64.89.64 1.79v2.66c0 .26.17.57.66.47A9.78 9.78 0 0 0 19 9.75C19 4.36 14.75 0 9.5 0z"
      fill="#000000"/>
  </svg>
)

// ── Provider icon: Apple ───────────────────────────────────────────────────────
const AppleIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M13.1 11.3c-.3.7-.6 1.3-1 1.9-.5.8-1 1.2-1.6 1.2-.4 0-.9-.1-1.5-.4-.6-.3-1.1-.4-1.6-.4s-1 .1-1.6.4c-.6.3-1.1.4-1.5.4-.6 0-1.1-.4-1.7-1.3-.5-.8-.9-1.7-1.2-2.7-.3-1.1-.5-2.1-.5-3.1 0-1.1.2-2 .7-2.8.4-.7 1-1.2 1.7-1.4.3 0 .7.1 1.3.3.6.2 1 .3 1.3.3.2 0 .7-.1 1.4-.4.7-.2 1.3-.3 1.7-.3 1.3.1 2.2.7 2.8 1.8-.5.3-.9.7-1.2 1.2-.3.5-.4 1-.4 1.6 0 .7.2 1.3.5 1.8.3.5.7.9 1.2 1.1l-.3.3zM9.9.5c0 .5-.2 1.1-.6 1.6-.5.6-1 .9-1.7.9 0-.5.2-1.1.6-1.6C8.7.9 9.3.5 9.9.4v.1z"
      fill="#000000"/>
  </svg>
)

// ── Provider icon: OIDC ────────────────────────────────────────────────────────
const OIDCIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 19 19" fill="none">
    {/* Left bar */}
    <rect x="1" y="7" width="5" height="11" rx="1.5" fill="#B2B2B2"/>
    {/* Centre arc / O shape */}
    <path d="M8.5 1.5a7.5 7.5 0 0 1 0 15" stroke="#F7931E" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
    {/* Right bar */}
    <rect x="13" y="7" width="5" height="6" rx="1.5" fill="#B2B2B2"/>
  </svg>
)

// ── OAuth button ───────────────────────────────────────────────────────────────
interface OAuthButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

const OAuthButton: React.FC<OAuthButtonProps> = ({ icon, label, onClick }) => {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        maxWidth: '320px',
        height: '42px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0',
        padding: '9px 0',
        background: hovered ? '#F9F9F9' : '#FFFFFF',
        border: '1px solid #D8D6D4',
        boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {/* Icon container */}
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingRight: '12px',
        width: '31px',
        height: '24px',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      {/* Label */}
      <span style={{
        fontFamily: "'Mona Sans', sans-serif",
        fontWeight: 500,
        fontSize: '14px',
        lineHeight: '24px',
        letterSpacing: '0',
        color: '#242424',
        textAlign: 'center',
      }}>
        {label}
      </span>
    </button>
  )
}

// ── Main Login component ───────────────────────────────────────────────────────
const Login: React.FC = () => {
  const navigate = useNavigate()

  // Redirect if already logged in
  React.useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      navigate('/dashboard')
    }
  }, [navigate])

  const handleGoogle = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oauth/google`
  }
  const handleMicrosoft = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oauth/microsoft`
  }
  const handleGitHub = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oauth/github`
  }
  const handleApple = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oauth/apple`
  }
  const handleOIDC = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oauth/oidc`
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '32px 20px 120px',
      background: '#FFFFFF',
      position: 'relative',
    }}>

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: '40px' }}>
        <RouterLink to="/" style={{ textDecoration: 'none', display: 'block' }}>
          <LogoMark />
        </RouterLink>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '11px',
        width: '100%',
        maxWidth: '560px',
        paddingBottom: '48px',
      }}>
        <h1 style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 600,
          fontSize: '20px',
          lineHeight: '29px',
          letterSpacing: '-0.6px',
          color: '#242424',
          margin: 0,
          textAlign: 'center',
        }}>
          Sign in with your identity provider
        </h1>
        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: '23px',
          letterSpacing: '-0.024px',
          color: '#343433',
          margin: 0,
          textAlign: 'center',
        }}>
          You'll use this provider to log in to your network.{' '}
          <RouterLink to="/register" style={{ color: '#343433' }}>
            (more)
          </RouterLink>
        </p>
      </div>

      {/* ── OAuth buttons ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        maxWidth: '320px',
      }}>
        <OAuthButton icon={<GoogleIcon />}    label="Sign in with Google"    onClick={handleGoogle}    />
        <OAuthButton icon={<MicrosoftIcon />} label="Sign in with Microsoft" onClick={handleMicrosoft} />
        <OAuthButton icon={<GitHubIcon />}    label="Sign in with GitHub"    onClick={handleGitHub}    />
        <OAuthButton icon={<AppleIcon />}     label="Sign in with Apple"     onClick={handleApple}     />
        <OAuthButton icon={<OIDCIcon />}      label="Sign in with OIDC"      onClick={handleOIDC}      />
      </div>

      {/* ── "Need another provider?" prompt ────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '64px',
        width: '100%',
        maxWidth: '320px',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '15px',
          gap: '0',
        }}>
          <p style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: '14.4px',
            lineHeight: '21px',
            letterSpacing: '-0.024px',
            color: '#242424',
            margin: '0 0 0 0',
            textAlign: 'center',
          }}>
            Need another provider?
          </p>
          <a
            href="mailto:support@remote365.com"
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 400,
              fontSize: '14.4px',
              lineHeight: '21px',
              letterSpacing: '-0.024px',
              color: '#343433',
              textDecoration: 'underline',
              textAlign: 'center',
            }}
          >
            Contact our team
          </a>
        </div>
      </div>

      {/* ── Legal footer ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '440px',
        marginTop: '40px',
      }}>
        <p style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: '12.8px',
          lineHeight: '19px',
          letterSpacing: '-0.128px',
          color: '#666666',
          margin: 0,
          textAlign: 'center',
        }}>
          By clicking the buttons above, you acknowledge that you have read,{' '}
          understood, and agree to Remote365's{' '}
          <RouterLink to="/terms" style={{ color: '#666666' }}>
            Terms of Service
          </RouterLink>
          {' '}and{' '}
          <RouterLink to="/privacy" style={{ color: '#666666' }}>
            Privacy Policy
          </RouterLink>.
        </p>
      </div>

    </div>
  )
}

export default Login
