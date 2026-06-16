import type { Score, SeriesWrap, Side } from './types'

/**
 * Pure series-derivation helpers that BOTH the engine booth and the UI consume. They live in the
 * engine (not src/series) because the post-game booth computes the wrap inside `simulateMatch`, where
 * only the engine has `result.winner` — and the engine must never import from the UI-side series
 * module. `src/series` re-exports these for the UI, so there is one canonical implementation.
 */

const ORIGIN_NUMERALS: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' }

/** "Origin I" / "Origin II" / "Origin III". */
export function originLabel(gameNumber: 1 | 2 | 3): string {
  return `Origin ${ORIGIN_NUMERALS[gameNumber]}`
}

/**
 * Post-game wrap bucket from (gameNumber, series wins BEFORE this game, this game's winner). The
 * shield is decided by the two-win rule on the resulting score; a drawn series (no side on two after
 * three games) retains for QLD as incumbent holder. Total over every reachable input.
 */
export function deriveWrap(
  gameNumber: 1 | 2 | 3,
  before: Score,
  winner: Side | 'DRAW',
): SeriesWrap {
  const after: Score = {
    qld: before.qld + (winner === 'QLD' ? 1 : 0),
    nsw: before.nsw + (winner === 'NSW' ? 1 : 0),
  }

  if (gameNumber === 1) {
    if (winner === 'QLD') return 'LEAD_TAKEN' // 1-0
    if (winner === 'NSW') return 'TRAILING' // 0-1
    return 'STALEMATE' // 0-0
  }

  if (gameNumber === 2) {
    if (before.qld > before.nsw) {
      // 1-0 going in — a win clinches the shield.
      if (winner === 'QLD') return 'SERIES_CLINCHED_QLD' // 2-0
      if (winner === 'NSW') return 'LEVELLED_DECIDER' // 1-1
      return 'G2_DRAW'
    }
    if (before.nsw > before.qld) {
      // 0-1 going in — must win to survive.
      if (winner === 'QLD') return 'KEPT_ALIVE_DECIDER' // 1-1
      if (winner === 'NSW') return 'SERIES_LOST_QLD' // 0-2
      return 'G2_DRAW'
    }
    // 0-0 going in (game 1 drawn) — nobody can clinch in game 2.
    if (winner === 'QLD') return 'LEAD_TAKEN'
    if (winner === 'NSW') return 'TRAILING'
    return 'G2_DRAW'
  }

  // Game 3 — the series resolves now.
  if (before.qld >= 2) {
    // 2-0 dead rubber, shield already Maroon.
    if (winner === 'QLD') return 'SWEEP_QLD' // 3-0
    if (winner === 'NSW') return 'DEAD_RUBBER_CONSOLATION_NSW' // 2-1
    return 'DEAD_RUBBER_DRAW'
  }
  if (before.nsw >= 2) {
    // 0-2 dead rubber, shield already gone.
    if (winner === 'QLD') return 'DEAD_RUBBER_CONSOLATION_QLD' // 1-2
    if (winner === 'NSW') return 'WHITEWASH_QLD' // 0-3
    return 'DEAD_RUBBER_DRAW'
  }
  // Live decider (1-1, or an after-draw 1-0 / 0-1 / 0-0). Shield by the two-win rule, else QLD retains.
  if (after.qld >= 2) return 'DECIDER_WON_QLD'
  if (after.nsw >= 2) return 'DECIDER_LOST_QLD'
  return 'DECIDER_DRAW_RETAIN'
}
