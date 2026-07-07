import { BIRTH_YEARS } from '../data/ages'
import type { Player } from '../data/types'
import type { Rng } from '../engine'
import type { AttrDelta } from './types'

/**
 * The aging model. Careers arc: growth to ~25, a peak plateau 26–28, then decline that steepens —
 * and the legs go first (speed decays hardest) while the craft compensates (composure/hands keep
 * growing through 30). Retirement probability rises with age to a HARD 100% at 36: no immortals,
 * pinned by test. All tunables in one place.
 */
export const AGING_TUNING = {
  /** Mean drift (attr points/season) by age band. */
  baseDrift: [
    { maxAge: 21, drift: 3.0 },
    { maxAge: 24, drift: 2.0 },
    { maxAge: 25, drift: 1.0 },
    { maxAge: 28, drift: 0.0 }, // the peak plateau
    { maxAge: 30, drift: -1.0 },
    { maxAge: 32, drift: -2.5 },
    { maxAge: 99, drift: -4.0 },
  ],
  /** Per-attribute multipliers on DECLINE (negative drift): the legs go first. */
  declineMult: { attack: 1.0, defence: 1.0, speed: 1.6, hands: 0.5, composure: 0.4, stamina: 0.9 },
  /** Per-attribute multipliers on GROWTH: young players sharpen everything, craft fastest. */
  growthMult: { attack: 1.0, defence: 1.0, speed: 0.7, hands: 1.1, composure: 1.2, stamina: 0.8 },
  /** Bolters burn bright and fade fast; workhorses age gracefully. */
  tagMult: { bolter: 1.2, workhorse: 0.8, rookie: 1.0, veteran: 1.0 } as Record<string, number>,
  /** Uniform noise half-width per attr per season (keeps careers individual). */
  noise: 1.5,
  /** Per-attr per-season clamp, then cumulative clamps at resolution. */
  seasonClamp: { min: -6, max: 5 },
  /** Retirement chance by age (rolled AFTER drift). ≤29 never; 36+ always. */
  retirement: [
    { age: 30, p: 0.1 },
    { age: 31, p: 0.2 },
    { age: 32, p: 0.35 },
    { age: 33, p: 0.55 },
    { age: 34, p: 0.75 },
    { age: 35, p: 0.9 },
  ],
  retirementForcedAge: 36,
  /** Extra retirement probability once the body has clearly gone (resolved overall below this). */
  fadedOverallThreshold: 62,
  fadedRetirementBonus: 0.15,
  /** Fallback birth-year bands (2026 ages) when a player has no authored entry, by tag. */
  fallbackAgeByTag: { rookie: 20, bolter: 23, workhorse: 27, veteran: 30 } as Record<string, number>,
  fallbackBaseYear: 2026,
} as const

/** A player's birth year: carried on the object (generated rookies), else the authored table,
 *  else a stable tag-band fallback. */
export function birthYearOf(p: Player): number {
  if (p.birthYear) return p.birthYear
  const authored = BIRTH_YEARS[p.id]
  if (authored) return authored
  const age = AGING_TUNING.fallbackAgeByTag[p.tag ?? 'workhorse'] ?? 26
  return AGING_TUNING.fallbackBaseYear - age
}

export function ageOf(p: Player, year: number): number {
  return year - birthYearOf(p)
}

function baseDriftFor(age: number): number {
  for (const band of AGING_TUNING.baseDrift) {
    if (age <= band.maxAge) return band.drift
  }
  return AGING_TUNING.baseDrift[AGING_TUNING.baseDrift.length - 1].drift
}

const ATTRS = ['attack', 'defence', 'speed', 'hands', 'composure', 'stamina'] as const

/**
 * One player's off-season drift. Draws EXACTLY 6 rng values (one per attribute) unconditionally, so
 * the stream can never desync on branch logic — the advanceConditions discipline.
 */
export function seasonDrift(p: Player, ageAtSeasonEnd: number, rng: Rng): AttrDelta {
  const base = baseDriftFor(ageAtSeasonEnd)
  const tagMult = AGING_TUNING.tagMult[p.tag ?? 'workhorse'] ?? 1
  const delta = {} as AttrDelta
  for (const attr of ATTRS) {
    const noise = (rng() * 2 - 1) * AGING_TUNING.noise
    const mult = base >= 0 ? AGING_TUNING.growthMult[attr] : AGING_TUNING.declineMult[attr]
    const raw = base * mult * tagMult + noise
    delta[attr] = Math.round(
      Math.max(AGING_TUNING.seasonClamp.min, Math.min(AGING_TUNING.seasonClamp.max, raw)),
    )
  }
  return delta
}

/**
 * The retirement probability for a player at season's end. 0 through 29; certain at 36 — the
 * no-immortals guarantee. `resolvedOverall` is his CURRENT (drifted) quality: clearly-faded men bow
 * out rather than limp on.
 */
export function retirementChance(age: number, resolvedOverall: number): number {
  if (age >= AGING_TUNING.retirementForcedAge) return 1
  const band = AGING_TUNING.retirement.find((b) => b.age === age)
  if (!band) return 0
  const faded = resolvedOverall < AGING_TUNING.fadedOverallThreshold ? AGING_TUNING.fadedRetirementBonus : 0
  return Math.min(1, band.p + faded)
}
