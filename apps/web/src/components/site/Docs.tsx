'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Rocket, LifeBuoy, MonitorSmartphone, Video, Users, ShieldCheck, CreditCard,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SiteContent from './SiteContent'

// ── Content model ──────────────────────────────────────────────────────────────
type Block =
  | { p: string }
  | { steps: string[] }
  | { list: string[] }
  | { code: string }
  | { callout: string; tone?: 'tip' | 'note' }

interface Article {
  id: string
  title: string
  blocks: Block[]
}

interface Group {
  label: string
  Icon: LucideIcon
  articles: Article[]
}

const GROUPS: Group[] = [
  {
    label: 'Getting started',
    Icon: Rocket,
    articles: [
      {
        id: 'overview',
        title: 'What is Remote365?',
        blocks: [
          { p: 'Remote365 is a secure remote access and support platform. Connect to any computer from anywhere, provide live support, run video meetings, and chat with your team — all from one app, with remote sessions protected by end-to-end encryption.' },
          { p: 'You can connect two ways: instantly with a one-time session code for on-demand support, or permanently to your own registered devices using their unique 9-digit ID and password.' },
        ],
      },
      {
        id: 'install',
        title: 'Install & sign in',
        blocks: [
          { p: 'Download the desktop app for your platform, then sign in or create a free account. Your workspace starts on a 15-day trial with full features.' },
          { steps: [
            'Go to the Downloads page and grab the installer for Windows (or the Android app for phones and tablets).',
            'Run the installer and launch Remote365.',
            'Sign in with your email, or choose “Sign Up” to create an account.',
            'Your device is registered automatically and gets its own ID and password.',
          ] },
          { callout: 'No account is required on the guest side — anyone can join a support session with just a code.', tone: 'tip' },
        ],
      },
      {
        id: 'your-id',
        title: 'Your device ID & password',
        blocks: [
          { p: 'Every registered device gets a permanent 9-digit ID and a password. Share both with someone and they can connect to that device from their browser, desktop, or phone.' },
          { code: 'Your ID       123 456 789\nPassword      45874511' },
          { p: 'You can regenerate the password at any time from the Home screen. Passwords are stored securely and are never visible to Remote365 staff.' },
        ],
      },
    ],
  },
  {
    label: 'Remote support',
    Icon: LifeBuoy,
    articles: [
      {
        id: 'start-session',
        title: 'Start a support session',
        blocks: [
          { p: 'Support sessions are temporary, encrypted connections — perfect for helping a client or family member once, without registering their device.' },
          { steps: [
            'On the Home screen, choose “Create a Session”.',
            'Share the generated session code (and link) with the person you’re helping.',
            'They enter the code — or open the link in their browser — and join.',
            'Their screen opens in your session view automatically.',
          ] },
        ],
      },
      {
        id: 'join-session',
        title: 'Join a session',
        blocks: [
          { p: 'To receive support, enter the session code your supporter shared. No install or account needed — it runs in the browser too.' },
          { list: [
            'Enter the session code provided by your supporter.',
            'Approve the connection request.',
            'Optionally toggle “View only” so the supporter can see but not control.',
          ] },
        ],
      },
      {
        id: 'during-session',
        title: 'During a session',
        blocks: [
          { p: 'While connected you can take full control or stay view-only. Everything happens over an end-to-end encrypted channel.' },
          { list: [
            'Full keyboard & mouse control, including multiple monitors.',
            'Two-way file transfer and clipboard sync.',
            'In-session chat.',
            'Optional session recording (if enabled by the organization).',
          ] },
        ],
      },
    ],
  },
  {
    label: 'Device access',
    Icon: MonitorSmartphone,
    articles: [
      {
        id: 'connect-by-id',
        title: 'Connect by device ID',
        blocks: [
          { p: 'To reach one of your own registered devices, enter its 9-digit ID and password from the “Connect with ID” panel. Works from the desktop app or any browser.' },
        ],
      },
      {
        id: 'unattended',
        title: 'Unattended access',
        blocks: [
          { p: 'Enable auto-host on a device so you can reach it any time — even when no one is sitting in front of it.' },
          { steps: [
            'Open the device and choose “Grant easy access to this device”.',
            'Enable auto-host so it accepts connections automatically.',
            'Connect from anywhere using the device ID.',
          ] },
          { callout: 'Unattended access respects your organization’s roles — members only see devices they’ve been granted.', tone: 'note' },
        ],
      },
    ],
  },
  {
    label: 'Meetings & chat',
    Icon: Video,
    articles: [
      {
        id: 'meetings',
        title: 'Video meetings',
        blocks: [
          { p: 'Start a live video meeting and invite anyone with a meeting code or link. Great for walking a customer through a fix or a quick team sync.' },
          { list: [
            'Create a meeting and share the code or link.',
            'Participants join from desktop, mobile, or browser.',
            'Screen share and chat during the call.',
          ] },
        ],
      },
      {
        id: 'chat',
        title: 'Team chat',
        blocks: [
          { p: 'Built-in chat keeps your team connected between sessions. Send messages, share files, record voice notes, and jump straight into a session or meeting from any conversation.' },
        ],
      },
    ],
  },
  {
    label: 'Teams & roles',
    Icon: Users,
    articles: [
      {
        id: 'members',
        title: 'Invite members',
        blocks: [
          { p: 'Invite teammates to your organization from the Members page. Each member signs in under your workspace and inherits the plan’s features.' },
        ],
      },
      {
        id: 'roles',
        title: 'Roles & permissions',
        blocks: [
          { p: 'Remote365 uses role-based access control. Assign roles to decide what each member can do, and grant device access per member on top of their role.' },
          { list: [
            'Owner — full control of the workspace and billing.',
            'Admin — manage members, devices, and settings.',
            'Viewer — view-only access to permitted devices.',
            'Per-member device access — grant or revoke specific devices for any member.',
          ] },
        ],
      },
    ],
  },
  {
    label: 'Security',
    Icon: ShieldCheck,
    articles: [
      {
        id: 'encryption',
        title: 'Encryption & privacy',
        blocks: [
          { p: 'Every remote session is protected with end-to-end encryption. Remote365 staff cannot view your sessions unless you explicitly request support.' },
        ],
      },
      {
        id: 'two-factor',
        title: 'Two-factor authentication',
        blocks: [
          { p: 'Turn on two-factor authentication for your account, or enforce it for your whole organization on Business and Enterprise plans.' },
          { list: [
            'Forced 2FA across the organization.',
            'Full audit logs of connections and actions.',
            'Connection policies to control who can reach what.',
          ] },
        ],
      },
    ],
  },
  {
    label: 'Billing',
    Icon: CreditCard,
    articles: [
      {
        id: 'plans',
        title: 'Plans & billing',
        blocks: [
          { p: 'Plans are billed monthly per workspace. Upgrade, downgrade, or cancel any time from billing settings — changes take effect immediately and are prorated on your next invoice.' },
          { callout: 'Your 15-day trial converts to a locked workspace until you pick a plan. Nothing is deleted — your devices and members come right back when you subscribe.', tone: 'note' },
        ],
      },
    ],
  },
]

const ALL = GROUPS.flatMap(g => g.articles)
const NAV_OFFSET = 110

// ── Block renderer ───────────────────────────────────────────────────────────
const BlockView: React.FC<{ block: Block }> = ({ block }) => {
  if ('p' in block) return <p className="doc-p">{block.p}</p>
  if ('steps' in block) return (
    <ol className="doc-steps">{block.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
  )
  if ('list' in block) return (
    <ul className="doc-ul">{block.list.map(s => <li key={s}>{s}</li>)}</ul>
  )
  if ('code' in block) return <pre className="doc-code">{block.code}</pre>
  return <div className={`doc-callout doc-callout--${block.callout && block.tone === 'tip' ? 'tip' : 'note'}`}>{block.callout}</div>
}

const Docs: React.FC = () => {
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(ALL[0]?.id)
  const refs = useRef<Record<string, HTMLElement | null>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GROUPS
    return GROUPS
      .map(g => ({ ...g, articles: g.articles.filter(a => a.title.toLowerCase().includes(q)) }))
      .filter(g => g.articles.length > 0)
  }, [query])

  useEffect(() => {
    const onScroll = () => {
      let current = ALL[0]?.id
      for (const a of ALL) {
        const el = refs.current[a.id]
        if (el && el.getBoundingClientRect().top <= NAV_OFFSET + 40) current = a.id
      }
      setActiveId(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (id: string) => refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <SiteContent>
      <div className="doc-page">

        {/* Header */}
        <section className="doc-hero">
          <span className="doc-eyebrow">Documentation</span>
          <h1 className="doc-title">Everything you need to run Remote365</h1>
          <p className="doc-lede">Guides for connecting, supporting, collaborating, and securing your devices and team.</p>
          <input
            className="doc-search"
            type="search"
            placeholder="Search the docs…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </section>

        <main className="doc-main">
          {/* Sidebar */}
          <aside className="doc-sidebar">
            <nav>
              {filtered.map(group => (
                <div key={group.label} className="doc-navgroup">
                  <div className="doc-navgroup-label">
                    <group.Icon size={15} strokeWidth={1.8} />
                    {group.label}
                  </div>
                  {group.articles.map(a => (
                    <button
                      key={a.id}
                      className={`doc-navlink${activeId === a.id ? ' is-active' : ''}`}
                      onClick={() => goTo(a.id)}
                    >
                      {a.title}
                    </button>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && <p className="doc-empty">No matching topics.</p>}
            </nav>
          </aside>

          {/* Content */}
          <article className="doc-content">
            {GROUPS.map(group => (
              <section key={group.label} className="doc-group">
                <div className="doc-group-head">
                  <span className="doc-group-icon"><group.Icon size={18} strokeWidth={2} /></span>
                  <h2>{group.label}</h2>
                </div>
                {group.articles.map(a => (
                  <section
                    key={a.id}
                    ref={el => { refs.current[a.id] = el }}
                    style={{ scrollMarginTop: `${NAV_OFFSET}px` }}
                    className="doc-article"
                  >
                    <h3 className="doc-article-title">{a.title}</h3>
                    {a.blocks.map((b, i) => <BlockView key={i} block={b} />)}
                  </section>
                ))}
              </section>
            ))}
          </article>
        </main>

        <style>{`
          .doc-page {
            font-family: 'Mona Sans', system-ui, -apple-system, sans-serif;
          }

          .doc-hero {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            text-align: center;
            padding: clamp(56px, 8vw, 96px) clamp(20px, 5vw, 40px) clamp(40px, 6vw, 64px);
            background: linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%);
          }
          .doc-eyebrow {
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: #FF8A00;
          }
          .doc-title {
            margin: 0;
            max-width: 760px;
            font-weight: 600;
            font-size: clamp(2rem, 4.5vw, 48px);
            line-height: 1.2;
            letter-spacing: -0.5px;
            color: #1A1D21;
          }
          .doc-lede {
            margin: 0;
            max-width: 620px;
            font-weight: 400;
            font-size: 18px;
            line-height: 26px;
            color: rgba(26, 29, 33, 0.65);
          }
          .doc-search {
            margin-top: 12px;
            width: 100%;
            max-width: 460px;
            height: 48px;
            padding: 0 18px;
            box-sizing: border-box;
            font-family: inherit;
            font-size: 15px;
            color: #1A1D21;
            background: #FFFFFF;
            border: 1px solid rgba(26, 29, 33, 0.18);
            border-radius: 8px;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .doc-search:focus {
            border-color: #FF8A00;
            box-shadow: 0 0 0 3px rgba(255, 138, 0, 0.15);
          }

          .doc-main {
            display: flex;
            align-items: flex-start;
            gap: 64px;
            width: 100%;
            max-width: 1440px;
            margin: 0 auto;
            padding: 48px clamp(20px, 4vw, 48px) 96px;
            box-sizing: border-box;
            flex: 1;
          }
          .doc-sidebar {
            position: sticky;
            top: 88px;
            width: 280px;
            flex-shrink: 0;
          }
          .doc-navgroup { margin-bottom: 22px; }
          .doc-navgroup-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 13px;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            color: rgba(26, 29, 33, 0.45);
            margin-bottom: 8px;
          }
          .doc-navlink {
            display: block;
            width: 100%;
            text-align: left;
            padding: 7px 12px;
            border: none;
            background: none;
            border-radius: 6px;
            font-family: inherit;
            font-weight: 500;
            font-size: 14px;
            line-height: 20px;
            color: rgba(26, 29, 33, 0.7);
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
          }
          .doc-navlink:hover { background: #F3F4F6; color: #1A1D21; }
          .doc-navlink.is-active {
            color: #FF8A00;
            background: rgba(255, 138, 0, 0.08);
            font-weight: 600;
          }
          .doc-empty { font-size: 14px; color: rgba(26,29,33,0.5); }

          .doc-content { flex: 1; min-width: 0; }
          .doc-group { margin-bottom: 56px; }
          .doc-group-head {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 16px;
            margin-bottom: 24px;
            border-bottom: 1px solid rgba(26, 29, 33, 0.1);
          }
          .doc-group-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 10px;
            color: #FFFFFF;
            background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
          }
          .doc-group-head h2 {
            margin: 0;
            font-weight: 600;
            font-size: 24px;
            line-height: 32px;
            color: #1A1D21;
          }
          .doc-article { margin-bottom: 36px; }
          .doc-article-title {
            margin: 0 0 12px;
            font-weight: 600;
            font-size: 19px;
            line-height: 27px;
            color: #1A1D21;
          }
          .doc-p {
            margin: 0 0 12px;
            font-weight: 400;
            font-size: 16px;
            line-height: 26px;
            color: rgba(26, 29, 33, 0.8);
          }
          .doc-steps, .doc-ul {
            margin: 0 0 12px;
            padding-left: 22px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 16px;
            line-height: 25px;
            color: rgba(26, 29, 33, 0.8);
          }
          .doc-steps li::marker { color: #FF8A00; font-weight: 700; }
          .doc-ul li::marker { color: #FF8A00; }
          .doc-code {
            margin: 0 0 14px;
            padding: 16px 18px;
            background: #1A1D21;
            border-radius: 8px;
            color: #F3F4F6;
            font-family: ui-monospace, 'SF Mono', Menlo, monospace;
            font-size: 14px;
            line-height: 22px;
            white-space: pre-wrap;
            overflow-x: auto;
          }
          .doc-callout {
            margin: 0 0 14px;
            padding: 14px 16px;
            border-radius: 8px;
            font-size: 15px;
            line-height: 23px;
            border-left: 3px solid;
          }
          .doc-callout--tip {
            background: rgba(255, 138, 0, 0.07);
            border-left-color: #FF8A00;
            color: #7a4a00;
          }
          .doc-callout--note {
            background: #F3F4F6;
            border-left-color: rgba(26, 29, 33, 0.35);
            color: rgba(26, 29, 33, 0.8);
          }

          @media (max-width: 860px) {
            .doc-main { flex-direction: column; gap: 24px; }
            .doc-sidebar {
              position: static;
              width: 100%;
              max-height: none;
              border-bottom: 1px solid rgba(26,29,33,0.1);
              padding-bottom: 16px;
            }
          }
        `}</style>
      </div>
    </SiteContent>
  )
}

export default Docs
