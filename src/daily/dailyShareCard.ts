import { GAME_URL } from '../gameUrl'
import { VENUES } from '../series/venues'
import type { DailyRecord, DailySummary } from './dailyLedger'
import { twistById } from './twists'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-07-06" → "6 Jul 2026". Hand-rolled so the card never varies with the device locale. */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`
}

/** QLD-POV result square: green win, red loss, yellow draw — same language as the series card. */
function square(r: DailyRecord): string {
  if (r.winner === 'QLD') return '🟩'
  if (r.winner === 'NSW') return '🟥'
  return '🟨'
}

/**
 * A Wordle-style, copy-pasteable summary of a played Daily — pure (no DOM), unit-testable. The brag
 * is the STREAK: the score proves the day, the fire proves the habit. The twist is named so a mate
 * seeing the card knows a win was earned under the day's conditions, not on a flat track.
 */
export function buildDailyShareCard(record: DailyRecord, summary: DailySummary): string {
  const twist = twistById(record.twistId)
  const lines = [
    'MAROON · The Daily Origin',
    `${formatDateKey(record.dateKey)} · ⚡ ${twist.label}`,
    `${square(record)} QLD ${record.finalScore.qld}–${record.finalScore.nsw} at ${VENUES[record.venueId].groundShort}`,
  ]
  if (summary.streak > 0) lines.push(`🔥 Streak ${summary.streak} · Best ${summary.bestStreak} · Won ${summary.wins}/${summary.played}`)
  else lines.push(`Best streak ${summary.bestStreak} · Won ${summary.wins}/${summary.played}`)
  lines.push(GAME_URL)
  return lines.join('\n')
}
