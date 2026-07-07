import type { BoardOutcome } from '../../coach'
import type { OffseasonReport } from '../../dynasty'
import { Wordmark } from '../components/Wordmark'
import './OffseasonScreen.css'

interface OffseasonScreenProps {
  report: OffseasonReport
  /** The board's annual review — a survival line, or the sacking and the succession. */
  board?: BoardOutcome | null
  onContinue: () => void
}

/**
 * The off-season — the dynasty's theatre. The season just ended hardens into history here:
 * the men who bow out get their farewell, the summer's movers get a line, and the era gets
 * its scoreboard before the next campaign opens.
 */
export function OffseasonScreen({ report, board, onContinue }: OffseasonScreenProps) {
  return (
    <div className="app-shell offseason-screen">
      <Wordmark sub="Off-season" />
      <header className="offseason-header">
        <p className="offseason-kicker">The {report.endedYear} season is in the books</p>
        <h1 className="offseason-title">THE OFF-SEASON</h1>
        <p className="offseason-era">{report.eraLine}</p>
      </header>

      {board && (
        <section className={`board-verdict ${board.sacked ? 'sacked' : ''}`} aria-label="Board review">
          <div className="board-verdict-label">{board.sacked ? '⚫ THE BOARD HAS ACTED' : 'The board meets'}</div>
          <p className="board-verdict-line">{board.statement}</p>
          {board.sacked && board.era && board.successor && (
            <>
              <p className="board-era-line">
                The {board.era.coachName} era: {board.era.fromYear}–{board.era.toYear} · {board.era.seasons}{' '}
                {board.era.seasons === 1 ? 'season' : 'seasons'} · {board.era.shields}{' '}
                {board.era.shields === 1 ? 'shield' : 'shields'}
              </p>
              <p className="board-successor">
                Incoming: <strong>{board.successor.name}</strong> — {board.successor.billing}.
              </p>
            </>
          )}
        </section>
      )}

      {report.retirements.length > 0 ? (
        <section className="offseason-retirements" aria-label="Retirements">
          <h2>Hanging up the boots</h2>
          {report.retirements.map((r) => (
            <div key={r.id} className="retirement-card">
              <div className="retirement-name">
                {r.name} <span className="retirement-meta">· {r.position} · {r.age}</span>
              </div>
              <p className="retirement-farewell">{r.farewell}</p>
            </div>
          ))}
        </section>
      ) : (
        <p className="offseason-quiet">No retirements this summer — the whole squad goes around again.</p>
      )}

      {report.rookieClass.length > 0 && (
        <section className="offseason-rookies" aria-label="Rookie class">
          <h2>The next generation</h2>
          {report.rookieClass.map((r) => (
            <div key={r.id} className="rookie-card">
              <div className="rookie-name">
                {r.name} <span className="rookie-meta">· {r.age} · {r.club} · {r.positions}</span>
              </div>
              <p className="rookie-note">{r.note}</p>
            </div>
          ))}
        </section>
      )}

      {(report.nswRetirements.length > 0 || report.nswCoachLine) && (
        <section className="offseason-nsw" aria-label="Across the border">
          <h2>Across the border</h2>
          {report.nswRetirements.map((r) => (
            <p key={r.name} className="nsw-change">
              <strong>{r.name}</strong> retires at {r.age} — the Blues blood <strong>{r.replacedBy}</strong> in his place.
            </p>
          ))}
          {report.nswCoachLine && <p className="nsw-change coach">{report.nswCoachLine}</p>}
        </section>
      )}

      {(report.risers.length > 0 || report.faders.length > 0) && (
        <section className="offseason-movers" aria-label="Summer form">
          <h2>The summer</h2>
          <div className="movers-cols">
            {report.risers.length > 0 && (
              <div className="movers-col">
                <div className="movers-label up">On the rise</div>
                {report.risers.map((m) => (
                  <p key={m.name}>
                    <strong>{m.name}</strong> — {m.note}
                  </p>
                ))}
              </div>
            )}
            {report.faders.length > 0 && (
              <div className="movers-col">
                <div className="movers-label down">Feeling the miles</div>
                {report.faders.map((m) => (
                  <p key={m.name}>
                    <strong>{m.name}</strong> — {m.note}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="offseason-actions">
        <button className="btn-primary" onClick={onContinue}>
          Begin the {report.nextYear} campaign
        </button>
      </div>
    </div>
  )
}
