import type { Player, PlayerRole } from '../data/types'
import { POSITION_META } from '../data/positions'
import { gauss, makeRng } from '../engine'
import type { MatchEvent, PlayerStatLine } from '../engine'
import { conditionSeed } from './seed'
import type { ConditionMap, FormRating, InjuryCause, InjuryKind, InjuryState, PlayerCondition } from './types'

/**
 * All the knobs for player form + injuries. The form<->attribute mapping and the play-hurt penalties
 * are the engine BOUNDARY (the UI applies them); the rest govern the between-games club round. Magnitude
 * is the balance-pass lever (step 9): form maps to +/-12 effective-attr points at the extremes.
 */
export const CONDITIONS_TUNING = {
  toAttrScale: 0.24, // a 0-100 rating maps to (rating-50)*toAttrScale effective-attr points
  deltaCap: 12, // hard cap on the signed form delta
  ratingNeutral: 50,
  regression: 0.55, // each club round pulls form this fraction toward neutral
  clubSd: 14, // sd of the seeded club-form swing
  clubSwingCap: 28, // clamp on the swing (keeps the squad mean ~50)
  originScale: 3, // performance z-score -> form points
  originDeltaCap: 6, // clamp on the Origin-performance nudge
  minutesFloor: 6, // below this minutesProxy, no Origin delta (injured-early / unselected)
  clubInjuryChance: 0.012, // per player per club round
  clubInjurySeriousFrac: 0.25, // of club injuries, the share that are OUT vs a doubtful niggle
  doubtfulReinjuryMult: 4, // head-knock probability multiplier for a play-hurt man
  doubtfulFormPenalty: -8, // flat effective-attr penalty for playing hurt
  // Role baselines for the Origin-performance z-score (per-80 performanceScore). CALIBRATED from a
  // 120-match neutral real-squad run (backs swing widest, forwards' tackle volume is steady), so an
  // average game nets ~0 form and only a genuine blinder/shocker moves the needle. RE-DERIVED after
  // the Great Rebalance (parity squads); if the authored squads move again, re-derive (mirror
  // originPerformanceDelta's gate + per-80 scaling over ~120 neutral sims) or every game reads biased.
  roleBaseline: {
    back: { mean: 1015, sd: 550 },
    forward: { mean: 848, sd: 290 },
    half: { mean: 842, sd: 341 },
  } as Record<PlayerRole, { mean: number; sd: number }>,
} as const

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

const SEVERITY: Record<InjuryKind, number> = { fit: 0, doubtful: 1, suspended: 2, out: 3 }

// ---- Engine-boundary derivations (App calls these at kickoff) ----

/** A 0-100 form rating -> a signed effective-attribute delta. The ONE place the rating becomes points. */
export function formRatingToDelta(form: FormRating): number {
  const { ratingNeutral, toAttrScale, deltaCap } = CONDITIONS_TUNING
  return clamp((form - ratingNeutral) * toAttrScale, -deltaCap, deltaCap)
}

export type FormBand = 'hot' | 'warm' | 'steady' | 'cool' | 'slump'

/** Coarse band for displaying a form rating on a card. */
export function formBand(form: FormRating): FormBand {
  if (form >= 66) return 'hot'
  if (form >= 56) return 'warm'
  if (form >= 45) return 'steady'
  if (form >= 35) return 'cool'
  return 'slump'
}

/** Head-knock probability multiplier for a play-hurt (DOUBTFUL) man; 1 otherwise. */
export function reinjuryMult(c: PlayerCondition): number {
  return c.injury.kind === 'doubtful' ? CONDITIONS_TUNING.doubtfulReinjuryMult : 1
}

/** Flat effective-attr penalty for playing hurt (DOUBTFUL); 0 otherwise. */
export function playHurtPenalty(c: PlayerCondition): number {
  return c.injury.kind === 'doubtful' ? CONDITIONS_TUNING.doubtfulFormPenalty : 0
}

/** The combined effective-attr delta for a player this game = form delta + any play-hurt penalty. */
export function conditionFormDelta(c: PlayerCondition): number {
  return formRatingToDelta(c.form) + playHurtPenalty(c)
}

/** Whether a player can be picked this game (OUT / SUSPENDED men cannot). */
export function isAvailable(c: PlayerCondition | undefined): boolean {
  return !c || (c.injury.kind !== 'out' && c.injury.kind !== 'suspended')
}

// ---- Initial seeding ----

const FIT: InjuryState = { kind: 'fit', gamesOut: 0 }

function startInjury(kind: InjuryKind | undefined): InjuryState {
  if (kind === 'out') return { kind: 'out', gamesOut: 1, cause: 'club-knock' }
  if (kind === 'suspended') return { kind: 'suspended', gamesOut: 1, cause: 'send-off' }
  if (kind === 'doubtful') return { kind: 'doubtful', gamesOut: 0, cause: 'club-knock' }
  return { ...FIT }
}

/**
 * Seed the whole condition map at series start: each player's form from `startForm` (default neutral)
 * and any pre-existing real-world injury from `startInjuryMap`. Covers the QLD pool + the NSW 21.
 */
export function initConditions(
  players: Player[],
  startForm: Record<string, number> = {},
  startInjuryMap: Record<string, InjuryKind> = {},
): ConditionMap {
  const map: ConditionMap = {}
  for (const p of players) {
    map[p.id] = {
      form: clamp(startForm[p.id] ?? CONDITIONS_TUNING.ratingNeutral, 0, 100),
      injury: startInjury(startInjuryMap[p.id]),
    }
  }
  return map
}

// ---- Carryover extraction from a finished match ----

export interface Carryover {
  id: string
  kind: Exclude<InjuryKind, 'fit'>
  cause: InjuryCause
}

/** Carryover injuries from a finished match's events (both sides), deduped per id with max severity. */
export function extractCarryover(events: MatchEvent[]): Carryover[] {
  const byId = new Map<string, Carryover>()
  const consider = (c: Carryover | null) => {
    if (!c) return
    const cur = byId.get(c.id)
    if (!cur || SEVERITY[c.kind] > SEVERITY[cur.kind]) byId.set(c.id, c)
  }
  for (const e of events) {
    if (e.type === 'HIA_FAIL' && e.attacker) {
      consider({ id: e.attacker.id, kind: 'out', cause: 'failed-hia' })
    } else if (e.type === 'INJURY_REPLACEMENT' && e.reason === 'foul-injury') {
      const victim = e.playerOff ?? e.attacker
      if (victim) consider({ id: victim.id, kind: 'out', cause: 'foul-injury' })
    } else if (e.type === 'SEND_OFF' && e.defender) {
      consider({ id: e.defender.id, kind: 'suspended', cause: 'send-off' })
    } else if (e.type === 'HIA_PASS' && e.attacker) {
      consider({ id: e.attacker.id, kind: 'doubtful', cause: 'head-knock' })
    }
  }
  return [...byId.values()]
}

// ---- Origin-performance form delta ----

/** A role-agnostic "how well did he play" score from a stat line — the basis for the z-score. */
export function performanceScore(line: PlayerStatLine): number {
  return (
    line.runMetres +
    line.tries * 70 +
    line.lineBreaks * 35 +
    line.tackleBreaks * 12 +
    line.tackles * 3.5 +
    line.forcedDropOuts * 15 +
    line.fieldGoals * 12 +
    line.fortyTwenties * 15 -
    line.missedTackles * 8 -
    line.errors * 30
  )
}

/**
 * The form nudge from a player's Origin game, role-normalised to a z-score. Returns 0 if he barely
 * featured (injured early / unselected) so a non-appearance never reads as a slump.
 */
export function originPerformanceDelta(line: PlayerStatLine | undefined, role: PlayerRole): number {
  if (!line || line.minutesProxy < CONDITIONS_TUNING.minutesFloor) return 0
  const per80 = performanceScore(line) * (80 / Math.max(20, line.minutesProxy))
  const base = CONDITIONS_TUNING.roleBaseline[role]
  const z = clamp((per80 - base.mean) / base.sd, -2.5, 2.5)
  return clamp(z * CONDITIONS_TUNING.originScale, -CONDITIONS_TUNING.originDeltaCap, CONDITIONS_TUNING.originDeltaCap)
}

// ---- The one entry point: advance every player between games ----

export interface AdvanceContext {
  rootSeed: number
  /** The game number these NEW conditions are FOR (the next to be played). Seeds the club round. */
  nextGameNumber: number
  /** All players (QLD pool + NSW), for role lookup. */
  players: Player[]
  /** Stat lines from the game just played (result.stats.players). */
  lines: Record<string, PlayerStatLine>
  /** Carryover injuries from the game just played (extractCarryover(events)). */
  carryover: Carryover[]
}

function roleOf(player: Player): PlayerRole {
  return POSITION_META[player.naturalPositions[0]].role
}

/** Age a prior injury by one elapsed game (OUT -> returns DOUBTFUL; SUSPENDED -> fit; DOUBTFUL -> fit). */
function ageInjury(prev: InjuryState): InjuryState {
  if (prev.kind === 'out') {
    const gamesOut = prev.gamesOut - 1
    if (gamesOut <= 0) return { kind: 'doubtful', gamesOut: 0, cause: prev.cause, returnedHurt: true }
    return { kind: 'out', gamesOut, cause: prev.cause }
  }
  if (prev.kind === 'suspended') {
    const gamesOut = prev.gamesOut - 1
    if (gamesOut <= 0) return { ...FIT }
    return { kind: 'suspended', gamesOut, cause: prev.cause }
  }
  return { ...FIT }
}

function carryoverToState(c: Carryover): InjuryState {
  if (c.kind === 'out') return { kind: 'out', gamesOut: 1, cause: c.cause }
  if (c.kind === 'suspended') return { kind: 'suspended', gamesOut: 1, cause: c.cause }
  return { kind: 'doubtful', gamesOut: 0, cause: c.cause }
}

/**
 * Advance every player's condition between games. Pure + deterministic: seeded off
 * `conditionSeed(rootSeed, nextGameNumber)`, iterating ids in sorted order with a FIXED draw count per
 * player, so the same inputs always yield the same next conditions. Never mutates `prev`.
 */
export function advanceConditions(prev: ConditionMap, ctx: AdvanceContext): ConditionMap {
  const rng = makeRng(conditionSeed(ctx.rootSeed, ctx.nextGameNumber))
  const roleById = new Map<string, PlayerRole>()
  for (const p of ctx.players) roleById.set(p.id, roleOf(p))
  const carryById = new Map<string, Carryover>()
  for (const c of ctx.carryover) carryById.set(c.id, c)

  const next: ConditionMap = {}
  for (const id of Object.keys(prev).sort()) {
    const cond = prev[id]
    // FIXED draws per player (gauss=2, injRoll, sevRoll) drawn unconditionally — the branch logic below
    // never changes the count, so the club round stays deterministic.
    const swing = clamp(gauss(rng, 0, CONDITIONS_TUNING.clubSd), -CONDITIONS_TUNING.clubSwingCap, CONDITIONS_TUNING.clubSwingCap)
    const injRoll = rng()
    const sevRoll = rng()

    // Injury: age the prior, overlay any new carryover (more severe wins), then a club-injury roll.
    let injury = ageInjury(cond.injury)
    const carry = carryById.get(id)
    if (carry) {
      const fresh = carryoverToState(carry)
      if (SEVERITY[fresh.kind] >= SEVERITY[injury.kind]) injury = fresh
    }
    if (injury.kind === 'fit' && injRoll < CONDITIONS_TUNING.clubInjuryChance) {
      injury =
        sevRoll < CONDITIONS_TUNING.clubInjurySeriousFrac
          ? { kind: 'out', gamesOut: 1, cause: 'club-knock' }
          : { kind: 'doubtful', gamesOut: 0, cause: 'club-knock' }
    }

    // Form: regress toward neutral, add the seeded club swing + the Origin-performance nudge.
    const regressed = CONDITIONS_TUNING.ratingNeutral + (cond.form - CONDITIONS_TUNING.ratingNeutral) * CONDITIONS_TUNING.regression
    const originDelta = originPerformanceDelta(ctx.lines[id], roleById.get(id) ?? 'forward')
    const form = clamp(regressed + swing + originDelta, 0, 100)

    next[id] = { form, injury }
  }
  return next
}
