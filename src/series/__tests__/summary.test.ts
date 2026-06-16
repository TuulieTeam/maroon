import { describe, expect, it } from 'vitest'
import type { PlayerOfMatch, Side } from '../../engine'
import type { SeriesGameRecord } from '../types'
import { pickSeriesMvp, summariseSeries } from '../summary'

function rec(gameNumber: 1 | 2 | 3, winner: Side | 'DRAW'): SeriesGameRecord {
  return {
    gameNumber,
    venueId: gameNumber === 1 ? 'SUNCORP' : gameNumber === 2 ? 'ACCOR_SYD' : 'MCG',
    seed: gameNumber,
    qldLineup: {} as SeriesGameRecord['qldLineup'],
    qldKickerId: 'q-HB',
    finalScore: { qld: 0, nsw: 0 },
    winner,
  }
}

describe('summariseSeries', () => {
  it('2-0 then a played dead rubber: deadRubberFrom = 3', () => {
    const r = summariseSeries([rec(1, 'QLD'), rec(2, 'QLD'), rec(3, 'NSW')])
    expect(r.seriesScore).toEqual({ qld: 2, nsw: 1 })
    expect(r.seriesWinner).toBe('QLD')
    expect(r.deadRubberFrom).toBe(3)
  })

  it('a live decider (1-1 then a result) has no dead rubber', () => {
    const r = summariseSeries([rec(1, 'QLD'), rec(2, 'NSW'), rec(3, 'QLD')])
    expect(r.seriesScore).toEqual({ qld: 2, nsw: 1 })
    expect(r.deadRubberFrom).toBeNull()
  })

  it('a clinch at game 2 with the dead rubber skipped has no dead rubber game on record', () => {
    const r = summariseSeries([rec(1, 'QLD'), rec(2, 'QLD')])
    expect(r.seriesWinner).toBe('QLD')
    expect(r.deadRubberFrom).toBeNull()
  })

  it('a drawn series retains for QLD', () => {
    const r = summariseSeries([rec(1, 'DRAW'), rec(2, 'QLD'), rec(3, 'NSW')])
    expect(r.seriesScore).toEqual({ qld: 1, nsw: 1 })
    expect(r.seriesWinner).toBe('QLD')
    expect(r.deadRubberFrom).toBeNull()
  })
})

describe('pickSeriesMvp', () => {
  const potm = (id: string, rating: number): PlayerOfMatch => ({
    id,
    name: id,
    side: 'QLD',
    rating,
    line: { id } as PlayerOfMatch['line'],
  })

  it('picks the highest rating', () => {
    expect(pickSeriesMvp([potm('a', 7), potm('b', 9), potm('c', 8)]).id).toBe('b')
  })

  it('breaks ties by id ascending (deterministic)', () => {
    expect(pickSeriesMvp([potm('z', 9), potm('a', 9)]).id).toBe('a')
  })
})
