import type { Score, SeriesStakes } from '../engine'
import type { GameNo } from './types'

/**
 * Maroon-perspective pre-kickoff stakes for (gameNumber, series wins so far). `seriesScore` counts
 * games WON before this match — draws are a no-result, so a level series after a drawn game routes to
 * the dedicated "after a draw" buckets. Total over every reachable (gameNumber, qld, nsw).
 */
export function deriveStakes(game: GameNo, seriesScore: Score): SeriesStakes {
  const { qld, nsw } = seriesScore
  if (game === 1) return 'OPENER'
  if (game === 2) {
    if (qld > nsw) return 'G2_CAN_CLINCH' // 1-0 up
    if (nsw > qld) return 'G2_MUST_WIN' // 0-1 down
    return 'G2_OPEN_AFTER_DRAW' // 0-0, game 1 was drawn
  }
  // Game 3.
  if (qld >= 2) return 'G3_DEAD_RUBBER_QLD_UP' // 2-0, shield already QLD
  if (nsw >= 2) return 'G3_DEAD_RUBBER_QLD_DOWN' // 0-2, shield already NSW
  if (qld === 1 && nsw === 1) return 'G3_DECIDER' // 1-1, winner takes all
  return 'G3_DECIDER_AFTER_DRAW' // 1-0 / 0-1 / 0-0 — a draw earlier, this game still decides it
}

export const GAME_LABELS: Record<GameNo, string> = {
  1: 'Origin I',
  2: 'Origin II',
  3: 'Origin III',
}

export function gameLabel(game: GameNo): string {
  return GAME_LABELS[game]
}
