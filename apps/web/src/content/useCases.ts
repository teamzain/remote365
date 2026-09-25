// Use-case stories: the home page's flip stack, /use-cases pages, the sitemap
// and llms.txt all read from here. Everything described is something the
// product does today (see the Docs page); no customer names or numbers.

export interface UseCaseSection {
  heading: string
  body: string
  points?: string[]
}

export interface UseCase {
  slug: string
  /** Short label shown above the card title. */
  eyebrow: string
  /** Card title and page H1. */
  title: string
  /** Card text; also the page's meta description. */
  summary: string
  /** 40–60 word answer that opens the page. */
  answer: string
  image: string
  imageAlt: string
  /** Card colours. */
  background: string
  foreground: string
  sections: UseCaseSection[]
  faqs: { question: string; answer: string }[]
}

export const USE_CASES: UseCase[] = [
  {
    slug: 'it-help-desk',
    eyebrow: 'IT help desk',
    title: 'Fix a colleague’s computer without walking to their desk',
    summary:
      'They share a one-time session code, you see their screen within seconds, fix the problem and hand control back. Remote sessions are end-to-end encrypted, and nobody has to install anything to join from a browser.',
    answer:
      'Remote365 lets an IT help desk support people on their own computers. The person needing help shares a one-time session code or link, joins from the app or a browser, approves the connection, and the technician gets their screen with full keyboard and mouse control, file transfer and clipboard sync.',
    image: '/37e0e57e97f1972d3a302e6e086d8b5f1b920cad.png',
    imageAlt: 'Two colleagues looking at a laptop running Remote365',
    background: '#a94808',
    foreground: '#fff7ed',
    sections: [
      {
        heading: 'How does a support session work?',
        body: 'Support sessions are temporary, encrypted connections for helping someone once, without registering their device.',
        points: [
          'The technician chooses “Create a Session” and shares the code or link.',
          'The user enters the code, or opens the link in a browser, and approves the request.',
          'They can keep it view-only, so the technician sees but does not control.',
          'The technician works with full keyboard and mouse control, including multiple monitors.',
        ],
      },
      {
        heading: 'What can the technician do during a session?',
        body: 'Everything travels over an end-to-end encrypted channel.',
        points: [
          'Two-way file transfer and clipboard sync',
          'Chat with the person being helped',
          'Session recording, when the organization turns it on (Business plan)',
        ],
      },
      {
        heading: 'How do you control who can reach which machine?',
        body: 'Role-based access decides what each member can do, and device access can be granted per member on top of their role. Organizations on the Business plan can force two-factor authentication for everyone and keep a full audit log of connections.',
      },
    ],
    faqs: [
      {
        question: 'Does the person being helped need an account?',
        answer: 'No. Anyone can join a support session with just the code, from the app or from a browser.',
      },
      {
        question: 'Can the user stop the session?',
        answer: 'Yes. They approve the connection before it starts, can keep it view-only, and can end it at any time.',
      },
    ],
  },
  {
    slug: 'msp',
    eyebrow: 'Managed service providers',
    title: 'Look after every client’s machines from one dashboard',
    summary:
      'Group devices by client, give each technician access to only the machines they look after, and reach unattended servers and workstations by their device ID, even when nobody is in front of them.',
    answer:
      'Remote365 gives managed service providers one dashboard for all client devices. Each device has a permanent 9-digit ID and password for unattended access, devices can be grouped by client, and per-member device access means each technician only sees the machines they are responsible for.',
    image: '/4dd57ec67c49dd891ff516acaa8dfe8e803d0fd2.png',
    imageAlt: 'A world map of connected devices above a laptop keyboard',
    background: '#0b5f6e',
    foreground: '#ecfeff',
    sections: [
      {
        heading: 'How does unattended access work?',
        body: 'Install Remote365 on the client machine and it registers with a permanent ID and password. Turn on auto-host and it accepts connections even when no one is sitting in front of it.',
        points: [
          'Connect by device ID from the desktop app or any browser',
          'Regenerate a device password at any time',
          'Members only see the devices they have been granted',
        ],
      },
      {
        heading: 'How do you organise many clients?',
        body: 'Device groups keep each client’s machines together, and per-member device access lets you hand a client to one technician without exposing the rest of your fleet.',
      },
      {
        heading: 'Which plan fits an MSP?',
        body: 'Pro includes device groups, per-member device access, a support queue and a scripts library. Business adds full role-based access control, connection policies, forced two-factor authentication, session recording and a one-year audit log. See the pricing page for current limits.',
      },
    ],
    faqs: [
      {
        question: 'Can a technician see every client’s devices?',
        answer: 'Only if you grant them. Device access is set per member, on top of their role.',
      },
      {
        question: 'Do client machines need a VPN or port forwarding?',
        answer: 'No. Devices connect out to Remote365, so there is no VPN, port forwarding or firewall change to set up.',
      },
    ],
  },
  {
    slug: 'remote-teams',
    eyebrow: 'Remote and hybrid teams',
    title: 'Keep a distributed team working like it shares one office',
    summary:
      'Reach your office computer from home, jump into a video meeting, and message teammates in built-in chat, all in the same app on Windows, Android and the web.',
    answer:
      'Remote365 combines remote desktop, video meetings and team chat in one app, so a distributed team can reach office computers from home, meet with a code or link, and message each other between sessions, on Windows, Android and in any modern browser.',
    image: '/b83a6130ee1316b5433f5fb72198938b2c5f00a7.jpg',
    imageAlt: 'A man in a video meeting on his laptop at home',
    background: '#3322a8',
    foreground: '#f3f1ff',
    sections: [
      {
        heading: 'Can I use my office computer from home?',
        body: 'Yes. Register the office computer, turn on unattended access, and connect to it by its device ID from home, from the desktop app, the Android app or a browser.',
      },
      {
        heading: 'What about meetings and chat?',
        body: 'Start a video meeting and invite anyone with a code or link; participants join from desktop, mobile or browser, with screen sharing and chat during the call. Team chat keeps people connected between sessions with messages, files and voice notes, and can jump straight into a session or meeting.',
      },
      {
        heading: 'How is access kept safe?',
        body: 'Remote sessions are end-to-end encrypted. Owners and admins decide who can reach which device, and two-factor authentication can be turned on for every account.',
      },
    ],
    faqs: [
      {
        question: 'Do meeting guests need an account?',
        answer: 'No. Guests join with the meeting code or link.',
      },
      {
        question: 'Which devices can I connect from?',
        answer: 'The Windows desktop app, the Android app, or any modern browser. macOS and iOS apps are coming soon.',
      },
    ],
  },
  {
    slug: 'family-support',
    eyebrow: 'Family support',
    title: 'Help your family with their phone or PC from anywhere',
    summary:
      'Install the Windows app or the Android host app on a parent’s device and help them from wherever you are, whether they are in Lahore and you are in Dubai, Riyadh, Toronto or Houston.',
    answer:
      'Remote365 lets you help relatives with their computer or Android phone from another city or country. They share a session code, or you set up unattended access once, and you can see their screen and fix things yourself, with the remote session end-to-end encrypted.',
    image: '/105f060441fe41618729fcd5695c6afc5a3d4f4f.png',
    imageAlt: 'A phone running the Remote365 app',
    background: '#8a1c4a',
    foreground: '#fff1f7',
    sections: [
      {
        heading: 'How do I help a parent once?',
        body: 'Start a support session and send them the code or link on WhatsApp or by text. They open it, approve the connection, and you can see and control their screen.',
      },
      {
        heading: 'How do I set it up so I can help any time?',
        body: 'Install Remote365 on their Windows PC, or the Remote365 Host app on their Android phone, and turn on unattended access. You can then connect by device ID whenever they need you, even across time zones while they sleep.',
      },
      {
        heading: 'Can I share access with a sibling?',
        body: 'Yes. You can grant access to one specific device to people you trust, without exposing anything else you own.',
      },
    ],
    faqs: [
      {
        question: 'Does my parent need to understand the app?',
        answer: 'For a one-off session they only need to open the link you send and approve the connection. With unattended access set up, they do not need to do anything.',
      },
      {
        question: 'Does it work on Android phones?',
        answer: 'Yes. Install the Remote365 Host app on the phone you want to help with; you control it from the Windows app, the Android app or a browser.',
      },
    ],
  },
]

export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find(u => u.slug === slug)
}
