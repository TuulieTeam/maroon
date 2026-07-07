import { useEffect, useState } from 'react'
import { buildDailyShareCard, buildWeekCard, formatDateKey, lastSevenSquares } from '../../daily'
import type { DailyChallenge, DailyLedger, DailyRecord, DailySummary } from '../../daily'
import { ShareCard } from './ShareCard'
import './DailyPanel.css'

interface DailyPanelProps {
  challenge: DailyChallenge
  /** Today's result once played — flips the panel from "play" to "come back tomorrow". */
  todayRecord: DailyRecord | undefined
  summary: DailySummary
  /** The whole history — drives the last-7-days strip and the week card. */
  ledger: DailyLedger
  onPlay: () => void
}

/** Minutes-resolution countdown to local midnight, when the next Daily unlocks. */
function useMidnightCountdown(): string {
  const compute = () => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const mins = Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 60_000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  const [label, setLabel] = useState(compute)
  useEffect(() => {
    const id = window.setInterval(() => setLabel(compute()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return label
}

function resultLine(record: DailyRecord): { cls: string; text: string } {
  const score = `${record.finalScore.qld}–${record.finalScore.nsw}`
  if (record.winner === 'QLD') return { cls: 'win', text: `WON ${score}` }
  if (record.winner === 'NSW') return { cls: 'loss', text: `LOST ${score}` }
  return { cls: 'draw', text: `DREW ${score}` }
}

/**
 * The hub's Daily Origin card — the reason to open the game on a day you're between series. Unplayed,
 * it sells today's one-shot challenge (the drawn Blues, the ground, the twist, the streak on the line).
 * Played, it locks in the result and counts down to tomorrow's.
 */
export function DailyPanel({ challenge, todayRecord, summary, ledger, onPlay }: DailyPanelProps) {
  const countdown = useMidnightCountdown()
  const strip = lastSevenSquares(ledger, challenge.dateKey)
  const weekCard = buildWeekCard(ledger, challenge.dateKey)

  return (
    <section className="daily-panel" aria-label="The Daily Origin">
      <div className="daily-head">
        <span className="daily-title">⚡ The Daily Origin</span>
        <span className="daily-date">{formatDateKey(challenge.dateKey)}</span>
      </div>

      {summary.played > 0 && (
        <div className="daily-strip" aria-label="Last seven days" title="The last seven days, oldest first">
          {strip.map((d) => (
            <span key={d.key}>{d.square}</span>
          ))}
        </div>
      )}

      {todayRecord ? (
        <>
          <div className={`daily-result ${resultLine(todayRecord).cls}`}>{resultLine(todayRecord).text}</div>
          <p className="daily-standing">
            {summary.streak > 0 ? <>🔥 <strong>{summary.streak}-day streak</strong> · </> : null}
            best {summary.bestStreak} · won {summary.wins}/{summary.played}
          </p>
          <ShareCard text={buildDailyShareCard(todayRecord, summary)} />
          {weekCard && <ShareCard text={weekCard} />}
          <p className="daily-countdown">Next Daily in {countdown}</p>
        </>
      ) : (
        <>
          <p className="daily-pitch">
            One match. One attempt. Today it&apos;s <strong>{challenge.opponent.name}</strong> at{' '}
            {challenge.venue.stadium} — <em>{challenge.twist.label}</em>: {challenge.twist.blurb}
          </p>
          <p className="daily-standing">
            {summary.streak > 0 ? (
              <>🔥 <strong>{summary.streak}-day streak on the line</strong></>
            ) : summary.played > 0 ? (
              <>best streak {summary.bestStreak} · won {summary.wins}/{summary.played}</>
            ) : (
              <>Your streak starts today.</>
            )}
          </p>
          <div className="daily-actions">
            <button className="btn-primary" onClick={onPlay}>
              Play today&apos;s Daily
            </button>
          </div>
        </>
      )}
    </section>
  )
}
