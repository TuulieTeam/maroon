import type { Player, Position } from '../data/types'
import type { VenueId } from '../engine'

/**
 * The Daily Origin's twist catalog. A twist is the day's authored constraint — the thing that makes
 * today's one-shot match a PUZZLE rather than a re-run: it rules men out of your pool, tilts a side's
 * form, or moves the game to a hostile deck. All of it composes at the App kickoff boundary exactly
 * like the difficulty dial (pure arithmetic on the form map + a ruled-out set + a venue pick), so the
 * engine never learns "twist" and the seeded play stream is never perturbed.
 *
 * `ruledOut` is a function of the CURRENT squad (never a hardcoded id list), so hand-kept 2026 roster
 * edits can't strand a twist pointing at players who no longer exist. The viability guard in
 * dailyChallenge.test.ts proves every twist still leaves a valid 19+2 pickable.
 */
export interface DailyTwist {
  /** Stable id persisted in the daily ledger. Never reuse or rename a shipped id. */
  id: string
  /** Short billing shown on the challenge card, e.g. "Depleted spine". */
  label: string
  /** One-liner setting the scene — why today is different. */
  blurb: string
  /** Uniform effective-attr delta folded into every NSW player's form entry. */
  nswFormDelta?: number
  /** Uniform effective-attr delta folded into every QLD player's form entry. */
  qldFormDelta?: number
  /** Today's unavailable men, derived from the live squad (pure — no rng, no ids frozen in). */
  ruledOut?: (squad: Player[]) => string[]
  /** Moves the match to this ground (otherwise the challenge's seeded venue draw stands). */
  forceVenue?: VenueId
}

const overall = (p: Player) =>
  (p.attrs.attack + p.attrs.defence + p.attrs.speed + p.attrs.hands + p.attrs.composure) / 5

/** The best natural fit for each given position — one man per position, best first by overall. */
function bestNaturalPer(squad: Player[], positions: Position[]): string[] {
  const out: string[] = []
  for (const pos of positions) {
    const best = squad
      .filter((p) => p.naturalPositions.includes(pos) && !out.includes(p.id))
      .sort((a, b) => overall(b) - overall(a))[0]
    if (best) out.push(best.id)
  }
  return out
}

/** The top N middles (natural prop/lock) by overall — the engine room of the pack. */
function topMiddles(squad: Player[], n: number): string[] {
  const isMiddle = (p: Player) =>
    p.naturalPositions.some((pos) => pos === 'PL' || pos === 'PR' || pos === 'LK')
  return squad
    .filter(isMiddle)
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, n)
    .map((p) => p.id)
}

export const DAILY_TWISTS: DailyTwist[] = [
  {
    id: 'full-80',
    label: 'The Full 80',
    blurb: 'No twist, no excuses — the full pool is fit and the Blues are ready. A straight shootout.',
  },
  {
    id: 'blues-career-best',
    label: 'Blues at career best',
    blurb: 'Every Blue is in the form of his life tonight. Only your sharpest sheet lives with them.',
    nswFormDelta: 4,
  },
  {
    id: 'five-day-turnaround',
    label: 'Five-day turnaround',
    blurb: 'Your men backed up from club footy on a short week. Heavy legs — pick an engine, not a highlight reel.',
    qldFormDelta: -3,
  },
  {
    id: 'depleted-spine',
    label: 'Depleted spine',
    blurb: 'Your first-choice spine is gone in one cruel week. Rebuild the 1-6-7-9 from what remains.',
    ruledOut: (squad) => bestNaturalPer(squad, ['FB', 'FE', 'HB', 'HK']),
  },
  {
    id: 'decimated-pack',
    label: 'Decimated pack',
    blurb: 'Your three best middles are in the casualty ward. Someone unfashionable has to carry the fight.',
    ruledOut: (squad) => topMiddles(squad, 3),
  },
  {
    id: 'hostile-cauldron',
    label: 'Hostile cauldron',
    blurb: 'A one-off in Sydney with 80,000 booing you off the bus — and the Blues feed on it.',
    nswFormDelta: 2,
    forceVenue: 'ACCOR_SYD',
  },
  {
    id: 'blood-the-kids',
    label: 'Blood the kids',
    blurb: 'The selectors rested every veteran. The future of Queensland gets its audition tonight.',
    ruledOut: (squad) => squad.filter((p) => p.tag === 'veteran').map((p) => p.id),
  },
]

/** Resolve a stored twist id; falls back to the plain shootout if a shipped id ever disappears. */
export function twistById(id: string | undefined): DailyTwist {
  return DAILY_TWISTS.find((t) => t.id === id) ?? DAILY_TWISTS[0]
}
