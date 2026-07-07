import type { CoachEra } from '../../coach'
import type { DynastyState } from '../../dynasty'
import './DynastyTimeline.css'

interface DynastyTimelineProps {
  dynasty: DynastyState
  /** Closed coaching eras + whoever holds the clipboard now — the era is the retellable unit. */
  eras: CoachEra[]
  currentCoachName: string
  currentEraShields: number
}

/**
 * The dynasty's arc at a glance: every year as a chip (shield or scar), and the coaching eras that
 * carve the run into chapters — "the Slater era: 3 years, 2 shields" is how a dynasty gets retold.
 */
export function DynastyTimeline({ dynasty, eras, currentCoachName, currentEraShields }: DynastyTimelineProps) {
  return (
    <section className="dynasty-timeline" aria-label="Dynasty timeline">
      <div className="dynasty-strip">
        {dynasty.years.map((y) => (
          <span
            key={y.year}
            className={`year-chip ${y.seriesWinner === 'QLD' ? 'win' : 'loss'}`}
            title={`${y.year}: ${y.seriesScore.qld}–${y.seriesScore.nsw}${y.retained ? ' (retained)' : ''}`}
          >
            ’{String(y.year).slice(2)} {y.seriesWinner === 'QLD' ? '🛡' : '·'}
          </span>
        ))}
        <span className="year-now">
          {dynasty.currentYear} · season {dynasty.currentYear - dynasty.startYear + 1}
        </span>
      </div>

      {(eras.length > 0 || dynasty.years.length > 0) && (
        <div className="era-rows">
          {eras.map((e) => (
            <div key={`${e.coachId}-${e.toYear}`} className="era-row closed">
              <span className="era-name">{e.coachName}</span>
              <span className="era-span">
                {e.fromYear}–{e.toYear} · {e.seasons} {e.seasons === 1 ? 'season' : 'seasons'} · {e.shields} 🛡
              </span>
            </div>
          ))}
          <div className="era-row current">
            <span className="era-name">{currentCoachName}</span>
            <span className="era-span">
              the current era · {currentEraShields} 🛡
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
