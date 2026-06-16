import { describe, expect, it } from 'vitest'
import { makeRng, chance, pick, gauss } from '../rng'

describe('mulberry32 rng', () => {
  it('is reproducible for a fixed seed', () => {
    const a = makeRng(12345)
    const b = makeRng(12345)
    const seqA = Array.from({ length: 50 }, () => a())
    const seqB = Array.from({ length: 50 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different streams for different seeds', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('emits values in [0, 1)', () => {
    const rng = makeRng(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is roughly uniform across deciles', () => {
    const rng = makeRng(7)
    const buckets = new Array(10).fill(0)
    const n = 100_000
    for (let i = 0; i < n; i++) {
      buckets[Math.min(9, Math.floor(rng() * 10))] += 1
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(n * 0.08)
      expect(count).toBeLessThan(n * 0.12)
    }
  })

  it('chance respects probability bounds', () => {
    const rng = makeRng(3)
    expect(chance(makeRng(3), 0)).toBe(false)
    expect(chance(makeRng(3), 1)).toBe(true)
    let hits = 0
    for (let i = 0; i < 10_000; i++) if (chance(rng, 0.3)) hits++
    expect(hits / 10_000).toBeGreaterThan(0.27)
    expect(hits / 10_000).toBeLessThan(0.33)
  })

  it('pick returns an array member', () => {
    const rng = makeRng(42)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 100; i++) expect(arr).toContain(pick(rng, arr))
  })

  it('gauss centres near the mean', () => {
    const rng = makeRng(11)
    let sum = 0
    const n = 20_000
    for (let i = 0; i < n; i++) sum += gauss(rng, 5, 1)
    const mean = sum / n
    expect(mean).toBeGreaterThan(4.9)
    expect(mean).toBeLessThan(5.1)
  })
})
