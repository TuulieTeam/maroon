import type { Score, VenueId } from '../engine'
import type { DailyLedger, DailyRecord } from './dailyLedger'
import { DAILY_SCHEMA_VERSION, EMPTY_DAILY_LEDGER } from './dailyLedger'

/** Daily archive key — independent of the series save and career ledger, so the three never interfere.
 *  Bump the suffix on any breaking shape change. */
const DAILY_KEY = 'maroon.daily.v1'

const VENUE_IDS = new Set<VenueId>(['SUNCORP', 'ACCOR_SYD', 'MCG'])

/**
 * Load the daily ledger, or an empty one if there is none / it is unreadable. Defensive by design:
 * any parse failure, schema mismatch, or malformed record discards the whole archive rather than
 * crashing the hub — a lost streak is sad; a broken app is worse.
 */
export function loadDaily(): DailyLedger {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return EMPTY_DAILY_LEDGER
    const parsed: unknown = JSON.parse(raw)
    return isValidLedger(parsed) ? parsed : EMPTY_DAILY_LEDGER
  } catch {
    return EMPTY_DAILY_LEDGER
  }
}

export function saveDaily(ledger: DailyLedger): void {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(ledger))
  } catch {
    // Storage full or unavailable (private mode) — the ledger stays in memory; no-op.
  }
}

function isScore(v: unknown): v is Score {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.qld === 'number' && typeof s.nsw === 'number'
}

function isDailyRecord(v: unknown): v is DailyRecord {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  if (typeof r.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.dateKey)) return false
  // Twist/opponent ids are validated for TYPE only — resolution falls back gracefully (twistById /
  // bluesById), so retiring a shipped twist can never invalidate a stored history.
  if (typeof r.twistId !== 'string' || typeof r.opponentId !== 'string') return false
  if (typeof r.venueId !== 'string' || !VENUE_IDS.has(r.venueId as VenueId)) return false
  if (!isScore(r.finalScore)) return false
  return r.winner === 'QLD' || r.winner === 'NSW' || r.winner === 'DRAW'
}

function isValidLedger(v: unknown): v is DailyLedger {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  if (l.schemaVersion !== DAILY_SCHEMA_VERSION) return false
  if (!Array.isArray(l.results) || !l.results.every(isDailyRecord)) return false
  // One record per date key is a ledger invariant — a duplicated key means a corrupt save.
  const keys = new Set((l.results as DailyRecord[]).map((r) => r.dateKey))
  return keys.size === l.results.length
}
