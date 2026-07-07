import type { Score, Side, VenueId } from '../engine'

/**
 * One played Daily — immutable result only (score + the day's drawn setup as IDs), never attributes
 * or lineups, mirroring the career ledger's discipline. One record per date key, ever: the Daily is
 * one attempt, and the ledger is the enforcement (recordDaily no-ops on a replayed key).
 */
export interface DailyRecord {
  dateKey: string
  twistId: string
  opponentId: string
  venueId: VenueId
  finalScore: Score
  winner: Side | 'DRAW'
}

export const DAILY_SCHEMA_VERSION = 1

/** Every Daily ever played, oldest first, at most one per date key. */
export interface DailyLedger {
  schemaVersion: typeof DAILY_SCHEMA_VERSION
  results: DailyRecord[]
}

export const EMPTY_DAILY_LEDGER: DailyLedger = { schemaVersion: DAILY_SCHEMA_VERSION, results: [] }

/** The streak read the hub shows — current fire, all-time best, and the lifetime record. */
export interface DailySummary {
  /** Consecutive daily WINS up to (and including) the most recent play — 0 once a day is missed or lost. */
  streak: number
  bestStreak: number
  played: number
  wins: number
}

/** Whole days between two date keys (b - a), via UTC so DST can never make a day 23/25 hours. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseUtc(b) - parseUtc(a)) / 86_400_000)
}

function parseUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

/** Today's record, if today has already been played. */
export function recordForDay(ledger: DailyLedger, dateKey: string): DailyRecord | undefined {
  return ledger.results.find((r) => r.dateKey === dateKey)
}

/**
 * Append a played Daily. Pure — returns a new ledger. No-ops if that date was already played (one
 * attempt per day is a hard rule, enforced here rather than only in the UI) and keeps results in
 * date order even if a system clock briefly ran backwards.
 */
export function recordDaily(ledger: DailyLedger, record: DailyRecord): DailyLedger {
  if (ledger.results.some((r) => r.dateKey === record.dateKey)) return ledger
  const results = [...ledger.results, record].sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1))
  return { ...ledger, results }
}

/**
 * Fold the ledger into the streak read, Wordle-style: only a WIN extends the streak, and the chain
 * must be unbroken day-to-day — a loss, a draw, or a skipped day snaps it. `todayKey` decides whether
 * the chain is still alive: a streak that ended before yesterday has lapsed and reads 0, but the run
 * itself still counts toward `bestStreak`.
 */
export function summariseDaily(ledger: DailyLedger, todayKey: string): DailySummary {
  const results = ledger.results
  const summary: DailySummary = { streak: 0, bestStreak: 0, played: results.length, wins: 0 }

  let run = 0
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.winner !== 'QLD') {
      run = 0
      continue
    }
    summary.wins += 1
    const prev = results[i - 1]
    // Consecutive-day win chains only: a gap (or a non-win yesterday, handled above) restarts the run.
    run = prev && daysBetween(prev.dateKey, r.dateKey) === 1 && run > 0 ? run + 1 : 1
    summary.bestStreak = Math.max(summary.bestStreak, run)
  }

  // The final run is only a LIVE streak if its last win was today or yesterday.
  const last = results[results.length - 1]
  if (last && run > 0 && daysBetween(last.dateKey, todayKey) <= 1) summary.streak = run

  return summary
}
