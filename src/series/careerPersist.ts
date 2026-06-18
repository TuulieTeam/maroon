import type { Score, Side, VenueId } from '../engine'
import type { CareerLedger, LedgerEntry, LedgerGame, LedgerMvp } from './career'
import { CAREER_SCHEMA_VERSION, EMPTY_LEDGER } from './career'

/** Career archive key — independent of the live series save (`maroon.series.v2`), so the two never
 *  interfere. Bump the suffix on any breaking shape change. */
const CAREER_KEY = 'maroon.career.v1'

const VENUE_IDS = new Set<VenueId>(['SUNCORP', 'ACCOR_SYD', 'MCG'])

/**
 * Load the career ledger, or an empty one if there is none / it is unreadable. Defensive by design:
 * any parse failure, schema mismatch, or malformed entry discards the whole archive and returns an
 * empty ledger rather than crashing the hub.
 */
export function loadCareer(): CareerLedger {
  try {
    const raw = localStorage.getItem(CAREER_KEY)
    if (!raw) return EMPTY_LEDGER
    const parsed: unknown = JSON.parse(raw)
    return isValidLedger(parsed) ? parsed : EMPTY_LEDGER
  } catch {
    return EMPTY_LEDGER
  }
}

export function saveCareer(ledger: CareerLedger): void {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(ledger))
  } catch {
    // Storage full or unavailable (private mode) — the ledger stays in memory; no-op.
  }
}

export function clearCareer(): void {
  try {
    localStorage.removeItem(CAREER_KEY)
  } catch {
    // Nothing to do — already gone or storage unavailable.
  }
}

function isScore(v: unknown): v is Score {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.qld === 'number' && typeof s.nsw === 'number'
}

function isSide(v: unknown): v is Side {
  return v === 'QLD' || v === 'NSW'
}

function isLedgerGame(v: unknown): v is LedgerGame {
  if (!v || typeof v !== 'object') return false
  const g = v as Record<string, unknown>
  if (g.gameNumber !== 1 && g.gameNumber !== 2 && g.gameNumber !== 3) return false
  if (typeof g.venueId !== 'string' || !VENUE_IDS.has(g.venueId as VenueId)) return false
  if (!isScore(g.finalScore)) return false
  return g.winner === 'QLD' || g.winner === 'NSW' || g.winner === 'DRAW'
}

function isMvp(v: unknown): v is LedgerMvp {
  if (v === null) return true
  if (!v || typeof v !== 'object') return false
  const m = v as Record<string, unknown>
  return typeof m.id === 'string' && typeof m.name === 'string' && isSide(m.side) && typeof m.rating === 'number'
}

function isLedgerEntry(v: unknown): v is LedgerEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  if (typeof e.rootSeed !== 'number') return false
  if (!isScore(e.seriesScore)) return false
  if (!isSide(e.seriesWinner)) return false
  if (typeof e.retained !== 'boolean') return false
  if (!Array.isArray(e.games) || !e.games.every(isLedgerGame)) return false
  return isMvp(e.mvp)
}

function isValidLedger(v: unknown): v is CareerLedger {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  if (l.schemaVersion !== CAREER_SCHEMA_VERSION) return false
  return Array.isArray(l.entries) && l.entries.every(isLedgerEntry)
}
