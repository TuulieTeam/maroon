import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import { buildBroadcast } from '../broadcast'
import { deriveWrap } from '../series'
import type { MatchResult, Score, SeriesContext, SeriesStakes, Side, Venue } from '../types'
import { defaultSetup } from './fixtures'

// Venues are pinned to homeAdvantage 0 here so these BOOTH-CONTENT tests stay isolated from the
// home-ground rating edge — the edge's own behaviour is covered in homeEdge.test.ts.
const SUNCORP: Venue = { id: 'SUNCORP', stadium: 'Suncorp Stadium', groundShort: 'Suncorp', city: 'Brisbane', homeSide: 'QLD', homeAdvantage: 0 }
const ACCOR: Venue = { id: 'ACCOR_SYD', stadium: 'Accor Stadium', groundShort: 'Accor', city: 'Sydney', homeSide: 'NSW', homeAdvantage: 0 }
const MCG: Venue = { id: 'MCG', stadium: 'the MCG', groundShort: 'the MCG', city: 'Melbourne', homeSide: 'NSW', homeAdvantage: 0 }

function series(gameNumber: 1 | 2 | 3, seriesScore: Score, stakes: SeriesStakes, venue: Venue): SeriesContext {
  return { gameNumber, seriesScore, venue, stakes }
}

function withSeries(ctx: SeriesContext) {
  return { ...defaultSetup(), series: ctx }
}

function allLines(b: MatchResult['broadcast']): string[] {
  return [...b.preGame, ...b.halfTime, ...b.postGame].map((s) => s.line)
}

// The post-game decider clauses (replicated to assert end-to-end wrap injection without exporting the
// internal copy map). Keep in sync with SERIES_WRAP_CLAUSE in broadcast.ts.
const DECIDER_CLAUSE: Record<'DECIDER_WON_QLD' | 'DECIDER_LOST_QLD' | 'DECIDER_DRAW_RETAIN', string> = {
  DECIDER_WON_QLD: 'QUEENSLAND WIN THE SHIELD! They take the decider and the series.',
  DECIDER_LOST_QLD: 'Heartbreak — the Blues win the decider and the series.',
  DECIDER_DRAW_RETAIN: 'They couldn’t be separated in the decider — Queensland keep the shield.',
}

describe('series-aware broadcast — determinism', () => {
  it('buildBroadcast is pure for the same series inputs', () => {
    const setup = withSeries(series(2, { qld: 1, nsw: 0 }, 'G2_CAN_CLINCH', ACCOR))
    const result = simulateMatch(setup, 1234)
    const a = buildBroadcast(setup, result, 1234)
    const b = buildBroadcast(setup, result, 1234)
    expect(a).toEqual(b)
  })

  it('a series seed reproduces deep-equal broadcast and an unchanged event stream', () => {
    const setup = withSeries(series(3, { qld: 1, nsw: 1 }, 'G3_DECIDER', MCG))
    const r1 = simulateMatch(setup, 99)
    const r2 = simulateMatch(setup, 99)
    expect(r1.broadcast).toEqual(r2.broadcast)
    expect(r1.events).toEqual(r2.events)
  })

  it('attaching series context does not perturb the match event stream vs the no-series default', () => {
    // The booth draws from its own salted rng, and a neutral venue (homeAdvantage 0) adds no rating
    // edge, so the play-by-play must be identical with or without a series context for a fixed seed.
    const base = simulateMatch(defaultSetup(), 555)
    const withCtx = simulateMatch(withSeries(series(1, { qld: 0, nsw: 0 }, 'OPENER', SUNCORP)), 555)
    expect(withCtx.events).toEqual(base.events)
    expect(withCtx.finalScore).toEqual(base.finalScore)
  })
})

describe('series-aware broadcast — content integrity', () => {
  const CONTEXTS: SeriesContext[] = [
    series(1, { qld: 0, nsw: 0 }, 'OPENER', SUNCORP),
    series(2, { qld: 1, nsw: 0 }, 'G2_CAN_CLINCH', ACCOR),
    series(2, { qld: 0, nsw: 1 }, 'G2_MUST_WIN', ACCOR),
    series(3, { qld: 1, nsw: 1 }, 'G3_DECIDER', MCG),
    series(3, { qld: 2, nsw: 0 }, 'G3_DEAD_RUBBER_QLD_UP', MCG),
  ]

  it('no unsubstituted tokens, no empty-token double spaces, non-empty lines', () => {
    for (const ctx of CONTEXTS) {
      for (const seed of [1, 7, 42, 808]) {
        const result = simulateMatch(withSeries(ctx), seed)
        for (const line of allLines(result.broadcast)) {
          expect(line.trim().length).toBeGreaterThan(0)
          expect(line).not.toMatch(/\{[a-zA-Z]+\}/)
          expect(line, `double space in: "${line}"`).not.toMatch(/ {2,}/)
        }
      }
    }
  })

  it('segment counts stay in band with a series attached', () => {
    const result = simulateMatch(withSeries(CONTEXTS[1]), 42)
    expect(result.broadcast.preGame.length).toBeGreaterThanOrEqual(4)
    expect(result.broadcast.preGame.length).toBeLessThanOrEqual(5)
    expect(result.broadcast.halfTime.length).toBeGreaterThanOrEqual(3)
    expect(result.broadcast.halfTime.length).toBeLessThanOrEqual(4)
    expect(result.broadcast.postGame.length).toBeGreaterThanOrEqual(4)
    expect(result.broadcast.postGame.length).toBeLessThanOrEqual(5)
  })
})

describe('series-aware broadcast — names the game, venue and stakes', () => {
  it('the pre-game names the game label and venue (Origin II at Accor Stadium)', () => {
    const result = simulateMatch(withSeries(series(2, { qld: 1, nsw: 0 }, 'G2_CAN_CLINCH', ACCOR)), 3)
    const pre = result.broadcast.preGame.map((s) => s.line).join(' ')
    expect(pre).toContain('Origin II')
    expect(pre).toContain('Accor Stadium')
  })

  it('the pre-game surfaces the exact stakes clause', () => {
    const clinch = 'Queensland lead the series one-nil and can wrap up the shield tonight.'
    for (const seed of [1, 5, 19]) {
      const result = simulateMatch(withSeries(series(2, { qld: 1, nsw: 0 }, 'G2_CAN_CLINCH', ACCOR)), seed)
      const named = result.broadcast.preGame.some((s) => s.line.includes(clinch))
      expect(named).toBe(true)
    }
  })

  it('the post-game wrap clause matches the derived decider outcome', () => {
    const before: Score = { qld: 1, nsw: 1 }
    for (const seed of [2, 13, 77, 404, 909]) {
      const result = simulateMatch(withSeries(series(3, before, 'G3_DECIDER', MCG)), seed)
      const winner: Side | 'DRAW' = result.winner
      const bucket = deriveWrap(3, before, winner) as keyof typeof DECIDER_CLAUSE
      const expectedClause = DECIDER_CLAUSE[bucket]
      const wrapped = result.broadcast.postGame.some((s) => s.line.includes(expectedClause))
      expect(wrapped, `seed ${seed} winner ${winner} expected "${expectedClause}"`).toBe(true)
    }
  })
})
