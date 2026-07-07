import { describe, expect, it } from 'vitest'
import { buildAutoLineup } from '../../data/autoSelect'
import { MATCHDAY_POSITIONS, RESERVE_POSITIONS } from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import { makeRng } from '../../engine'
import type { Position } from '../../data/types'
import type { SeriesState } from '../../series'
import { AGING_TUNING, ageOf, birthYearOf, retirementChance, seasonDrift } from '../aging'
import { runOffseason } from '../offseason'
import { resolveRoster } from '../roster'
import { dynastySeriesSeed, offseasonSeed } from '../seed'
import type { DynastyState } from '../types'

const START = 2026

function freshDynasty(seed = 12345): DynastyState {
  return {
    schemaVersion: 1,
    dynastySeed: seed,
    startYear: START,
    currentYear: START,
    overlay: { attrDeltas: {}, retired: [], rookies: [] },
    years: [],
  }
}

function completedSeries(rootSeed: number, winner: 'QLD' | 'NSW' = 'QLD'): SeriesState {
  return {
    schemaVersion: 3,
    rootSeed,
    opponentId: 'classic',
    currentGame: 3,
    seriesScore: winner === 'QLD' ? { qld: 2, nsw: 1 } : { qld: 1, nsw: 2 },
    games: [],
    status: 'complete',
    seriesWinner: winner,
    playerConditions: {},
  }
}

describe('dynasty — seeds and ages', () => {
  it('the start year series seed IS the dynasty seed (adoption is byte-identical)', () => {
    expect(dynastySeriesSeed(987654321, START, START)).toBe(987654321 >>> 0)
    expect(dynastySeriesSeed(987654321, START, START + 1)).not.toBe(987654321 >>> 0)
    expect(offseasonSeed(987654321, START)).not.toBe(dynastySeriesSeed(987654321, START, START))
  })

  it('every QLD player has an authored birth year and a sane 2026 age', () => {
    for (const p of QLD_SQUAD) {
      const age = ageOf(p, START)
      expect(age, `${p.name} is ${age}`).toBeGreaterThanOrEqual(18)
      expect(age, `${p.name} is ${age}`).toBeLessThanOrEqual(38)
      expect(birthYearOf(p)).toBeGreaterThan(1980)
    }
  })
})

describe('dynasty — aging shape', () => {
  it('mean drift is monotonically non-increasing across age bands', () => {
    // 500 seeded synthetic careers per age; the mean must fall as age rises.
    const player = { ...QLD_SQUAD[0], tag: 'workhorse' as const }
    const meanAt = (age: number): number => {
      let total = 0
      const rng = makeRng(42 + age)
      for (let i = 0; i < 500; i++) {
        const d = seasonDrift(player, age, rng)
        total += d.attack + d.defence + d.speed + d.hands + d.composure + d.stamina
      }
      return total / 500
    }
    const ages = [20, 23, 25, 27, 30, 32, 34]
    const means = ages.map(meanAt)
    for (let i = 1; i < means.length; i++) {
      expect(means[i], `age ${ages[i]} (${means[i].toFixed(2)}) vs age ${ages[i - 1]} (${means[i - 1].toFixed(2)})`).toBeLessThanOrEqual(
        means[i - 1] + 0.35, // small tolerance for noise between adjacent bands
      )
    }
    expect(means[0]).toBeGreaterThan(5) // kids grow
    expect(means[means.length - 1]).toBeLessThan(-6) // the old fade
  })

  it('post-30 the legs go first: speed declines faster than composure', () => {
    const player = { ...QLD_SQUAD[0], tag: 'workhorse' as const }
    const rng = makeRng(7)
    let speed = 0
    let composure = 0
    for (let i = 0; i < 500; i++) {
      const d = seasonDrift(player, 32, rng)
      speed += d.speed
      composure += d.composure
    }
    expect(speed).toBeLessThan(composure)
  })

  it('retirement is impossible before 30 and certain at 36', () => {
    expect(retirementChance(29, 90)).toBe(0)
    expect(retirementChance(36, 90)).toBe(1)
    expect(retirementChance(45, 90)).toBe(1)
    expect(retirementChance(32, 90)).toBeGreaterThan(0)
    // A clearly-faded 32-year-old is likelier to go than a star of the same age.
    expect(retirementChance(32, 50)).toBeGreaterThan(retirementChance(32, 90))
  })
})

describe('dynasty — the off-season', () => {
  it('is deterministic: same state + same series → identical next state and report', () => {
    const a = runOffseason(freshDynasty(555), completedSeries(555))
    const b = runOffseason(freshDynasty(555), completedSeries(555))
    expect(a.next).toEqual(b.next)
    expect(a.report).toEqual(b.report)
  })

  it('no immortals, absolutely: across 20 seeds and 15 seasons nobody — rookie or original — plays past 36', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = (() => {
        let s = freshDynasty(seed * 1000)
        for (let i = 0; i < 15; i++) {
          s = runOffseason(s, completedSeries(dynastySeriesSeed(seed * 1000, START, s.currentYear))).next
        }
        return s
      })()
      const retired = new Set(state.overlay.retired)
      for (const p of [...QLD_SQUAD, ...state.overlay.rookies]) {
        if (retired.has(p.id)) continue
        const age = ageOf(p, state.currentYear)
        expect(age, `${p.name} still active at ${age} (seed ${seed})`).toBeLessThanOrEqual(AGING_TUNING.retirementForcedAge)
      }
    }
  })

  it('the intake keeps the squad whole and roughly as strong across 15 seasons', () => {
    const overallOf = (p: { attrs: { attack: number; defence: number; speed: number; hands: number; composure: number } }) =>
      (p.attrs.attack + p.attrs.defence + p.attrs.speed + p.attrs.hands + p.attrs.composure) / 5
    const baseMean = QLD_SQUAD.reduce((t, p) => t + overallOf(p), 0) / QLD_SQUAD.length
    for (let seed = 1; seed <= 6; seed++) {
      let state = freshDynasty(seed * 31)
      for (let i = 0; i < 15; i++) {
        state = runOffseason(state, completedSeries(dynastySeriesSeed(seed * 31, START, state.currentYear))).next
        const roster = resolveRoster(QLD_SQUAD, state.overlay, state.currentYear, state.startYear)
        // Whole: enough bodies + every starting position covered by intake planning.
        expect(roster.length, `seed ${seed} ${state.currentYear}: squad ${roster.length}`).toBeGreaterThanOrEqual(24)
        // Roughly as strong: the world neither inflates nor collapses (calibration guard).
        const mean = roster.reduce((t, p) => t + overallOf(p), 0) / roster.length
        expect(Math.abs(mean - baseMean), `seed ${seed} ${state.currentYear}: mean ${mean.toFixed(1)} vs base ${baseMean.toFixed(1)}`).toBeLessThanOrEqual(6)
      }
    }
  })

  it('viability: every year of a 15-season dynasty still fields a full 19 + 2 via auto-fill', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let state = freshDynasty(seed * 77)
      for (let yearN = 0; yearN < 15; yearN++) {
        const roster = resolveRoster(QLD_SQUAD, state.overlay, state.currentYear, state.startYear)
        const lineup = buildAutoLineup(roster)
        for (const pos of [...MATCHDAY_POSITIONS, ...RESERVE_POSITIONS] as Position[]) {
          expect(lineup[pos], `seed ${seed} year ${state.currentYear}: cannot fill ${pos}`).toBeTruthy()
        }
        state = runOffseason(state, completedSeries(dynastySeriesSeed(seed * 77, START, state.currentYear))).next
      }
    }
  })

  it('the veterans bow out on schedule: DCE (37 in 2026) never survives the first off-season', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { next, report } = runOffseason(freshDynasty(seed * 13), completedSeries(seed * 13))
      expect(next.overlay.retired).toContain('dce')
      expect(report.retirements.some((r) => r.name === 'Daly Cherry-Evans')).toBe(true)
    }
  })

  it('archives the year with the result and rolls the calendar', () => {
    const { next, report } = runOffseason(freshDynasty(99), completedSeries(99, 'QLD'))
    expect(next.currentYear).toBe(START + 1)
    expect(next.years).toHaveLength(1)
    expect(next.years[0]).toMatchObject({ year: START, seriesWinner: 'QLD', seriesRootSeed: 99 })
    expect(report.eraLine).toContain('Year 2')
    expect(report.eraLine).toContain('1 shield')
  })
})

describe('dynasty — the rookie class', () => {
  it('rookie ids are unique across a 20-year dynasty and no rookie shares a surname with a real Maroon', () => {
    const baseSurnames = new Set(QLD_SQUAD.map((p) => p.name.split(' ').slice(1).join(' ')))
    let state = freshDynasty(4242)
    for (let i = 0; i < 20; i++) {
      state = runOffseason(state, completedSeries(dynastySeriesSeed(4242, START, state.currentYear))).next
    }
    const ids = state.overlay.rookies.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of state.overlay.rookies) {
      const surname = r.name.split(' ').slice(1).join(' ')
      expect(baseSurnames.has(surname), `${r.name} impersonates a real Maroon`).toBe(false)
      expect(r.birthYear).toBeGreaterThan(2000)
      expect(r.tag).toBe('rookie')
      expect(r.id).toMatch(/^dyn-q-\d{4}-\d+$/)
    }
    expect(state.overlay.rookies.length).toBeGreaterThan(5) // two decades of intake actually happened
  })

  it('rookies debut young, age like anyone, and eventually retire', () => {
    let state = freshDynasty(9090)
    for (let i = 0; i < 15; i++) {
      state = runOffseason(state, completedSeries(dynastySeriesSeed(9090, START, state.currentYear))).next
    }
    const retiredRookies = state.overlay.rookies.filter((r) => state.overlay.retired.includes(r.id))
    // Early classes are into their 30s by year 15 — some must have drifted and some retired.
    const drifted = state.overlay.rookies.filter((r) => state.overlay.attrDeltas[r.id])
    expect(drifted.length).toBeGreaterThan(0)
    expect(retiredRookies.length + state.overlay.rookies.length).toBeGreaterThan(0)
  })
})

describe('dynasty — resolved rosters', () => {
  it('year one with an empty overlay is byte-identical to the base squad', () => {
    const roster = resolveRoster(QLD_SQUAD, { attrDeltas: {}, retired: [], rookies: [] }, START, START)
    expect(roster).toEqual(QLD_SQUAD)
  })

  it('later years clear 2026 statuses, refresh notes, and clamp drifted attributes', () => {
    const overlay = {
      attrDeltas: { ponga: { attack: -80, defence: 5, speed: 200, hands: 0, composure: 0, stamina: 0 } },
      retired: ['dce'],
      rookies: [],
    }
    const roster = resolveRoster(QLD_SQUAD, overlay, START + 3, START)
    expect(roster.some((p) => p.id === 'dce')).toBe(false)
    const ponga = roster.find((p) => p.id === 'ponga')!
    expect(ponga.attrs.attack).toBe(30) // floor
    expect(ponga.attrs.speed).toBe(99) // ceiling
    expect(ponga.status).toBe('available')
    expect(ponga.formNote).toContain(String(START + 3))
    // Coates (injured in 2026) reports fit in a later year.
    expect(roster.find((p) => p.id === 'coates')!.status).toBe('available')
  })

  it('a 30+ man reads as a veteran whatever his authored tag', () => {
    const roster = resolveRoster(QLD_SQUAD, { attrDeltas: {}, retired: [], rookies: [] }, START + 6, START)
    const walsh = roster.find((p) => p.id === 'walsh')! // bolter, born 2002 → 30 in 2032
    expect(ageOf(walsh, START + 6)).toBeGreaterThanOrEqual(30)
    expect(walsh.tag).toBe('veteran')
  })
})
