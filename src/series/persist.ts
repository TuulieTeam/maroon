import { QLD_SQUAD } from '../data/qldSquad'
import type { Score } from '../engine'
import type { SeriesGameRecord, SeriesState } from './types'

/** Versioned localStorage key — bump the suffix on any breaking shape change. */
const STORAGE_KEY = 'maroon.series.v2'
const SCHEMA_VERSION = 2

/** Player ids that exist in the current squad — a stored lineup referencing anything else is stale. */
const SQUAD_IDS = new Set(QLD_SQUAD.map((p) => p.id))

const VENUE_IDS = new Set(['SUNCORP', 'ACCOR_SYD', 'MCG'])
const INJURY_KINDS = new Set(['fit', 'doubtful', 'out', 'suspended'])

/**
 * Load a saved series, or null if there is none / it is unreadable. Defensive by design: any parse
 * failure, schema-version mismatch, or stored player id that no longer resolves discards the save and
 * returns null (the caller then starts a fresh series). `finalScore`/`winner` are the immutable tally
 * source-of-truth, so a future engine/tuning change can never retroactively rewrite a finished series.
 */
export function loadSeries(): SeriesState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidSeries(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveSeries(state: SeriesState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable (private mode) — the series stays in memory; no-op.
  }
}

export function clearSeries(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — already gone or storage unavailable.
  }
}

function isScore(v: unknown): v is Score {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.qld === 'number' && typeof s.nsw === 'number'
}

function isValidGameRecord(v: unknown): v is SeriesGameRecord {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  if (r.gameNumber !== 1 && r.gameNumber !== 2 && r.gameNumber !== 3) return false
  if (typeof r.venueId !== 'string' || !VENUE_IDS.has(r.venueId)) return false
  if (typeof r.seed !== 'number') return false
  if (typeof r.qldKickerId !== 'string' || !SQUAD_IDS.has(r.qldKickerId)) return false
  if (!isScore(r.finalScore)) return false
  if (r.winner !== 'QLD' && r.winner !== 'NSW' && r.winner !== 'DRAW') return false
  if (!r.qldLineup || typeof r.qldLineup !== 'object') return false
  for (const id of Object.values(r.qldLineup as Record<string, unknown>)) {
    if (typeof id !== 'string' || !SQUAD_IDS.has(id)) return false
  }
  return true
}

/** Every condition must have a numeric form in [0,100] and a valid injury kind + numeric countdown. */
function isValidConditionMap(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  for (const cond of Object.values(v as Record<string, unknown>)) {
    if (!cond || typeof cond !== 'object') return false
    const c = cond as Record<string, unknown>
    if (typeof c.form !== 'number' || c.form < 0 || c.form > 100) return false
    const inj = c.injury
    if (!inj || typeof inj !== 'object') return false
    const i = inj as Record<string, unknown>
    if (typeof i.kind !== 'string' || !INJURY_KINDS.has(i.kind)) return false
    if (typeof i.gamesOut !== 'number') return false
  }
  return true
}

function isValidSeries(v: unknown): v is SeriesState {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  if (s.schemaVersion !== SCHEMA_VERSION) return false
  if (typeof s.rootSeed !== 'number') return false
  if (s.currentGame !== 1 && s.currentGame !== 2 && s.currentGame !== 3) return false
  if (s.status !== 'in-progress' && s.status !== 'complete') return false
  if (s.seriesWinner !== undefined && s.seriesWinner !== 'QLD' && s.seriesWinner !== 'NSW') return false
  if (!isScore(s.seriesScore)) return false
  if (!isValidConditionMap(s.playerConditions)) return false
  if (!Array.isArray(s.games)) return false
  return s.games.every(isValidGameRecord)
}
