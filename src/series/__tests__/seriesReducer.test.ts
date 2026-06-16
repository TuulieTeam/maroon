import { describe, expect, it } from 'vitest'
import type { Position } from '../../data/types'
import { POSITION_ORDER } from '../../data/positions'
import type { MatchStats, Score, Side } from '../../engine'
import { gameSeed } from '../seed'
import { applyGameResult, concludeSeries, initSeries, type PlayedGame } from '../seriesReducer'
import type { SeriesState } from '../types'

function lineup(): Record<Position, string> {
  const map = {} as Record<Position, string>
  for (const pos of POSITION_ORDER) map[pos] = `q-${pos}`
  return map
}

function played(winner: Side | 'DRAW', qld = winner === 'QLD' ? 18 : 12, nsw = winner === 'NSW' ? 18 : 12): PlayedGame {
  const finalScore: Score = winner === 'DRAW' ? { qld: 12, nsw: 12 } : { qld, nsw }
  return { qldLineup: lineup(), qldKickerId: 'q-HB', finalScore, winner, events: [], stats: { players: {} } as MatchStats }
}

function run(state: SeriesState, ...winners: (Side | 'DRAW')[]): SeriesState {
  return winners.reduce((s, w) => applyGameResult(s, played(w)), state)
}

describe('initSeries', () => {
  it('starts scoreless on game 1, in progress, no shield', () => {
    const s = initSeries(999)
    expect(s).toMatchObject({
      schemaVersion: 2,
      rootSeed: 999,
      currentGame: 1,
      seriesScore: { qld: 0, nsw: 0 },
      games: [],
      status: 'in-progress',
    })
    expect(s.seriesWinner).toBeUndefined()
  })

  it('coerces rootSeed to uint32', () => {
    expect(initSeries(-1).rootSeed).toBe(0xffffffff)
  })
})

describe('applyGameResult — records and tally', () => {
  it('stores an immutable record with derived seed and venue, advances the cursor', () => {
    const s = applyGameResult(initSeries(7), played('QLD'))
    expect(s.games).toHaveLength(1)
    expect(s.games[0]).toMatchObject({
      gameNumber: 1,
      venueId: 'SUNCORP',
      seed: gameSeed(7, 1),
      winner: 'QLD',
      qldKickerId: 'q-HB',
    })
    expect(s.currentGame).toBe(2)
    expect(s.seriesScore).toEqual({ qld: 1, nsw: 0 })
    expect(s.status).toBe('in-progress')
    expect(s.seriesWinner).toBeUndefined()
  })

  it('does not mutate the input state', () => {
    const s0 = initSeries(7)
    applyGameResult(s0, played('QLD'))
    expect(s0.games).toHaveLength(0)
    expect(s0.currentGame).toBe(1)
  })
})

describe('applyGameResult — shield outcomes', () => {
  it('QLD clinches 2-0 at game 2; shield set but game 3 dead rubber still pending', () => {
    const s = run(initSeries(1), 'QLD', 'QLD')
    expect(s.seriesScore).toEqual({ qld: 2, nsw: 0 })
    expect(s.seriesWinner).toBe('QLD')
    expect(s.status).toBe('in-progress')
    expect(s.currentGame).toBe(3)
  })

  it('plays the dead rubber to a 3-0 sweep; series completes', () => {
    const s = run(initSeries(1), 'QLD', 'QLD', 'QLD')
    expect(s.seriesScore).toEqual({ qld: 3, nsw: 0 })
    expect(s.seriesWinner).toBe('QLD')
    expect(s.status).toBe('complete')
    expect(s.games).toHaveLength(3)
  })

  it('NSW wins the series 0-2', () => {
    const s = run(initSeries(1), 'NSW', 'NSW')
    expect(s.seriesWinner).toBe('NSW')
    expect(s.status).toBe('in-progress')
    expect(s.currentGame).toBe(3)
  })

  it('1-1 forces a live decider — no shield until game 3', () => {
    const s = run(initSeries(1), 'QLD', 'NSW')
    expect(s.seriesScore).toEqual({ qld: 1, nsw: 1 })
    expect(s.seriesWinner).toBeUndefined()
    expect(s.currentGame).toBe(3)
    const won = applyGameResult(s, played('QLD'))
    expect(won.seriesWinner).toBe('QLD')
    expect(won.status).toBe('complete')
  })

  it('a drawn decider at 1-1 retains the shield for QLD', () => {
    const s = run(initSeries(1), 'QLD', 'NSW', 'DRAW')
    expect(s.seriesScore).toEqual({ qld: 1, nsw: 1 })
    expect(s.status).toBe('complete')
    expect(s.seriesWinner).toBe('QLD')
  })

  it('an entirely drawn series retains the shield for QLD', () => {
    const s = run(initSeries(1), 'DRAW', 'DRAW', 'DRAW')
    expect(s.seriesScore).toEqual({ qld: 0, nsw: 0 })
    expect(s.status).toBe('complete')
    expect(s.seriesWinner).toBe('QLD')
  })

  it('is a no-op once complete', () => {
    const s = run(initSeries(1), 'QLD', 'QLD', 'QLD')
    expect(applyGameResult(s, played('NSW'))).toBe(s)
  })
})

describe('concludeSeries — skipping a dead rubber', () => {
  it('closes a clinched series early without playing game 3', () => {
    const s = run(initSeries(1), 'QLD', 'QLD')
    const done = concludeSeries(s)
    expect(done.status).toBe('complete')
    expect(done.seriesWinner).toBe('QLD')
    expect(done.games).toHaveLength(2)
  })

  it('refuses to skip a live (undecided) series', () => {
    const s = run(initSeries(1), 'QLD', 'NSW') // 1-1, live decider pending
    expect(concludeSeries(s)).toBe(s)
  })
})
