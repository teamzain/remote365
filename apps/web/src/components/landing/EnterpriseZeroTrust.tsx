import React from 'react'

// ── Zero-Trust shield icon (#DEE8F6 / #15315B / #678AC0) ─────────────────────
const ZeroTrustIcon: React.FC = () => (
  <svg width="57" height="57" viewBox="0 0 57 57" fill="none">
    {/* Shield body */}
    <path
      d="M28.5 3L6 12v16c0 13.2 9.6 25.5 22.5 28.5C41.4 53.5 51 41.2 51 28V12L28.5 3z"
      fill="#DEE8F6"
    />
    {/* Inner shield accent */}
    <path
      d="M28.5 10L13 17.5V28c0 8.8 6.4 17 15.5 19C37.6 45 44 36.8 44 28v-10.5L28.5 10z"
      fill="#678AC0"
      opacity="0.5"
    />
    {/* Lock body */}
    <rect x="20" y="29" width="17" height="13" rx="3" fill="#15315B" />
    {/* Lock shackle */}
    <path
      d="M22 29v-4a6.5 6.5 0 0 1 13 0v4"
      stroke="#15315B" strokeWidth="2.5" fill="none" strokeLinecap="round"
    />
    {/* Lock keyhole */}
    <circle cx="28.5" cy="35" r="2" fill="#DEE8F6" />
    <rect x="27.5" y="35" width="2" height="3" fill="#DEE8F6" />
  </svg>
)

// ── Decorative background graphic for stat cards ───────────────────────────────
// Two vertical bars (from #E6E4E2 spec vectors) positioned in the card's top-right
const CardDecorLeft: React.FC = () => (
  <svg width="143" height="157" viewBox="0 0 143 157" fill="none" style={{ display: 'block' }}>
    <rect x="0"   y="0"  width="55" height="163" rx="8" fill="#E6E4E2" opacity="0.7" />
    <rect x="91"  y="0"  width="75" height="163" rx="8" fill="#E6E4E2" opacity="0.7" />
  </svg>
)

const CardDecorCenter: React.FC = () => (
  <svg width="143" height="157" viewBox="0 0 143 157" fill="none" style={{ display: 'block' }}>
    <rect x="0"   y="60"  width="150" height="96" rx="8" fill="#E6E4E2" opacity="0.7" />
    <rect x="0"   y="-35" width="150" height="92" rx="8" fill="#E6E4E2" opacity="0.7" />
  </svg>
)

const CardDecorRight: React.FC = () => (
  <svg width="143" height="157" viewBox="0 0 143 157" fill="none" style={{ display: 'block' }}>
    <rect x="0"   y="0"  width="58" height="163" rx="8" fill="#E6E4E2" opacity="0.7" />
    <rect x="82"  y="15" width="80" height="127" rx="8" fill="#E6E4E2" opacity="0.7" />
  </svg>
)

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  value: string
  label: string
  Decor: React.FC
}

const StatCard: React.FC<StatCardProps> = ({ value, label, Decor }) => (
  <div
    style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      padding: '32px 25px 33px',
      gap: '12px',
      flex: 1,
      minWidth: '300px',
      background: '#F3F4F6',
      border: '1px solid #F3F4F6',
      borderRadius: '12px',
      overflow: 'hidden',
      isolation: 'isolate',
    }}
  >
    {/* Decorative background graphic — right side */}
    <div
      style={{
        position: 'absolute',
        top: '1px',
        right: '0',
        bottom: '1px',
        width: '143px',
        display: 'flex',
        alignItems: 'center',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Decor />
    </div>

    {/* Stat number */}
    <div style={{ position: 'relative', zIndex: 1 }}>
      <span
        style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: '48px',
          lineHeight: '57px',
          letterSpacing: '-0.96px',
          color: '#000000',
        }}
      >
        {value}
      </span>
    </div>

    {/* Label */}
    <div style={{ position: 'relative', zIndex: 2 }}>
      <span
        style={{
          fontFamily: "'Mona Sans', sans-serif",
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: '24px',
          letterSpacing: '-0.16px',
          color: '#000000',
        }}
      >
        {label}
      </span>
    </div>
  </div>
)

// ── Main component ─────────────────────────────────────────────────────────────
const EnterpriseZeroTrust: React.FC = () => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '112px 40px',
      background: '#FFFFFF',
    }}
  >
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '0 40px',
        width: '100%',
        maxWidth: '1280px',
      }}
    >
      <div style={{ width: '100%' }}>

        {/* ── Icon ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <ZeroTrustIcon />
        </div>

        {/* ── Heading + body copy ───────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '25px',
            padding: '0 218px',
            marginBottom: '112px',
          }}
        >
          <h2
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 500,
              fontSize: '48px',
              lineHeight: '57px',
              letterSpacing: '-0.96px',
              color: '#000000',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Built for Zero Trust
          </h2>

          <p
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
              letterSpacing: '-0.18px',
              color: 'rgba(26, 29, 33, 0.65)',
              margin: 0,
              textAlign: 'center',
              maxWidth: '844px',
            }}
          >
            Enforce identity-based controls across your organization to authenticate, authorize, and
            verify every connection throughout your private network. Remote365 integrates with leading
            identity providers to automate the provisioning of users, roles, and groups to allow
            seamless enforcement of core principles like continuous verification and least-privilege
            access.
          </p>
        </div>

        {/* ── "We help customers…" subtitle ────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p
            style={{
              fontFamily: "'Mona Sans', sans-serif",
              fontWeight: 500,
              fontSize: '24px',
              lineHeight: '34px',
              letterSpacing: '-0.48px',
              color: 'rgba(26, 29, 33, 0.8)',
              margin: 0,
            }}
          >
            We help customers build secure, private networks.
          </p>
        </div>

        {/* ── Stat cards ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '24px',
          }}
        >
          <StatCard value="4,000+"    label="companies"            Decor={CardDecorLeft}   />
          <StatCard value="100,000+"  label="monthly active users" Decor={CardDecorCenter} />
          <StatCard value="2.5M+"     label="active devices"       Decor={CardDecorRight}  />
        </div>

      </div>
    </div>
  </section>
)

export default EnterpriseZeroTrust
