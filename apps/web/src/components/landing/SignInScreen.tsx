'use client'

import dynamic from 'next/dynamic'
import { ArrowRight } from 'lucide-react'
import {
  ExpandableScreen,
  ExpandableScreenContent,
  ExpandableScreenTrigger,
} from './ExpandableScreen'

// The sign-in form pulls in the app's auth store and API client; load it only
// when someone opens (or is about to open) the panel.
const loadPanel = () => import('./SignInPanel')
const SignInPanel = dynamic(loadPanel, {
  ssr: false,
  loading: () => <div className="si-loading" aria-hidden="true" />,
})

type Variant = 'nav-signin' | 'nav-start' | 'hero'

const LINKS: Record<Variant, string> = {
  // Real links: without JavaScript (or with ctrl/cmd-click) they open the
  // app's own sign-in and sign-up pages.
  'nav-signin': '/login',
  'nav-start': '/register',
  hero: '/register',
}

// "Sign In" and "Get Started" buttons that morph into a full-screen sign-in
// panel (Cult UI's Expandable Screen): the form on the left, a marquee of
// what Remote365 does on the right.
export default function SignInScreen({ variant }: { variant: Variant }) {
  return (
    <ExpandableScreen triggerRadius="100px" contentRadius="24px">
      <span onPointerEnter={loadPanel} onFocus={loadPanel} className={variant === 'hero' ? 'si-trigger-hero' : undefined}>
        <ExpandableScreenTrigger href={LINKS[variant]} className={variant === 'hero' ? 'vh-cta-wrap' : undefined}>
          {variant === 'hero' ? (
            <span className="vh-cta">
              <span>Get Started</span>
              <span className="vh-cta-icon" aria-hidden="true">
                <ArrowRight size={16} strokeWidth={2.5} />
              </span>
            </span>
          ) : variant === 'nav-signin' ? (
            <span className="navbar-btn navbar-btn-pill navbar-btn-pill-outline">Sign In</span>
          ) : (
            <span className="navbar-btn navbar-btn-pill navbar-btn-pill-primary">Get Started</span>
          )}
        </ExpandableScreenTrigger>
      </span>

      <ExpandableScreenContent className="si-panel" ariaLabel="Sign in to Remote365">
        <SignInPanel />
      </ExpandableScreenContent>

      <style>{`
        .si-trigger-hero { display: contents; }
        .si-panel {
          color: #ffffff;
          background:
            radial-gradient(900px 520px at 0% 0%, rgba(255, 138, 0, 0.18), transparent 62%),
            radial-gradient(700px 480px at 100% 100%, rgba(234, 88, 12, 0.1), transparent 60%),
            #0b0b0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .si-loading { min-height: 100%; }
      `}</style>
    </ExpandableScreen>
  )
}
