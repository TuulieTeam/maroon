import type { MatchEvent } from '../../engine'
import './Scoreboard.css'

interface ScoreboardProps {
  current: MatchEvent | null
  tackleCount: number | null
  possession: 'QLD' | 'NSW' | null
}

function clockLabel(event: MatchEvent | null): { time: string; half: string } {
  if (!event) return { time: "0'", half: 'Kick Off' }
  if (event.type === 'FULL_TIME') return { time: "80'", half: 'Full Time' }
  if (event.type === 'HALF_TIME') return { time: "40'", half: 'Half Time' }
  const half = event.minute >= 40 ? '2nd Half' : '1st Half'
  return { time: `${event.minute}'`, half }
}

export function Scoreboard({ current, tackleCount, possession }: ScoreboardProps) {
  const score = current?.score ?? { qld: 0, nsw: 0 }
  const { time, half } = clockLabel(current)

  return (
    <div className="scoreboard">
      <div className="scoreboard-main">
        <div className="score-team qld">
          <div className="team-name">QLD</div>
          <div className="team-score">{score.qld}</div>
        </div>
        <div className="score-clock">
          <div className="clock-time">{time}</div>
          <div className="clock-half">{half}</div>
        </div>
        <div className="score-team nsw">
          <div className="team-name">NSW</div>
          <div className="team-score">{score.nsw}</div>
        </div>
      </div>
      <div className="scoreboard-detail">
        {possession && (
          <span>
            Possession:{' '}
            <span className={possession === 'QLD' ? 'poss-qld' : 'poss-nsw'}>{possession}</span>
          </span>
        )}
        {tackleCount != null && <span>Tackle {Math.min(6, tackleCount)}</span>}
      </div>
    </div>
  )
}
