import React from 'react'
import type { Faq } from '@/content/faq'

// Plus icon that turns into an × when the item is open (CSS, see below).
const PlusIcon: React.FC = () => (
  <svg className="faq-plus" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <line x1="10" y1="4.17" x2="10" y2="15.83" stroke="#111315" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="4.17" y1="10" x2="15.83" y2="10" stroke="#111315" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

interface FaqListProps {
  items: Faq[]
  title?: string
  subtitle?: string
  /** Heading id, for in-page links (e.g. /faq#security). */
  id?: string
}

// Question-and-answer list on native <details>: the answers are in the HTML
// (search engines and AI assistants read them), it works without JavaScript,
// and keyboard and screen-reader support come with the element.
const FaqList: React.FC<FaqListProps> = ({ items, title = 'Frequently Asked Questions', subtitle, id }) => (
  <section className="faq-section" aria-labelledby={id ? `${id}-title` : undefined}>
    <div className="faq-container">

      <div className="faq-heading">
        <h2 className="faq-title" id={id ? `${id}-title` : undefined}>{title}</h2>
        {subtitle && <p className="faq-subtitle">{subtitle}</p>}
      </div>

      <div className="faq-list">
        {items.map(item => (
          <details key={item.question} className="faq-item">
            <summary className="faq-item-head">
              <h3 className="faq-question">{item.question}</h3>
              <PlusIcon />
            </summary>
            <p className="faq-answer">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>

    <style>{`
      .faq-section {
        padding: 78px clamp(20px, 4vw, 40px) 100px;
      }
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
      }
      .faq-item-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        cursor: pointer;
        list-style: none;
      }
      .faq-item-head::-webkit-details-marker { display: none; }
      .faq-item-head:focus-visible {
        outline: 2px solid #ff8a00;
        outline-offset: 6px;
        border-radius: 4px;
      }
      .faq-question {
        margin: 0;
        font-weight: 500;
        font-size: 18px;
        line-height: 25px;
        color: #111315;
      }
      .faq-plus {
        flex-shrink: 0;
        transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .faq-item[open] .faq-plus { transform: rotate(45deg); }
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

export default FaqList
