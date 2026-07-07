import { GAME_URL } from '../gameUrl'
import type { DailyLedger } from './dailyLedger'
import { daysBetween, recordForDay } from './dailyLedger'
import { formatDateKey } from './dailyShareCard'

/**
 * The weekly rhythm — the Sunday-night group-chat artifact. A strip of the last seven days on the
 * hub panel, and a Mon–Sun week card to paste. Squares are the shared language: green win, red
 * loss, yellow draw, black unplayed.
 */

/** Shift a date key by n days (UTC arithmetic — immune to DST). */
export function shiftKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const t = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** The Monday of the week containing `dateKey` (ISO weeks — footy weeks end on Sunday). */
export function mondayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay() // 0 = Sunday
  return shiftKey(dateKey, dow === 0 ? -6 : 1 - dow)
}

function squareFor(ledger: DailyLedger, key: string): string {
  const r = recordForDay(ledger, key)
  if (!r) return '⬛'
  if (r.winner === 'QLD') return '🟩'
  if (r.winner === 'NSW') return '🟥'
  return '🟨'
}

/** The last seven calendar days ending today — the hub strip. Oldest first. */
export function lastSevenSquares(ledger: DailyLedger, todayKey: string): Array<{ key: string; square: string }> {
  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftKey(todayKey, i - 6)
    return { key, square: squareFor(ledger, key) }
  })
}

/**
 * The Mon–Sun week card, or null when the week is untouched (an empty card is an anti-brag).
 * Future days in the current week read as unplayed squares — the card is honest about a Wednesday.
 */
export function buildWeekCard(ledger: DailyLedger, todayKey: string): string | null {
  const monday = mondayOf(todayKey)
  const keys = Array.from({ length: 7 }, (_, i) => shiftKey(monday, i))
  const played = keys.map((k) => recordForDay(ledger, k)).filter(Boolean)
  if (played.length === 0) return null
  const wins = played.filter((r) => r!.winner === 'QLD').length
  const squares = keys.map((k) => (daysBetween(todayKey, k) > 0 ? '⬛' : squareFor(ledger, k))).join('')
  return [
    'MAROON · Daily Origin — the week',
    `${formatDateKey(monday)} → ${formatDateKey(shiftKey(monday, 6))}`,
    squares,
    `Won ${wins}/${played.length} this week`,
    GAME_URL,
  ].join('\n')
}
