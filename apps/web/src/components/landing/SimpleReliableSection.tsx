import React from 'react'

interface FeatureCard {
  image: string
  title: string
  description: string
}

// Illustrations are the unDraw exports named in the design. Drop the SVGs into
// apps/web/public/ with these filenames and they render automatically.
const CARDS: FeatureCard[] = [
  {
    image: '/111.png',
    title: 'Up in minutes',
    description: 'Install Remote365, register your device, and start accepting remote connections — no IT department needed.',
  },
  {
    image: '/222.png',
    title: 'Any device, any OS',
    description: 'Remote365 runs on Windows, macOS, Linux, iOS, and Android. Access and support devices across every platform.',
  },
  {
    image: '/333.png',
    title: 'Secure by design',
    description: 'End-to-end encrypted sessions, role-based access, and forced two-factor authentication keep every device safe.',
  },
]

const SimpleReliableSection: React.FC = () => (
  <section className="sr-section">
    <h2 className="sr-heading">Simple, Powerful, and Reliable</h2>

    <div className="sr-cards">
      {CARDS.map(card => (
        <div key={card.title} className="sr-card">
          <div className="sr-illustration">
            <img src={card.image} alt="" />
          </div>
          <div className="sr-card-text">
            <h3 className="sr-card-title">{card.title}</h3>
            <p className="sr-card-desc">{card.description}</p>
          </div>
        </div>
      ))}
    </div>

    <style>{`
      .sr-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 58px;
        padding: 36px clamp(20px, 8vw, 123px);
        background: #FFFFFF;
      }
      .sr-heading {
        margin: 0;
        max-width: 1440px;
        font-weight: 600;
        font-size: clamp(2rem, 4.5vw, 55px);
        line-height: 1.42;
        text-align: center;
        color: #1A1D21;
      }
      .sr-cards {
        display: flex;
        justify-content: center;
        align-items: stretch;
        flex-wrap: wrap;
        gap: 38px;
        width: 100%;
        max-width: 1440px;
      }
      .sr-card {
        flex: 1 1 340px;
        max-width: 390px;
        min-height: 390px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 45px;
        padding: 24px;
        border: 1px solid rgba(26, 29, 33, 0.3);
        border-radius: 4px;
      }
      .sr-illustration {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 170px;
      }
      .sr-illustration img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .sr-card-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        width: 100%;
        max-width: 328px;
      }
      .sr-card-title {
        margin: 0;
        font-weight: 500;
        font-size: 24px;
        line-height: 34px;
        text-align: center;
        color: #000000;
      }
      .sr-card-desc {
        margin: 0;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        color: #000000;
      }

      @media (max-width: 640px) {
        .sr-section { gap: 40px; padding: 36px 20px; }
        .sr-card { min-height: 0; padding: 32px 24px; gap: 32px; }
      }
    `}</style>
  </section>
)

export default SimpleReliableSection
