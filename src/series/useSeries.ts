import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SeriesContext } from '../engine'
import { buildSeriesContext } from './buildContext'
import { clearSeries, loadSeries, saveSeries } from './persist'
import { applyGameResult, concludeSeries, initSeries } from './seriesReducer'
import type { PlayedGame } from './seriesReducer'
import type { SeriesState } from './types'

export interface UseSeries {
  state: SeriesState
  /** Engine-facing context for the game currently ON (the next to be played). */
  currentContext: SeriesContext
  /** Fold a finished game into the series (append record, recount, set shield/status). */
  recordResult: (played: PlayedGame) => void
  /** Close a clinched series early when the player skips the dead rubber. */
  skipDeadRubber: () => void
  /** Discard the current series and start a fresh one with a new root seed. */
  newSeries: () => void
}

/**
 * The React boundary for series state: owns the `SeriesState`, rehydrates it from localStorage on
 * mount, and persists on every change. The pure reducer/derivations live elsewhere; only this file and
 * `persist.ts` touch React / `localStorage`. `rootSeedFactory` is injected (e.g. `() => Date.now()`)
 * so the impure seed source stays out of the pure series core.
 */
export function useSeries(rootSeedFactory: () => number): UseSeries {
  const [state, setState] = useState<SeriesState>(() => loadSeries() ?? initSeries(rootSeedFactory()))

  useEffect(() => {
    saveSeries(state)
  }, [state])

  const recordResult = useCallback((played: PlayedGame) => {
    setState((s) => applyGameResult(s, played))
  }, [])

  const skipDeadRubber = useCallback(() => {
    setState((s) => concludeSeries(s))
  }, [])

  const newSeries = useCallback(() => {
    clearSeries()
    setState(initSeries(rootSeedFactory()))
  }, [rootSeedFactory])

  const currentContext = useMemo(() => buildSeriesContext(state), [state])

  return { state, currentContext, recordResult, skipDeadRubber, newSeries }
}
