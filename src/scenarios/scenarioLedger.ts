import type { ScenarioEntry, ScenarioLedger } from './types'

/**
 * Fold a COMPLETED scenario run into the ledger. Pure. Attempts always tick (a finished match is a
 * spent attempt, win or lose); the conquest facts are write-once — the first time the win condition
 * is met is the date the cabinet remembers, and later replays can't rewrite history.
 */
export function recordScenarioRun(
  ledger: ScenarioLedger,
  id: string,
  passed: boolean,
  dateKey: string,
  detail?: string,
): ScenarioLedger {
  const prior: ScenarioEntry = ledger.entries[id] ?? { attempts: 0 }
  const next: ScenarioEntry = { ...prior, attempts: prior.attempts + 1 }
  if (passed && !prior.firstDone) {
    next.firstDone = dateKey
    if (detail) next.bestDetail = detail
  }
  return { ...ledger, entries: { ...ledger.entries, [id]: next } }
}

/** How many scenarios have been conquered at least once. */
export function scenariosDone(ledger: ScenarioLedger): number {
  return Object.values(ledger.entries).filter((e) => e.firstDone).length
}
