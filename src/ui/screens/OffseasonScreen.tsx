import type { OffseasonReport } from '../../dynasty'
import './OffseasonScreen.css'

interface OffseasonScreenProps {
  report: OffseasonReport
  onContinue: () => void
}

/**
 * The off-season — the dynasty's theatre. The season just ended hardens into history here:
 * the men who bow out get their farewell, the summer's movers get a line, and the era gets
 * its scoreboard before the next campaign opens.
 */
export function OffseasonScreen({ report, onContinue }: OffseasonScreenProps) {
  return (
    <div className="app-shell offseason-screen">
      <header className="offseason-header">
        <p className="offseason-kicker">The {report.endedYear} season is in the books</p>
        <h1 className="offseason-title">THE OFF-SEASON</h1>
        <p className="offseason-era">{report.eraLine}</p>
      </header>

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
