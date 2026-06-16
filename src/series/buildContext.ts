import type { SeriesContext } from '../engine'
import { deriveStakes } from './stakes'
import type { SeriesState } from './types'
import { venueForGame } from './venues'

/**
 * Assemble the engine-facing `SeriesContext` for the game the series is currently ON (the next to be
 * played). This is the single new field threaded into `MatchSetup.series` — plain data the booth
 * reads. `seriesScore` is the wins BEFORE this game, which is exactly `state.seriesScore` since only
 * completed games are tallied.
 */
export function buildSeriesContext(state: SeriesState): SeriesContext {
  const gameNumber = state.currentGame
  return {
    gameNumber,
    seriesScore: { ...state.seriesScore },
    venue: venueForGame(gameNumber),
    stakes: deriveStakes(gameNumber, state.seriesScore),
  }
}
