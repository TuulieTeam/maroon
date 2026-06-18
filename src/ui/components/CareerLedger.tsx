import type { CareerSummary } from '../../series'
import './CareerLedger.css'

interface CareerLedgerProps {
  summary: CareerSummary
}

/** All-time career totals + a series-MVP hall of fame. Renders nothing until a series has been finished. */
export function CareerLedger({ summary }: CareerLedgerProps) {
  if (summary.seriesPlayed === 0) return null
  const { shieldsWon, seriesWon, seriesLost, seriesDrawn, gameWins, gameLosses, gameDraws, mvpHallOfFame } = summary

  return (
    <section className="career">
      <div className="career-label">Career · {summary.seriesPlayed} series</div>

      <div className="career-stats">
        <div className="career-stat">
          <div className="career-stat-value gold">{shieldsWon}</div>
          <div className="career-stat-key">Shields</div>
        </div>
        <div className="career-stat">
          <div className="career-stat-value">
            {seriesWon}–{seriesLost}
          </div>
          <div className="career-stat-key">Series{seriesDrawn > 0 ? ` · ${seriesDrawn} retained` : ''}</div>
        </div>
        <div className="career-stat">
          <div className="career-stat-value">
            {gameWins}–{gameLosses}
            {gameDraws > 0 ? `–${gameDraws}` : ''}
          </div>
          <div className="career-stat-key">Games</div>
        </div>
      </div>

      {mvpHallOfFame.length > 0 && (
        <div className="career-hof">
          <div className="career-hof-label">Series MVP hall of fame</div>
          <ul className="career-hof-list">
            {mvpHallOfFame.slice(0, 6).map((m) => (
              <li key={`${m.side}:${m.name}`} className={`career-hof-item ${m.side.toLowerCase()}`}>
                <span className="career-hof-name">{m.name}</span>
                <span className="career-hof-meta">
                  {m.side} · ×{m.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
