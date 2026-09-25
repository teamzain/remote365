import React from 'react'
import { MonitorSmartphone, ShieldCheck, Zap } from 'lucide-react'
import ScrollSplitCard, { type ScrollSplitCardItem } from './ScrollSplitCard'
import splitImage from '../../assets/landing/split-card.jpg'

const ICON = { size: 28, strokeWidth: 1.75 } as const

// Light, brand orange and dark backs, echoing the component's original
// three-tone set. Text is near-black on the two light cards: white on
// #FF8A00 is too low-contrast for body copy.
const CARDS: ScrollSplitCardItem[] = [
  {
    title: 'Up in minutes',
    description: 'Install Remote365, register your device, and start accepting remote connections — no IT department needed.',
    bgColor: '#EDEDED',
    textColor: '#111315',
    icon: <Zap {...ICON} />,
  },
  {
    title: 'Any device, any OS',
    description: 'Remote365 runs on Windows, macOS, Linux, iOS, and Android. Access and support devices across every platform.',
    bgColor: '#FF8A00',
    textColor: '#111315',
    icon: <MonitorSmartphone {...ICON} />,
  },
  {
    title: 'Secure by design',
    description: 'End-to-end encrypted sessions, role-based access, and forced two-factor authentication keep every device safe.',
    bgColor: '#141416',
    textColor: '#FFFFFF',
    icon: <ShieldCheck {...ICON} />,
  },
]

// "Simple, Powerful, and Reliable": a photo of Remote365 in use that splits
// into three panels and flips over to the three reasons as you scroll.
// Scroll-driven and several screens tall, so it must not sit inside a
// ScrollReveal (that would hide it until it was 15% in view).
const SimpleReliableSection: React.FC = () => (
  <section className="sr-section">
    <ScrollSplitCard
      imageSrc={splitImage}
      cards={CARDS}
      intro={<span className="sr-eyebrow">Why Remote365</span>}
      outro={<h2 className="sr-heading">Simple, Powerful, and Reliable</h2>}
    />

    <style>{`
      .sr-eyebrow {
        display: inline-block;
        margin-bottom: 24px; /* on top of the component's gap above the image */
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: rgba(255, 255, 255, 0.8);
      }
      .sr-heading {
        margin: 0;
        padding: 0 16px;
        font-weight: 600;
        font-size: clamp(2rem, 4.5vw, 55px);
        line-height: 1.2;
        letter-spacing: -0.02em;
        background-image: linear-gradient(180deg, #ffffff 0%, #b8bec8 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
    `}</style>
  </section>
)

export default SimpleReliableSection
