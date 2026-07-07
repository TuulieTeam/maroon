import { describe, expect, it } from 'vitest'
import { BLUES_VARIANTS, bluesById } from '../../data/bluesVariants'
import type { IconicMoment, MatchResult } from '../../engine'
import type { CareerLedger, LedgerEntry } from '../career'
import { NEMESIS_TUNING, crownNemesis, foldNswDamage, returningNemesis } from '../nemesis'
import type { NemesisTally } from '../nemesis'

/** Minimal stats with the given NSW player lines (the fields the fold actually reads). */
function statsWith(lines: Array<{ id: string; tries?: number; lineBreaks?: number; tackleBreaks?: number; side?: 'QLD' | 'NSW' }>): MatchResult['stats'] {
  const players: Record<string, unknown> = {}
  for (const l of lines) {
    players[l.id] = {
      id: l.id,
      name: l.id,
      side: l.side ?? 'NSW',
      tries: l.tries ?? 0,
      lineBreaks: l.lineBreaks ?? 0,
      tackleBreaks: l.tackleBreaks ?? 0,
    }
  }
  return { players } as unknown as MatchResult['stats']
}

function moment(playerId: string, side: 'QLD' | 'NSW'): IconicMoment {
  return { playerId, playerName: playerId, side, minute: 70, kind: 'TRY', scoreAfter: { qld: 0, nsw: 4 }, line: '' }
}

const CLASSIC = bluesById('classic')
const CLASSIC_PLAYERS = Object.values(CLASSIC.lineup)

describe('nemesis — the damage fold', () => {
  it('scores tries, breaks, and tackle breaks; only NSW men accrue; the iconic moment adds its bonus', () => {
    const t1 = foldNswDamage(undefined, statsWith([
      { id: 'nsw-cl', tries: 2, lineBreaks: 1, tackleBreaks: 3 },
      { id: 'qld-man', tries: 3, side: 'QLD' },
    ]), moment('nsw-cl', 'NSW'))
    expect(t1['nsw-cl']).toEqual({
      name: 'nsw-cl',
      tries: 2,
      lineBreaks: 1,
      damage: 2 * NEMESIS_TUNING.perTry + NEMESIS_TUNING.perLineBreak + 3 * NEMESIS_TUNING.perTackleBreak + NEMESIS_TUNING.iconicBonus,
    })
    expect(t1['qld-man']).toBeUndefined()
    // A QLD-side iconic moment adds nothing to the Blues tally.
    const t2 = foldNswDamage(undefined, statsWith([{ id: 'nsw-cl', tries: 1 }]), moment('qld-man', 'QLD'))
    expect(t2['nsw-cl'].damage).toBe(NEMESIS_TUNING.perTry)
  })

  it('accumulates across games and tolerates an undefined prior tally (pre-drop-7 saves)', () => {
    const g1 = foldNswDamage(undefined, statsWith([{ id: 'nsw-wr', tries: 1 }]), undefined)
    const g2 = foldNswDamage(g1, statsWith([{ id: 'nsw-wr', tries: 2, lineBreaks: 2 }]), undefined)
    expect(g2['nsw-wr']).toEqual({ name: 'nsw-wr', tries: 3, lineBreaks: 2, damage: 3 * 8 + 2 * 4 })
  })
})

describe('nemesis — the crowning', () => {
  it('crowns the max-damage man only past the threshold, using the name captured at fold time', () => {
    const under: NemesisTally = { 'nsw-cl': { name: 'Latrell Mitchell', tries: 2, lineBreaks: 1, damage: 20 } }
    expect(crownNemesis(under)).toBeNull()
    const over: NemesisTally = {
      'nsw-cl': { name: 'Latrell Mitchell', tries: 3, lineBreaks: 2, damage: 32 },
      'nsw-wr': { name: 'Someone Else', tries: 1, lineBreaks: 0, damage: 8 },
    }
    const crowned = crownNemesis(over)!
    expect(crowned.id).toBe('nsw-cl')
    expect(crowned.name).toBe('Latrell Mitchell')
    expect(crowned.damage).toBe(32)
    // A nameless entry (a pre-drop-8 save) can't be crowned; absent tally can't either.
    expect(crownNemesis({ ghost: { tries: 5, lineBreaks: 5, damage: 99 } })).toBeNull()
    expect(crownNemesis(undefined)).toBeNull()
  })

  it('a generated replacement Blue can be crowned — his name rode the fold, no sheet lookup needed', () => {
    const folded = foldNswDamage(undefined, statsWith([{ id: 'dyn-b-2029-1', tries: 4, lineBreaks: 2 }]), undefined)
    const crowned = crownNemesis(folded)!
    expect(crowned.id).toBe('dyn-b-2029-1')
    expect(crowned.name).toBe('dyn-b-2029-1') // statsWith uses id as name; real lines carry real names
    expect(crowned.damage).toBe(4 * 8 + 2 * 4)
  })
})

describe('nemesis — the grudge callback', () => {
  function entryWith(nemesisName: string, year?: number): LedgerEntry {
    return {
      rootSeed: (year ?? 1) * 7,
      seriesScore: { qld: 1, nsw: 2 },
      seriesWinner: 'NSW',
      retained: false,
      games: [],
      mvp: null,
      nemesis: { id: 'whatever-id', name: nemesisName, tries: 4, lineBreaks: 2, damage: 44 },
      ...(year ? { year } : {}),
    }
  }

  it('matches by NAME across different sheets, picks the most recent, and writes the threat line', () => {
    // Payne Haas appears in more than one Blues variant under different ids — the grudge follows the man.
    const sheetsWithHaas = BLUES_VARIANTS.filter((v) => Object.values(v.lineup).some((p) => p.name === 'Payne Haas'))
    expect(sheetsWithHaas.length).toBeGreaterThanOrEqual(2)
    const career: CareerLedger = {
      schemaVersion: 2,
      entries: [entryWith('Payne Haas', 2027), entryWith('Payne Haas', 2029)],
    }
    for (const sheet of sheetsWithHaas) {
      const grudge = returningNemesis(career, Object.values(sheet.lineup))!
      expect(grudge.year).toBe(2029) // most recent grudge wins
      expect(grudge.line).toContain('Payne Haas')
      expect(grudge.line).toContain('’29')
      expect(grudge.line).toContain('He’s back')
    }
  })

  it('stays silent when no archived nemesis appears in the drawn sheet', () => {
    const career: CareerLedger = { schemaVersion: 2, entries: [entryWith('Nobody Realman', 2027)] }
    expect(returningNemesis(career, CLASSIC_PLAYERS)).toBeNull()
    expect(returningNemesis({ schemaVersion: 2, entries: [] }, CLASSIC_PLAYERS)).toBeNull()
  })
})
