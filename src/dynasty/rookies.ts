import type { Player, Position } from '../data/types'
import { makeRng } from '../engine'
import type { Rng } from '../engine'

/**
 * The rookie class — generated Queenslanders who refill the pool as the old guard retires. Rookies
 * are GENERATED-WORLD state: seeded deterministically, then stored verbatim in the dynasty save so
 * a future name-pool or archetype edit can never rename a three-season veteran of YOUR dynasty.
 * Ids are namespaced (`dyn-q-2029-1`) and collision-proof by construction; the surname pool is
 * curated to exclude every surname in the authored base data (test-pinned), so a generated kid can
 * never impersonate a real Maroon.
 */
export const ROOKIE_TUNING = {
  /** Overall band for a standard draft class — calibrated ~6.5 under the post-rebalance squad mean
   *  (~79), so a debutant is a project, not a finished Origin player. Retune WITH qldSquad.ts. */
  overallMin: 65,
  overallMax: 80,
  /** One-in-twenty is a generational talent. */
  generationalChance: 0.05,
  generationalMin: 81,
  generationalMax: 88,
  /** Debut age band. */
  ageMin: 19,
  ageMax: 21,
  /** Never more than this many debuts in one summer — a class, not a flood. */
  maxPerYear: 6,
} as const

const FIRST_NAMES = [
  'Jack', 'Tom', 'Kai', 'Xavier', 'Hamish', 'Tyrell', 'Beau', 'Lachlan', 'Israel', 'Noah',
  'Levi', 'Jesse', 'Ryder', 'Cooper', 'Malakai', 'Taine', 'Blake', 'Sione', 'Hugo', 'Darcy',
  'Manaia', 'Eli', 'Zac', 'Rory', 'Tevita', 'Callum', 'Brodie', 'Finn', 'Semisi', 'Angus',
  'Koa', 'Jarrah', 'Banjo', 'Tane', 'Solomone', 'Heath', 'Rhys', 'Otis', 'Micah', 'Fletcher',
  'Kobe', 'Duke', 'Nixon', 'Talan', 'Iosefa', 'Clancy', 'Reuben', 'Viliami', 'Sonny', 'Arlo',
]

/** No overlap with any authored QLD surname (pinned by rookies.test) — nor the NSW replacement
 *  pool, so a generated Maroon can never share a full-name-space with a generated Blue. */
const SURNAMES = [
  'Kealey', 'Marburg', 'Tanoai', 'Whitford', 'Bellamy-Roy', 'Ferndale', 'Aputangi', 'Corrigan',
  'Delacroix', 'Havili', 'Norwood', 'Tuilagi-Smith', 'Redpath', 'Okafor', 'Brimson-Lee', 'Calloway',
  'Ngata', 'Sherrington', 'Vaikona', 'Ashworth', 'Manu-Green', 'Oxley', 'Palaszczuk', 'Kirwan-Doyle',
  'Teulilo', 'Barlow', 'Hokianga', 'Stratford', 'Vunivalu-Reid', 'McAllister',
  'Ashcombe', 'Bramleigh', 'Carseldine', 'Deloraine', 'Ellsworth', 'Fanshawe', 'Gillingham', 'Hartwell',
  'Jephcott', 'Kirkbride', 'Lindqvist', 'Mataafa', 'Naumann', 'Onslow', 'Petherbridge', 'Quilkey',
  'Rangiwai', 'Solofa-Grey', 'Tuivasa-Brown', 'Wenlock', 'Yarran-Cole', 'Zelinski',
]

const CLUBS = ['Broncos', 'Cowboys', 'Dolphins', 'Titans', 'Storm', 'Rabbitohs', 'Dragons', 'Sharks']

/** Positional archetypes — the shape of a kid built for that job. Weights sum to 1-ish per attr. */
interface Archetype {
  positions: Position[]
  /** Relative attr emphasis (multiplied onto the rolled overall). */
  shape: { attack: number; defence: number; speed: number; hands: number; composure: number }
  stamina: [number, number]
  goalKicking: [number, number]
}

export const ARCHETYPES: Record<string, Archetype> = {
  outsideBack: {
    positions: ['WL', 'WR', 'CL', 'CR'],
    shape: { attack: 1.1, defence: 0.85, speed: 1.25, hands: 0.9, composure: 0.8 },
    stamina: [68, 82],
    goalKicking: [2, 30],
  },
  fullback: {
    positions: ['FB', 'WL', 'WR'],
    shape: { attack: 1.15, defence: 0.8, speed: 1.2, hands: 1.0, composure: 0.85 },
    stamina: [72, 86],
    goalKicking: [10, 55],
  },
  half: {
    positions: ['HB', 'FE'],
    shape: { attack: 1.05, defence: 0.8, speed: 0.95, hands: 1.2, composure: 1.05 },
    stamina: [70, 86],
    goalKicking: [30, 80],
  },
  hooker: {
    positions: ['HK'],
    shape: { attack: 0.95, defence: 1.05, speed: 1.0, hands: 1.15, composure: 1.0 },
    stamina: [80, 94],
    goalKicking: [1, 8],
  },
  middle: {
    positions: ['PR', 'PL', 'LK'],
    shape: { attack: 0.95, defence: 1.2, speed: 0.7, hands: 0.75, composure: 0.9 },
    stamina: [60, 80],
    goalKicking: [1, 3],
  },
  edge: {
    positions: ['SRL', 'SRR', 'LK'],
    shape: { attack: 1.0, defence: 1.1, speed: 0.9, hands: 0.8, composure: 0.85 },
    stamina: [70, 90],
    goalKicking: [1, 4],
  },
}

const ARCHETYPE_KEYS = Object.keys(ARCHETYPES)

function clampAttr(x: number): number {
  return Math.max(35, Math.min(92, Math.round(x)))
}

function pickInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1))
}

/** One rookie. Draws a FIXED 12 rng values so the class stream can never desync. */
function generateRookie(rng: Rng, id: string, forYear: number, archetypeKey: string): Player {
  const a = ARCHETYPES[archetypeKey]
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)] // 1
  const surname = SURNAMES[Math.floor(rng() * SURNAMES.length)] // 2
  const club = CLUBS[Math.floor(rng() * CLUBS.length)] // 3
  const generational = rng() < ROOKIE_TUNING.generationalChance // 4
  const overall = generational
    ? pickInt(rng, ROOKIE_TUNING.generationalMin, ROOKIE_TUNING.generationalMax) // 5
    : pickInt(rng, ROOKIE_TUNING.overallMin, ROOKIE_TUNING.overallMax)
  const age = pickInt(rng, ROOKIE_TUNING.ageMin, ROOKIE_TUNING.ageMax) // 6
  const stamina = pickInt(rng, a.stamina[0], a.stamina[1]) // 7
  const goalKicking = pickInt(rng, a.goalKicking[0], a.goalKicking[1]) // 8
  // 9-12: per-attr jitter (one draw each for attack/defence/speed/hands; composure balances).
  const jitter = () => (rng() * 2 - 1) * 4
  return {
    id,
    name: `${first} ${surname}`,
    club,
    naturalPositions: [...a.positions],
    attrs: {
      attack: clampAttr(overall * a.shape.attack + jitter()),
      defence: clampAttr(overall * a.shape.defence + jitter()),
      speed: clampAttr(overall * a.shape.speed + jitter()),
      hands: clampAttr(overall * a.shape.hands + jitter()),
      composure: clampAttr(overall * a.shape.composure),
    },
    goalKicking,
    stamina,
    tag: 'rookie',
    birthYear: forYear - age,
    formNote: `Debuts ${forYear} — ${generational ? 'the scouts are calling him a generational talent' : 'graded through the Queensland pathways'}.`,
  }
}

/** Decorrelated stream for the rookie class — never shares draws with the aging pass. */
export function rookieSeed(dynastySeed: number, forYear: number): number {
  return (dynastySeed ^ Math.imul(0x85ebca6b, (forYear & 0xffff) + 0x77)) >>> 0
}

/**
 * The summer's intake: one rookie per requested archetype (positional needs first, then best-athlete
 * top-ups), capped at maxPerYear. Deterministic from (dynastySeed, forYear, needs) — and because the
 * result is STORED, even a future generator change can't rewrite an existing class.
 */
export function generateRookieClass(dynastySeed: number, forYear: number, needs: string[]): Player[] {
  const rng = makeRng(rookieSeed(dynastySeed, forYear))
  const take = needs.slice(0, ROOKIE_TUNING.maxPerYear)
  return take.map((archetypeKey, i) =>
    generateRookie(rng, `dyn-q-${forYear}-${i + 1}`, forYear, ARCHETYPE_KEYS.includes(archetypeKey) ? archetypeKey : 'edge'),
  )
}

/** Which archetype replaces a body at this position — the intake planner's lookup. */
export function archetypeForPosition(pos: Position): string {
  if (pos === 'FB') return 'fullback'
  if (pos === 'HB' || pos === 'FE') return 'half'
  if (pos === 'HK') return 'hooker'
  if (pos === 'PR' || pos === 'PL' || pos === 'LK') return 'middle'
  if (pos === 'SRL' || pos === 'SRR') return 'edge'
  return 'outsideBack'
}
