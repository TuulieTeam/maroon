import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../data/types'
import type { PlayerOfMatch, SeriesContext } from '../engine'
import { buildSeriesContext } from './buildContext'
import { addCompletedSeries, summariseCareer } from './career'
import type { CareerSummary, LedgerIconicMoment } from './career'
import { loadCareer, saveCareer } from './careerPersist'
import { clearSeries, loadSeries, saveSeries } from './persist'
import { applyGameResult, concludeSeries, initSeries } from './seriesReducer'
import type { NswResolver, PlayedGame } from './seriesReducer'
import type { Difficulty } from './difficulty'
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
  /** Set the challenge level — only takes effect before game 1 kicks off (then the series locks it). */
  setDifficulty: (difficulty: Difficulty) => void
  /** Archive the just-finished series into the career ledger (if complete), then start a fresh one.
   *  A dynasty passes the next year's seed/roster/label; omitted = the standalone behaviour. */
  newSeries: (seriesMvp?: PlayerOfMatch | null, opts?: NewSeriesOptions) => void
}

export interface NewSeriesOptions {
  /** Explicit root seed for the fresh series (a dynasty year's deterministic seed). */
  rootSeed?: number
  /** The QLD pool the fresh series plays with (a dynasty year's resolved roster). */
  roster?: Player[]
  /** Start everyone level instead of the authored 2026 form/injury tables (year 2+). */
  neutralStart?: boolean
  /** The dynasty year label archived onto the finished series' career entry. */
  year?: number
  /** The shield-deciding game's iconic moment, archived onto the career entry. */
  iconicMoment?: LedgerIconicMoment
}

/**
 * The React boundary for series state: owns the `SeriesState`, rehydrates it from localStorage on
 * mount, and persists on every change. The pure reducer/derivations live elsewhere; only this file and
 * `persist.ts` touch React / `localStorage`. `rootSeedFactory` is injected (e.g. `() => Date.now()`)
 * so the impure seed source stays out of the pure series core. `roster` is the QLD pool the series
 * plays with — a dynasty year passes its resolved squad; omitted = the base 2026 pool.
 */
export function useSeries(rootSeedFactory: () => number, roster?: Player[], nswFor?: NswResolver): UseSeries {
  const [state, setState] = useState<SeriesState>(
    // The roster's ids (incl. generated rookies) are legitimate in a saved dynasty-year lineup.
    () => loadSeries(roster ? new Set(roster.map((p) => p.id)) : undefined) ?? initSeries(rootSeedFactory(), 'origin', roster, false, nswFor),
  )
  const [career, setCareer] = useState(() => loadCareer())
  // The pools ride refs so the recordResult callback stays stable across roster changes.
  const rosterRef = useRef(roster)
  const nswForRef = useRef(nswFor)
  useEffect(() => {
    rosterRef.current = roster
    nswForRef.current = nswFor
  }, [roster, nswFor])

  useEffect(() => {
    saveSeries(state)
  }, [state])

  useEffect(() => {
    saveCareer(career)
  }, [career])

  const recordResult = useCallback((played: PlayedGame) => {
    setState((s) => applyGameResult(s, played, rosterRef.current, nswForRef.current))
  }, [])

  const skipDeadRubber = useCallback(() => {
    setState((s) => concludeSeries(s))
  }, [])

  // Adjustable only on the game-1 selection screen; once a game is in the books the dial is locked.
  const setDifficulty = useCallback((difficulty: Difficulty) => {
    setState((s) => (s.games.length === 0 && s.status === 'in-progress' ? { ...s, difficulty } : s))
  }, [])

  const newSeries = useCallback(
    (seriesMvp: PlayerOfMatch | null = null, opts?: NewSeriesOptions) => {
      // Archive the finished series before wiping the live save — addCompletedSeries no-ops if the
      // series isn't complete or was already archived (deduped by rootSeed). The fresh series inherits
      // the just-finished series' difficulty (re-adjustable before its game 1).
      setCareer((c) => addCompletedSeries(c, state, seriesMvp, opts?.year, opts?.iconicMoment))
      clearSeries()
      setState(
        initSeries(
          opts?.rootSeed ?? rootSeedFactory(),
          state.difficulty ?? 'origin',
          opts?.roster,
          opts?.neutralStart,
          nswForRef.current,
        ),
      )
    },
    [state, rootSeedFactory],
  )

  const currentContext = useMemo(() => buildSeriesContext(state), [state])
  const careerSummary = useMemo(() => summariseCareer(career), [career])

  return { state, currentContext, careerSummary, recordResult, skipDeadRubber, setDifficulty, newSeries }
}
