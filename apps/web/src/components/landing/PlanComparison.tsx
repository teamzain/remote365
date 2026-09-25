import { Check, Minus } from 'lucide-react'
import type { ApiPlan } from '@/lib/plans'

// "Compare plans" under the pricing cards, after Componentry's "pricing-02"
// feature table (componentry.dev, `shadcn add @componentry/pricing-02`),
// without its yearly/monthly switch: plans are monthly only. Every row is a
// limit the product enforces; nothing here is marketing copy.
//  - price, members, devices, concurrent sessions, audit log: live catalogue
//  - largest file per transfer and session recording: the enforced values in
//    packages/shared/src/plans.ts (FILE_TRANSFER_MAX_BYTES, PLAN_LIMITS);
//    the site cannot import that package, so keep these two in step with it.

const FILE_CAP: Record<string, string> = {
  TRIAL: '500 MB',
  SOLO: '2 GB',
  PRO: '5 GB',
  BUSINESS: '20 GB',
}
const RECORDING = new Set(['BUSINESS', 'ENTERPRISE'])

type Cell = string | boolean

const limit = (n: number | null) => (n == null ? 'Unlimited' : n.toLocaleString('en-US'))

const ROWS: { label: string; value: (p: ApiPlan) => Cell }[] = [
  {
    label: 'Price',
    value: p => (p.price === 'Custom' ? 'Custom' : p.price === 0 ? `Free for ${p.trialDays ?? 15} days` : `$${p.price} per month`),
  },
  { label: 'Members', value: p => limit(p.maxUsers) },
  { label: 'Devices', value: p => limit(p.maxDevices) },
  { label: 'Concurrent sessions', value: p => limit(p.maxConcurrentSessions) },
  { label: 'Largest file per transfer', value: p => FILE_CAP[p.id] ?? '—' },
  { label: 'Session recording', value: p => RECORDING.has(p.id) },
  {
    label: 'Audit log',
    value: p => {
      const d = p.auditRetentionDays
      if (d == null) return false
      if (d === 'Custom') return 'Custom'
      return d >= 365 && d % 365 === 0 ? `${d / 365} year${d === 365 ? '' : 's'}` : `${d} days`
    },
  },
]

function Value({ cell }: { cell: Cell }) {
  if (cell === true) return <Check size={18} className="pc-yes" role="img" aria-label="Included" />
  if (cell === false) return <Minus size={18} className="pc-no" role="img" aria-label="Not included" />
  return <>{cell}</>
}

export default function PlanComparison({ plans }: { plans: ApiPlan[] }) {
  return (
    <section className="pc" aria-labelledby="pc-heading">
      <h2 className="pc-heading" id="pc-heading">Compare plans</h2>
      <p className="pc-sub">
        Every plan includes support sessions, unattended access, file transfer, clipboard
        sync and meetings. The plans differ in these limits:
      </p>

      {/* Wide screens: one table */}
      <div className="pc-table-wrap">
        <table className="pc-table">
          <colgroup>
            <col style={{ width: '28%' }} />
            {plans.map(p => <col key={p.id} style={{ width: `${72 / plans.length}%` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col"><span className="pc-visually-hidden">Limit</span></th>
              {plans.map(p => (
                <th key={p.id} scope="col" className={p.popular ? 'is-popular' : undefined}>
                  {p.name}
                  {p.popular && <span className="pc-badge">Popular</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {plans.map(p => <td key={p.id} className={p.popular ? 'is-popular' : undefined}><Value cell={row.value(p)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per plan, no sideways scrolling */}
      <div className="pc-cards">
        {plans.map(p => (
          <div key={p.id} className={`pc-card${p.popular ? ' is-popular' : ''}`}>
            <h3 className="pc-card-title">{p.name}{p.popular && <span className="pc-badge">Popular</span>}</h3>
            <dl>
              {ROWS.map(row => (
                <div key={row.label} className="pc-card-row">
                  <dt>{row.label}</dt>
                  <dd><Value cell={row.value(p)} /></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <style>{`
        .pc {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px clamp(16px, 4vw, 40px) 24px;
          color: #fff;
        }
        .pc-heading { margin: 0; text-align: center; font-size: clamp(26px, 3vw, 34px); font-weight: 700; letter-spacing: -0.02em; }
        .pc-sub { margin: 10px auto 0; max-width: 640px; text-align: center; font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.66); }
        .pc-visually-hidden {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        .pc-table-wrap {
          margin-top: 28px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 12, 0.6);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          overflow: hidden;
        }
        .pc-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 15px; }
        .pc-table th, .pc-table td {
          padding: 14px 16px;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          overflow-wrap: anywhere;
        }
        .pc-table tbody tr:last-child th, .pc-table tbody tr:last-child td { border-bottom: 0; }
        .pc-table thead th { font-size: 16px; font-weight: 700; background: rgba(255, 255, 255, 0.03); }
        .pc-table tbody th { text-align: left; font-weight: 600; color: rgba(255, 255, 255, 0.78); }
        .pc-table td { color: #fff; font-weight: 500; }
        .pc-table .is-popular { background: rgba(255, 138, 0, 0.07); }
        .pc-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(255, 138, 0, 0.18);
          color: #ffb347;
          font-size: 11px;
          font-weight: 700;
          vertical-align: middle;
        }
        .pc-yes { color: #ff8a00; vertical-align: middle; }
        .pc-no { color: rgba(255, 255, 255, 0.3); vertical-align: middle; }
        .pc-cards { display: none; }
        @media (max-width: 720px) {
          .pc-table-wrap { display: none; }
          .pc-cards { display: grid; gap: 12px; margin-top: 24px; }
          .pc-card {
            padding: 18px;
            border-radius: 18px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(10, 10, 12, 0.6);
          }
          .pc-card.is-popular { border-color: rgba(255, 138, 0, 0.45); }
          .pc-card-title { margin: 0 0 10px; font-size: 18px; font-weight: 700; }
          .pc-card dl { margin: 0; }
          .pc-card-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.07);
            font-size: 14px;
          }
          .pc-card-row dt { color: rgba(255, 255, 255, 0.65); }
          .pc-card-row dd { margin: 0; font-weight: 600; text-align: right; }
        }
      `}</style>
    </section>
  )
}
