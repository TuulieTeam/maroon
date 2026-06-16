import type { Side } from '../../engine'
import type { GameNo, SeriesState } from '../../series'
import './SeriesScoreboard.css'

interface SeriesScoreboardProps {
  state: SeriesState
  /** Optional framing for the game about to be played (shown above the pips). */
  upcoming?: { gameLabel: string; venueName: string; stakesLabel?: string }
}

const GAMES: GameNo[] = [1, 2, 3]

function sideName(side: Side): string {
  return side === 'QLD' ? 'Queensland' : 'New South Wales'
}

/** The running series headline — leader / decided / dead-rubber-pending / drawn-retain. */
function seriesLine(state: SeriesState): string {
  const { seriesScore: s, status, seriesWinner, games } = state
  const hi = Math.max(s.qld, s.nsw)
  const lo = Math.min(s.qld, s.nsw)

  if (status === 'complete') {
    if (!seriesWinner) return 'Series complete'
    if (s.qld === s.nsw) return 'Series drawn — Queensland retain the shield'
    return `${sideName(seriesWinner)} win the series ${hi}–${lo}`
  }
  if (seriesWinner) {
    // Shield clinched, the dead rubber is still to be played.
    return `${sideName(seriesWinner)} have the shield (${s.qld}–${s.nsw}) — dead rubber to come`
  }
  if (games.length === 0) return 'Best of three — the series begins'
  if (s.qld > s.nsw) return `Queensland lead the series ${s.qld}–${s.nsw}`
  if (s.nsw > s.qld) return `New South Wales lead the series ${s.nsw}–${s.qld}`
  return `All square at ${s.qld}–${s.nsw}`
}

export function SeriesScoreboard({ state, upcoming }: SeriesScoreboardProps) {
  return (
    <div className="series-scoreboard">
      {upcoming && (
        <div className="series-upcoming">
          <span className="series-game-label">{upcoming.gameLabel}</span>
          <span className="series-venue">{upcoming.venueName}</span>
          {upcoming.stakesLabel && <span className="series-stakes">{upcoming.stakesLabel}</span>}
        </div>
      )}

      <div className="series-pips" role="list" aria-label="Series progress">
        {GAMES.map((n) => {
          const rec = state.games.find((g) => g.gameNumber === n)
          const isCurrent = n === state.currentGame && state.status === 'in-progress'
          const mod = rec
            ? rec.winner === 'QLD'
              ? 'won-qld'
              : rec.winner === 'NSW'
                ? 'won-nsw'
                : 'drawn'
            : isCurrent
              ? 'current'
              : 'upcoming'
          return (
            <div key={n} className={`series-pip ${mod}`} role="listitem">
              <span className="pip-game">G{n}</span>
              <span className="pip-score">
                {rec ? `${rec.finalScore.qld}–${rec.finalScore.nsw}` : isCurrent ? '•' : ''}
              </span>
            </div>
          )
        })}
      </div>

      <div className="series-line">{seriesLine(state)}</div>
    </div>
  )
}
