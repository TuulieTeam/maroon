import { describe, expect, it } from 'vitest'
import type { SeriesStakes } from '../../engine'
import type { GameNo } from '../types'
import { deriveStakes, gameLabel } from '../stakes'

type Row = [GameNo, number, number, SeriesStakes]

// Every reachable (gameNumber, qldWins, nswWins) before kickoff. seriesScore counts WINS only, so a
// drawn game leaves the tally level — hence the after-draw rows (G2 0-0, G3 1-0/0-1/0-0).
const ROWS: Row[] = [
  [1, 0, 0, 'OPENER'],
  [2, 1, 0, 'G2_CAN_CLINCH'],
  [2, 0, 1, 'G2_MUST_WIN'],
  [2, 0, 0, 'G2_OPEN_AFTER_DRAW'],
  [3, 1, 1, 'G3_DECIDER'],
  [3, 2, 0, 'G3_DEAD_RUBBER_QLD_UP'],
  [3, 0, 2, 'G3_DEAD_RUBBER_QLD_DOWN'],
  [3, 1, 0, 'G3_DECIDER_AFTER_DRAW'],
  [3, 0, 1, 'G3_DECIDER_AFTER_DRAW'],
  [3, 0, 0, 'G3_DECIDER_AFTER_DRAW'],
]

describe('deriveStakes', () => {
  it.each(ROWS)('game %i at %i-%i -> %s', (game, qld, nsw, expected) => {
    expect(deriveStakes(game, { qld, nsw })).toBe(expected)
  })

  it('every row maps to a defined bucket (no fall-through)', () => {
    for (const [game, qld, nsw] of ROWS) {
      expect(deriveStakes(game, { qld, nsw })).toBeTruthy()
    }
  })
})

describe('gameLabel', () => {
  it('names the three games', () => {
    expect(gameLabel(1)).toBe('Origin I')
    expect(gameLabel(2)).toBe('Origin II')
    expect(gameLabel(3)).toBe('Origin III')
  })
})
