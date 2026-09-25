// Frequently asked questions: /faq (all groups), /pricing (the pricing
// group), FAQPage structured data and llms.txt. Answers come from the Docs
// page and the plan catalogue; keep them in step with the product.

export interface Faq {
  question: string
  answer: string
}

export interface FaqGroup {
  id: string
  title: string
  items: Faq[]
}

export const PRICING_FAQS: Faq[] = [
  {
    question: 'Does Remote365 have a free trial?',
    answer: 'Yes — every new workspace starts with a 15-day free trial. The organization owner gets full access with the Trial plan’s devices and the core remote support features, no credit card required.',
  },
  {
    question: 'How does billing work?',
    answer: 'Plans are billed monthly per workspace. You can upgrade, downgrade, or cancel at any time from your billing settings and the change applies immediately.',
  },
  {
    question: 'How do device limits work?',
    answer: 'Each plan includes a number of devices you can register for unattended access. When you reach the limit you can remove devices you no longer use or move to a bigger plan — sessions to already-registered devices keep working either way.',
  },
  {
    question: 'What happens when my trial ends?',
    answer: 'Your workspace is locked until you pick a plan, but nothing is deleted — your devices, members, and settings are all preserved and come right back once you subscribe.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes. Upgrades and downgrades take effect immediately, and the amount you already paid is prorated automatically on your next invoice.',
  },
  {
    question: 'What is the difference between Solo and Pro?',
    answer: 'Solo is for an individual managing their own machines and has no team administration. Pro adds team roles, device groups, per-member device access, a support queue, a scripts library, and basic analytics.',
  },
  {
    question: 'Do you offer custom plans?',
    answer: 'Yes — for larger organizations that need unlimited scale, SSO, compliance controls, or SLA-backed support, contact our sales team and we will put together a plan that fits.',
  },
  {
    question: 'Do you offer discounts for non-profits or educational institutions?',
    answer: 'We do. Reach out to sales with a short description of your organization and we will set you up with discounted pricing.',
  },
]

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'basics',
    title: 'The basics',
    items: [
      {
        question: 'What is Remote365?',
        answer: 'Remote365 is a remote access and support app. You can connect to any computer from anywhere, give live remote support, run video meetings and chat with your team, all from one app, with remote sessions protected by end-to-end encryption.',
      },
      {
        question: 'How do I connect to another computer?',
        answer: 'Two ways: with a one-time session code for on-demand support, or to your own registered devices with their permanent 9-digit ID and password.',
      },
      {
        question: 'Which devices and systems does Remote365 run on?',
        answer: 'There is a Windows desktop app, an Android app, and the Remote365 Host app for Android devices you want to control. The web app works in any modern browser. macOS and iOS apps are coming soon.',
      },
      {
        question: 'Do I need a VPN or port forwarding?',
        answer: 'No. Devices connect out to Remote365, so there is no VPN, port forwarding or firewall change to set up.',
      },
    ],
  },
  {
    id: 'sessions',
    title: 'Support sessions and unattended access',
    items: [
      {
        question: 'Does the person I am helping need an account?',
        answer: 'No. Anyone can join a support session with just the code, from the app or from a browser, without installing anything.',
      },
      {
        question: 'What can I do during a session?',
        answer: 'Take full keyboard and mouse control (including multiple monitors) or stay view-only, transfer files both ways, sync the clipboard, and chat. Organizations can also turn on session recording.',
      },
      {
        question: 'How does unattended access work?',
        answer: 'Install Remote365 on the device, choose “Grant easy access to this device” and enable auto-host. You can then connect to it by its device ID any time, even when nobody is in front of it.',
      },
      {
        question: 'Can I control an Android phone or tablet?',
        answer: 'Yes. Install the Remote365 Host app on the Android device you want to control, then connect from the Windows app, the Android app or a browser.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security and privacy',
    items: [
      {
        question: 'Are remote sessions encrypted?',
        answer: 'Yes. Every remote session is protected with end-to-end encryption, and Remote365 staff cannot view your sessions unless you explicitly ask for support.',
      },
      {
        question: 'Can I require two-factor authentication?',
        answer: 'Any user can turn on two-factor authentication. On the Business and Enterprise plans an organization can enforce it for every member.',
      },
      {
        question: 'How do I control who can reach which device?',
        answer: 'Remote365 uses role-based access control: owners and admins assign roles, and device access can be granted or revoked per member on top of their role. Viewers get view-only access to the devices they are allowed to see.',
      },
      {
        question: 'Can someone connect to my computer without my permission?',
        answer: 'A support session starts only after you approve it, and you can keep it view-only. Unattended access is something you turn on for your own devices, protected by the device password, which you can regenerate at any time.',
      },
    ],
  },
  {
    id: 'meetings',
    title: 'Meetings and chat',
    items: [
      {
        question: 'Does Remote365 include video meetings?',
        answer: 'Yes. Start a meeting and invite anyone with a code or link; participants join from desktop, mobile or browser, with screen sharing and chat during the call.',
      },
      {
        question: 'Is there team chat?',
        answer: 'Yes. Built-in chat lets your team send messages, share files and record voice notes, and jump straight into a session or meeting from a conversation.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Plans and billing',
    items: PRICING_FAQS,
  },
]

export const ALL_FAQS: Faq[] = FAQ_GROUPS.flatMap(g => g.items)
