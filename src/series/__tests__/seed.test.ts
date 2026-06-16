import { describe, expect, it } from 'vitest'
import { gameSeed, seriesSeeds } from '../seed'

describe('gameSeed', () => {
  it('game 1 equals the rootSeed (legacy single-match stays byte-identical)', () => {
    for (const root of [0, 1, 12345, 0xdeadbeef, Date_now_like()]) {
      expect(gameSeed(root, 1)).toBe(root >>> 0)
    }
  })

  it('produces three distinct, stable, uint32 seeds', () => {
    const root = 0x1234abcd
    const seeds = seriesSeeds(root)
    expect(new Set(seeds).size).toBe(3)
    for (const s of seeds) {
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(0xffffffff)
    }
    // Deterministic — same root, same seeds.
    expect(seriesSeeds(root)).toEqual(seeds)
  })

  it('different roots give different per-game seeds', () => {
    expect(seriesSeeds(1)).not.toEqual(seriesSeeds(2))
  })
})

// A large positive integer standing in for a Date.now()-style seed without using Date in the test.
function Date_now_like(): number {
  return 1_718_000_000_000 % 0xffffffff
}
