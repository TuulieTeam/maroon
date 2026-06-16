import { describe, expect, it } from 'vitest'
import type { MatchStats } from '../../engine'
import { buildSeriesContext } from '../buildContext'
import { applyGameResult, initSeries, type PlayedGame } from '../seriesReducer'

const qldWin: PlayedGame = {
  qldLineup: {} as PlayedGame['qldLineup'],
  qldKickerId: 'q-HB',
  finalScore: { qld: 20, nsw: 10 },
  winner: 'QLD',
  events: [],
  stats: { players: {} } as MatchStats,
}

describe('buildSeriesContext', () => {
  it('game 1 of a fresh series is the Brisbane opener at 0-0', () => {
    const ctx = buildSeriesContext(initSeries(1))
    expect(ctx.gameNumber).toBe(1)
    expect(ctx.seriesScore).toEqual({ qld: 0, nsw: 0 })
    expect(ctx.venue.id).toBe('SUNCORP')
    expect(ctx.venue.city).toBe('Brisbane')
    expect(ctx.stakes).toBe('OPENER')
  })

  it('after a QLD game-1 win, game 2 is the Sydney can-clinch at 1-0', () => {
    const ctx = buildSeriesContext(applyGameResult(initSeries(1), qldWin))
    expect(ctx.gameNumber).toBe(2)
    expect(ctx.seriesScore).toEqual({ qld: 1, nsw: 0 })
    expect(ctx.venue.id).toBe('ACCOR_SYD')
    expect(ctx.stakes).toBe('G2_CAN_CLINCH')
  })

  it('seriesScore in the context is a copy, not a live reference', () => {
    const state = initSeries(1)
    const ctx = buildSeriesContext(state)
    ctx.seriesScore.qld = 99
    expect(state.seriesScore.qld).toBe(0)
  })
})
