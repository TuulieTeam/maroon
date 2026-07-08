import type { Channel, Player, Position } from '../data/types'
import { CHANNEL_OWNERS, POSITION_META } from '../data/positions'
import type { Rng } from './rng'
import { chance } from './rng'
import type { KickType, Side, Venue } from './types'

export const TUNING = {
  /** Plays per match scale: clock advance per play (minutes). ~80/mean total plays. */
  playClockMean: 0.255,
  playClockSd: 0.065,

  /** Channel-owner blend weights (index 0 = primary edge defender/attacker). */
  ownerWeights: [0.45, 0.25, 0.18, 0.12],

  /** Channel-selection softmax temperature (higher = more lopsided toward weak edge). */
  channelSoftmaxTemp: 0.06,
  /** Floor probability so no channel is ever fully ignored. */
  channelBaseSpread: 0.12,
  /**
   * Base channel-traffic split applied BEFORE the attack-vs-defence softmax adjustment, reflecting
   * that real rugby league runs ~45-55% of plays through the middle/ruck. The softmax (still gated
   * by channelSoftmaxTemp) then perturbs this base toward whichever EDGE has the bigger rating
   * mismatch, so a weak edge is still targeted above its base share — the selection→outcome signal
   * is preserved while middle forwards (lock/props) get realistic tackle + hit-up volume.
   * Must sum to 1.
   */
  channelBase: { LEFT: 0.225, MIDDLE: 0.55, RIGHT: 0.225 } as Record<Channel, number>,

  /**
   * Break contest: pBreak = sigmoid(k * (effAttack + edgeSupport - effDefence) - bias).
   * edgeSupport = (unit attackRating - edgeSupportAnchor) * edgeSupportScale — support is relative
   * to a TYPICAL Origin unit, not absolute, so re-levelling the authored squads doesn't inflate
   * scoring volume. Anchor + bias were re-calibrated after the Great Rebalance when parity squads
   * produced 45+ point games (scoreVolume target: ~34 avg total, 60+ totals rare — Origin, not
   * basketball). Volume guard: realBalance.test.ts total-points pins.
   */
  breakK: 0.055,
  breakBias: 2.8,
  edgeSupportScale: 0.18,
  edgeSupportAnchor: 75,

  /** Clean-break (vs half-break) speed contest vs fullback cover. */
  cleanBreakK: 0.05,
  /** Try conversion from a clean line break, modulated by cover speed. */
  tryFromCleanBreakBase: 0.5,
  tryCoverScale: 0.006,

  /** Error / knock-on: pError = sigmoid(j * (errorPressure - effHands)). */
  errorJ: 0.05,
  errorPressure: 58,
  errorBase: 0.007,

  /** Penalty: driven by lowest-composure owner under pressure. */
  penaltyK: 0.04,
  penaltyPressure: 70,
  penaltyBase: 0.0145,

  /** Fatigue: per-minute decay of effective attrs; forwards tire faster than backs. */
  fatigueForwardPerMin: 0.7,
  fatigueBackPerMin: 0.34,
  /** Max attribute points shaved by fatigue before any interchange relief. */
  fatigueCap: 30,
  /** Bench rotation: starting forward goes for a spell once fatigue crosses this. */
  benchRotateThreshold: 12,
  /** Freshness a benched forward recovers per minute while resting. */
  benchRecoverPerMin: 0.85,

  /**
   * Per-player stamina (aerobic engine). Modulates ONLY the fatigue ACCRUAL rate — recovery while
   * resting is unchanged. A player at the baseline tires at the role's nominal rate; above baseline
   * tires slower, below baseline tires faster. The mult is clamped so even extreme staminas stay in
   * a believable band. Pure arithmetic — no rng.
   */
  staminaBaseline: 75,
  staminaFatigueSlope: 0.003,
  staminaMultMin: 0.7,
  staminaMultMax: 1.3,

  /** Squad rules. */
  interchangeCap: 8,
  usableBenchNormal: 4,

  /**
   * Home-ground edge. A uniform, pre-kickoff effective-attr nudge applied to EVERY selected player by
   * side — the home side up by `home`, the visitor down by `away` — then scaled by the venue's
   * homeAdvantage (0..1). Points, the same unit as form deltas. TUNED AGAINST realBalance.test.ts:
   * because the edge hits every man on the park at once, the win curve is steep (~7pp of win rate per
   * net point with parity squads) — a full fortress is deliberately only a ~1.5pt net swing, which is
   * ~+10pp at home. Folded into the form map in simulate.ts; pure arithmetic, no rng drawn.
   */
  homeEdge: { home: 1.0, away: 0.5 },

  /**
   * Drama — HIA & foul play. Deliberately RARE spice: a typical match has 0–1 of each,
   * and reaching the 3-failed-HIA unlock is a genuinely uncommon, memorable event.
   * Per-play probabilities are tiny because there are ~600+ plays in a match.
   */
  drama: {
    /** Base chance per resolved carry that the ball-runner cops a head knock. */
    headKnockBase: 0.0011,
    /** Multiplier on a big collision (hit-up, or a defender in a line-break/try contest). */
    headKnockCollisionMult: 2.4,
    /** Chance a player taken for an HIA fails it (ruled out, counts toward the 3-fail unlock). */
    hiaFailChance: 0.4,
    /** Base chance per tackle that the defending tackler commits foul play. */
    foulPlayBase: 0.0016,
    /** Given foul play: chance it draws a sin bin (10 in the bin). */
    sinBinGivenFoul: 0.5,
    /** Given foul play: chance it is a send-off (rest of match). */
    sendOffGivenFoul: 0.08,
    /** Given a sin-bin/send-off foul: chance the victim suffers a match-ending injury. */
    foulInjuryChance: 0.2,
    /** Minutes a sin-binned player sits out. */
    sinBinMinutes: 10,
    /** Uniform defence-rating points shaved off a short-handed side (per missing man). */
    shortHandedDefencePenalty: 10,
    /** Failed HIAs for one team that unlock its 5th & 6th bench. */
    failedHiaToUnlock: 3,
  },
} as const

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/** Shared empty form map — avoids allocating a Map on every form-free call. */
const NO_FORM: ReadonlyMap<string, number> = new Map()

/**
 * Effective attribute = base, shaved by in-match fatigue, nudged by a per-game FORM delta. Form is a
 * signed, bounded constant set BEFORE kickoff (never mid-match) — pure arithmetic, no rng, so it never
 * perturbs the play stream's draw count. `formDelta` defaults to 0, so every legacy 2-arg call is
 * byte-identical. The min(99) ceiling is only reachable with a positive form delta on an elite attr.
 */
export function effectiveAttr(base: number, fatigue: number, formDelta = 0): number {
  return Math.max(1, Math.min(99, base - fatigue + formDelta))
}

/**
 * The home-ground effective-attr edge per side for a venue, in points (signed). The side at home gets
 * +homeEdge.home, the visitor −homeEdge.away, both scaled by the ground's homeAdvantage (0..1). A
 * neutral or unset homeAdvantage returns 0 for both sides, so a flavour-only venue applies no edge.
 * Pure arithmetic — the caller folds these into the form map, so no rng is drawn.
 */
export function homeEdgeBySide(venue: Pick<Venue, 'homeSide' | 'homeAdvantage'>): Record<Side, number> {
  const strength = Math.max(0, Math.min(1, venue.homeAdvantage ?? 0))
  // `|| 0` collapses a -0 (when strength is 0) to +0 so callers never see negative zero.
  const home = TUNING.homeEdge.home * strength || 0
  const away = -TUNING.homeEdge.away * strength || 0
  return venue.homeSide === 'QLD' ? { QLD: home, NSW: away } : { QLD: away, NSW: home }
}

export function channelOf(position: Position): Channel | null {
  return POSITION_META[position].channel
}

export interface ChannelUnit {
  attackRating: number
  defenceRating: number
  primaryDefender: Player
  primaryAttacker: Player
}

interface OwnerView {
  player: Player
  attack: number
  defence: number
  speed: number
  hands: number
}

function ownerViews(
  lineup: Record<Position, Player>,
  channel: Channel,
  fatigue: Map<string, number>,
  form: ReadonlyMap<string, number> = NO_FORM,
): OwnerView[] {
  const positions = CHANNEL_OWNERS[channel]
  return positions.map((pos) => {
    const player = lineup[pos]
    const f = fatigue.get(player.id) ?? 0
    const fm = form.get(player.id) ?? 0
    return {
      player,
      attack: effectiveAttr(player.attrs.attack, f, fm),
      defence: effectiveAttr(player.attrs.defence, f, fm),
      speed: effectiveAttr(player.attrs.speed, f, fm),
      hands: effectiveAttr(player.attrs.hands, f, fm),
    }
  })
}

export function weightedBlend(values: number[]): number {
  let total = 0
  let weightSum = 0
  values.forEach((v, i) => {
    const w = TUNING.ownerWeights[i] ?? 0
    total += v * w
    weightSum += w
  })
  return weightSum > 0 ? total / weightSum : 0
}

/**
 * The per-owner attack/defence contributions, before the ownerWeights blend. SINGLE SOURCE OF TRUTH
 * for the channel-rating coefficients — `channelUnit` (the sim) and `channelStrength` (the selection
 * read in matchup.ts) BOTH consume these, so the read can never drift from the contest math.
 */
export function ownerAttackContribution(v: Pick<OwnerView, 'attack' | 'speed' | 'hands'>): number {
  return v.attack * 0.7 + v.speed * 0.18 + v.hands * 0.12
}

export function ownerDefenceContribution(v: Pick<OwnerView, 'defence' | 'speed'>): number {
  return v.defence * 0.82 + v.speed * 0.18
}

export function channelUnit(
  lineup: Record<Position, Player>,
  channel: Channel,
  fatigue: Map<string, number>,
  /** Uniform defence-rating penalty for a short-handed side (sin-bin / send-off). */
  defenceDebuff = 0,
  /** Per-player form deltas (id -> signed effective-attr points). Empty = form-free. */
  form: ReadonlyMap<string, number> = NO_FORM,
): ChannelUnit {
  const views = ownerViews(lineup, channel, fatigue, form)
  const attackRating = weightedBlend(views.map(ownerAttackContribution))
  const defenceRating = weightedBlend(views.map(ownerDefenceContribution)) - defenceDebuff
  return {
    attackRating,
    defenceRating,
    primaryAttacker: views[0].player,
    primaryDefender: views[0].player,
  }
}

/**
 * NSW's RIGHT-side attack runs at QLD's LEFT-side defence and vice-versa.
 * MIDDLE maps to MIDDLE. This cross-wiring is the heart of the matchup.
 */
export function defendingChannelFor(attackChannel: Channel): Channel {
  if (attackChannel === 'LEFT') return 'RIGHT'
  if (attackChannel === 'RIGHT') return 'LEFT'
  return 'MIDDLE'
}

export function channelAttackWeights(
  attackLineup: Record<Position, Player>,
  defenceLineup: Record<Position, Player>,
  attackFatigue: Map<string, number>,
  defenceFatigue: Map<string, number>,
  /** Defending side's short-handed penalty — a short-handed side leaks more across all channels. */
  defenceDebuff = 0,
  /** Per-player form deltas for the attacking / defending sides. Empty = form-free. */
  attackForm: ReadonlyMap<string, number> = NO_FORM,
  defenceForm: ReadonlyMap<string, number> = NO_FORM,
): Record<Channel, number> {
  const channels: Channel[] = ['LEFT', 'MIDDLE', 'RIGHT']
  // Weight each channel by its MIDDLE-favouring BASE share scaled by the softmax mismatch factor
  // exp(edge * temp). The base sets the bulk of traffic (middle ~½); the softmax then perturbs it
  // toward whichever channel has the bigger attack-vs-defence edge, so a weak edge is still targeted
  // above its base share — preserving the selection→outcome signal without flattening the middle.
  const raw: Record<Channel, number> = { LEFT: 0, MIDDLE: 0, RIGHT: 0 }
  for (const ch of channels) {
    const atk = channelUnit(attackLineup, ch, attackFatigue, 0, attackForm)
    const def = channelUnit(defenceLineup, defendingChannelFor(ch), defenceFatigue, defenceDebuff, defenceForm)
    const edge = atk.attackRating - def.defenceRating
    raw[ch] = TUNING.channelBase[ch] * Math.exp(edge * TUNING.channelSoftmaxTemp)
  }
  const sum = raw.LEFT + raw.MIDDLE + raw.RIGHT
  const result: Record<Channel, number> = { LEFT: 0, MIDDLE: 0, RIGHT: 0 }
  for (const ch of channels) {
    const weighted = raw[ch] / sum
    result[ch] = (1 - TUNING.channelBaseSpread) * weighted + (TUNING.channelBaseSpread * TUNING.channelBase[ch])
  }
  return result
}

export function pickChannel(rng: Rng, weights: Record<Channel, number>): Channel {
  const r = rng()
  let acc = 0
  const channels: Channel[] = ['LEFT', 'MIDDLE', 'RIGHT']
  for (const ch of channels) {
    acc += weights[ch]
    if (r < acc) return ch
  }
  return 'MIDDLE'
}

// ---- Stat-credit attribution (M1–M4) ----
// These decide WHICH channel member is *credited* a carry / tackle. The contest itself still uses
// the primary owner (index 0) so the selection→outcome causal signal is preserved; only the
// stat-holder is spread across the channel here.

/** GRIND = forward-flavoured carries (hit-up/tackle/offload/half-break); STRIKE = edge/break carries. */
export type CarryKind = 'GRIND' | 'STRIKE'

/** Credit weights over CHANNEL_OWNERS[channel] order. LEFT=[CL,WL,SRL,FE] RIGHT=[CR,WR,SRR,HB] MIDDLE=[LK,PL,PR,HK]. */
export const CARRY_WEIGHTS: Record<CarryKind, Record<Channel, number[]>> = {
  GRIND: { LEFT: [0.22, 0.18, 0.45, 0.15], RIGHT: [0.22, 0.18, 0.45, 0.15], MIDDLE: [0.3, 0.32, 0.32, 0.06] },
  STRIKE: { LEFT: [0.42, 0.3, 0.18, 0.1], RIGHT: [0.42, 0.3, 0.18, 0.1], MIDDLE: [0.34, 0.3, 0.3, 0.06] },
}

/** ~15% of MIDDLE strike carries are credited to the fullback hitting the line (the metre leader). */
const FB_MIDDLE_STRIKE_SHARE = 0.15

function weightedIndex(weights: number[], r: number): number {
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (r < acc) return i
  }
  return weights.length - 1
}

/**
 * Re-weight a channel's credit vector so OFF-FIELD owners (sin-bin / send-off / HIA-pending) get
 * zero share, renormalised over the remaining available owners. This changes only WHICH owner a
 * weight draw maps to — never how many rng() calls happen — so the play stream's draw count is
 * preserved. If every owner is off the field (so degenerate it can't happen under the 4-man cap),
 * the original weights are returned unchanged.
 */
function availableWeights(
  weights: number[],
  owners: Position[],
  lineup: Record<Position, Player>,
  offFieldIds?: Set<string>,
): number[] {
  if (!offFieldIds || offFieldIds.size === 0) return weights
  let sum = 0
  const masked = weights.map((w, i) => {
    const avail = !offFieldIds.has(lineup[owners[i]].id)
    const v = avail ? w : 0
    sum += v
    return v
  })
  if (sum <= 0) return weights
  return masked.map((v) => v / sum)
}

/**
 * Pick the player CREDITED with a carry. Consumes a fixed number of rng() draws per (channel, kind)
 * so the event stream stays deterministic:
 *  - MIDDLE + STRIKE: draws TWO rng() (the FB roll first, then the weight draw) — unconditionally.
 *  - everything else: draws ONE rng() (the weight draw).
 */
export function pickCarrier(
  rng: Rng,
  lineup: Record<Position, Player>,
  channel: Channel,
  kind: CarryKind,
  /** Ids that are OFF the field (sin-bin / send-off / HIA-pending) — never credited a carry. */
  offFieldIds?: Set<string>,
): Player {
  const owners = CHANNEL_OWNERS[channel]
  const weights = availableWeights(CARRY_WEIGHTS[kind][channel], owners, lineup, offFieldIds)
  // M2: the fullback gets a slice of MIDDLE strike carries. The roll is drawn unconditionally for
  // MIDDLE/STRIKE (and never for any other channel/kind) so the draw count per branch is fixed.
  if (channel === 'MIDDLE' && kind === 'STRIKE') {
    const fbRoll = rng()
    const r = rng()
    // Only hand it to the fullback if he's actually on the field; otherwise fall through to the
    // (renormalised) channel owners using the SAME weight draw — draw count stays at 2.
    if (fbRoll < FB_MIDDLE_STRIKE_SHARE && !offFieldIds?.has(lineup.FB.id)) return lineup.FB
    return lineup[owners[weightedIndex(weights, r)]]
  }
  const r = rng()
  return lineup[owners[weightedIndex(weights, r)]]
}

/**
 * Tackle-credit weights over CHANNEL_OWNERS order — concentrated on the forwards so the lock / props
 * lead the team's tackle count and edge backs (the channel primary, a centre) make materially fewer.
 * LEFT/RIGHT = [centre, wing, second-row, half]; MIDDLE = [lock, prop, prop, hooker].
 */
export const TACKLE_WEIGHTS: Record<Channel, number[]> = {
  LEFT: [0.26, 0.14, 0.46, 0.14],
  RIGHT: [0.26, 0.14, 0.46, 0.14],
  MIDDLE: [0.42, 0.27, 0.25, 0.06],
}

/**
 * Probability a completed tackle has a second man in (first support tackler) and, given that, a
 * third man in (second support). Most NRL tackles involve 2 defenders and a meaningful share pull in
 * a third, so crediting up to two support men is what lifts per-team tackle counts into the realistic
 * 260–360 band (a lone primary + single optional support tops out around 200 at the model's play
 * volume of ~112 completed tackles/team — see calibration.test.ts).
 */
const TACKLE_SUPPORT_PROB = 0.9
const TACKLE_SUPPORT2_PROB = 0.85

/**
 * Pick the tacklers CREDITED with a completed tackle: a primary, a likely support man, and (given a
 * support) a less-likely third man in — all from the SAME defending channel, weighted to the middle.
 * Consumes a FIXED FIVE rng() draws every call (primary index, support roll, support index, second-
 * support roll, second-support index) so the play stream stays deterministic regardless of outcome.
 * `support2` is null whenever there is no first support.
 */
export function pickTacklers(
  rng: Rng,
  lineup: Record<Position, Player>,
  channel: Channel,
  /** Ids that are OFF the field (sin-bin / send-off / HIA-pending) — never credited a tackle. */
  offFieldIds?: Set<string>,
): { primary: Player; support: Player | null; support2: Player | null } {
  const owners = CHANNEL_OWNERS[channel]
  // Renormalise off-field owners out of the credit vector — same five rng() draws, just remapped.
  const weights = availableWeights(TACKLE_WEIGHTS[channel], owners, lineup, offFieldIds)
  const isOff = (i: number) => Boolean(offFieldIds?.has(lineup[owners[i]].id))
  // Advance an index off a clash (or an off-field owner) to the next eligible owner in order.
  const bump = (i: number, taken: number[]): number => {
    let j = i
    for (let k = 0; k < owners.length; k++) {
      if (!taken.includes(j) && !isOff(j)) return j
      j = (j + 1) % owners.length
    }
    return i
  }
  const pi = bump(weightedIndex(weights, rng()), [])
  const hasSupport = rng() < TACKLE_SUPPORT_PROB
  const si = bump(weightedIndex(weights, rng()), [pi])
  // Draw the second-support roll + index UNCONDITIONALLY (fixed draw count); only credit it when
  // there's already a first support and the roll fires.
  const hasSupport2 = rng() < TACKLE_SUPPORT2_PROB
  const s2i = bump(weightedIndex(weights, rng()), [pi, si])
  return {
    primary: lineup[owners[pi]],
    support: hasSupport ? lineup[owners[si]] : null,
    support2: hasSupport && hasSupport2 ? lineup[owners[s2i]] : null,
  }
}

export interface ContestInput {
  attacker: Player
  defender: Player
  attackUnit: ChannelUnit
  fullbackSpeed: number
  attackFatigue: number
  defenceFatigue: number
  /** Uniform defence-rating penalty when the defending side is short-handed (sin-bin / send-off). 0 at full strength. */
  defenceDebuff?: number
  /** Form deltas for the ball-runner / the defender (signed effective-attr points). 0 = form-free. */
  attackerForm?: number
  defenderForm?: number
}

export type ContestOutcome =
  | { kind: 'TRY' }
  | { kind: 'LINE_BREAK' }
  | { kind: 'HALF_BREAK' }
  | { kind: 'HELD' }

export function resolveContest(rng: Rng, input: ContestInput): ContestOutcome {
  const aForm = input.attackerForm ?? 0
  const dForm = input.defenderForm ?? 0
  const effAttack = effectiveAttr(input.attacker.attrs.attack, input.attackFatigue, aForm)
  // A short-handed defence (sin-bin / send-off) defends measurably worse — wire the uniform debuff
  // into the actual break contest (it already feeds channel-selection but cancels in the softmax).
  const effDefence = effectiveAttr(input.defender.attrs.defence, input.defenceFatigue, dForm) - (input.defenceDebuff ?? 0)
  const edgeSupport = (input.attackUnit.attackRating - TUNING.edgeSupportAnchor) * TUNING.edgeSupportScale

  const pBreak = sigmoid(
    TUNING.breakK * (effAttack + edgeSupport - effDefence) - TUNING.breakBias,
  )
  if (!chance(rng, pBreak)) return { kind: 'HELD' }

  const effSpeed = effectiveAttr(input.attacker.attrs.speed, input.attackFatigue, aForm)
  const pClean = sigmoid(TUNING.cleanBreakK * (effSpeed - input.fullbackSpeed))
  if (!chance(rng, pClean)) return { kind: 'HALF_BREAK' }

  const pTry =
    TUNING.tryFromCleanBreakBase - input.fullbackSpeed * TUNING.tryCoverScale + effSpeed * TUNING.tryCoverScale
  if (chance(rng, Math.min(0.95, Math.max(0.2, pTry)))) return { kind: 'TRY' }
  return { kind: 'LINE_BREAK' }
}

/** A held tackle that still leaked metres: the defender's read failed without conceding a break. */
export function resolveMissedTackle(
  rng: Rng,
  attacker: Player,
  defender: Player,
  attackFatigue: number,
  defenceFatigue: number,
  attackerForm = 0,
  defenderForm = 0,
): boolean {
  const effAttack = effectiveAttr(attacker.attrs.attack, attackFatigue, attackerForm)
  const effDefence = effectiveAttr(defender.attrs.defence, defenceFatigue, defenderForm)
  const p = sigmoid(TUNING.breakK * (effAttack - effDefence) - 2.1) * 1.1
  return chance(rng, p)
}

export function resolveError(rng: Rng, attacker: Player, fatigue: number, formDelta = 0): boolean {
  const effHands = effectiveAttr(attacker.attrs.hands, fatigue, formDelta)
  const p = TUNING.errorBase + sigmoid(TUNING.errorJ * (TUNING.errorPressure - effHands)) * 0.055
  return chance(rng, p)
}

export function resolvePenalty(
  rng: Rng,
  owners: Player[],
  fatigue: Map<string, number>,
  form: ReadonlyMap<string, number> = NO_FORM,
): Player | null {
  let weakest = owners[0]
  let weakestComposure = Infinity
  for (const p of owners) {
    const c = effectiveAttr(p.attrs.composure, fatigue.get(p.id) ?? 0, form.get(p.id) ?? 0)
    if (c < weakestComposure) {
      weakestComposure = c
      weakest = p
    }
  }
  const p = TUNING.penaltyBase + sigmoid(TUNING.penaltyK * (TUNING.penaltyPressure - weakestComposure)) * 0.045
  return chance(rng, p) ? weakest : null
}

export function offloadChance(rng: Rng, attacker: Player, fatigue: number, formDelta = 0): boolean {
  const effHands = effectiveAttr(attacker.attrs.hands, fatigue, formDelta)
  return chance(rng, sigmoid(0.06 * (effHands - 78)) * 0.4)
}

// ---- Drama: HIA & foul play (pure; simulate.ts owns all bookkeeping) ----

export function resolveHeadKnock(rng: Rng, isBigCollision: boolean, reinjuryMult = 1): boolean {
  // reinjuryMult > 1 for a DOUBTFUL/play-hurt man carrying a re-injury risk. Still exactly one draw,
  // so the play stream's draw count is unchanged; defaults to 1 (no extra risk).
  const p = TUNING.drama.headKnockBase * (isBigCollision ? TUNING.drama.headKnockCollisionMult : 1) * reinjuryMult
  return chance(rng, p)
}

export function resolveHiaOutcome(rng: Rng): 'PASS' | 'FAIL' {
  return chance(rng, TUNING.drama.hiaFailChance) ? 'FAIL' : 'PASS'
}

export type FoulSanction = 'PENALTY_ONLY' | 'SIN_BIN' | 'SEND_OFF'

export interface FoulPlayResult {
  sanction: FoulSanction
  injuredVictim: boolean
}

export function resolveFoulPlay(rng: Rng, tackler: Player, formDelta = 0): FoulPlayResult | null {
  // Lower-composure defenders are likelier to overstep (a slump frays the discipline too).
  const composureMod = sigmoid(0.05 * (70 - (tackler.attrs.composure + formDelta))) * 0.8 + 0.6
  if (!chance(rng, TUNING.drama.foulPlayBase * composureMod)) return null

  const roll = rng()
  let sanction: FoulSanction = 'PENALTY_ONLY'
  if (roll < TUNING.drama.sendOffGivenFoul) sanction = 'SEND_OFF'
  else if (roll < TUNING.drama.sendOffGivenFoul + TUNING.drama.sinBinGivenFoul) sanction = 'SIN_BIN'

  const carded = sanction === 'SIN_BIN' || sanction === 'SEND_OFF'
  const injuredVictim = carded && chance(rng, TUNING.drama.foulInjuryChance)
  return { sanction, injuredVictim }
}

// ---- Kicking game (PASS 1). All pure; simulate.ts owns the loop flow + stats. ----

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/**
 * A kicker's boot quality (1–99), derived from existing attrs — NO new Player field. Goal-kicking
 * dominates (a long, accurate boot is the headline trait), composure carries the nerve to land the
 * tough one, hands the touch on a grubber. Fatigue shaves composure + hands (not the trained
 * goal-kicking leg). Cleary ~85, Ponga ~83, DCE ~80, Munster ~55, a forward ~35; the synthetic def-HB fixture
 * (gk 10 / comp 70 / hands 70) lands ~37 → 40/20s & field goals are rightly rare for that team.
 */
export function kickSkill(p: Player, fatigue = 0, formDelta = 0): number {
  // Form sways the nerve (composure) and touch (hands), NOT the trained goal-kicking leg.
  const gk = p.goalKicking
  const comp = effectiveAttr(p.attrs.composure, fatigue, formDelta)
  const hands = effectiveAttr(p.attrs.hands, fatigue, formDelta)
  return Math.min(99, Math.max(1, gk * 0.55 + comp * 0.28 + hands * 0.17))
}

export interface KickContext {
  /** 0 = own try-line, 100 = opposition try-line (attacking field position of the kicking side). */
  fieldPosition: number
  /** Match clock (minutes). */
  clock: number
  /** Absolute score margin (|qld - nsw|) — gates the field-goal decision. */
  scoreMargin: number
  /** The kicker's boot quality from kickSkill(). */
  kickSkill: number
}

/**
 * Decide what kind of kick the side puts up on the last tackle. Draws EXACTLY ONE rng() (`roll`),
 * always — every branch reads the same single draw, so the play-stream draw count is fixed. TOUCH is
 * never chosen here (the penalty branch sets it directly). Branch order matters: field goal first
 * (only late + tight + in range), then the 40/20 gamble (only from one's own half), then the redzone
 * attacking options, then the long-range bomb/clearing split, then a plain clearing kick.
 */
export function chooseKickType(rng: Rng, ctx: KickContext): KickType {
  const roll = rng()
  const ks = ctx.kickSkill
  const fp = ctx.fieldPosition

  // 1) Field goal — only in the dying stages, in a one-score game, and inside drop-goal range.
  if (ctx.clock >= 70 && ctx.scoreMargin <= 2 && fp >= 62) {
    const pFG = clamp(0.45 + (ks - 50) * 0.004, 0.25, 0.7)
    if (roll < pFG) return 'FIELD_GOAL'
  }

  // 2) 40/20 — a deliberate gamble attempted from inside one's own half. In this model a side only
  // kicks on the last tackle, so by tackle six it has usually advanced past its own 40; we therefore
  // allow the attempt across the whole defensive half (fp <= 50) and weight it up for a quality boot
  // so the realised rate lands at the real-NRL ~1-3 attempts/match (validated in kicking.test.ts).
  if (fp <= 50) {
    const pAtt = clamp(0.32 + (ks - 50) * 0.006, 0.08, 0.55)
    if (roll < pAtt) return 'FORTY_TWENTY'
  }

  // 3) Redzone (fp >= 78) — attacking kicks. Split the single roll into BOMB / GRUBBER / CROSS_FIELD,
  // nudged a touch toward BOMB/GRUBBER for a better boot (he backs the contestable / rolling option).
  if (fp >= 78) {
    const kn = (ks - 50) / 50
    const bombCut = 0.45 + 0.06 * kn
    const grubberCut = 0.78 + 0.04 * kn
    if (roll < bombCut) return 'BOMB'
    if (roll < grubberCut) return 'GRUBBER'
    return 'CROSS_FIELD'
  }

  // 4) Attacking-half territory (fp >= 60) — mostly a clearing kick, occasionally a bomb for pressure.
  if (fp >= 60) {
    return roll < 0.25 ? 'BOMB' : 'CLEARING'
  }

  // 5) Everywhere else — a plain downfield clearing kick.
  return 'CLEARING'
}

export type KickOutcome =
  | { kind: 'HANDOVER'; fieldGain: number }
  | { kind: 'REGAIN'; newField: number; repeatSet: boolean }
  | { kind: 'DROP_OUT' }
  | { kind: 'CHASE_TRY' }
  | { kind: 'FIELD_GOAL_MADE' }
  | { kind: 'FIELD_GOAL_MISS'; fieldGain: number }

export interface KickResolveContext {
  /** Attacking field position of the kicking side at the moment of the kick. */
  fieldPosition: number
  /** Kicker's boot quality from kickSkill(). */
  kickSkill: number
  /** Catcher's (defending fullback's) effective hands. */
  catcherHands: number
  /** Catcher's (defending fullback's) effective speed. */
  catcherSpeed: number
}

/**
 * Resolve a kick to an outcome. ALWAYS draws EXACTLY TWO rng() — `a` (primary outcome) and `b`
 * (secondary spread: territory magnitude / newField jitter) — regardless of type or branch, so the
 * play-stream draw count is fixed. `kn` = normalised boot quality in [-~1, ~1]; a better boot wins
 * more territory, forces more drop-outs, and lands more 40/20s + field goals.
 */
export function resolveKick(rng: Rng, type: KickType, ctx: KickResolveContext): KickOutcome {
  const a = rng()
  const b = rng()
  const kn = (ctx.kickSkill - 50) / 50

  switch (type) {
    case 'CLEARING': {
      // A clearing kick always hands over; a better boot wins more territory. fieldGain ~30-45.
      const fieldGain = Math.round(30 + 15 * (0.5 * (a + b)) + 6 * kn)
      return { kind: 'HANDOVER', fieldGain: clamp(fieldGain, 22, 52) }
    }
    case 'BOMB': {
      const pForcedDead = clamp(0.06 + 0.06 * kn, 0.02, 0.16)
      const pDefErr = clamp(0.1 + 0.1 * kn - (ctx.catcherHands - 70) * 0.004, 0.04, 0.28)
      if (a < pForcedDead) return { kind: 'DROP_OUT' }
      if (a < pForcedDead + pDefErr) {
        // Knocked back / spilled under the high ball — regained for a repeat set ~55-65 out.
        return { kind: 'REGAIN', newField: clamp(55 + Math.round(b * 10), 55, 65), repeatSet: true }
      }
      // Caught and returned — a modest territory swing on the handover (a bomb doesn't gain much ground).
      return { kind: 'HANDOVER', fieldGain: clamp(18 + Math.round(b * 12), 14, 32) }
    }
    case 'GRUBBER': {
      const pTry = clamp(0.05 + 0.05 * kn, 0.02, 0.12)
      const pDropOut = 0.18 + 0.1 * kn
      if (a < pTry) return { kind: 'CHASE_TRY' }
      if (a < pTry + pDropOut) return { kind: 'DROP_OUT' }
      // Rolled through / cleaned up — handover, ~22m territory swing.
      return { kind: 'HANDOVER', fieldGain: clamp(22 + Math.round((b - 0.5) * 10), 14, 30) }
    }
    case 'CROSS_FIELD': {
      const pTry = clamp(0.12 + 0.1 * kn - (ctx.catcherSpeed - 78) * 0.004, 0.04, 0.3)
      if (a < pTry) return { kind: 'CHASE_TRY' }
      return { kind: 'HANDOVER', fieldGain: clamp(16 + Math.round(b * 10), 12, 28) }
    }
    case 'FORTY_TWENTY': {
      const pSuccess = clamp(0.3 + 0.3 * kn, 0.12, 0.62)
      if (a < pSuccess) {
        // Found touch deep — fed back inside the opp half for a fresh set ~78 out.
        return { kind: 'REGAIN', newField: clamp(76 + Math.round(b * 6), 74, 82), repeatSet: false }
      }
      // Missed the mark — a long kick that still flips the field a long way (handover).
      return { kind: 'HANDOVER', fieldGain: clamp(40 + Math.round(b * 12), 34, 54) }
    }
    case 'FIELD_GOAL': {
      // Distance-adjusted: closer to the line (higher fp) is an easier shot.
      const distAdj = (ctx.fieldPosition - 70) * 0.01
      const pMade = clamp(0.55 + 0.45 * kn + distAdj, 0.3, 0.92)
      if (a < pMade) return { kind: 'FIELD_GOAL_MADE' }
      // Missed shot — sails dead / fielded, the defending side gets it deep (long-kick territory).
      return { kind: 'FIELD_GOAL_MISS', fieldGain: clamp(36 + Math.round(b * 10), 30, 50) }
    }
    case 'TOUCH': {
      // Not chosen by chooseKickType; resolved arithmetically by the penalty branch (zero draws there).
      // Defensive default so the switch is exhaustive — a touch-finder gains territory and is retained.
      return { kind: 'REGAIN', newField: ctx.fieldPosition, repeatSet: false }
    }
  }
}
