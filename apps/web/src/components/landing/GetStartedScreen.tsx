import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  ArrowRight,
  Download,
  LayoutDashboard,
  MessageSquare,
  MonitorSmartphone,
  ShieldCheck,
  UserPlus,
  Zap,
} from 'lucide-react'
import {
  ExpandableScreen,
  ExpandableScreenContent,
  ExpandableScreenTrigger,
  useExpandableScreen,
} from './ExpandableScreen'
import { useAuthStore } from '../../store/authStore'

// Points and copy are the site's existing claims (hero + feature cards).
const POINTS = [
  { Icon: Zap, text: 'Install Remote365, register your device, and start accepting remote connections — no IT department needed.' },
  { Icon: MonitorSmartphone, text: 'Runs on Windows, macOS, Linux, iOS, and Android.' },
  { Icon: ShieldCheck, text: 'End-to-end encrypted sessions, role-based access, and forced two-factor authentication.' },
]

interface Action {
  to: string
  title: string
  description: string
  Icon: typeof Zap
  primary?: boolean
}

const signedOutActions: Action[] = [
  { to: '/register', title: 'Create a free account', description: 'Set up your workspace and add your first device.', Icon: UserPlus, primary: true },
  { to: '/downloads', title: 'Download the app', description: 'Install Remote365 on the computer or phone you want to reach.', Icon: Download },
  { to: '/contact', title: 'Talk to sales', description: 'Questions about plans or rolling out to a team? We’ll help.', Icon: MessageSquare },
]

const signedInActions: Action[] = [
  { to: '/dashboard', title: 'Open your dashboard', description: 'Your devices, sessions and meetings.', Icon: LayoutDashboard, primary: true },
  signedOutActions[1],
  signedOutActions[2],
]

const ActionLink: React.FC<{ action: Action }> = ({ action }) => {
  const { collapse } = useExpandableScreen()
  const { Icon } = action
  return (
    // Collapse too, for the case where the link points at the current page.
    <RouterLink
      to={action.to}
      onClick={collapse}
      className={`gs-action${action.primary ? ' gs-action--primary' : ''}`}
    >
      <span className="gs-action-icon"><Icon size={20} strokeWidth={2} /></span>
      <span className="gs-action-text">
        <span className="gs-action-title">{action.title}</span>
        <span className="gs-action-desc">{action.description}</span>
      </span>
      <ArrowRight className="gs-action-arrow" size={18} strokeWidth={2} />
    </RouterLink>
  )
}

const Panel: React.FC = () => {
  const signedIn = Boolean(useAuthStore(s => s.accessToken))
  const { collapse } = useExpandableScreen()
  const actions = signedIn ? signedInActions : signedOutActions

  return (
    <div className="gs-body">
      <div className="gs-info">
        <span className="gs-eyebrow">Get started</span>
        <h2 className="gs-title">Remote access to any device, in minutes</h2>
        <p className="gs-sub">
          Connect to any device, run live meetings, chat with your team, and support
          anyone from anywhere.
        </p>
        <ul className="gs-points">
          {POINTS.map(({ Icon, text }) => (
            <li key={text}>
              <span className="gs-point-icon"><Icon size={20} strokeWidth={2} /></span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="gs-actions">
        {actions.map(a => <ActionLink key={a.to} action={a} />)}
        {!signedIn && (
          <p className="gs-signin">
            Already have an account?{' '}
            <RouterLink to="/login" onClick={collapse}>Sign in</RouterLink>
          </p>
        )}
      </div>
    </div>
  )
}

interface GetStartedScreenProps {
  /** hero: the big glass CTA on the home page; nav: the header button. */
  variant: 'hero' | 'nav'
}

// "Get Started" that morphs into a full-screen chooser (Cult UI's Expandable
// Screen) instead of jumping straight to /register.
const GetStartedScreen: React.FC<GetStartedScreenProps> = ({ variant }) => (
  <ExpandableScreen triggerRadius="100px" contentRadius="24px">
    <ExpandableScreenTrigger className={variant === 'hero' ? 'vh-cta-wrap' : undefined}>
      {variant === 'hero' ? (
        <span className="vh-cta">
          <span>Get Started</span>
          <span className="vh-cta-icon" aria-hidden="true">
            <ArrowRight size={16} strokeWidth={2.5} />
          </span>
        </span>
      ) : (
        <span className="navbar-btn navbar-btn-pill navbar-btn-pill-primary">Get Started</span>
      )}
    </ExpandableScreenTrigger>

    <ExpandableScreenContent className="gs-panel" ariaLabel="Get started with Remote365">
      <Panel />
    </ExpandableScreenContent>

    <style>{`
      .gs-panel {
        color: #ffffff;
        background:
          radial-gradient(900px 520px at 0% 0%, rgba(255, 138, 0, 0.2), transparent 62%),
          radial-gradient(700px 480px at 100% 100%, rgba(234, 88, 12, 0.12), transparent 60%),
          #0b0b0d;
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-family: 'Mona Sans', system-ui, -apple-system, sans-serif;
      }
      .gs-body {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 64px;
        max-width: 1100px;
        min-height: 100%;
        margin: 0 auto;
        padding: 64px;
      }
      .gs-info,
      .gs-actions {
        flex: 1;
        min-width: 0;
      }
      .gs-eyebrow {
        font-size: 14px;
        font-weight: 600;
        color: #ff8a00;
      }
      .gs-title {
        margin: 12px 0 0;
        font-size: clamp(2rem, 4vw, 48px);
        font-weight: 700;
        line-height: 1.08;
        letter-spacing: -0.03em;
        background-image: linear-gradient(180deg, #ffffff 0%, #b8bec8 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .gs-sub {
        margin: 16px 0 0;
        font-size: 17px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.64);
      }
      .gs-points {
        list-style: none;
        margin: 32px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .gs-points li {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        font-size: 15px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.78);
      }
      .gs-point-icon {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255, 138, 0, 0.12);
        color: #ff8a00;
      }
      .gs-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .gs-action {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #ffffff;
        text-decoration: none;
        transition: background 0.3s, border-color 0.3s, transform 0.3s;
      }
      .gs-action:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 138, 0, 0.5);
        transform: translateY(-1px);
      }
      .gs-action-icon {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.08);
      }
      .gs-action-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .gs-action-title {
        font-size: 17px;
        font-weight: 600;
      }
      .gs-action-desc {
        font-size: 14px;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.6);
      }
      .gs-action-arrow {
        flex-shrink: 0;
        transition: transform 0.3s;
      }
      .gs-action:hover .gs-action-arrow {
        transform: translateX(3px);
      }
      /* Primary: brand orange with near-black text (white on #FF8A00 is
         too low-contrast for the description). */
      .gs-action--primary {
        background: linear-gradient(135deg, #ff8a00 0%, #f97316 100%);
        border-color: transparent;
        color: #111315;
        box-shadow: 0 16px 40px rgba(255, 138, 0, 0.25);
      }
      .gs-action--primary:hover {
        background: linear-gradient(135deg, #ff9a1f 0%, #fb8230 100%);
        border-color: transparent;
      }
      .gs-action--primary .gs-action-icon {
        background: rgba(17, 19, 21, 0.12);
      }
      .gs-action--primary .gs-action-desc {
        color: rgba(17, 19, 21, 0.75);
      }
      .gs-signin {
        margin: 8px 0 0;
        text-align: center;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
      }
      .gs-signin a {
        color: #ff8a00;
        font-weight: 600;
        text-decoration: none;
      }
      .gs-signin a:hover {
        text-decoration: underline;
      }

      @media (max-width: 900px) {
        .gs-body {
          flex-direction: column;
          align-items: stretch;
          gap: 32px;
          padding: 72px 20px 32px;
        }
        .gs-points { margin-top: 24px; }
      }
    `}</style>
  </ExpandableScreen>
)

export default GetStartedScreen
