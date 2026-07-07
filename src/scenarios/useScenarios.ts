import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { recordScenarioRun, scenariosDone } from './scenarioLedger'
import { loadScenarios, saveScenarios } from './scenarioPersist'
import type { ScenarioLedger } from './types'

export interface UseScenarios {
  /** The whole persisted conquest history — the browser and career-scope feats read across it. */
  ledger: ScenarioLedger
  /** How many scenarios have been conquered at least once. */
  doneCount: number
  /** Fold a completed run into the ledger and persist. Returns the post-fold ledger so the caller
   *  can judge feats against it synchronously (the hook's state update is async). */
  record: (id: string, passed: boolean, dateKey: string, detail?: string) => ScenarioLedger
}

/**
 * The scenario library's state hook — owns the persisted ledger the way useDaily owns the daily's.
 * The working ledger lives in a ref that updates synchronously (the useFeats pattern), so `record`
 * can hand the post-fold ledger straight back for the same-tick feat judgement.
 */
export function useScenarios(): UseScenarios {
  const [ledger, setLedger] = useState(loadScenarios)
  const ledgerRef = useRef(ledger)
  useEffect(() => {
    ledgerRef.current = ledger
  }, [ledger])

  const doneCount = useMemo(() => scenariosDone(ledger), [ledger])

  const record = useCallback(
    (id: string, passed: boolean, dateKey: string, detail?: string): ScenarioLedger => {
      const next = recordScenarioRun(ledgerRef.current, id, passed, dateKey, detail)
      ledgerRef.current = next
      saveScenarios(next)
      setLedger(next)
      return next
    },
    [],
  )

  return { ledger, doneCount, record }
}
