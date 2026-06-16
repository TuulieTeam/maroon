import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import { defaultSetup } from './fixtures'

describe('simulateMatch determinism', () => {
  it('produces an identical event stream and score for the same seed', () => {
    const setup = defaultSetup()
    const a = simulateMatch(setup, 2024)
    const b = simulateMatch(setup, 2024)
    expect(a.finalScore).toEqual(b.finalScore)
    expect(a.events.length).toBe(b.events.length)
    expect(a.events.map((e) => e.commentary)).toEqual(b.events.map((e) => e.commentary))
    expect(a.events.map((e) => e.type)).toEqual(b.events.map((e) => e.type))
  })

  it('produces different matches for different seeds', () => {
    const setup = defaultSetup()
    const a = simulateMatch(setup, 1)
    const b = simulateMatch(setup, 9999)
    const differs =
      a.finalScore.qld !== b.finalScore.qld ||
      a.finalScore.nsw !== b.finalScore.nsw ||
      a.events.length !== b.events.length
    expect(differs).toBe(true)
  })
})

describe('simulateMatch invariants', () => {
  const seeds = [1, 2, 3, 7, 42, 100, 256, 777, 2024, 31337]

  it('clock-driven events are well-formed across many seeds', () => {
    for (const seed of seeds) {
      const result = simulateMatch(defaultSetup(), seed)
      const { events } = result

      const halfTimes = events.filter((e) => e.type === 'HALF_TIME')
      const fullTimes = events.filter((e) => e.type === 'FULL_TIME')
      expect(halfTimes.length).toBe(1)
      expect(fullTimes.length).toBe(1)
      expect(events[events.length - 1].type).toBe('FULL_TIME')

      for (const e of events) {
        expect(e.minute).toBeGreaterThanOrEqual(0)
        expect(e.minute).toBeLessThanOrEqual(80)
      }

      let prevQld = 0
      let prevNsw = 0
      for (const e of events) {
        expect(e.score.qld).toBeGreaterThanOrEqual(prevQld)
        expect(e.score.nsw).toBeGreaterThanOrEqual(prevNsw)
        prevQld = e.score.qld
        prevNsw = e.score.nsw
      }

      expect(result.finalScore.qld).toBe(prevQld)
      expect(result.finalScore.nsw).toBe(prevNsw)

      // seq is strictly increasing
      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBeGreaterThan(events[i - 1].seq)
      }
    }
  })

  it('total tries land in a sane band on average', () => {
    let total = 0
    const n = 60
    for (let seed = 0; seed < n; seed++) {
      const r = simulateMatch(defaultSetup(), seed)
      total += r.stats.tries.QLD + r.stats.tries.NSW
    }
    const avg = total / n
    expect(avg).toBeGreaterThan(4)
    expect(avg).toBeLessThan(16)
  })

  it('winner matches the final score', () => {
    for (const seed of seeds) {
      const r = simulateMatch(defaultSetup(), seed)
      if (r.finalScore.qld > r.finalScore.nsw) expect(r.winner).toBe('QLD')
      else if (r.finalScore.nsw > r.finalScore.qld) expect(r.winner).toBe('NSW')
      else expect(r.winner).toBe('DRAW')
    }
  })
})
