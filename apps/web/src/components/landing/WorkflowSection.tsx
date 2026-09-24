import React from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'

const TerminalMockup: React.FC = () => (
  <div style={{
    width: '100%',
    height: '215px',
    background: '#343433',
    overflow: 'hidden',
    display: 'flex',
    gap: 0,
  }}>
    <div style={{ flex: '0 0 65%', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
          <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
        ))}
      </div>
      <div style={{ color: '#787676', fontSize: '11px', fontFamily: 'monospace' }}>Remote365 — Session Log</div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <span style={{ color: '#B2D862', fontSize: '12px', fontFamily: 'monospace' }}>→</span>
        <span style={{ color: '#E7E3E0', fontSize: '12px', fontFamily: 'monospace' }}>Connecting to  482-761-903</span>
      </div>
      <div style={{ color: '#C0AAFF', fontSize: '12px', fontFamily: 'monospace' }}>Authenticating device...</div>
      <div style={{ color: '#28C840', fontSize: '12px', fontFamily: 'monospace' }}>Session established. E2E encrypted.</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <span style={{ color: '#B2D862', fontSize: '12px', fontFamily: 'monospace' }}>→</span>
        <span style={{ color: '#E7E3E0', fontSize: '12px', fontFamily: 'monospace' }}>Devices online</span>
      </div>
      <div style={{ color: '#E7E3E0', fontSize: '12px', fontFamily: 'monospace', opacity: 0.7 }}>482-761-903  John's MacBook Pro   ● online</div>
      <div style={{ color: '#E7E3E0', fontSize: '12px', fontFamily: 'monospace', opacity: 0.7 }}>219-045-887  Office Desktop Win   ● online</div>
    </div>
    <div style={{ flex: 1, opacity: 0.08, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '16px' }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ background: '#DEE8F6', borderRadius: '4px' }} />
      ))}
    </div>
  </div>
)

const DeviceMockup: React.FC = () => (
  <div style={{
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  }}>
    <div style={{
      width: '100%',
      maxWidth: '320px',
      background: '#F3F4F6',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
    }}>
      <div style={{ background: '#E6E4E2', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
          <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#787676', fontFamily: "'Mona Sans', sans-serif" }}>Remote365</span>
      </div>
      <div style={{ display: 'flex', height: '240px' }}>
        <div style={{ width: '60px', background: '#F0EDEA', borderRight: '1px solid #E0DDD9', display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0', alignItems: 'center' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: '28px', height: '28px', borderRadius: '6px', background: i === 1 ? '#487961' : '#D8D4CF' }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ height: '10px', background: '#111315', borderRadius: '3px', width: '60%' }} />
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px', borderRadius: '6px',
              background: i === 0 ? 'rgba(72, 121, 97, 0.12)' : 'transparent',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#487961', flexShrink: 0 }} />
              <div style={{ height: '8px', background: '#D0CCC8', borderRadius: '3px', flex: 1 }} />
              <div style={{ height: '8px', background: '#487961', borderRadius: '3px', width: '40px', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const WorkflowSection: React.FC = () => (
  <section style={{ background: '#FFFFFF' }}>
    <div className="workflow-container">

      {/* Left: dark integration card */}
      <div className="workflow-left">
        <div style={{ padding: 'clamp(28px, 4vw, 50px)' }}>
          <h3 style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: 'clamp(22px, 2.5vw, 36px)',
            lineHeight: '1.17',
            letterSpacing: '-0.72px',
            color: '#FFFFFF',
            margin: '0 0 24px 0',
          }}>
            Fits into your preferred workflow
          </h3>

          <p style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 400,
            fontSize: 'clamp(15px, 1.5vw, 20px)',
            lineHeight: '1.35',
            letterSpacing: '-0.4px',
            color: 'rgba(255, 255, 255, 0.7)',
            margin: '0 0 32px 0',
          }}>
            Remote365 integrates with your helpdesk, ticketing, and monitoring tools. Deploy to devices silently via MDM, manage access by team or role, and get full session audit logs for compliance.
          </p>

          <a href="#" style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#FFFFFF',
                border: '1px solid #FFFFFF',
                borderRadius: '8px',
                padding: '0 16px',
                height: '41px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                letterSpacing: '-0.16px',
                color: '#111315',
              }}>
                See docs
              </span>
              <ArrowRight size={16} color="#111315" />
            </div>
          </a>
        </div>

        <div style={{ flex: 1 }} />
        <TerminalMockup />
      </div>

      {/* Right: green device card + guides */}
      <div className="workflow-right">
        <div style={{
          background: '#FF8A00',
          borderRadius: '12px',
          height: '380px',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <DeviceMockup />
        </div>

        <div>
          <p style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: '16px',
            lineHeight: '24px',
            letterSpacing: '-0.16px',
            textTransform: 'uppercase',
            color: '#000000',
            margin: '0 0 8px 0',
          }}>
            Guides
          </p>

          <h3 style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 500,
            fontSize: '24px',
            lineHeight: '34px',
            letterSpacing: '-0.48px',
            color: '#000000',
            margin: '0 0 20px 0',
          }}>
            Remote365 quickstart guide
          </h3>

          <a href="#" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
          }}>
            <span style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 500,
              fontSize: '16px',
              lineHeight: '23px',
              letterSpacing: '-0.17px',
              color: '#000000',
            }}>
              Read guide
            </span>
            <ExternalLink size={17} color="#000000" />
          </a>
        </div>
      </div>

    </div>

    <style>{`
      .workflow-container {
        max-width: 1360px;
        margin: 0 auto;
        padding: clamp(60px, 8vw, 112px) clamp(20px, 6vw, 80px);
        display: flex;
        gap: 32px;
        align-items: stretch;
      }
      .workflow-left {
        flex: 1;
        background: #242424;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-height: 480px;
      }
      .workflow-right {
        width: 360px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 32px;
      }
      @media (max-width: 900px) {
        .workflow-container {
          flex-direction: column;
        }
        .workflow-right {
          width: 100%;
        }
      }
    `}</style>
  </section>
)

export default WorkflowSection
