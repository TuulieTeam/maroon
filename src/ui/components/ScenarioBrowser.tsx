import { SCENARIOS, TIER_LABELS, TIER_ORDER } from '../../scenarios'
import type { ScenarioDef, ScenarioLedger } from '../../scenarios'
import './ScenarioBrowser.css'

interface ScenarioBrowserProps {
  ledger: ScenarioLedger
  onPlay: (def: ScenarioDef) => void
}

/**
 * The scenario library on the hub — "This Day in Origin". Every scenario is visible with its win
 * condition (the hint IS the pull, the FeatCabinet stance); conquered ones wear the date and the
 * detail. No locks, no gating: pick a fight with history whenever you like.
 */
export function ScenarioBrowser({ ledger, onPlay }: ScenarioBrowserProps) {
  const done = Object.values(ledger.entries).filter((e) => e.firstDone).length
  return (
    <section className="scenario-browser" aria-labelledby="scenario-browser-title">
      <div className="scenario-browser-head">
        <h2 id="scenario-browser-title">This Day in Origin</h2>
        <span className="scenario-browser-tally">
          {done}/{SCENARIOS.length} conquered
        </span>
      </div>
      <p className="scenario-browser-sub">
        Pinned matches, retryable forever — the same game every time. The only variable is your 19.
      </p>
      {TIER_ORDER.map((tier) => {
        const defs = SCENARIOS.filter((s) => s.tier === tier)
        if (defs.length === 0) return null
        return (
          <div key={tier} className="scenario-tier">
            <h3 className={`scenario-tier-label tier-${tier}`}>{TIER_LABELS[tier]}</h3>
            <ul className="scenario-list">
              {defs.map((def) => {
                const entry = ledger.entries[def.id]
                const conquered = Boolean(entry?.firstDone)
                return (
                  <li key={def.id} className={`scenario-row ${conquered ? 'is-done' : ''}`}>
                    <div className="scenario-row-main">
                      <span className="scenario-row-title">
                        {conquered ? '✓ ' : ''}
                        {def.title}
                      </span>
                      <span className="scenario-row-goal">🎯 {def.winLabel}</span>
                      {conquered ? (
                        <span className="scenario-row-record">
                          Conquered {entry!.firstDone}
                          {entry!.bestDetail ? ` · ${entry.bestDetail}` : ''}
                          {entry!.attempts > 1 ? ` · ${entry.attempts} attempts` : ' · first attempt'}
                        </span>
                      ) : entry && entry.attempts > 0 ? (
                        <span className="scenario-row-record">
                          {entry.attempts} {entry.attempts === 1 ? 'attempt' : 'attempts'} — still standing
                        </span>
                      ) : null}
                    </div>
                    <button className="btn-ghost scenario-row-play" onClick={() => onPlay(def)}>
                      {conquered ? 'Replay' : 'Take it on'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
