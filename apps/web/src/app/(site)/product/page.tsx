import Image from 'next/image'
import SiteContent from '@/components/site/SiteContent'
import ProductHero from '@/components/landing/ProductHero'
import ProductExplainer from '@/components/landing/ProductExplainer'
import AccessAnywhereSection from '@/components/landing/AccessAnywhereSection'
import GetInvolvedSection from '@/components/landing/GetInvolvedSection'
import GetStartedCta from '@/components/landing/GetStartedCta'
import ConnectionDiagram from '@/components/landing/ConnectionDiagram'
import FeatureTabs, { type FeatureTab } from '@/components/landing/FeatureTabs'
import RemoteDesktopScene from '@/components/landing/RemoteDesktopScene'
import ChatMock from '@/components/landing/ChatMock'
import { ScrollReveal } from '@/components/landing/ScrollReveal'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Product: remote access, support, meetings and chat',
  description:
    'What Remote365 does: unattended access to your own devices by ID, support sessions started with a code, video meetings, team chat and file transfer, with role-based access and two-factor authentication.',
  path: '/product',
})

// Every point is something the product does today (see the Docs page and
// the plan limits in packages/shared).
const FEATURES: FeatureTab[] = [
  {
    id: 'support',
    label: 'Support sessions',
    title: 'Help someone in seconds',
    body: 'Create a session and share its one-time code or link. The person you are helping joins in the Remote365 app and approves the request, and their screen opens in your session view. They do not need an account.',
    points: [
      'Full keyboard and mouse control, including multiple monitors',
      'View-only mode when you only need to watch',
      'Two-way file transfer and clipboard sync',
      'Chat with the person you are helping',
    ],
    visual: (
      <Image
        src="/105f060441fe41618729fcd5695c6afc5a3d4f4f.png"
        alt="A phone running the Remote365 app"
        width={1535}
        height={1025}
        sizes="(min-width: 860px) 560px, 92vw"
      />
    ),
  },
  {
    id: 'unattended',
    label: 'Unattended access',
    title: 'Reach your own computers any time',
    body: 'Every registered device has a permanent 9-digit ID and a password. Turn on auto-host, and you can connect to it by ID from the desktop app, the Android app or a browser, even when nobody is in front of it.',
    points: [
      'Regenerate a device password at any time',
      'Members only see the devices they have been granted',
      'No VPN, port forwarding or firewall changes',
    ],
    visual: <RemoteDesktopScene />,
  },
  {
    id: 'meetings',
    label: 'Meetings',
    title: 'Meet without switching apps',
    body: 'Start a video meeting and invite anyone with a code or link. Participants join from the desktop app, the mobile app or a browser, and guests do not need an account.',
    points: [
      'Screen sharing and chat during the call',
      'Schedule a meeting for later and add it to Google Calendar',
      'The same app you use for remote support',
    ],
    visual: (
      <Image
        src="/b83a6130ee1316b5433f5fb72198938b2c5f00a7.jpg"
        alt="A man in a video meeting on his laptop"
        width={2499}
        height={1667}
        sizes="(min-width: 860px) 560px, 92vw"
      />
    ),
  },
  {
    id: 'chat',
    label: 'Team chat',
    title: 'Keep your team talking between sessions',
    body: 'Built-in chat keeps support conversations next to the tools that fix things, so a message can turn into a remote session or a meeting in one click.',
    points: [
      'Direct messages and group chats',
      'Share files and record voice notes',
      'Jump from a conversation into a session or meeting',
    ],
    visual: <ChatMock />,
  },
  {
    id: 'security',
    label: 'Security',
    title: 'You decide who reaches what',
    body: 'Every remote session is encrypted end to end, and Remote365 staff cannot view your sessions unless you ask for support. Access is set member by member.',
    points: [
      'Owner, Admin and Viewer roles, plus access granted per device and member',
      'Two-factor authentication for every account, enforceable on Business',
      'Session recording on the Business plan',
    ],
    visual: (
      <Image
        src="/c460f6a065169b1b08853ed8eb897298d1e73c19.png"
        alt="Laptop, phone and browser connected through a lock"
        width={1600}
        height={980}
        sizes="(min-width: 860px) 560px, 92vw"
      />
    ),
  },
]

export default function ProductPage() {
  return (
    <SiteContent>
      <main>
        <ScrollReveal delay={0.1}>
          <ProductHero
            heading="Remote access for everyone, everywhere"
            description="Connect to any device from anywhere — start a support session with a code, control machines by their ID, run video meetings, and chat with your team. Remote sessions are end-to-end encrypted, with no VPN or setup."
            ctaText="Start your free trial"
            visual={<ConnectionDiagram />}
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <ProductExplainer />
        </ScrollReveal>

        <FeatureTabs
          heading="Everything in one app"
          intro="Support sessions, access to your own devices, meetings and chat, with the same security everywhere."
          tabs={FEATURES}
        />

        <ScrollReveal delay={0.15}>
          <AccessAnywhereSection
            title="Share with friends and family"
            subtitle="Grant access to specific machines for the people you trust — so they can reach that one computer, without exposing anything else you own."
            linkLabel=""
            image="/37e0e57e97f1972d3a302e6e086d8b5f1b920cad.png"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <GetInvolvedSection />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <AccessAnywhereSection
            title="Our commitment to security"
            subtitle="Every remote session is end-to-end encrypted. Role-based access control, forced two-factor authentication, and full audit logs keep your team and every device protected."
            linkLabel="See plans"
            linkTo="/pricing"
            image="/73c24a8b6ac291b698899b4f986d0ee1ea5bdaa8.png"
            illustration
            reverse
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <GetStartedCta />
        </ScrollReveal>
      </main>
    </SiteContent>
  )
}
