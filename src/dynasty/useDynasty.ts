import { useCallback, useMemo, useRef, useState } from 'react'
import { QLD_SQUAD } from '../data/qldSquad'
import type { Player } from '../data/types'
import { loadSeries } from '../series/persist'
import type { SeriesState } from '../series'
import { loadDynasty, saveDynasty } from './dynastyPersist'
import { runOffseason } from './offseason'
import { resolveRoster } from './roster'
import { dynastySeriesSeed } from './seed'
import type { DynastyState, OffseasonReport } from './types'

export interface UseDynasty {
  state: DynastyState
  /** The current year's resolved QLD roster — what every series surface plays with. */
  roster: Player[]
  /** Run the off-season for a COMPLETED series: ages, retires, archives, rolls the year. Returns
   *  the report for the off-season screen. Idempotent per year (re-running returns null). */
  runOffseasonFor: (completed: SeriesState) => OffseasonReport | null
  /** The deterministic series seed for the CURRENT year. */
  nextSeriesSeed: () => number
}

export const DYNASTY_START_YEAR = 2026

/**
 * The dynasty's React boundary. A dynasty always exists: on first load it ADOPTS the live series as
 * year one (dynastySeed = that series' rootSeed, which `dynastySeriesSeed` maps back to itself for
 * the start year) — so shipping the Dynasty never disturbs an in-flight save.
 */
export function useDynasty(): UseDynasty {
  const [state, setState] = useState<DynastyState>(() => {
    const existing = loadDynasty()
    if (existing) return existing
    const adopted: DynastyState = {
      schemaVersion: 1,
      dynastySeed: (loadSeries()?.rootSeed ?? Date.now()) >>> 0,
      startYear: DYNASTY_START_YEAR,
      currentYear: DYNASTY_START_YEAR,
      overlay: { attrDeltas: {}, retired: [] },
      years: [],
    }
    saveDynasty(adopted)
    return adopted
  })
  const ref = useRef(state)

  const roster = useMemo(
    () => resolveRoster(QLD_SQUAD, state.overlay, state.currentYear, state.startYear),
    [state],
  )

  const runOffseasonFor = useCallback((completed: SeriesState): OffseasonReport | null => {
    const cur = ref.current
    // Exactly-once per series: an already-archived rootSeed (or a not-complete series) never re-runs.
    if (completed.status !== 'complete' || !completed.seriesWinner) return null
    if (cur.years.some((y) => y.seriesRootSeed === completed.rootSeed)) return null
    const { next, report } = runOffseason(cur, completed)
    ref.current = next
    saveDynasty(next)
    setState(next)
    return report
  }, [])

  const nextSeriesSeed = useCallback(
    () => dynastySeriesSeed(ref.current.dynastySeed, ref.current.startYear, ref.current.currentYear),
    [],
  )

  return { state, roster, runOffseasonFor, nextSeriesSeed }
}
