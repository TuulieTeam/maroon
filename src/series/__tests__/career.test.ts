import { describe, expect, it } from 'vitest'
import type { PlayerOfMatch, Score, Side, VenueId } from '../../engine'
import type { Position } from '../../data/types'
import { addCompletedSeries, EMPTY_LEDGER, summariseCareer } from '../career'
import type { CareerLedger } from '../career'
import type { GameNo, SeriesGameRecord, SeriesState } from '../types'

function game(gameNumber: GameNo, venueId: VenueId, winner: Side | 'DRAW', qld: number, nsw: number): SeriesGameRecord {
  return {
    gameNumber,
    venueId,
    seed: gameNumber,
    qldLineup: {} as Record<Position, string>,
    qldKickerId: 'ponga',
    finalScore: { qld, nsw },
    winner,
  }
}

function completed(rootSeed: number, games: SeriesGameRecord[], score: Score, winner: Side): SeriesState {
  return {
    schemaVersion: 3,
    rootSeed,
    opponentId: 'classic',
    currentGame: 3,
    seriesScore: score,
    games,
    status: 'complete',
    seriesWinner: winner,
    playerConditions: {},
  }
}

function mvp(name: string, side: Side, rating: number): PlayerOfMatch {
  return { id: name.toLowerCase(), name, side, rating, line: {} } as unknown as PlayerOfMatch
}

const QLD_WIN = completed(
  1,
  [game(1, 'SUNCORP', 'QLD', 20, 10), game(2, 'ACCOR_SYD', 'NSW', 8, 14), game(3, 'MCG', 'QLD', 16, 12)],
  { qld: 2, nsw: 1 },
  'QLD',
)

describe('addCompletedSeries', () => {
  it('archives a completed series with results and the MVP', () => {
    const led = addCompletedSeries(EMPTY_LEDGER, QLD_WIN, mvp('Harry Grant', 'QLD', 8.4))
    expect(led.entries).toHaveLength(1)
    const e = led.entries[0]
    expect(e.rootSeed).toBe(1)
    expect(e.seriesWinner).toBe('QLD')
    expect(e.retained).toBe(false)
    expect(e.games).toHaveLength(3)
    expect(e.mvp).toEqual({ id: 'harry grant', name: 'Harry Grant', side: 'QLD', rating: 8.4 })
  })

  it('does not mutate the input ledger', () => {
    addCompletedSeries(EMPTY_LEDGER, QLD_WIN, null)
    expect(EMPTY_LEDGER.entries).toHaveLength(0)
  })

  it('dedupes by rootSeed — archiving the same series twice is a no-op', () => {
    const once = addCompletedSeries(EMPTY_LEDGER, QLD_WIN, null)
    const twice = addCompletedSeries(once, QLD_WIN, null)
    expect(twice.entries).toHaveLength(1)
    expect(twice).toBe(once) // unchanged reference
  })

  it('refuses to archive an incomplete series', () => {
    const inProgress: SeriesState = { ...QLD_WIN, status: 'in-progress', seriesWinner: undefined }
    expect(addCompletedSeries(EMPTY_LEDGER, inProgress, null).entries).toHaveLength(0)
  })

  it('marks a drawn series as retained', () => {
    const drawn = completed(
      2,
      [game(1, 'SUNCORP', 'QLD', 18, 6), game(2, 'ACCOR_SYD', 'NSW', 10, 16), game(3, 'MCG', 'DRAW', 14, 14)],
      { qld: 1, nsw: 1 },
      'QLD',
    )
    expect(addCompletedSeries(EMPTY_LEDGER, drawn, null).entries[0].retained).toBe(true)
  })
})

describe('summariseCareer', () => {
  it('folds shields, series and game records and ranks the MVP hall of fame', () => {
    let led: CareerLedger = EMPTY_LEDGER
    led = addCompletedSeries(led, QLD_WIN, mvp('Harry Grant', 'QLD', 8.4)) // QLD 2-1, games W L W
    led = addCompletedSeries(
      led,
      completed(2, [game(1, 'SUNCORP', 'NSW', 6, 18), game(2, 'ACCOR_SYD', 'NSW', 4, 20)], { qld: 0, nsw: 2 }, 'NSW'),
      mvp('Nathan Cleary', 'NSW', 9.1),
    ) // NSW 2-0, games L L
    led = addCompletedSeries(
      led,
      completed(
        3,
        [game(1, 'SUNCORP', 'QLD', 22, 10), game(2, 'ACCOR_SYD', 'QLD', 18, 12)],
        { qld: 2, nsw: 0 },
        'QLD',
      ),
      mvp('Harry Grant', 'QLD', 8.8),
    ) // QLD 2-0, games W W

    const s = summariseCareer(led)
    expect(s.seriesPlayed).toBe(3)
    expect(s.shieldsWon).toBe(2)
    expect(s.shieldsLost).toBe(1)
    expect(s.seriesWon).toBe(2)
    expect(s.seriesLost).toBe(1)
    expect(s.seriesDrawn).toBe(0)
    expect(s.gameWins).toBe(4)
    expect(s.gameLosses).toBe(3)
    expect(s.gameDraws).toBe(0)
    // Grant tops the hall of fame (2 MVPs, best 8.8), Cleary second.
    expect(s.mvpHallOfFame[0]).toEqual({ name: 'Harry Grant', side: 'QLD', count: 2, bestRating: 8.8 })
    expect(s.mvpHallOfFame[1]).toEqual({ name: 'Nathan Cleary', side: 'NSW', count: 1, bestRating: 9.1 })
  })

  it('is empty for an empty ledger', () => {
    const s = summariseCareer(EMPTY_LEDGER)
    expect(s.seriesPlayed).toBe(0)
    expect(s.mvpHallOfFame).toEqual([])
  })
})
