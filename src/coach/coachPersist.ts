import { PRESSURE_TUNING } from './pressure'

/** The coach's standing — currently just the hot-seat index. The sack/era machinery (Dynasty drop)
 *  extends this shape with era archives later. Bump the suffix on any breaking change. */
export interface CoachState {
  schemaVersion: 1
  pressure: number
  /** Root seeds of series already folded into the index — the exactly-once guard across reloads. */
  judgedSeries: number[]
}

export const COACH_SCHEMA_VERSION = 1

export const INITIAL_COACH_STATE: CoachState = {
  schemaVersion: COACH_SCHEMA_VERSION,
  pressure: PRESSURE_TUNING.start,
  judgedSeries: [],
}

const COACH_KEY = 'maroon.coach.v1'

export function loadCoach(): CoachState {
  try {
    const raw = localStorage.getItem(COACH_KEY)
    if (!raw) return INITIAL_COACH_STATE
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : INITIAL_COACH_STATE
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

function isValid(v: unknown): v is CoachState {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  if (s.schemaVersion !== COACH_SCHEMA_VERSION) return false
  if (typeof s.pressure !== 'number' || s.pressure < 0 || s.pressure > 100) return false
  return Array.isArray(s.judgedSeries) && s.judgedSeries.every((x) => typeof x === 'number')
}
