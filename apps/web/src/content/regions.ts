// Region pages (/remote-desktop/<slug>): Pakistan, the Gulf and North
// America. Each page is written for that audience (time zones, typical uses,
// cross-border family support). Facts only: no customer names, and no
// compliance, data-residency or local-office claims.

export interface RegionSection {
  heading: string
  body: string
  points?: string[]
}

export interface Region {
  slug: string
  /** Country name as used in headings. */
  name: string
  /** Open Graph locale for the page. */
  ogLocale: string
  /** schema.org areaServed name. */
  areaServed: string
  metaTitle: string
  metaDescription: string
  h1: string
  /** 40–60 word direct answer that opens the page. */
  answer: string
  timeZones: string
  cities: string[]
  sections: RegionSection[]
  faqs: { question: string; answer: string }[]
}

// What is true everywhere; each region page links to these facts.
const PLATFORMS = 'Windows app, Android app (plus the Remote365 Host app for Android devices you want to control), and any modern browser; macOS and iOS apps are coming soon'

export const REGIONS: Region[] = [
  {
    slug: 'pakistan',
    name: 'Pakistan',
    ogLocale: 'en_PK',
    areaServed: 'Pakistan',
    metaTitle: 'Remote desktop software in Pakistan',
    metaDescription:
      'Remote365 is remote desktop and support software for Pakistan: help staff and clients in Karachi, Lahore or Islamabad, reach unattended PCs by ID, and support family abroad, with plans priced in US dollars.',
    h1: 'Remote desktop and remote support in Pakistan',
    answer:
      'Remote365 is a remote desktop app you can use in Pakistan to support colleagues and clients, reach your own computers unattended, and help family in other cities or abroad. Sessions start with a one-time code or a device ID, work without VPN or port forwarding, and are end-to-end encrypted.',
    timeZones: 'Pakistan Standard Time (PKT, UTC+5, no daylight saving)',
    cities: ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Peshawar'],
    sections: [
      {
        heading: 'Who uses remote desktop in Pakistan?',
        body: 'The same app covers the common cases:',
        points: [
          'Office IT teams supporting staff across branches without travelling between cities',
          'Software houses and freelancers supporting clients in the Gulf, the UK and North America',
          'Families helping parents in Pakistan from Dubai, Riyadh, Toronto or Houston, or the other way round',
          'People reaching their own office or home PC while travelling',
        ],
      },
      {
        heading: 'How do time zones affect support from Pakistan?',
        body: 'Pakistan is 1 hour ahead of the UAE, 2 hours ahead of Saudi Arabia, and 9–10 hours ahead of New York and Toronto (12–13 hours ahead of the US and Canadian west coast). Unattended access means a machine can be fixed at a time that suits the technician, even while its owner is asleep: turn on auto-host once, then connect by the device’s 9-digit ID.',
      },
      {
        heading: 'Does it work on Pakistani internet connections?',
        body: 'Remote365 connects over ordinary internet connections, including home broadband and mobile data. Devices connect out to Remote365, so there is no VPN, port forwarding or router change to set up.',
      },
      {
        heading: 'What does it cost?',
        body: 'Every workspace starts with a 15-day free trial. Plans are priced in US dollars and billed monthly; see the pricing page for the current plans and limits.',
      },
    ],
    faqs: [
      {
        question: 'Can I help someone in Pakistan from abroad?',
        answer: 'Yes. Send them a support session code or link; they open it in the Remote365 app, approve the connection, and you see their screen. For regular help, set up unattended access once and connect by device ID.',
      },
      {
        question: 'Which devices are supported?',
        answer: `The ${PLATFORMS}.`,
      },
    ],
  },
  {
    slug: 'saudi-arabia',
    name: 'Saudi Arabia',
    ogLocale: 'en_SA',
    areaServed: 'Saudi Arabia',
    metaTitle: 'Remote desktop software in Saudi Arabia',
    metaDescription:
      'Remote365 is remote desktop and support software for Saudi Arabia: support staff across Riyadh, Jeddah and Dammam, reach unattended PCs by ID, and control who can access which machine, with plans priced in US dollars.',
    h1: 'Remote desktop and remote support in Saudi Arabia',
    answer:
      'Remote365 is a remote desktop app for businesses and families in Saudi Arabia. IT teams can support staff in other branches with a one-time session code, reach unattended machines by device ID, and limit each technician to the devices they look after. Remote sessions are end-to-end encrypted and need no VPN.',
    timeZones: 'Arabia Standard Time (AST, UTC+3, no daylight saving)',
    cities: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar'],
    sections: [
      {
        heading: 'How do companies in Saudi Arabia use remote desktop?',
        body: 'Typical uses are:',
        points: [
          'A head-office IT team supporting branches in other cities without a site visit',
          'Managed service providers looking after several client offices from one dashboard',
          'Staff reaching their office computer from home',
          'Expat families helping relatives in South Asia or elsewhere with their phone or PC',
        ],
      },
      {
        heading: 'How do you control who can access company machines?',
        body: 'Owners and admins assign roles, and device access is granted per member on top of the role, so a technician only sees the machines they are responsible for. On the Business plan you can force two-factor authentication for everyone, set connection policies, record sessions and keep a one-year audit log.',
      },
      {
        heading: 'What about time differences with other countries?',
        body: 'Saudi Arabia is 1 hour behind the UAE, 2 hours behind Pakistan, and 7–8 hours ahead of New York. Unattended access lets a supporter in another time zone reach a machine outside office hours, without anyone on site.',
      },
      {
        heading: 'What does it cost?',
        body: 'Start with a 15-day free trial. Plans are priced in US dollars and billed monthly; larger organizations can contact sales for a custom plan.',
      },
    ],
    faqs: [
      {
        question: 'Does the person receiving support need to install anything?',
        answer: 'Only the free Remote365 app. They join with your code in the app and approve the connection, and they do not need an account.',
      },
      {
        question: 'Which devices are supported?',
        answer: `The ${PLATFORMS}.`,
      },
    ],
  },
  {
    slug: 'uae',
    name: 'the UAE',
    ogLocale: 'en_AE',
    areaServed: 'United Arab Emirates',
    metaTitle: 'Remote desktop software in the UAE',
    metaDescription:
      'Remote365 is remote desktop and support software for the UAE: support teams and clients in Dubai, Abu Dhabi and Sharjah, reach unattended PCs by ID, and run meetings and chat in the same app.',
    h1: 'Remote desktop and remote support in the UAE',
    answer:
      'Remote365 is a remote desktop app for teams and families in the UAE. Support colleagues and clients with a one-time session code, reach your own computers unattended by device ID, and meet or chat with your team in the same app, on Windows, Android and the web, with end-to-end encrypted remote sessions.',
    timeZones: 'Gulf Standard Time (GST, UTC+4, no daylight saving)',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain'],
    sections: [
      {
        heading: 'Who uses remote desktop in the UAE?',
        body: 'Common uses are:',
        points: [
          'Companies with staff split between Dubai, Abu Dhabi and remote work',
          'IT service providers supporting several client offices',
          'Teams working with colleagues in Pakistan, India or Europe',
          'Families in the UAE helping parents back home with their phone or PC',
        ],
      },
      {
        heading: 'Can one app handle support, meetings and chat?',
        body: 'Yes. Remote365 combines remote desktop with video meetings (join by code or link, with screen sharing) and team chat with files and voice notes, so a support call can move from chat to a remote session without switching tools.',
      },
      {
        heading: 'How do time zones work for teams in the UAE?',
        body: 'The UAE is 1 hour ahead of Saudi Arabia, 1 hour behind Pakistan, and 8–9 hours ahead of New York. Unattended access lets a colleague in another country fix a machine after hours without anyone on site.',
      },
      {
        heading: 'What does it cost?',
        body: 'Every workspace starts with a 15-day free trial. Plans are priced in US dollars and billed monthly.',
      },
    ],
    faqs: [
      {
        question: 'Can I help my parents in Pakistan or India from the UAE?',
        answer: 'Yes. Send a support session code or link for a one-off session, which they join in the Remote365 app, or set up unattended access on their device once and connect by device ID whenever they need help.',
      },
      {
        question: 'Which devices are supported?',
        answer: `The ${PLATFORMS}.`,
      },
    ],
  },
  {
    slug: 'united-states',
    name: 'the United States',
    ogLocale: 'en_US',
    areaServed: 'United States',
    metaTitle: 'Remote desktop software for US teams',
    metaDescription:
      'Remote365 is remote desktop and support software for the United States: help employees and clients across time zones, give an MSP team per-technician device access, and reach unattended PCs by ID, with monthly plans in US dollars.',
    h1: 'Remote desktop and remote support in the United States',
    answer:
      'Remote365 is a remote desktop app for small businesses, IT teams and managed service providers in the United States. Support people with a one-time session code, reach unattended computers by device ID across time zones, and control each technician’s access per device, with end-to-end encrypted remote sessions and monthly US-dollar pricing.',
    timeZones: 'Eastern, Central, Mountain and Pacific time (UTC−5 to UTC−8, with daylight saving), plus Alaska and Hawaii',
    cities: ['New York', 'Houston', 'Chicago', 'Los Angeles', 'Dallas', 'Atlanta'],
    sections: [
      {
        heading: 'Who uses Remote365 in the US?',
        body: 'Typical users are:',
        points: [
          'Small businesses without an on-site IT person',
          'Managed service providers looking after many client machines',
          'Remote and hybrid teams reaching office computers from home',
          'Families supporting relatives in another state or another country',
        ],
      },
      {
        heading: 'How do MSPs keep client access separate?',
        body: 'Group each client’s devices, then grant device access per technician on top of their role. Pro adds device groups, per-member device access and a 30-day audit log; Business adds session recording, two-factor authentication enforced for everyone and a one-year audit log.',
      },
      {
        heading: 'How do you support people across US time zones?',
        body: 'A support session works the moment the other person shares a code. For machines nobody is sitting at, turn on unattended access and connect by device ID, whether it is morning in New York or evening in Los Angeles.',
      },
      {
        heading: 'What does it cost?',
        body: 'A 15-day free trial, then monthly plans in US dollars; see the pricing page for the current plans and what each includes.',
      },
    ],
    faqs: [
      {
        question: 'Is there a free trial?',
        answer: 'Yes. Every new workspace starts with a 15-day free trial, no credit card required.',
      },
      {
        question: 'Which devices are supported?',
        answer: `The ${PLATFORMS}.`,
      },
    ],
  },
  {
    slug: 'canada',
    name: 'Canada',
    ogLocale: 'en_CA',
    areaServed: 'Canada',
    metaTitle: 'Remote desktop software in Canada',
    metaDescription:
      'Remote365 is remote desktop and support software for Canada: support staff and clients from Toronto to Vancouver, reach unattended PCs by ID, and help family abroad, with monthly plans priced in US dollars.',
    h1: 'Remote desktop and remote support in Canada',
    answer:
      'Remote365 is a remote desktop app for teams and families in Canada. Support colleagues and clients with a one-time session code, reach your own computers unattended by device ID from any province, and help relatives in Pakistan, the Gulf or elsewhere, with end-to-end encrypted remote sessions.',
    timeZones: 'Newfoundland to Pacific time (UTC−3:30 to UTC−8, with daylight saving in most provinces)',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Mississauga'],
    sections: [
      {
        heading: 'How do Canadians use remote desktop?',
        body: 'Common uses are:',
        points: [
          'Small offices and clinics supported by an outside IT provider',
          'Teams spread across provinces and time zones',
          'People reaching their work computer from home',
          'Families helping parents in Pakistan, India or the Middle East with their phone or PC',
        ],
      },
      {
        heading: 'How do you help family overseas from Canada?',
        body: 'Toronto is 9–10 hours behind Pakistan and 7–9 hours behind the Gulf. Set up the Remote365 Host app on a parent’s Android phone, or Remote365 on their Windows PC, turn on unattended access, and help them in your evening while it is their morning.',
      },
      {
        heading: 'Do I need a VPN?',
        body: 'No. Devices connect out to Remote365, so there is no VPN, port forwarding or firewall change, at home or in the office.',
      },
      {
        heading: 'What does it cost?',
        body: 'Every workspace starts with a 15-day free trial. Plans are priced in US dollars and billed monthly.',
      },
    ],
    faqs: [
      {
        question: 'Can I control an Android phone?',
        answer: 'Yes. Install the Remote365 Host app on the phone you want to control, then connect from the Windows app, the Android app or a browser.',
      },
      {
        question: 'Which devices are supported?',
        answer: `The ${PLATFORMS}.`,
      },
    ],
  },
]

export function getRegion(slug: string): Region | undefined {
  return REGIONS.find(r => r.slug === slug)
}
