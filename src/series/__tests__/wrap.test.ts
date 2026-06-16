import { describe, expect, it } from 'vitest'
import type { Side } from '../../engine'
import type { GameNo, SeriesWrap } from '../types'
import { deriveWrap } from '../wrap'

type Winner = Side | 'DRAW'
type Row = [GameNo, number, number, Winner, SeriesWrap]

// Exhaustive over reachable (gameNumber, winsBefore, winner). `before` counts wins only.
const ROWS: Row[] = [
  // Game 1 — series 0-0.
  [1, 0, 0, 'QLD', 'LEAD_TAKEN'],
  [1, 0, 0, 'NSW', 'TRAILING'],
  [1, 0, 0, 'DRAW', 'STALEMATE'],
  // Game 2 from 1-0 (can clinch).
  [2, 1, 0, 'QLD', 'SERIES_CLINCHED_QLD'],
  [2, 1, 0, 'NSW', 'LEVELLED_DECIDER'],
  [2, 1, 0, 'DRAW', 'G2_DRAW'],
  // Game 2 from 0-1 (must win).
  [2, 0, 1, 'QLD', 'KEPT_ALIVE_DECIDER'],
  [2, 0, 1, 'NSW', 'SERIES_LOST_QLD'],
  [2, 0, 1, 'DRAW', 'G2_DRAW'],
  // Game 2 from 0-0 (game 1 drawn) — no clinch possible.
  [2, 0, 0, 'QLD', 'LEAD_TAKEN'],
  [2, 0, 0, 'NSW', 'TRAILING'],
  [2, 0, 0, 'DRAW', 'G2_DRAW'],
  // Game 3 decider 1-1.
  [3, 1, 1, 'QLD', 'DECIDER_WON_QLD'],
  [3, 1, 1, 'NSW', 'DECIDER_LOST_QLD'],
  [3, 1, 1, 'DRAW', 'DECIDER_DRAW_RETAIN'],
  // Game 3 dead rubber, QLD up 2-0.
  [3, 2, 0, 'QLD', 'SWEEP_QLD'],
  [3, 2, 0, 'NSW', 'DEAD_RUBBER_CONSOLATION_NSW'],
  [3, 2, 0, 'DRAW', 'DEAD_RUBBER_DRAW'],
  // Game 3 dead rubber, QLD down 0-2.
  [3, 0, 2, 'QLD', 'DEAD_RUBBER_CONSOLATION_QLD'],
  [3, 0, 2, 'NSW', 'WHITEWASH_QLD'],
  [3, 0, 2, 'DRAW', 'DEAD_RUBBER_DRAW'],
  // Game 3 after-draw deciders (a draw earlier leaves only one win on the board).
  [3, 1, 0, 'QLD', 'DECIDER_WON_QLD'], // -> 2-0 wins
  [3, 1, 0, 'NSW', 'DECIDER_DRAW_RETAIN'], // -> 1-1 drawn series, QLD retains
  [3, 1, 0, 'DRAW', 'DECIDER_DRAW_RETAIN'],
  [3, 0, 1, 'QLD', 'DECIDER_DRAW_RETAIN'], // -> 1-1 drawn series, QLD retains
  [3, 0, 1, 'NSW', 'DECIDER_LOST_QLD'], // -> 0-2 NSW takes it
  [3, 0, 1, 'DRAW', 'DECIDER_DRAW_RETAIN'],
  [3, 0, 0, 'QLD', 'DECIDER_DRAW_RETAIN'], // two draws then a win -> 1-0, no side on two
  [3, 0, 0, 'NSW', 'DECIDER_DRAW_RETAIN'],
  [3, 0, 0, 'DRAW', 'DECIDER_DRAW_RETAIN'],
]

describe('deriveWrap', () => {
  it.each(ROWS)('game %i from %i-%i, %s wins -> %s', (game, qld, nsw, winner, expected) => {
    expect(deriveWrap(game, { qld, nsw }, winner)).toBe(expected)
  })
})
