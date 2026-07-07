import { useCallback, useRef, useState } from 'react'
import type { SeriesState } from '../series'
import { boardReview } from './board'
import type { BoardOutcome } from './board'
import { coachById } from './coaches'
import type { Coach } from './coaches'
import { loadCoach, saveCoach } from './coachPersist'
import type { CoachState } from './coachPersist'
import { applyGameHeat, applySeriesPressure } from './pressure'

export interface UseCoach {
  state: CoachState
  /** The man currently holding the clipboard. */
  coach: Coach
  /** Fold one game's settled media position into the hot seat. */
  gameHeat: (stance: 'backs' | 'savages', qldWon: boolean) => void
  /** Fold a COMPLETED series into the hot seat + the era ledger — exactly once per rootSeed. */
  seriesHeat: (completed: SeriesState) => void
  /** The board's annual review, run at the off-season. May close the era and install a successor. */
  review: (completed: SeriesState, endedYear: number) => BoardOutcome
  /** The ref-accurate CURRENT pressure — for same-tick reads (feats judge the siege as it stood). */
  pressureNow: () => number
}

/**
 * The hot seat's React boundary. Same synchronous-ref discipline as useFeats: game heat, series
 * heat, and the board review can land in one tick, so the working state lives in a ref and React
 * state trails it for rendering.
 */
export function useCoach(): UseCoach {
  const [state, setState] = useState(loadCoach)
  const ref = useRef(state)

  const commit = useCallback((next: CoachState) => {
    ref.current = next
    saveCoach(next)
    setState(next)
  }, [])

  const gameHeat = useCallback(
    (stance: 'backs' | 'savages', qldWon: boolean) => {
      const cur = ref.current
      const pressure = applyGameHeat(cur.pressure, stance, qldWon)
      if (pressure !== cur.pressure) commit({ ...cur, pressure })
    },
    [commit],
  )

  const seriesHeat = useCallback(
    (completed: SeriesState) => {
      const cur = ref.current
      if (completed.status !== 'complete' || !completed.seriesWinner) return
      if (cur.judgedSeries.includes(completed.rootSeed)) return
      const won = completed.seriesWinner === 'QLD'
      commit({
        ...cur,
        pressure: applySeriesPressure(cur.pressure, completed),
        eraSeasons: cur.eraSeasons + 1,
        eraShields: cur.eraShields + (won ? 1 : 0),
        lostStreak: won ? 0 : cur.lostStreak + 1,
        // Keep the guard list bounded — only recent series can plausibly be re-judged.
        judgedSeries: [...cur.judgedSeries, completed.rootSeed].slice(-20),
      })
    },
    [commit],
  )

  const review = useCallback(
    (completed: SeriesState, endedYear: number): BoardOutcome => {
      const { next, outcome } = boardReview(ref.current, completed, endedYear)
      if (next !== ref.current) commit(next)
      return outcome
    },
    [commit],
  )

  const pressureNow = useCallback(() => ref.current.pressure, [])

  return { state, coach: coachById(state.coachId), gameHeat, seriesHeat, review, pressureNow }
}
