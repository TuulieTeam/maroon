import { COACHES, TEMPERAMENT_START, coachById } from './coaches'
import { PRESSURE_TUNING } from './pressure'

/** One closed coaching era — immutable history, the retellable unit of a long dynasty. */
export interface CoachEra {
  coachId: string
  coachName: string
  fromYear: number
  toYear: number
  seasons: number
  shields: number
  /** The board's one-line obituary, frozen at the sacking. */
  verdict: string
}

/**
 * The coach's standing. Extends the drop-2 shape with the era machinery: who holds the clipboard,
 * how his era is tracking, and the eras already ended. All new fields are normalised on load, so a
 * drop-2 save upgrades in place (the difficulty-field pattern) — nobody's pressure history is wiped.
 */
export interface CoachState {
  schemaVersion: 1
  pressure: number
  /** Root seeds of series already folded into the index — the exactly-once guard across reloads. */
  judgedSeries: number[]
  /** The current coach (a `coaches.ts` id). */
  coachId: string
  /** The year the current era began (0 = unknown/legacy — set on first dynasty season close). */
  eraFromYear: number
  /** Seasons + shields under the current coach. */
  eraSeasons: number
  eraShields: number
  /** Consecutive lost series under the current coach — the board counts. */
  lostStreak: number
  /** Closed eras, oldest first. */
  eras: CoachEra[]
}

export const COACH_SCHEMA_VERSION = 1

export const INITIAL_COACH_STATE: CoachState = {
  schemaVersion: COACH_SCHEMA_VERSION,
  pressure: PRESSURE_TUNING.start,
  judgedSeries: [],
  coachId: COACHES[0].id,
  eraFromYear: 0,
  eraSeasons: 0,
  eraShields: 0,
  lostStreak: 0,
  eras: [],
}

const COACH_KEY = 'maroon.coach.v1'

export function loadCoach(): CoachState {
  try {
    const raw = localStorage.getItem(COACH_KEY)
    if (!raw) return INITIAL_COACH_STATE
    const parsed: unknown = JSON.parse(raw)
    const upgraded = normalise(parsed)
    return upgraded ?? INITIAL_COACH_STATE
  } catch {
    return INITIAL_COACH_STATE
  }
}

export function saveCoach(state: CoachState): void {
  try {
    localStorage.setItem(COACH_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — the hot seat stays in memory; no-op.
  }
}

/** The honeymoon level a fresh appointment starts on. */
export function freshPressureFor(coachId: string): number {
  return TEMPERAMENT_START[coachById(coachId).temperament]
}

function isEra(v: unknown): v is CoachEra {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    typeof e.coachId === 'string' &&
    typeof e.coachName === 'string' &&
    typeof e.fromYear === 'number' &&
    typeof e.toYear === 'number' &&
    typeof e.seasons === 'number' &&
    typeof e.shields === 'number' &&
    typeof e.verdict === 'string'
  )
}

/** Accept a drop-2 save (core fields only) and fill the era machinery with defaults. */
function normalise(v: unknown): CoachState | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  if (s.schemaVersion !== COACH_SCHEMA_VERSION) return null
  if (typeof s.pressure !== 'number' || s.pressure < 0 || s.pressure > 100) return null
  if (!Array.isArray(s.judgedSeries) || !s.judgedSeries.every((x) => typeof x === 'number')) return null
  const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  return {
    schemaVersion: COACH_SCHEMA_VERSION,
    pressure: s.pressure,
    judgedSeries: s.judgedSeries as number[],
    coachId: typeof s.coachId === 'string' ? s.coachId : COACHES[0].id,
    eraFromYear: num(s.eraFromYear),
    eraSeasons: num(s.eraSeasons),
    eraShields: num(s.eraShields),
    lostStreak: num(s.lostStreak),
    eras: Array.isArray(s.eras) && s.eras.every(isEra) ? (s.eras as CoachEra[]) : [],
  }
}
