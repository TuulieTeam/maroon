import { describe, expect, it } from 'vitest'
import { BLUES_IDS } from '../../data/bluesVariants'
import { buildAutoLineup } from '../../data/autoSelect'
import { MATCHDAY_POSITIONS, RESERVE_POSITIONS } from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import { buildDailyChallenge, dailyKey, dailySeed } from '../dailyChallenge'
import { DAILY_TWISTS, twistById } from '../twists'

describe('daily challenge — determinism', () => {
  it('the same date key always builds the same challenge', () => {
    const a = buildDailyChallenge('2026-07-06')
    const b = buildDailyChallenge('2026-07-06')
    expect(a.seed).toBe(b.seed)
    expect(a.opponent.id).toBe(b.opponent.id)
    expect(a.venue.id).toBe(b.venue.id)
    expect(a.twist.id).toBe(b.twist.id)
  })

  it('seeds are uint32 and consecutive dates land on unrelated seeds', () => {
    const seeds = new Set<number>()
    for (let d = 1; d <= 28; d++) {
      const s = dailySeed(`2026-07-${String(d).padStart(2, '0')}`)
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(0xffffffff)
      seeds.add(s)
    }
    expect(seeds.size).toBe(28)
  })

  it('a month of dailies visits every Blues side, every ground, and most twists', () => {
    const opponents = new Set<string>()
    const venues = new Set<string>()
    const twists = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const day = new Date(Date.UTC(2026, 6, 1 + i))
      const c = buildDailyChallenge(
        `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`,
      )
      opponents.add(c.opponent.id)
      venues.add(c.venue.id)
      twists.add(c.twist.id)
      expect(BLUES_IDS).toContain(c.opponent.id)
      // A twist that moves the game owns the venue; otherwise the seeded draw stands.
      if (c.twist.forceVenue) expect(c.venue.id).toBe(c.twist.forceVenue)
    }
    expect(opponents.size).toBe(3)
    expect(venues.size).toBe(3)
    expect(twists.size, `only saw twists: ${[...twists].join(', ')}`).toBeGreaterThanOrEqual(10)
  })

  it('dailyKey renders a local calendar date as YYYY-MM-DD', () => {
    expect(dailyKey(new Date(2026, 6, 6))).toBe('2026-07-06')
    expect(dailyKey(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('daily twists — viability', () => {
  it('every twist leaves a full, valid 19 + 2 pickable from the remaining pool', () => {
    for (const twist of DAILY_TWISTS) {
      const out = new Set(twist.ruledOut?.(QLD_SQUAD) ?? [])
      const remaining = QLD_SQUAD.filter((p) => !out.has(p.id))
      const lineup = buildAutoLineup(remaining)
      for (const pos of [...MATCHDAY_POSITIONS, ...RESERVE_POSITIONS]) {
        expect(lineup[pos], `twist "${twist.id}" cannot fill ${pos}`).toBeTruthy()
      }
    }
  })

  it('depleted-spine takes the first-choice 1-6-7-9 and blood-the-kids rests every veteran', () => {
    const spineOut = new Set(twistById('depleted-spine').ruledOut!(QLD_SQUAD))
    // The best natural fullback, five-eighth, halfback, and hooker in the current squad.
    expect(spineOut.size).toBe(4)
    expect(spineOut.has('munster')).toBe(true)
    expect(spineOut.has('grant')).toBe(true)

    const kidsOut = new Set(twistById('blood-the-kids').ruledOut!(QLD_SQUAD))
    for (const p of QLD_SQUAD) {
      expect(kidsOut.has(p.id), `${p.name} (${p.tag})`).toBe(p.tag === 'veteran')
    }
  })

  it('leaders-gone rests exactly the four best men in the squad', () => {
    const out = twistById('leaders-gone').ruledOut!(QLD_SQUAD)
    expect(out).toHaveLength(4)
    // The catalog sorts by the shared `overall` — pin the shape, not the names, so form-table
    // edits to the hand-kept squad can't break the test.
    const overallOf = (id: string) => {
      const p = QLD_SQUAD.find((q) => q.id === id)!
      return (p.attrs.attack + p.attrs.defence + p.attrs.speed + p.attrs.hands + p.attrs.composure) / 5
    }
    const floor = Math.min(...out.map(overallOf))
    for (const p of QLD_SQUAD.filter((q) => !out.includes(q.id))) {
      expect(overallOf(p.id)).toBeLessThanOrEqual(floor)
    }
  })

  it('club-call twists rule out exactly that club’s contingent', () => {
    for (const [twistId, club] of [
      ['club-decider-dolphins', 'Dolphins'],
      ['club-decider-cowboys', 'Cowboys'],
    ] as const) {
      const out = new Set(twistById(twistId).ruledOut!(QLD_SQUAD))
      for (const p of QLD_SQUAD) {
        expect(out.has(p.id), `${twistId}: ${p.name} (${p.club})`).toBe(p.club === club)
      }
      expect(out.size).toBeGreaterThan(0)
    }
  })

  it('back-five-gone takes one best natural fit per outside-back position', () => {
    const out = twistById('back-five-gone').ruledOut!(QLD_SQUAD)
    expect(out).toHaveLength(5)
    expect(new Set(out).size).toBe(5)
  })

  it('an unknown stored twist id falls back to the plain shootout', () => {
    expect(twistById('retired-twist-id').id).toBe('full-80')
    expect(twistById(undefined).id).toBe('full-80')
  })
})
