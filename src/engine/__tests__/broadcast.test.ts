import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import { buildBroadcast, yourEdgeFor, yourEdgePhrase } from '../broadcast'
import type { Channel } from '../../data/types'
import type { MatchResult, Segment } from '../types'
import { defaultSetup, makePlayer } from './fixtures'

function allSegments(b: MatchResult['broadcast']): Segment[] {
  return [...b.preGame, ...b.halfTime, ...b.postGame]
}

describe('broadcast determinism', () => {
  it('buildBroadcast is pure for the same inputs', () => {
    const setup = defaultSetup()
    const result = simulateMatch(setup, 1234)
    const a = buildBroadcast(setup, result, 1234)
    const b = buildBroadcast(setup, result, 1234)
    expect(a).toEqual(b)
  })

  it('two simulateMatch runs with the same seed produce deep-equal broadcasts', () => {
    const r1 = simulateMatch(defaultSetup(), 99)
    const r2 = simulateMatch(defaultSetup(), 99)
    expect(r1.broadcast).toEqual(r2.broadcast)
  })

  it('the salted broadcast rng does not perturb the match event stream', () => {
    // The whole result (incl. broadcast) is computed in simulateMatch; the event stream must be
    // byte-identical run to run for a fixed seed.
    const r1 = simulateMatch(defaultSetup(), 555)
    const r2 = simulateMatch(defaultSetup(), 555)
    expect(r1.events).toEqual(r2.events)
    expect(r1.finalScore).toEqual(r2.finalScore)
  })
})

describe('broadcast content integrity', () => {
  it('every segment line has no unsubstituted tokens and is non-empty', () => {
    for (const seed of [1, 2, 7, 50, 808, 2024, 31337]) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const s of allSegments(result.broadcast)) {
        expect(s.line.trim().length).toBeGreaterThan(0)
        expect(s.line).not.toMatch(/\{[a-zA-Z]+\}/)
        expect(s.persona.trim().length).toBeGreaterThan(0)
        expect(s.role.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('fixed segment counts per slot', () => {
    const result = simulateMatch(defaultSetup(), 42)
    expect(result.broadcast.preGame.length).toBeGreaterThanOrEqual(4)
    expect(result.broadcast.preGame.length).toBeLessThanOrEqual(5)
    expect(result.broadcast.halfTime.length).toBeGreaterThanOrEqual(3)
    expect(result.broadcast.halfTime.length).toBeLessThanOrEqual(4)
    expect(result.broadcast.postGame.length).toBeGreaterThanOrEqual(4)
    expect(result.broadcast.postGame.length).toBeLessThanOrEqual(5)
  })
})

describe('broadcast real facts', () => {
  it('a post-game line names the actual player of the match', () => {
    for (const seed of [3, 11, 77, 404]) {
      const result = simulateMatch(defaultSetup(), seed)
      const named = result.broadcast.postGame.some((s) => s.line.includes(result.playerOfMatch.name))
      expect(named).toBe(true)
    }
  })

  it('a half-time line surfaces the leaking edge for the most-targeted NSW channel', () => {
    // Find a seed where NSW scored in the first half so a leaking edge is derivable.
    let checked = false
    for (let seed = 1; seed <= 400 && !checked; seed++) {
      const result = simulateMatch(defaultSetup(), seed)
      const htIdx = result.events.findIndex((e) => e.type === 'HALF_TIME')
      if (htIdx === -1) continue
      const firstHalf = result.events.slice(0, htIdx + 1)
      const nswTryChannels: Record<Channel, number> = { LEFT: 0, MIDDLE: 0, RIGHT: 0 }
      for (const e of firstHalf) {
        if (e.type === 'TRY' && e.side === 'NSW' && e.channel) nswTryChannels[e.channel] += 1
      }
      const total = nswTryChannels.LEFT + nswTryChannels.MIDDLE + nswTryChannels.RIGHT
      if (total === 0) continue

      let leadCh: Channel = 'LEFT'
      let best = -1
      for (const ch of ['LEFT', 'MIDDLE', 'RIGHT'] as Channel[]) {
        if (nswTryChannels[ch] > best) {
          best = nswTryChannels[ch]
          leadCh = ch
        }
      }
      const edge = yourEdgeFor(leadCh)
      // The booth now uses a single clean QLD-POV phrase ("your right edge" / "your left edge" /
      // "through the middle"), NOT "the Blues are scoring through X, which is your Y-side defence".
      const phrase = yourEdgePhrase(edge)
      const mentioned = result.broadcast.halfTime.some((s) => s.line.includes(phrase))
      expect(mentioned).toBe(true)
      // And it must NOT double-translate: no "-side defence" double-explanation in any half-time line.
      const doubleTranslated = result.broadcast.halfTime.some((s) => s.line.includes('-side defence'))
      expect(doubleTranslated).toBe(false)
      // De-dupe: at most ONE half-time line states the leaking-edge phrase.
      const edgeMentions = result.broadcast.halfTime.filter((s) => s.line.includes(phrase)).length
      expect(edgeMentions).toBeLessThanOrEqual(1)
      checked = true
    }
    expect(checked).toBe(true)
  })
})

describe('broadcast pre-game gamble surfacing', () => {
  it('mentions an injured pick by name in the pre-game build-up', () => {
    // Inject an injured player into the QLD left centre slot; the gamble line should name him.
    const injured = makePlayer('gamble-cl', 60, undefined, 'injured')
    injured.name = 'Crocked Carl'
    const setup = defaultSetup({ CL: injured })
    const result = simulateMatch(setup, 7)
    const mentioned = result.broadcast.preGame.some((s: Segment) => s.line.includes('Crocked Carl'))
    expect(mentioned).toBe(true)
  })
})

describe('yourEdgeFor mapping', () => {
  it('maps NSW attacking channel to the QLD defensive edge', () => {
    expect(yourEdgeFor('RIGHT')).toBe('left')
    expect(yourEdgeFor('LEFT')).toBe('right')
    expect(yourEdgeFor('MIDDLE')).toBe('middle')
  })
})
