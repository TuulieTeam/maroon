import { describe, expect, it } from 'vitest'
import type { PlayerOfMatch, Score, Side, VenueId } from '../../engine'
import type { Position } from '../../data/types'
import { buildShareCard } from '../shareCard'
import type { GameNo, SeriesGameRecord, SeriesState } from '../types'

function game(gameNumber: GameNo, venueId: VenueId, winner: Side | 'DRAW', qld: number, nsw: number): SeriesGameRecord {
  return {
    gameNumber,
    venueId,
    seed: 1,
    qldLineup: {} as Record<Position, string>,
    qldKickerId: 'k',
    finalScore: { qld, nsw },
    winner,
  }
}

function complete(games: SeriesGameRecord[], score: Score, seriesWinner: Side): SeriesState {
  return {
    schemaVersion: 3,
    rootSeed: 1,
    opponentId: 'classic',
    currentGame: 3,
    seriesScore: score,
    games,
    status: 'complete',
    seriesWinner,
    playerConditions: {},
  }
}

const MVP = { id: 'grant', name: 'Harry Grant', side: 'QLD', rating: 8.4, line: {} } as unknown as PlayerOfMatch

describe('buildShareCard', () => {
  it('renders a QLD shield win with squares, grounds, scores and the MVP', () => {
    const state = complete(
      [game(1, 'SUNCORP', 'QLD', 24, 12), game(2, 'ACCOR_SYD', 'NSW', 10, 18), game(3, 'MCG', 'QLD', 20, 16)],
      { qld: 2, nsw: 1 },
      'QLD',
    )
    const text = buildShareCard(state, MVP)
    expect(text).toContain('MAROON · State of Origin 2026')
    expect(text).toContain('Queensland win the shield 2–1')
    expect(text).toContain('🟩 Suncorp 24–12')
    expect(text).toContain('🟥 Accor 10–18')
    expect(text).toContain('🟩 the MCG 20–16')
    expect(text).toContain('👑 Player of the Series: Harry Grant (QLD)')
  })

  it('names NSW when the Blues win', () => {
    const state = complete(
      [game(1, 'SUNCORP', 'NSW', 12, 13), game(2, 'ACCOR_SYD', 'NSW', 6, 22)],
      { qld: 0, nsw: 2 },
      'NSW',
    )
    expect(buildShareCard(state, null)).toContain('New South Wales win the shield 2–0')
  })

  it('says retain on a drawn series', () => {
    const state = complete(
      [game(1, 'SUNCORP', 'QLD', 20, 10), game(2, 'ACCOR_SYD', 'NSW', 8, 14), game(3, 'MCG', 'DRAW', 16, 16)],
      { qld: 1, nsw: 1 },
      'QLD',
    )
    const text = buildShareCard(state, null)
    expect(text).toContain('Queensland retain the shield 1–1')
    expect(text).toContain('🟨 the MCG 16–16')
  })

  it('omits the MVP line when none was seen', () => {
    const state = complete([game(1, 'SUNCORP', 'QLD', 20, 10)], { qld: 1, nsw: 0 }, 'QLD')
    expect(buildShareCard(state, null)).not.toContain('👑')
  })
})
