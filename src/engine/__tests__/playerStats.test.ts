import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import { defaultSetup } from './fixtures'

const SEEDS = [1, 2, 3, 7, 42, 100, 256, 777, 2024, 31337]

describe('per-player stats reconcile with team stats', () => {
  it('sum of players tries per side equals stats.tries[side]', () => {
    for (const seed of SEEDS) {
      const { stats } = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const sum = Object.values(stats.players)
          .filter((p) => p.side === side)
          .reduce((acc, p) => acc + p.tries, 0)
        expect(sum).toBe(stats.tries[side])
      }
    }
  })

  it('sum of players line breaks per side equals stats.lineBreaks[side]', () => {
    for (const seed of SEEDS) {
      const { stats } = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const sum = Object.values(stats.players)
          .filter((p) => p.side === side)
          .reduce((acc, p) => acc + p.lineBreaks, 0)
        expect(sum).toBe(stats.lineBreaks[side])
      }
    }
  })

  it('sum of players errors per side equals stats.errors[side]', () => {
    for (const seed of SEEDS) {
      const { stats } = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const sum = Object.values(stats.players)
          .filter((p) => p.side === side)
          .reduce((acc, p) => acc + p.errors, 0)
        expect(sum).toBe(stats.errors[side])
      }
    }
  })
})

describe('player of the match', () => {
  it('is a real player from one of the squads and carries a populated stat line', () => {
    for (const seed of SEEDS) {
      const result = simulateMatch(defaultSetup(), seed)
      const potm = result.playerOfMatch
      expect(result.stats.players[potm.id]).toBeDefined()
      expect(potm.name.length).toBeGreaterThan(0)
      expect(potm.line.id).toBe(potm.id)
    }
  })

  it('is winner-biased: on a decisive result the POTM usually comes from the winning side', () => {
    let decisive = 0
    let fromWinner = 0
    for (let seed = 0; seed < 120; seed++) {
      const result = simulateMatch(defaultSetup(), seed)
      if (result.winner === 'DRAW') continue
      decisive += 1
      if (result.playerOfMatch.side === result.winner) fromWinner += 1
    }
    expect(decisive).toBeGreaterThan(0)
    const share = fromWinner / decisive
    // eslint-disable-next-line no-console
    console.log(`[playerStats] POTM from winning side ${fromWinner}/${decisive} (${(share * 100).toFixed(0)}%)`)
    expect(share).toBeGreaterThan(0.6)
  })
})
