import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PlayerOfMatch, SeriesContext } from '../engine'
import { buildSeriesContext } from './buildContext'
import { addCompletedSeries, summariseCareer } from './career'
import type { CareerSummary } from './career'
import { loadCareer, saveCareer } from './careerPersist'
import { clearSeries, loadSeries, saveSeries } from './persist'
import { applyGameResult, concludeSeries, initSeries } from './seriesReducer'
import type { PlayedGame } from './seriesReducer'
import type { SeriesState } from './types'

export interface UseSeries {
  state: SeriesState
  /** Engine-facing context for the game currently ON (the next to be played). */
  currentContext: SeriesContext
  /** All-time totals across every completed series the player has finished. */
  careerSummary: CareerSummary
  /** Fold a finished game into the series (append record, recount, set shield/status). */
  recordResult: (played: PlayedGame) => void
  /** Close a clinched series early when the player skips the dead rubber. */
  skipDeadRubber: () => void
  /** Archive the just-finished series into the career ledger (if complete), then start a fresh one. */
  newSeries: (seriesMvp?: PlayerOfMatch | null) => void
}

/**
 * The React boundary for series state: owns the `SeriesState`, rehydrates it from localStorage on
 * mount, and persists on every change. The pure reducer/derivations live elsewhere; only this file and
 * `persist.ts` touch React / `localStorage`. `rootSeedFactory` is injected (e.g. `() => Date.now()`)
 * so the impure seed source stays out of the pure series core.
 */
export function useSeries(rootSeedFactory: () => number): UseSeries {
  const [state, setState] = useState<SeriesState>(() => loadSeries() ?? initSeries(rootSeedFactory()))
  const [career, setCareer] = useState(() => loadCareer())

  useEffect(() => {
    saveSeries(state)
  }, [state])

  useEffect(() => {
    saveCareer(career)
  }, [career])

  const recordResult = useCallback((played: PlayedGame) => {
    setState((s) => applyGameResult(s, played))
  }, [])

  const skipDeadRubber = useCallback(() => {
    setState((s) => concludeSeries(s))
  }, [])

  const newSeries = useCallback(
    (seriesMvp: PlayerOfMatch | null = null) => {
      // Archive the finished series before wiping the live save — addCompletedSeries no-ops if the
      // series isn't complete or was already archived (deduped by rootSeed).
      setCareer((c) => addCompletedSeries(c, state, seriesMvp))
      clearSeries()
      setState(initSeries(rootSeedFactory()))
    },
    [state, rootSeedFactory],
  )

  const currentContext = useMemo(() => buildSeriesContext(state), [state])
  const careerSummary = useMemo(() => summariseCareer(career), [career])

  return { state, currentContext, careerSummary, recordResult, skipDeadRubber, newSeries }
}
