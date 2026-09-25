'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { API_URL } from '@/lib/env'

// "Which app should we build next?" on the Downloads page, after Cult UI's
// "Feature Voting" (cult-ui.com): one vote per browser, results shown after
// voting, and the choice can be changed. Backed by
// /api/support/platform-votes in auth-service. Counts are real; nothing is
// seeded.

type Platform = 'macos' | 'ios' | 'linux'

const OPTIONS: { id: Platform; name: string; note: string }[] = [
  { id: 'macos', name: 'macOS', note: 'Remote365 for Mac' },
  { id: 'ios', name: 'iOS', note: 'iPhone and iPad' },
  { id: 'linux', name: 'Linux', note: 'Linux desktops' },
]

interface Tally {
  counts: Record<Platform, number>
  total: number
  yourVote: Platform | null
}

const ENDPOINT = `${API_URL}/api/support/platform-votes`
const VOTER_KEY = 'remote365_voter_id'

function voterId(): string | null {
  try {
    let id = localStorage.getItem(VOTER_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VOTER_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export default function PlatformVote() {
  const [tally, setTally] = useState<Tally | null>(null)
  const [changing, setChanging] = useState(false)
  const [pending, setPending] = useState<Platform | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A returning visitor sees their earlier vote and the results.
  useEffect(() => {
    const id = voterId()
    if (!id) return
    let cancelled = false
    fetch(`${ENDPOINT}?voterId=${encodeURIComponent(id)}`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: Tally | null) => { if (!cancelled && data?.yourVote) setTally(data) })
      .catch(() => { /* the options still work */ })
    return () => { cancelled = true }
  }, [])

  const vote = async (platform: Platform) => {
    const id = voterId()
    if (!id) { setError('Your browser blocked storage, so the vote could not be saved.'); return }
    setPending(platform)
    setError(null)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, voterId: id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not save your vote.')
      setTally(data as Tally)
      setChanging(false)
    } catch (err) {
      setError((err as Error).message || 'Could not save your vote. Please try again.')
    } finally {
      setPending(null)
    }
  }

  const showResults = tally && !changing

  return (
    <section className="pv" aria-labelledby="pv-heading">
      <h2 className="pv-heading" id="pv-heading">Which app should we build next?</h2>
      <p className="pv-sub">
        Apps for macOS and iOS are on the way. Tell us which one you need first, or ask for Linux.
      </p>

      {showResults ? (
        <div className="pv-results" aria-live="polite">
          {OPTIONS.map(o => {
            const n = tally.counts[o.id] ?? 0
            const pct = tally.total ? Math.round((n / tally.total) * 100) : 0
            const mine = tally.yourVote === o.id
            return (
              <div key={o.id} className={`pv-result${mine ? ' is-mine' : ''}`}>
                <div className="pv-result-top">
                  <span>{o.name}{mine && <span className="pv-mine">Your vote</span>}</span>
                  <span>{pct}%</span>
                </div>
                <div className="pv-bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
          <p className="pv-total">
            {tally.total.toLocaleString('en-US')} {tally.total === 1 ? 'vote' : 'votes'} so far.{' '}
            <button type="button" className="pv-change" onClick={() => setChanging(true)}>Change my vote</button>
          </p>
        </div>
      ) : (
        <div className="pv-options">
          {OPTIONS.map(o => (
            <button
              key={o.id}
              type="button"
              className={`pv-option${tally?.yourVote === o.id ? ' is-mine' : ''}`}
              onClick={() => vote(o.id)}
              disabled={pending !== null}
              aria-pressed={tally?.yourVote === o.id}
            >
              <span className="pv-option-name">{o.name}</span>
              <span className="pv-option-note">{o.note}</span>
              {pending === o.id && <Loader2 size={16} className="pv-spin" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {error && <p className="pv-error" role="alert">{error}</p>}

      <style>{`
        .pv {
          max-width: 760px;
          margin: 0 auto;
          padding: clamp(40px, 6vw, 72px) clamp(16px, 4vw, 40px) clamp(64px, 8vw, 96px);
          text-align: center;
          color: #fff;
        }
        .pv-heading { margin: 0; font-size: clamp(24px, 3vw, 34px); font-weight: 700; letter-spacing: -0.02em; }
        .pv-sub { margin: 10px 0 0; font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.66); }
        .pv-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
        .pv-option {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 18px 12px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          font: inherit;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }
        .pv-option:hover:not(:disabled) { border-color: rgba(255, 138, 0, 0.6); background: rgba(255, 255, 255, 0.08); transform: translateY(-1px); }
        .pv-option:focus-visible { outline: 2px solid #ff8a00; outline-offset: 2px; }
        .pv-option:disabled { cursor: default; opacity: 0.7; }
        .pv-option.is-mine { border-color: rgba(255, 138, 0, 0.7); }
        .pv-option-name { font-size: 17px; font-weight: 700; }
        .pv-option-note { font-size: 13px; color: rgba(255, 255, 255, 0.6); }
        .pv-spin { position: absolute; top: 10px; right: 10px; animation: pvSpin 0.9s linear infinite; }
        @keyframes pvSpin { to { transform: rotate(360deg); } }
        .pv-results { display: flex; flex-direction: column; gap: 14px; margin: 24px auto 0; max-width: 520px; text-align: left; }
        .pv-result-top { display: flex; justify-content: space-between; font-size: 15px; font-weight: 600; }
        .pv-mine {
          margin-left: 8px;
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(255, 138, 0, 0.18);
          color: #ffb347;
          font-size: 11px;
          font-weight: 700;
        }
        .pv-bar { height: 10px; margin-top: 6px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
        .pv-bar span { display: block; height: 100%; border-radius: 9999px; background: rgba(255, 255, 255, 0.35); transition: width 0.6s ease; }
        .pv-result.is-mine .pv-bar span { background: linear-gradient(90deg, #ff8a00, #ffb347); }
        .pv-total { margin: 4px 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.6); text-align: center; }
        .pv-change {
          border: 0;
          background: none;
          padding: 0;
          color: #ff8a00;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }
        .pv-change:hover { text-decoration: underline; }
        .pv-error { margin: 14px 0 0; font-size: 14px; color: #fca5a5; }
        @media (max-width: 480px) {
          .pv-options { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </section>
  )
}
