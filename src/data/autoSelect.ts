import type { Player, Position } from './types'
import { BENCH_POSITIONS, POSITION_META, RESERVE_POSITIONS, STARTING_POSITIONS } from './positions'

export type AutoLineup = Partial<Record<Position, string>>

const overall = (p: Player) =>
  (p.attrs.attack + p.attrs.defence + p.attrs.speed + p.attrs.hands + p.attrs.composure) / 5

// Static real-world standing — injured/suspended/dropped drop down the order.
const statusPenalty = (p: Player) => (p.status && p.status !== 'available' ? 25 : 0)

const isForward = (p: Player) => p.naturalPositions.some((n) => POSITION_META[n].role === 'forward')

/**
 * Pick a sensible, position-correct default 19 + 2 reserves from the pool. Starting slots are
 * filled HARDEST-FIRST (fewest eligible players), so scarce specialist roles (hooker, fullback)
 * get their man before utilities are consumed elsewhere — and each slot takes the BEST fit, not
 * the first player listed who happens to be eligible. That's what stops a hooker landing at prop.
 *
 * `formDelta(id)` (default 0) folds each man's live form into the ranking — already including any
 * play-hurt penalty — so a red-hot bolter rises, a slumping gun falls, and a fit alternative is
 * preferred over a doubtful one. Pass it (the caller filters out the fully ruled-out men first).
 */
export function buildAutoLineup(squad: Player[], formDelta: (id: string) => number = () => 0): AutoLineup {
  // Form-adjusted quality: base attrs, lifted/dropped by live form, minus the static status standing.
  const quality = (p: Player) => overall(p) + formDelta(p.id) - statusPenalty(p)
  // A small nudge for a player's primary position, so a specialist edges a utility for their own slot.
  const startScore = (p: Player, pos: Position) => (p.naturalPositions[0] === pos ? 8 : 0) + quality(p)

  const next: AutoLineup = {}
  const taken = new Set<string>()
  const remaining = () => squad.filter((p) => !taken.has(p.id))
  const eligibleCount = (pos: Position) => squad.filter((p) => p.naturalPositions.includes(pos)).length

  const startingByScarcity = [...STARTING_POSITIONS].sort((a, b) => eligibleCount(a) - eligibleCount(b))
  for (const pos of startingByScarcity) {
    const pool = remaining()
    const pick =
      pool
        .filter((p) => p.naturalPositions.includes(pos))
        .sort((a, b) => startScore(b, pos) - startScore(a, pos))[0] ??
      pool.sort((a, b) => quality(b) - quality(a))[0]
    if (pick) {
      next[pos] = pick.id
      taken.add(pick.id)
    }
  }

  // Bench (INT1-6): best remaining FORWARDS first for rotation cover.
  for (const pos of BENCH_POSITIONS) {
    const pool = remaining()
    const pick =
      pool.filter(isForward).sort((a, b) => quality(b) - quality(a))[0] ??
      pool.sort((a, b) => quality(b) - quality(a))[0]
    if (pick) {
      next[pos] = pick.id
      taken.add(pick.id)
    }
  }

  // Reserves (20th/21st): best remaining of any kind.
  for (const pos of RESERVE_POSITIONS) {
    const pick = remaining().sort((a, b) => quality(b) - quality(a))[0]
    if (pick) {
      next[pos] = pick.id
      taken.add(pick.id)
    }
  }

  return next
}
