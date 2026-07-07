import type { Score, Side, VenueId } from '../engine'
import type { CareerLedger, LedgerEntry, LedgerGame, LedgerMvp } from './career'
import { CAREER_SCHEMA_VERSION, EMPTY_LEDGER } from './career'

/** Career archive key — independent of the live series save (`maroon.series.v2`), so the two never
 *  interfere. Bump the suffix on any breaking shape change. */
const CAREER_KEY = 'maroon.career.v1'

const VENUE_IDS = new Set<VenueId>(['SUNCORP', 'ACCOR_SYD', 'MCG'])

/**
 * Load the career ledger, or an empty one if there is none / it is unreadable. Defensive by design:
 * any parse failure or malformed entry discards the whole archive rather than crashing the hub —
 * EXCEPT a v1 archive, which UPGRADES in place (v2 only added optional fields, so a valid v1 entry
 * is already a valid v2 entry). A career must never be wiped by a schema bump.
 */
export function loadCareer(): CareerLedger {
  try {
    const raw = localStorage.getItem(CAREER_KEY)
    if (!raw) return EMPTY_LEDGER
    const parsed: unknown = JSON.parse(raw)
    const upgraded = upgradeLedger(parsed)
    return isValidLedger(upgraded) ? upgraded : EMPTY_LEDGER
  } catch {
    return EMPTY_LEDGER
  }
}

/** v1 → v2: entries carry over verbatim (every v2 addition is optional). Anything else passes through. */
function upgradeLedger(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v
  const l = v as Record<string, unknown>
  if (l.schemaVersion === 1 && Array.isArray(l.entries)) return { ...l, schemaVersion: CAREER_SCHEMA_VERSION }
  return v
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
  if (!isMvp(e.mvp)) return false
  // v2 optionals: reject only a present-but-bad value (the difficulty-field pattern). Ids are checked
  // for TYPE only — resolution falls back gracefully, so retiring a variant never invalidates history.
  if (e.difficulty !== undefined && typeof e.difficulty !== 'string') return false
  if (e.opponentId !== undefined && typeof e.opponentId !== 'string') return false
  if (e.year !== undefined && typeof e.year !== 'number') return false
  if (e.iconicMoment !== undefined && !isIconicMoment(e.iconicMoment)) return false
  if (e.nemesis !== undefined && !isNemesis(e.nemesis)) return false
  return true
}

function isIconicMoment(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const m = v as Record<string, unknown>
  return (
    typeof m.playerId === 'string' &&
    typeof m.playerName === 'string' &&
    isSide(m.side) &&
    (m.gameNumber === 1 || m.gameNumber === 2 || m.gameNumber === 3) &&
    typeof m.minute === 'number' &&
    typeof m.kind === 'string' &&
    typeof m.line === 'string'
  )
}

function isNemesis(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const n = v as Record<string, unknown>
  return (
    typeof n.id === 'string' &&
    typeof n.name === 'string' &&
    typeof n.tries === 'number' &&
    typeof n.lineBreaks === 'number' &&
    typeof n.damage === 'number'
  )
}

function isValidLedger(v: unknown): v is CareerLedger {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  if (l.schemaVersion !== CAREER_SCHEMA_VERSION) return false
  return Array.isArray(l.entries) && l.entries.every(isLedgerEntry)
}
