import { describe, expect, it } from 'vitest'
import type { Player, Position } from '../../data/types'
import type { MatchEvent, PlayerStatLine, Side } from '../../engine'
import {
  CONDITIONS_TUNING,
  advanceConditions,
  conditionFormDelta,
  extractCarryover,
  formRatingToDelta,
  initConditions,
  isAvailable,
  originPerformanceDelta,
  playHurtPenalty,
  reinjuryMult,
} from '../conditions'
import type { ConditionMap } from '../types'

function mkPlayer(id: string, pos: Position): Player {
  return {
    id,
    name: id,
    club: 'Test',
    naturalPositions: [pos],
    attrs: { attack: 70, defence: 70, speed: 70, hands: 70, composure: 70 },
    goalKicking: 10,
  }
}

function line(partial: Partial<PlayerStatLine>): PlayerStatLine {
  return {
    id: 'x',
    name: 'x',
    side: 'QLD',
    runs: 0,
    runMetres: 0,
    tackles: 0,
    missedTackles: 0,
    tackleBreaks: 0,
    lineBreaks: 0,
    tries: 0,
    errors: 0,
    kicks: 0,
    kickMetres: 0,
    fortyTwenties: 0,
    forcedDropOuts: 0,
    fieldGoals: 0,
    minutesProxy: 50,
    ...partial,
  }
}

function ev(type: MatchEvent['type'], side: Side, who: Partial<Pick<MatchEvent, 'attacker' | 'defender' | 'playerOff'>>, reason?: string): MatchEvent {
  return { minute: 30, seq: 1, type, side, score: { qld: 0, nsw: 0 }, commentary: '', reason, ...who }
}

describe('formRatingToDelta', () => {
  it('maps a 0-100 rating to a bounded signed delta', () => {
    expect(formRatingToDelta(50)).toBe(0)
    expect(formRatingToDelta(78)).toBeCloseTo(6.72, 2)
    expect(formRatingToDelta(0)).toBe(-12) // clamped
    expect(formRatingToDelta(100)).toBe(12) // clamped
    expect(formRatingToDelta(30)).toBeCloseTo(-4.8, 5)
  })
})

describe('play-hurt boundary helpers', () => {
  const doubtful: ConditionMap[string] = { form: 60, injury: { kind: 'doubtful', gamesOut: 0 } }
  const fit: ConditionMap[string] = { form: 60, injury: { kind: 'fit', gamesOut: 0 } }
  it('a doubtful man carries a re-injury risk and a play-hurt penalty', () => {
    expect(reinjuryMult(doubtful)).toBe(CONDITIONS_TUNING.doubtfulReinjuryMult)
    expect(playHurtPenalty(doubtful)).toBe(CONDITIONS_TUNING.doubtfulFormPenalty)
    // conditionFormDelta folds the penalty into the form delta.
    expect(conditionFormDelta(doubtful)).toBe(formRatingToDelta(60) + CONDITIONS_TUNING.doubtfulFormPenalty)
  })
  it('a fit man has no penalty or extra risk', () => {
    expect(reinjuryMult(fit)).toBe(1)
    expect(playHurtPenalty(fit)).toBe(0)
  })
  it('isAvailable blocks OUT / SUSPENDED only', () => {
    expect(isAvailable(fit)).toBe(true)
    expect(isAvailable(doubtful)).toBe(true)
    expect(isAvailable({ form: 50, injury: { kind: 'out', gamesOut: 1 } })).toBe(false)
    expect(isAvailable({ form: 50, injury: { kind: 'suspended', gamesOut: 1 } })).toBe(false)
  })
})

describe('initConditions', () => {
  const players = [mkPlayer('a', 'PL'), mkPlayer('b', 'CL'), mkPlayer('c', 'HB')]
  it('seeds form from the start map (default neutral) and injuries from the injury map', () => {
    const c = initConditions(players, { a: 70, b: 30 }, { c: 'out' })
    expect(c.a.form).toBe(70)
    expect(c.a.injury.kind).toBe('fit')
    expect(c.b.form).toBe(30)
    expect(c.c.form).toBe(50) // default neutral
    expect(c.c.injury).toMatchObject({ kind: 'out', gamesOut: 1 })
  })
})

describe('extractCarryover', () => {
  const p = (id: string) => mkPlayer(id, 'PL')
  it('maps injury/discipline events to carryover, max-severity per id', () => {
    const events: MatchEvent[] = [
      ev('HIA_FAIL', 'QLD', { attacker: p('hia-out') }),
      ev('HIA_PASS', 'NSW', { attacker: p('knock') }),
      ev('SEND_OFF', 'QLD', { defender: p('sent') }),
      ev('INJURY_REPLACEMENT', 'NSW', { playerOff: p('fouled') }, 'foul-injury'),
      // a player who passed an HIA then later failed one -> OUT wins over DOUBTFUL.
      ev('HIA_PASS', 'QLD', { attacker: p('both') }),
      ev('HIA_FAIL', 'QLD', { attacker: p('both') }),
    ]
    const out = extractCarryover(events)
    const byId = Object.fromEntries(out.map((c) => [c.id, c]))
    expect(byId['hia-out']).toMatchObject({ kind: 'out', cause: 'failed-hia' })
    expect(byId['knock']).toMatchObject({ kind: 'doubtful', cause: 'head-knock' })
    expect(byId['sent']).toMatchObject({ kind: 'suspended', cause: 'send-off' })
    expect(byId['fouled']).toMatchObject({ kind: 'out', cause: 'foul-injury' })
    expect(byId['both'].kind).toBe('out') // max severity
  })
})

describe('originPerformanceDelta', () => {
  it('is 0 for a barely-featured player (injured early / unselected)', () => {
    expect(originPerformanceDelta(line({ minutesProxy: 3, tries: 2 }), 'forward')).toBe(0)
    expect(originPerformanceDelta(undefined, 'back')).toBe(0)
  })
  it('lifts a blinder, drops a shocker, and stays within +/-6', () => {
    const blinder = originPerformanceDelta(line({ minutesProxy: 30, runMetres: 220, tries: 3, lineBreaks: 2, tackleBreaks: 6, tackles: 20 }), 'forward')
    const shocker = originPerformanceDelta(line({ minutesProxy: 60, runMetres: 40, errors: 4, missedTackles: 6, tackles: 10 }), 'forward')
    expect(blinder).toBeGreaterThan(1)
    expect(shocker).toBeLessThan(-1)
    expect(blinder).toBeGreaterThan(shocker)
    expect(Math.abs(blinder)).toBeLessThanOrEqual(6)
    expect(Math.abs(shocker)).toBeLessThanOrEqual(6)
  })
})

describe('advanceConditions', () => {
  const players = [mkPlayer('a', 'PL'), mkPlayer('b', 'CL'), mkPlayer('c', 'HB')]
  const ctx = (extra: Partial<Parameters<typeof advanceConditions>[1]> = {}) => ({
    rootSeed: 12345,
    nextGameNumber: 2,
    players,
    lines: {},
    carryover: [],
    ...extra,
  })

  it('is deterministic and does not mutate the input', () => {
    const prev = initConditions(players)
    const a = advanceConditions(prev, ctx())
    const b = advanceConditions(prev, ctx())
    expect(a).toEqual(b)
    expect(prev.a.form).toBe(50) // untouched
  })

  it('keeps the squad mean near neutral with no carryover / no Origin (regression + symmetric swing)', () => {
    let map = initConditions(Array.from({ length: 40 }, (_, i) => mkPlayer(`p${i}`, 'PL')))
    for (let g = 2; g <= 6; g++) {
      map = advanceConditions(map, ctx({ players: Object.keys(map).map((id) => mkPlayer(id, 'PL')), nextGameNumber: g }))
      const forms = Object.values(map).map((c) => c.form)
      const mean = forms.reduce((s, n) => s + n, 0) / forms.length
      expect(mean).toBeGreaterThan(40)
      expect(mean).toBeLessThan(60)
      for (const f of forms) expect(f).toBeGreaterThanOrEqual(0)
      for (const f of forms) expect(f).toBeLessThanOrEqual(100)
    }
  })

  it('runs the injury lifecycle: OUT -> DOUBTFUL(returned) -> FIT', () => {
    const prev: ConditionMap = { a: { form: 50, injury: { kind: 'out', gamesOut: 1, cause: 'failed-hia' } } }
    const g2 = advanceConditions(prev, ctx({ players: [mkPlayer('a', 'PL')] }))
    expect(g2.a.injury).toMatchObject({ kind: 'doubtful', returnedHurt: true })
    const g3 = advanceConditions(g2, ctx({ players: [mkPlayer('a', 'PL')], nextGameNumber: 3 }))
    expect(g3.a.injury.kind).toBe('fit')
  })

  it('folds a fresh carryover injury in (more severe wins over the aged state)', () => {
    const prev = initConditions([mkPlayer('a', 'PL')])
    const next = advanceConditions(prev, ctx({ players: [mkPlayer('a', 'PL')], carryover: [{ id: 'a', kind: 'out', cause: 'failed-hia' }] }))
    expect(next.a.injury).toMatchObject({ kind: 'out', gamesOut: 1, cause: 'failed-hia' })
  })

  it('a strong Origin game lifts form more than a poor one (same seed isolates the club swing)', () => {
    // Same player + same seed => the random club swing is identical, so the only difference between
    // the two runs is the Origin-performance delta. (Across different players in one round the ±28
    // swing legitimately dwarfs the ±6 Origin nudge — form is noisy by design.)
    const players2 = [mkPlayer('p', 'CL')]
    const prev = initConditions(players2) // at 50
    const strong = advanceConditions(prev, ctx({ players: players2, lines: { p: line({ minutesProxy: 60, runMetres: 240, tries: 3, lineBreaks: 2, tackleBreaks: 6 }) } }))
    const poor = advanceConditions(prev, ctx({ players: players2, lines: { p: line({ minutesProxy: 60, runMetres: 30, errors: 4, missedTackles: 5 }) } }))
    expect(strong.p.form).toBeGreaterThan(poor.p.form)
  })
})
