import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import { makeRng } from '../rng'
import { bucketPhase, bucketScoreline, renderCommentary } from '../commentary'
import type { CommentaryContext } from '../commentary'
import type { KickType } from '../types'
import { defaultSetup, makePlayer } from './fixtures'

const NAMED_TYPES = new Set(['HIT_UP', 'TACKLE', 'MISSED_TACKLE', 'LINE_BREAK', 'TRY', 'ERROR'])

describe('commentary integrity', () => {
  it('every event has non-empty commentary with no unsubstituted tokens', () => {
    for (const seed of [1, 2, 50, 808, 2024]) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const e of result.events) {
        expect(e.commentary.trim().length).toBeGreaterThan(0)
        expect(e.commentary).not.toMatch(/\{[a-zA-Z]+\}/)
      }
    }
  })

  it('named events include the relevant player name', () => {
    const result = simulateMatch(defaultSetup(), 4242)
    for (const e of result.events) {
      if (!NAMED_TYPES.has(e.type)) continue
      const names = [e.attacker?.name, e.defender?.name].filter(Boolean) as string[]
      const mentioned = names.some((n) => e.commentary.includes(n))
      expect(mentioned).toBe(true)
    }
  })

  it('interchange lines name both the incoming and outgoing players', () => {
    const result = simulateMatch(defaultSetup(), 13)
    const interchanges = result.events.filter((e) => e.type === 'INTERCHANGE')
    // Forwards fatigue over 80 minutes, so at least one rotation should occur.
    expect(interchanges.length).toBeGreaterThan(0)
    for (const e of interchanges) {
      expect(e.commentary).toContain(e.attacker!.name)
      expect(e.commentary).toContain(e.playerOff!.name)
    }
  })
})

describe('repeat-targeting framing', () => {
  it('fires escalating framing once a channel is hit 3+ times', () => {
    const ctx: CommentaryContext = {
      rng: makeRng(1),
      channelTargetCount: 0,
      score: { qld: 0, nsw: 0 },
      lastTemplateIndex: new Map(),
      minute: 20,
      scoreline: 'tight',
      phase: 'middle',
    }
    const attacker = makePlayer('atk', 70, { attack: 90 })
    const defender = makePlayer('Leaky Lad', 30)

    const lines: string[] = []
    for (let hit = 1; hit <= 5; hit++) {
      ctx.channelTargetCount = hit
      lines.push(
        renderCommentary(
          { type: 'TRY', side: 'NSW', channel: 'LEFT', attacker, defender },
          ctx,
        ),
      )
    }

    expect(lines[2]).toMatch(/third time/i)
    expect(lines[4]).toMatch(/all night|living at/i)
    expect(lines[2]).toContain('Leaky Lad')
  })
})

describe('kick-type-aware play-by-play (Pass 2)', () => {
  const KICK_TYPES: KickType[] = [
    'CLEARING',
    'BOMB',
    'GRUBBER',
    'CROSS_FIELD',
    'FORTY_TWENTY',
    'FIELD_GOAL',
    'TOUCH',
  ]

  // Words that uniquely belong to ONE kick type's flavour lines — a render for another type must
  // never contain them (the universal-fallback lines are generic and contain none of these).
  const FOREIGN_KEYWORDS: Record<KickType, RegExp[]> = {
    CLEARING: [/grubber/i, /\bbomb\b/i, /cross-field/i, /40\/20/i, /forty-twenty/i, /pocket/i, /one-pointer/i],
    BOMB: [/grubber/i, /clearing/i, /cross-field/i, /40\/20/i, /forty-twenty/i, /pocket/i, /one-pointer/i],
    GRUBBER: [/\bbomb\b/i, /clearing/i, /cross-field/i, /40\/20/i, /forty-twenty/i, /pocket/i, /one-pointer/i],
    CROSS_FIELD: [/grubber/i, /clearing/i, /40\/20/i, /forty-twenty/i, /pocket/i, /one-pointer/i],
    FORTY_TWENTY: [/grubber/i, /\bbomb\b/i, /clearing/i, /cross-field/i, /pocket/i, /one-pointer/i],
    FIELD_GOAL: [/grubber/i, /\bbomb\b/i, /clearing/i, /cross-field/i, /40\/20/i, /forty-twenty/i],
    TOUCH: [/grubber/i, /\bbomb\b/i, /cross-field/i, /40\/20/i, /forty-twenty/i, /pocket/i, /one-pointer/i],
  }

  function renderKickLines(kickType: KickType): string[] {
    const attacker = makePlayer('Boot', 70, { composure: 85 })
    const lines: string[] = []
    // A fresh ctx per render (independent rng seed) so we sample the whole pool, not the repeat-walk.
    for (let seed = 0; seed < 60; seed++) {
      const ctx: CommentaryContext = {
        rng: makeRng(seed * 2654435761),
        channelTargetCount: 0,
        score: { qld: 6, nsw: 6 },
        lastTemplateIndex: new Map(),
        minute: 50,
        scoreline: 'tight',
        phase: 'middle',
        fieldZone: 'middle',
      }
      lines.push(
        renderCommentary({ type: 'KICK', side: 'QLD', channel: 'MIDDLE', attacker, kickType }, ctx),
      )
    }
    return lines
  }

  it('each kick type renders ≥3 distinct, non-empty, leak-free lines', () => {
    for (const kt of KICK_TYPES) {
      const lines = renderKickLines(kt)
      const distinct = new Set(lines)
      expect(distinct.size, `${kt} distinct kick lines`).toBeGreaterThanOrEqual(3)
      for (const line of distinct) {
        expect(line.trim().length, `${kt} non-empty`).toBeGreaterThan(0)
        expect(line, `${kt} no token leak`).not.toMatch(/\{[a-zA-Z]+\}/)
      }
    }
  })

  it('a kick of one type never renders another type’s flavour (e.g. a BOMB is never a grubber line)', () => {
    for (const kt of KICK_TYPES) {
      const lines = renderKickLines(kt)
      for (const line of lines) {
        for (const foreign of FOREIGN_KEYWORDS[kt]) {
          expect(foreign.test(line), `${kt} line leaked foreign keyword ${foreign}: "${line}"`).toBe(false)
        }
      }
    }
  })

  it('exactly ONE match-rng draw per KICK render (filtering is pre-draw)', () => {
    const attacker = makePlayer('Boot', 70)
    for (const kt of KICK_TYPES) {
      let draws = 0
      const counted = () => {
        draws += 1
        return makeRng(draws * 2654435761)()
      }
      const ctx: CommentaryContext = {
        rng: counted,
        channelTargetCount: 0,
        score: { qld: 0, nsw: 0 },
        lastTemplateIndex: new Map(),
        minute: 50,
        scoreline: 'tight',
        phase: 'middle',
        fieldZone: 'middle',
      }
      renderCommentary({ type: 'KICK', side: 'QLD', channel: 'MIDDLE', attacker, kickType: kt }, ctx)
      // KICK is not a TRY/DRAMA type, so renderCommentary draws exactly once (the pickTemplate draw).
      expect(draws, `${kt} match-rng draws`).toBe(1)
    }
  })
})

describe('new kicking outcome pools (Pass 2)', () => {
  function renderOutcome(type: 'FORTY_TWENTY' | 'DROP_OUT' | 'FIELD_GOAL' | 'REPEAT_SET'): string[] {
    const attacker = makePlayer('Maestro', 70, { composure: 90 })
    const lines: string[] = []
    for (let seed = 0; seed < 60; seed++) {
      const ctx: CommentaryContext = {
        rng: makeRng(seed * 40503),
        channelTargetCount: 0,
        score: { qld: 13, nsw: 12 },
        lastTemplateIndex: new Map(),
        minute: 75,
        scoreline: 'tight',
        phase: 'last10',
        fieldZone: 'middle',
      }
      lines.push(renderCommentary({ type, side: 'QLD', attacker }, ctx))
    }
    return lines
  }

  it('each outcome event has >1 phrasing and no token leaks', () => {
    for (const type of ['FORTY_TWENTY', 'DROP_OUT', 'FIELD_GOAL', 'REPEAT_SET'] as const) {
      const lines = renderOutcome(type)
      const distinct = new Set(lines)
      expect(distinct.size, `${type} distinct lines`).toBeGreaterThan(1)
      for (const line of distinct) {
        expect(line.trim().length, `${type} non-empty`).toBeGreaterThan(0)
        expect(line, `${type} no token leak`).not.toMatch(/\{[a-zA-Z]+\}/)
      }
    }
  })
})

describe('context buckets', () => {
  it('bucketPhase keys the clock into early/middle/last10/post-siren', () => {
    expect(bucketPhase(5)).toBe('early')
    expect(bucketPhase(40)).toBe('middle')
    expect(bucketPhase(75)).toBe('last10')
    expect(bucketPhase(80)).toBe('post-siren')
  })

  it('bucketScoreline reads margin + leader', () => {
    expect(bucketScoreline({ qld: 6, nsw: 6 })).toBe('tight')
    expect(bucketScoreline({ qld: 16, nsw: 6 })).toBe('handy-lead-qld')
    expect(bucketScoreline({ qld: 6, nsw: 18 })).toBe('handy-lead-nsw')
    expect(bucketScoreline({ qld: 30, nsw: 6 })).toBe('blowout-qld')
    expect(bucketScoreline({ qld: 0, nsw: 24 })).toBe('blowout-nsw')
  })
})

describe('commentary variety', () => {
  it('produces many distinct phrasings for a high-frequency type across seeds', () => {
    const tackleLines = new Set<string>()
    for (const seed of [1, 7, 42, 99, 256, 808, 2024, 31337]) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const e of result.events) {
        if (e.type === 'TACKLE') tackleLines.add(e.commentary)
      }
    }
    // Tagged pool + repeat-avoidance should yield well beyond a handful of distinct lines.
    expect(tackleLines.size).toBeGreaterThan(6)
  })
})
