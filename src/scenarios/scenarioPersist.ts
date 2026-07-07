import type { ScenarioEntry, ScenarioLedger } from './types'
import { EMPTY_SCENARIO_LEDGER, SCENARIOS_SCHEMA_VERSION } from './types'

/** Scenario archive key — independent of every other save; a career wipe keeps your conquests.
 *  Bump the suffix on any breaking shape change. */
const SCENARIOS_KEY = 'maroon.scenarios.v1'

/** Load the scenario ledger, or an empty one on any parse/shape failure (defensive, like every save). */
export function loadScenarios(): ScenarioLedger {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY)
    if (!raw) return EMPTY_SCENARIO_LEDGER
    const parsed: unknown = JSON.parse(raw)
    return isValidLedger(parsed) ? parsed : EMPTY_SCENARIO_LEDGER
  } catch {
    return EMPTY_SCENARIO_LEDGER
  }
}

export function saveScenarios(ledger: ScenarioLedger): void {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(ledger))
  } catch {
    // Storage full or unavailable — the ledger stays in memory; no-op.
  }
}

function isEntry(v: unknown): v is ScenarioEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  if (typeof e.attempts !== 'number' || e.attempts < 0) return false
  if (e.firstDone !== undefined && typeof e.firstDone !== 'string') return false
  return e.bestDetail === undefined || typeof e.bestDetail === 'string'
}

function isValidLedger(v: unknown): v is ScenarioLedger {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  if (l.schemaVersion !== SCENARIOS_SCHEMA_VERSION) return false
  if (!l.entries || typeof l.entries !== 'object' || Array.isArray(l.entries)) return false
  // Unknown scenario ids are kept (a retired scenario stays conquered — history hardens).
  return Object.values(l.entries as Record<string, unknown>).every(isEntry)
}
