import { useCallback, useRef, useState } from 'react'
import type { SeriesState } from '../series'
import { loadCoach, saveCoach } from './coachPersist'
import type { CoachState } from './coachPersist'
import { applyGameHeat, applySeriesPressure } from './pressure'

export interface UseCoach {
  state: CoachState
  /** Fold one game's settled media position into the hot seat. */
  gameHeat: (stance: 'backs' | 'savages', qldWon: boolean) => void
  /** Fold a COMPLETED series into the hot seat — exactly once per rootSeed, across reloads. */
  seriesHeat: (completed: SeriesState) => void
}

/**
 * The hot seat's React boundary. Same synchronous-ref discipline as useFeats: game heat and series
 * heat can land in the same tick (a series-ending game), so the working state lives in a ref and
 * React state trails it for rendering.
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
      commit({
        ...cur,
        pressure: applySeriesPressure(cur.pressure, completed),
        // Keep the guard list bounded — only recent series can plausibly be re-judged.
        judgedSeries: [...cur.judgedSeries, completed.rootSeed].slice(-20),
      })
    },
    [commit],
  )

  return { state, gameHeat, seriesHeat }
}
