import { THE_RECORD } from '../../dynasty'
import type { ShieldStreak } from '../../dynasty'
import './TheEight.css'

/**
 * The 8-in-a-row tracker — Queensland's holy grail as a strip of eight squares filling gold. Only
 * OUTRIGHT wins fill a square: a drawn retain keeps the shield but resets the run (the record book
 * is cruel), so the strip always tells the truth about the streak the feats judge.
 */
export function TheEight({ streak }: { streak: ShieldStreak }) {
  const filled = Math.min(streak.current, THE_RECORD)
  const caption =
    streak.current === 0
      ? 'The record is 8 straight. The first square is a shield won outright.'
      : streak.current === 1
        ? '1 straight — the record is 8.'
        : streak.current < THE_RECORD
          ? `${streak.current} straight — the record is 8.`
          : streak.current === THE_RECORD
            ? '8 STRAIGHT. THE RECORD IS EQUALLED.'
            : `${streak.current} straight — beyond The Eight.`
  return (
    <div className="the-eight" role="img" aria-label={`Shield streak: ${streak.current} straight, best ${streak.best}`}>
      <div className="the-eight-head">
        <span className="the-eight-label">The Eight</span>
        <span className="the-eight-best">best run: {streak.best}</span>
      </div>
      <div className="the-eight-strip">
        {Array.from({ length: THE_RECORD }, (_, i) => (
          <span key={i} className={`the-eight-square ${i < filled ? 'is-filled' : ''}`} />
        ))}
      </div>
      <div className={`the-eight-caption ${streak.current >= THE_RECORD ? 'is-legend' : ''}`}>{caption}</div>
    </div>
  )
}
