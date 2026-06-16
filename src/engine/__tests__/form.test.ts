import { describe, expect, it } from 'vitest'
import type { Position } from '../../data/types'
import { CHANNEL_OWNERS } from '../../data/positions'
import { channelUnit, effectiveAttr } from '../ratings'
import { channelStrength } from '../matchup'
import { simulateMatch } from '../simulate'
import { defaultSetup, makePlayer, qldTeam } from './fixtures'

describe('effectiveAttr form term', () => {
  it('folds a signed form delta on top of fatigue, clamped to [1, 99]', () => {
    expect(effectiveAttr(70, 0)).toBe(70) // legacy 2-arg path unchanged
    expect(effectiveAttr(70, 0, 0)).toBe(70)
    expect(effectiveAttr(70, 0, 12)).toBe(82) // in form
    expect(effectiveAttr(70, 0, -12)).toBe(58) // slump
    expect(effectiveAttr(90, 0, 12)).toBe(99) // ceiling clamp (102 -> 99)
    expect(effectiveAttr(5, 0, -12)).toBe(1) // floor clamp (-7 -> 1)
    expect(effectiveAttr(70, 30, 12)).toBe(52) // composes with fatigue
  })
})

describe('form mirror: the selection read tracks the contest math', () => {
  it('channelStrength(form) equals channelUnit ratings (fatigue 0) with the same form', () => {
    const lineup = qldTeam().lineup
    const noFatigue = new Map<string, number>()
    const form = new Map<string, number>()
    for (const pos of CHANNEL_OWNERS.LEFT) form.set(lineup[pos].id, 10) // hot left edge
    for (const pos of CHANNEL_OWNERS.RIGHT) form.set(lineup[pos].id, -8) // cold right edge
    for (const ch of ['LEFT', 'MIDDLE', 'RIGHT'] as const) {
      const read = channelStrength(lineup, ch, form)!
      const unit = channelUnit(lineup, ch, noFatigue, 0, form)
      expect(read.attack).toBe(Math.round(unit.attackRating))
      expect(read.defence).toBe(Math.round(unit.defenceRating))
    }
  })
})

describe('form is opt-in: absent form is byte-identical to legacy', () => {
  it('an empty / undefined form map produces the same match as no form field', () => {
    for (const seed of [1, 42, 808]) {
      const base = simulateMatch(defaultSetup(), seed)
      const withEmpty = simulateMatch({ ...defaultSetup(), form: {} }, seed)
      expect(withEmpty.events).toEqual(base.events)
      expect(withEmpty.finalScore).toEqual(base.finalScore)
    }
  })
})

describe('form moves the field', () => {
  it('a uniformly in-form Queensland outscores a uniformly slumping one over the same seeds', () => {
    const ids = Object.values(qldTeam().lineup).map((p) => p.id)
    const hot: Record<string, number> = {}
    const cold: Record<string, number> = {}
    for (const id of ids) {
      hot[id] = 12
      cold[id] = -12
    }
    let hotMargin = 0
    let coldMargin = 0
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1)
    for (const seed of seeds) {
      const h = simulateMatch({ ...defaultSetup(), form: hot }, seed)
      const c = simulateMatch({ ...defaultSetup(), form: cold }, seed)
      hotMargin += h.finalScore.qld - h.finalScore.nsw
      coldMargin += c.finalScore.qld - c.finalScore.nsw
    }
    // A +12 squad-wide form must measurably beat a −12 one on aggregate margin (form is noticeable).
    expect(hotMargin).toBeGreaterThan(coldMargin)
  })
})

describe('form balance: noticeable, but quality still dominates (the selection signal survives)', () => {
  const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1)

  // NSW attack QLD's LEFT (CL) down their own RIGHT channel, so QLD left-edge concessions surface as
  // NSW tries under byChannel.RIGHT. Lower = the QLD centre defended his edge better.
  function nswRightTries(clDefence: number, clForm: number): number {
    const cl = { ...makePlayer('cl-test', clDefence), naturalPositions: ['CL'] as Position[] }
    let total = 0
    for (const seed of SEEDS) {
      const r = simulateMatch({ ...defaultSetup({ CL: cl }), form: { 'cl-test': clForm } }, seed)
      total += r.stats.byChannel.RIGHT.nswTries
    }
    return total / SEEDS.length
  }

  it('a hot key defender concedes clearly fewer tries down his edge than a cold one', () => {
    const hot = nswRightTries(60, 12)
    const cold = nswRightTries(60, -12)
    // Form must move the contest by a full try or more — it can genuinely flip an edge.
    expect(cold).toBeGreaterThan(hot + 1)
  })

  it('quality outweighs form — a strong but cold defender still beats a weak but hot one', () => {
    const weakHot = nswRightTries(45, 12) // poor defender, red-hot
    const strongCold = nswRightTries(85, -12) // elite defender, slumping
    // The ±12 form swing must NOT erase a 40-point quality gap — picking the better man still wins.
    expect(strongCold).toBeLessThan(weakHot)
  })
})
