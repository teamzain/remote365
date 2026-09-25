'use client'

import React, { useState } from 'react'

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: 'Does Remote365 have a free trial?',
    answer: 'Yes — every new workspace starts with a 15-day free trial. The organization owner gets full access with three devices and the core remote support features, no credit card required.',
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

// Plus icon that turns into an × when the item is open
const PlusIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="20" height="20" viewBox="0 0 20 20" fill="none"
    style={{
      flexShrink: 0,
      transform: open ? 'rotate(45deg)' : 'none',
      transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
    }}
  >
    <line x1="10" y1="4.17" x2="10" y2="15.83" stroke="#111315" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="4.17" y1="10" x2="15.83" y2="10" stroke="#111315" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const FAQRow: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="faq-item" onClick={() => setOpen(o => !o)}>
      <div className="faq-item-head">
        <span className="faq-question">{question}</span>
        <PlusIcon open={open} />
      </div>
      {open && <p className="faq-answer">{answer}</p>}
    </div>
  )
}

const PricingFAQ: React.FC = () => (
  <section style={{ padding: '78px clamp(20px, 4vw, 40px) 100px' }}>
    <div className="faq-container">

      <div className="faq-heading">
        <h2 className="faq-title">Frequently Asked Questions</h2>
        <p className="faq-subtitle">
          Everything you need to know about Remote365 plans and billing.
        </p>
      </div>

      <div className="faq-list">
        {FAQ_ITEMS.map(item => (
          <FAQRow key={item.question} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>

    <style>{`
      .faq-container {
        display: flex;
        flex-direction: column;
        gap: 32px;
        width: 100%;
        max-width: 950px;
        margin: 0 auto;
      }
      .faq-heading {
        display: flex;
        flex-direction: column;
        gap: 10px;
        text-align: center;
      }
      .faq-title {
        margin: 0;
        font-weight: 700;
        font-size: 32px;
        line-height: 45px;
        color: #111315;
      }
      .faq-subtitle {
        margin: 0;
        font-weight: 400;
        font-size: 18px;
        line-height: 25px;
        color: rgba(26, 29, 33, 0.8);
      }
      .faq-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .faq-item {
        padding: 20px;
        background: #F3F4F6;
        border-radius: 4px;
        cursor: pointer;
      }
      .faq-item-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
      }
      .faq-question {
        font-weight: 500;
        font-size: 18px;
        line-height: 25px;
        color: #111315;
      }
      .faq-answer {
        margin: 24px 0 0;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: rgba(17, 19, 21, 0.8);
      }
      @media (max-width: 640px) {
        .faq-title { font-size: 26px; line-height: 36px; }
        .faq-question { font-size: 16px; line-height: 23px; }
      }
    `}</style>
  </section>
)

export default PricingFAQ
