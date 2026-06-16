import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import { chooseKickType, resolveKick, kickSkill } from '../ratings'
import { makeRng } from '../rng'
import { defaultSetup, qldTeam, nswTeam } from './fixtures'
import type { MatchEvent, MatchSetup, Side, KickType } from '../types'
import type { Player, Position } from '../../data/types'

const SEEDS = [1, 2, 3, 7, 42, 100, 256, 777, 2024, 31337]

/** Elite-boot QLD HB so 40/20s + field goals can fire; everything else as the default synthetic team. */
function eliteKicker(): Player {
  return {
    id: 'def-HB',
    name: 'Elite HB',
    club: 'Test',
    naturalPositions: ['HB'],
    attrs: { attack: 90, defence: 82, speed: 80, hands: 90, composure: 95 },
    goalKicking: 95,
    stamina: 88,
  }
}

/** A balanced strong setup (QLD mirrors NSW-ish ratings + elite kicker) so late games stay tight and
 *  field goals occasionally fire — the default lopsided synthetic teams rarely produce a <=2-pt game. */
function balancedSetup(): MatchSetup {
  const nsw = nswTeam()
  const qld = qldTeam({ HB: eliteKicker() })
  for (const pos of Object.keys(qld.lineup) as Position[]) {
    const p = qld.lineup[pos]
    qld.lineup[pos] = {
      ...p,
      attrs: { ...p.attrs, attack: 84, defence: 82, hands: 84, composure: 84 },
    }
  }
  return { qld, nsw }
}

/** Project the full event stream to a comparable tuple incl. the new kick fields. */
function streamProjection(events: MatchEvent[]) {
  return events.map((e) => [e.seq, e.type, e.kickType ?? null, e.metres ?? null, e.side, e.commentary])
}

describe('kicking: determinism (incl. kickType + new events)', () => {
  it('same seed yields an identical kick-aware stream', () => {
    for (const seed of [1, 99, 2024]) {
      const a = simulateMatch(defaultSetup(), seed)
      const b = simulateMatch(defaultSetup(), seed)
      expect(streamProjection(a.events)).toEqual(streamProjection(b.events))
      expect(a.finalScore).toEqual(b.finalScore)
    }
  })
})

describe('kicking: fixed rng-draw count of the resolvers', () => {
  it('chooseKickType draws exactly 1 and resolveKick draws exactly 2, every branch', () => {
    // Drive a counting rng across many (type, context) combinations; the draw count must be constant.
    let draws = 0
    const counted = () => {
      draws += 1
      return makeRng(draws * 2654435761)()
    }
    const types: KickType[] = ['CLEARING', 'BOMB', 'GRUBBER', 'CROSS_FIELD', 'FORTY_TWENTY', 'FIELD_GOAL', 'TOUCH']
    for (let fp = 5; fp <= 95; fp += 10) {
      for (const clock of [10, 50, 75]) {
        for (const margin of [0, 2, 10]) {
          draws = 0
          chooseKickType(counted, { fieldPosition: fp, clock, scoreMargin: margin, kickSkill: 60 })
          expect(draws).toBe(1)
        }
      }
      for (const type of types) {
        draws = 0
        resolveKick(counted, type, { fieldPosition: fp, kickSkill: 60, catcherHands: 80, catcherSpeed: 82 })
        expect(draws).toBe(2)
      }
    }
  })
})

describe('kicking: kickSkill derivation', () => {
  it('orders boots correctly and clamps to 1..99', () => {
    const cleary = kickSkill({ goalKicking: 92, attrs: { composure: 95, hands: 90 } } as Player)
    const munster = kickSkill({ goalKicking: 52, attrs: { composure: 70, hands: 78 } } as Player)
    const forward = kickSkill({ goalKicking: 20, attrs: { composure: 60, hands: 55 } } as Player)
    expect(cleary).toBeGreaterThan(munster)
    expect(munster).toBeGreaterThan(forward)
    expect(cleary).toBeLessThanOrEqual(99)
    expect(forward).toBeGreaterThanOrEqual(1)
  })
})

describe('kicking: 40/20 regains possession', () => {
  it('a successful 40/20 keeps the kicking side in possession deep in the opp half', () => {
    // Elite-boot QLD HB so the 40/20 fires; scan seeds for the first successful one.
    const setup = (): MatchSetup => defaultSetup({ HB: eliteKicker() })
    let found: { events: MatchEvent[]; idx: number } | null = null
    for (let seed = 0; seed < 400 && !found; seed++) {
      const evs = simulateMatch(setup(), seed).events
      const idx = evs.findIndex((e) => e.type === 'FORTY_TWENTY')
      if (idx >= 0) found = { events: evs, idx }
    }
    expect(found, 'expected at least one successful 40/20 across the seed scan').not.toBeNull()
    const { events, idx } = found!
    const ft = events[idx]
    // The FORTY_TWENTY event is immediately preceded by the KICK that produced it.
    const kick = events[idx - 1]
    expect(kick.type).toBe('KICK')
    expect(kick.kickType).toBe('FORTY_TWENTY')
    expect(kick.side).toBe(ft.side)
    // The very next attacking play (HIT_UP/TACKLE/etc. with a channel) belongs to the SAME side — the
    // kicking team retained possession (no flip).
    const nextPlay = events.slice(idx + 1).find((e) => e.channel && e.type !== 'PENALTY')
    expect(nextPlay).toBeDefined()
    expect(nextPlay!.side).toBe(ft.side)
  })
})

describe('kicking: forced drop-out (CTO correction)', () => {
  it('a forced drop-out keeps the KICKING team in possession with a fresh attacking set', () => {
    let found: { events: MatchEvent[]; idx: number } | null = null
    for (let seed = 0; seed < 200 && !found; seed++) {
      const evs = simulateMatch(defaultSetup(), seed).events
      const idx = evs.findIndex((e) => e.type === 'DROP_OUT')
      if (idx >= 0) found = { events: evs, idx }
    }
    expect(found, 'expected at least one DROP_OUT across the seed scan').not.toBeNull()
    const { events, idx } = found!
    const dropOut = events[idx]
    const kick = events[idx - 1]
    expect(kick.type).toBe('KICK')
    expect(kick.side).toBe(dropOut.side)
    // No TURNOVER_DOWNTOWN around the drop-out (possession is retained, not handed over).
    expect(events[idx - 1].type).not.toBe('TURNOVER_DOWNTOWN')
    expect(events[idx + 1]?.type).not.toBe('TURNOVER_DOWNTOWN')
    // The next attacking play belongs to the SAME (kicking) side — they received the drop-out.
    const nextPlay = events.slice(idx + 1).find((e) => e.channel && e.type !== 'PENALTY')
    expect(nextPlay).toBeDefined()
    expect(nextPlay!.side).toBe(dropOut.side)
  })

  it('forcedDropOuts is credited to the kicking side and reconciles with the events', () => {
    for (const seed of SEEDS) {
      const r = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as Side[]) {
        const dropOutEvents = r.events.filter((e) => e.type === 'DROP_OUT' && e.side === side).length
        expect(r.stats.forcedDropOuts[side]).toBe(dropOutEvents)
      }
    }
  })
})

describe('kicking: field goals score exactly one', () => {
  it('a field goal moves the score by exactly 1, only at minute>=70, and is rare', () => {
    let fgMatches = 0
    const N = 400
    let asserted = false
    const setup = balancedSetup() // deterministic + not mutated by the sim — build once.
    for (let seed = 0; seed < N; seed++) {
      const r = simulateMatch(setup, seed)
      let matchHasFg = false
      for (let i = 0; i < r.events.length; i++) {
        const fg = r.events[i]
        if (fg.type !== 'FIELD_GOAL') continue
        matchHasFg = true
        asserted = true
        // Only fires in the dying stages.
        expect(fg.minute).toBeGreaterThanOrEqual(70)
        // The score at the FG event is exactly 1 more (on the scoring side) than just before it.
        const before = r.events[i - 1].score
        const delta = fg.score.qld - before.qld + (fg.score.nsw - before.nsw)
        expect(delta).toBe(1)
      }
      if (matchHasFg) fgMatches += 1
    }
    expect(asserted, 'expected at least one field goal across the balanced seed scan').toBe(true)
    // Rare: comfortably fewer than ~0.5 per match.
    expect(fgMatches / N).toBeLessThan(0.5)
  })
})

describe('kicking: stats reconcile', () => {
  it('per-player kick stats sum to the team totals; kickTypes sum to kicks; score reconciles', () => {
    for (const seed of SEEDS) {
      const r = simulateMatch(defaultSetup(), seed)
      const { stats } = r
      for (const side of ['QLD', 'NSW'] as Side[]) {
        const players = Object.values(stats.players).filter((p) => p.side === side)
        const sum = (fn: (p: (typeof players)[number]) => number) => players.reduce((a, p) => a + fn(p), 0)
        expect(sum((p) => p.kicks)).toBe(stats.kicks[side])
        expect(sum((p) => p.kickMetres)).toBe(stats.kickMetres[side])
        expect(sum((p) => p.fortyTwenties)).toBe(stats.fortyTwenties[side])
        expect(sum((p) => p.forcedDropOuts)).toBe(stats.forcedDropOuts[side])
        expect(sum((p) => p.fieldGoals)).toBe(stats.fieldGoals[side])
        // kickTypes sum to the team kick count.
        const ktSum = Object.values(stats.kickTypes[side]).reduce((a, b) => a + b, 0)
        expect(ktSum).toBe(stats.kicks[side])
      }
      // Final score = tries*4 + conversions*2 + fieldGoals*1, per side.
      for (const side of ['QLD', 'NSW'] as Side[]) {
        const conversions = r.events.filter(
          (e) => e.type === 'CONVERSION' && e.side === side,
        )
        // Count MADE conversions by score delta on the conversion event.
        let madeConversions = 0
        for (const c of conversions) {
          const i = r.events.indexOf(c)
          const before = r.events[i - 1].score
          const d = c.score.qld - before.qld + (c.score.nsw - before.nsw)
          if (d === 2) madeConversions += 1
        }
        const expected = stats.tries[side] * 4 + madeConversions * 2 + stats.fieldGoals[side] * 1
        const actual = side === 'QLD' ? r.finalScore.qld : r.finalScore.nsw
        expect(actual).toBe(expected)
      }
    }
  })
})

describe('kicking: rule faithfulness', () => {
  it('no FIELD_GOAL event before minute 70', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = simulateMatch(balancedSetup(), seed)
      for (const e of r.events) {
        if (e.type === 'FIELD_GOAL') expect(e.minute).toBeGreaterThanOrEqual(70)
      }
    }
  })

  it('every KICK event carries a kickType', () => {
    for (const seed of SEEDS) {
      const r = simulateMatch(defaultSetup(), seed)
      for (const e of r.events) {
        if (e.type === 'KICK') expect(e.kickType).toBeDefined()
      }
    }
  })
})

describe('kicking: frequency bands (real-NRL realism)', () => {
  it('per-team kicks, 40/20 attempts/success and drop-outs sit in believable bands', () => {
    const N = 300
    let kicks = 0
    let fortyAtt = 0
    let fortySuccess = 0
    let dropOuts = 0
    let samples = 0
    for (let seed = 0; seed < N; seed++) {
      const r = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as Side[]) {
        kicks += r.stats.kicks[side]
        fortyAtt += r.stats.kickTypes[side].FORTY_TWENTY
        fortySuccess += r.stats.fortyTwenties[side]
        dropOuts += r.stats.forcedDropOuts[side]
        samples += 1
      }
    }
    const perTeamKicks = kicks / samples
    const fortyAttPerMatch = fortyAtt / N // both sides per match
    const fortySuccessPerMatch = fortySuccess / N
    const dropOutsPerMatch = dropOuts / N
    // eslint-disable-next-line no-console
    console.log(
      `[kicking] per-team kicks=${perTeamKicks.toFixed(2)} | 40/20 att/match=${fortyAttPerMatch.toFixed(2)} ` +
        `success/match=${fortySuccessPerMatch.toFixed(2)} | dropOuts/match=${dropOutsPerMatch.toFixed(2)}`,
    )
    // Kicks per team: last-tackle kicks (~16-18) + penalty touch-finders — a believable 14-30.
    expect(perTeamKicks).toBeGreaterThan(14)
    expect(perTeamKicks).toBeLessThan(30)
    // 40/20s are a rare weapon: a fraction of a match each on average, success well under one a match.
    expect(fortyAttPerMatch).toBeGreaterThan(0.1)
    expect(fortyAttPerMatch).toBeLessThan(3)
    expect(fortySuccessPerMatch).toBeLessThan(1)
    // Forced drop-outs: a handful a match.
    expect(dropOutsPerMatch).toBeGreaterThan(0.5)
    expect(dropOutsPerMatch).toBeLessThan(5)
  })
})
