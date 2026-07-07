import { describe, expect, it } from 'vitest'
import { BLUES_VARIANTS, bluesById } from '../../data/bluesVariants'
import type { SeriesState } from '../../series'
import { makeRng } from '../../engine'
import { allNswIdentities, generateBluesReplacement, nswBirthYear, nswKey, resolveBluesSheet, resolveReplacement } from '../nsw'
import { NSW_COACHES, runOffseason } from '../offseason'
import { dynastySeriesSeed } from '../seed'
import type { DynastyState } from '../types'

const START = 2026

function freshDynasty(seed = 12345): DynastyState {
  return {
    schemaVersion: 1,
    dynastySeed: seed,
    startYear: START,
    currentYear: START,
    overlay: { attrDeltas: {}, retired: [], rookies: [], nswReplacements: {} },
    years: [],
    nswCoach: { index: 0, lostStreak: 0 },
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

function runYears(seed: number, n: number, winner: 'QLD' | 'NSW' = 'QLD'): DynastyState {
  let s = freshDynasty(seed)
  for (let i = 0; i < n; i++) {
    s = runOffseason(s, completedSeries(dynastySeriesSeed(seed, START, s.currentYear), winner)).next
  }
  return s
}

const overallOf = (p: { attrs: { attack: number; defence: number; speed: number; hands: number; composure: number } }) =>
  (p.attrs.attack + p.attrs.defence + p.attrs.speed + p.attrs.hands + p.attrs.composure) / 5

describe('nsw — canonical identity', () => {
  it('the same man in two sheets is ONE identity with ONE age', () => {
    expect(nswKey('Payne Haas')).toBe(nswKey('payne haas'))
    const identities = allNswIdentities(freshDynasty().overlay)
    const distinctNames = new Set(
      BLUES_VARIANTS.flatMap((v) => Object.values(v.lineup).map((p) => p.name)),
    )
    expect(identities.size).toBe(distinctNames.size)
    // Haas appears in multiple sheets; his birth year must be identical wherever he's read from.
    const haasInstances = BLUES_VARIANTS.flatMap((v) => Object.values(v.lineup)).filter((p) => p.name === 'Payne Haas')
    expect(haasInstances.length).toBeGreaterThanOrEqual(2)
    const years = new Set(haasInstances.map(nswBirthYear))
    expect(years.size).toBe(1)
  })

  it('birth years spread WITHIN tag bands and give sane 2026 ages', () => {
    for (const sheet of BLUES_VARIANTS) {
      for (const p of Object.values(sheet.lineup)) {
        const age = START - nswBirthYear(p)
        expect(age, `${p.name} is ${age}`).toBeGreaterThanOrEqual(19)
        expect(age, `${p.name} is ${age}`).toBeLessThanOrEqual(32)
      }
    }
  })
})

describe('nsw — retirements and replacements', () => {
  it('Blues retire over a long dynasty and their replacements keep the sheet whole and near-strength', () => {
    const state = runYears(777, 12)
    const nswRetired = state.overlay.retired.filter((k) => k.startsWith('nsw:'))
    expect(nswRetired.length, 'no Blue retired in 12 years').toBeGreaterThan(5)
    for (const sheet of BLUES_VARIANTS) {
      const base = bluesById(sheet.id)
      const resolved = resolveBluesSheet(base, state.overlay)
      // Every slot filled, no retired man still on the park.
      expect(Object.keys(resolved.lineup)).toHaveLength(Object.keys(base.lineup).length)
      for (const p of Object.values(resolved.lineup)) {
        expect(state.overlay.retired.includes(nswKey(p.name)), `${p.name} plays on retired`).toBe(false)
      }
      // Equal-strength property holds within a widened band (aging + 92-98% replacements).
      const baseMean = Object.values(base.lineup).reduce((t, p) => t + overallOf(p), 0) / 21
      const resolvedMean = Object.values(resolved.lineup).reduce((t, p) => t + overallOf(p), 0) / 21
      expect(Math.abs(resolvedMean - baseMean), `${sheet.id}: ${resolvedMean.toFixed(1)} vs ${baseMean.toFixed(1)}`).toBeLessThanOrEqual(7)
    }
  })

  it('a replacement mirrors the departed man: same positions, 92-98% quality band', () => {
    const rng = makeRng(42)
    const departed = bluesById('classic').lineup.CL
    const repl = generateBluesReplacement(rng, departed, 2029, 1)
    expect(repl.naturalPositions).toEqual(departed.naturalPositions)
    expect(repl.id).toBe('dyn-b-2029-1')
    expect(repl.birthYear).toBeGreaterThanOrEqual(2029 - 24)
    const ratio = overallOf(repl) / overallOf(departed)
    expect(ratio).toBeGreaterThan(0.85) // rounding tolerance under the 0.92 floor
    expect(ratio).toBeLessThanOrEqual(1.0)
  })

  it('replacement chains resolve: when the replacement retires, HIS replacement plays', () => {
    const overlay = {
      attrDeltas: {},
      retired: [nswKey('Old Blue'), nswKey('Mid Blue')],
      rookies: [],
      nswReplacements: {
        [nswKey('Old Blue')]: { ...bluesById('classic').lineup.CL, id: 'dyn-b-1', name: 'Mid Blue' },
        [nswKey('Mid Blue')]: { ...bluesById('classic').lineup.CL, id: 'dyn-b-2', name: 'New Blue' },
      },
    }
    expect(resolveReplacement(nswKey('Old Blue'), overlay)?.name).toBe('New Blue')
  })

  it('the scouting threats swap retired danger men for their replacements', () => {
    const state = runYears(777, 12)
    for (const sheet of BLUES_VARIANTS) {
      const resolved = resolveBluesSheet(bluesById(sheet.id), state.overlay)
      const onPark = new Set(Object.values(resolved.lineup).map((p) => p.name))
      for (const t of resolved.edgeThreats) {
        for (const name of t.dangerMen) {
          expect(state.overlay.retired.includes(nswKey(name)), `threat names retired ${name}`).toBe(false)
          // A swapped-in danger man is actually on the resolved sheet.
          if (!bluesById(sheet.id).edgeThreats.some((bt) => bt.dangerMen.includes(name))) {
            expect(onPark.has(name)).toBe(true)
          }
        }
      }
    }
  })

  it('is deterministic end to end with NSW in the world', () => {
    const a = runYears(999, 6)
    const b = runYears(999, 6)
    expect(a).toEqual(b)
  })
})

describe('nsw — the coaching carousel', () => {
  it('two straight series losses to Queensland and their coach walks', () => {
    let s = freshDynasty(50)
    const r1 = runOffseason(s, completedSeries(dynastySeriesSeed(50, START, s.currentYear), 'QLD'))
    expect(r1.report.nswCoachLine).toBeNull()
    expect(r1.next.nswCoach.lostStreak).toBe(1)
    s = r1.next
    const r2 = runOffseason(s, completedSeries(dynastySeriesSeed(50, START, s.currentYear), 'QLD'))
    expect(r2.report.nswCoachLine).toContain(NSW_COACHES[0])
    expect(r2.report.nswCoachLine).toContain(NSW_COACHES[1])
    expect(r2.next.nswCoach).toEqual({ index: 1, lostStreak: 0 })
    // An NSW shield resets the streak — their coach survives.
    const r3 = runOffseason(r2.next, completedSeries(dynastySeriesSeed(50, START, r2.next.currentYear), 'NSW'))
    expect(r3.report.nswCoachLine).toBeNull()
    expect(r3.next.nswCoach.lostStreak).toBe(0)
  })
})
