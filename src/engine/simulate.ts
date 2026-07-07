import type { Channel, Player, Position } from '../data/types'
import {
  BENCH_POSITIONS,
  CHANNEL_OWNERS,
  LOCKED_BENCH_POSITIONS,
  POSITION_META,
  RESERVE_POSITIONS,
  STARTING_POSITIONS,
} from '../data/positions'
import type {
  KickType,
  MatchEvent,
  MatchResult,
  MatchSetup,
  MatchStats,
  PlayerOfMatch,
  PlayerStatLine,
  Score,
  SelectedTeam,
  Side,
} from './types'
import { makeRng, gauss } from './rng'
import type { Rng } from './rng'
import {
  TUNING,
  channelAttackWeights,
  channelUnit,
  chooseKickType,
  defendingChannelFor,
  effectiveAttr,
  homeEdgeBySide,
  kickSkill,
  offloadChance,
  pickCarrier,
  pickChannel,
  pickTacklers,
  resolveContest,
  resolveError,
  resolveFoulPlay,
  resolveHeadKnock,
  resolveHiaOutcome,
  resolveKick,
  resolveMissedTackle,
  resolvePenalty,
} from './ratings'
import type { KickOutcome } from './ratings'
import { bucketFieldZone, bucketPhase, bucketScoreline, renderCommentary } from './commentary'
import type { CommentaryContext, CommentaryInput } from './commentary'
import { buildBroadcast } from './broadcast'
import { iconicMomentSegment, pickIconicMoment, renderIconicLine } from './iconicMoment'
import { originLabel } from './series'
import { pickColor } from './colorCommentary'
import type { ColorMoment } from './colorCommentary'
import { callerFor } from './personas'
import type { PersonaId } from './personas'

const HALF_MINUTE = 40
const FULL_MINUTE = 80
const TRY_POINTS = 4
const CONVERSION_POINTS = 2
const FIELD_GOAL_POINTS = 1
const PENALTY_FIELD_GAIN = 22

/**
 * Rotation control (local to the sim — NOT the calibrated ratings.ts knobs). These stagger the
 * forward interchanges across the match instead of bunching them at one fatigue-threshold minute,
 * and kill the off→on→off churn, while keeping the late-match bench-quality effect intact:
 *  - one interchange per team per stepClock (the single most-fatigued eligible forward),
 *  - a minimum game-time GAP between a team's interchanges,
 *  - a minimum ON-STINT before a player can be rotated off,
 *  - a minimum REST before a rested player can return,
 *  - the existing "replacement must be meaningfully fresher" gap.
 */
const ROTATION = {
  /**
   * Minimum game-minutes between a single team's tactical interchanges. Set wide so the 8 interchanges
   * spread across the whole match (last ones into the 60s) instead of being burned by ~48' — keeping
   * fresh legs in reserve for the back end, which is the whole point of a deep bench.
   */
  minInterchangeGapMin: 7,
  /** Minimum minutes a player must have been on the field before he can be rotated off. */
  minStintMin: 12,
  /** Minimum minutes a rested player must sit before he's eligible to return. */
  minRestMin: 11,
  /** The incoming body must be at least this many fatigue points fresher than the man he replaces. */
  freshnessGap: 4,
} as const

interface TeamRuntime {
  side: Side
  /** Position -> the player currently ON the field at that slot. */
  onField: Record<Position, Player>
  /** Available bench bodies not currently on the field (INT1–6; locked slots gated by unlock). */
  bench: Player[]
  /** Starting-slot players currently resting (rotated off, free to return). */
  resting: Map<string, { player: Player; slot: Position }>
  /** Pre-game camp cover (20th & 21st man) — never enters in normal/HIA/foul play. */
  reserves: Player[]
  fatigue: Map<string, number>
  kickerId: string
  /** Tactical interchanges + rested-starter returns used (HIA/injury subs are exempt). */
  interchangesUsed: number
  /** Distinct bench players who have taken the field (the "only 4 usable" gate). */
  benchEntered: Set<string>
  /** Set once 3 failed HIAs OR a foul-play match-ending injury unlocks the 5th/6th bench. */
  extraBenchUnlocked: boolean
  failedHia: number
  /** Ruled out for the rest of the match (failed HIA, send-off, foul injury). */
  unavailable: Set<string>
  /** Players off for an HIA, awaiting resolution. */
  hiaPending: Map<string, { resolveAtClock: number; slot: Position; replacement: Player | null }>
  /** Sin-binned players: out until returnAtClock; while binned the side carries a defence debuff. */
  sinBin: Map<string, { returnAtClock: number; slot: Position }>
  /** Players on the field right now (13 minus those in the bin / sent off). */
  menOnField: number
  /** Ids of the 5th & 6th (locked) bench bodies — entering one under unlock fires RESERVE_ACTIVATED. */
  lockedIds: Set<string>
  /** Game-clock of this side's last TACTICAL interchange — enforces a minimum gap so subs stagger. */
  lastInterchangeClock: number
  /** Per-player game-clock at which they last took the field — enforces a minimum on-stint. */
  enteredAt: Map<string, number>
  /** Per-player game-clock at which they last went to the bench — enforces a minimum rest. */
  restingSince: Map<string, number>
}

function buildRuntime(team: SelectedTeam): TeamRuntime {
  const onField = {} as Record<Position, Player>
  for (const pos of STARTING_POSITIONS) onField[pos] = team.lineup[pos]
  const bench = BENCH_POSITIONS.map((pos) => team.lineup[pos]).filter(Boolean)
  const reserves = RESERVE_POSITIONS.map((pos) => team.lineup[pos]).filter(Boolean)
  const lockedIds = new Set(
    LOCKED_BENCH_POSITIONS.map((pos) => team.lineup[pos]?.id).filter((id): id is string => Boolean(id)),
  )
  const fatigue = new Map<string, number>()
  for (const pos of STARTING_POSITIONS) fatigue.set(team.lineup[pos].id, 0)
  for (const b of bench) fatigue.set(b.id, 0)
  // Starters take the field at kick-off (clock 0); bench bodies have no entry time until they come on.
  const enteredAt = new Map<string, number>()
  for (const pos of STARTING_POSITIONS) enteredAt.set(team.lineup[pos].id, 0)
  return {
    side: team.side,
    onField,
    bench,
    resting: new Map(),
    reserves,
    fatigue,
    kickerId: team.kickerId,
    interchangesUsed: 0,
    benchEntered: new Set(),
    extraBenchUnlocked: false,
    failedHia: 0,
    unavailable: new Set(),
    hiaPending: new Map(),
    sinBin: new Map(),
    menOnField: STARTING_POSITIONS.length,
    lockedIds,
    lastInterchangeClock: -Infinity,
    enteredAt,
    restingSince: new Map(),
  }
}

function isForwardSlot(pos: Position): boolean {
  return POSITION_META[pos].role === 'forward' && !pos.startsWith('INT') && !pos.startsWith('RES')
}

const STAMINA_DEFAULT = TUNING.staminaBaseline

/**
 * Per-player multiplier on the fatigue ACCRUAL rate (never on recovery). Higher stamina than the
 * baseline → tires slower (<1); lower → tires faster (>1); clamped to a believable band. Pure
 * arithmetic, no rng — so it never perturbs the play stream's draw count.
 */
function staminaMult(player: Player): number {
  const s = player.stamina ?? STAMINA_DEFAULT
  const m = 1 - (s - TUNING.staminaBaseline) * TUNING.staminaFatigueSlope
  return Math.min(TUNING.staminaMultMax, Math.max(TUNING.staminaMultMin, m))
}

/**
 * Ids of players currently OFF the field but still sitting in an `onField[slot]` (or being tracked):
 * sin-binned, sent-off / ruled-out (unavailable), and HIA-pending. These must be excluded from ALL
 * active selection (contest owner, carry credit, tackle credit) so a ruled-out player never carries,
 * tackles, or gets named after being taken off. On sin-bin return they leave `sinBin` and rejoin
 * selection automatically. The short-handed disadvantage is modelled separately by defenceDebuff.
 */
function offFieldIds(rt: TeamRuntime): Set<string> {
  const ids = new Set<string>()
  for (const id of rt.sinBin.keys()) ids.add(id)
  for (const id of rt.unavailable) ids.add(id)
  for (const id of rt.hiaPending.keys()) ids.add(id)
  return ids
}

function advanceFatigue(rt: TeamRuntime, minutes: number): void {
  for (const pos of STARTING_POSITIONS) {
    const player = rt.onField[pos]
    const rate =
      (isForwardSlot(pos) ? TUNING.fatigueForwardPerMin : TUNING.fatigueBackPerMin) * staminaMult(player)
    const next = Math.min(TUNING.fatigueCap, (rt.fatigue.get(player.id) ?? 0) + rate * minutes)
    rt.fatigue.set(player.id, next)
  }
  for (const [, { player }] of rt.resting) {
    const next = Math.max(0, (rt.fatigue.get(player.id) ?? 0) - TUNING.benchRecoverPerMin * minutes)
    rt.fatigue.set(player.id, next)
  }
}

/** A bench body is allowed onto the field only if it's already entered, or capacity remains. */
function benchEntryAllowed(rt: TeamRuntime, candidate: Player): boolean {
  if (rt.benchEntered.has(candidate.id)) return true
  if (rt.benchEntered.size < TUNING.usableBenchNormal) return true
  return rt.extraBenchUnlocked
}

function isForwardPlayer(player: Player): boolean {
  return player.naturalPositions.some((p) => POSITION_META[p].role === 'forward')
}

/** A No.9-only forward — names hooker but no other forward position (a specialist rake). */
function isPureHooker(player: Player): boolean {
  const forwards = player.naturalPositions.filter((p) => POSITION_META[p].role === 'forward')
  return forwards.length > 0 && forwards.every((p) => p === 'HK')
}

/**
 * How well a player fits a vacated slot, for like-for-like tactical rotation. Pure + deterministic:
 *  3 — the player names that exact slot in his natural positions (a true specialist replacement),
 *  2 — covers the slot's ROLE and CHANNEL (e.g. a middle prop for a prop slot),
 *  1 — covers the slot's ROLE but a different channel (a back-rower for a prop, say),
 *  0 — wrong role entirely (a back for a forward slot — never chosen for a forward rotation).
 *
 * The hooker (No.9) is treated as a SPECIALIST, NOT a generic middle forward: only a hooker-capable
 * body fits the hooker slot, and a pure hooker never fits another forward slot. Without this, HK and
 * the props share role 'forward' + channel 'MIDDLE', so the rotation would happily pack a rake into
 * the front row (the "Harry Grant at prop" bug).
 */
function slotFit(player: Player, slot: Position): number {
  if (player.naturalPositions.includes(slot)) return 3
  if (slot === 'HK' || isPureHooker(player)) return 0
  const slotMeta = POSITION_META[slot]
  const sameRole = player.naturalPositions.some((p) => POSITION_META[p].role === slotMeta.role)
  if (!sameRole) return 0
  const sameChannel = player.naturalPositions.some(
    (p) => POSITION_META[p].role === slotMeta.role && POSITION_META[p].channel === slotMeta.channel,
  )
  return sameChannel ? 2 : 1
}

/**
 * The best like-for-like forward eligible to take a vacated `slot` for a TACTICAL rotation. Builds
 * the SAME eligible pool as before (bench forward-capable + benchEntryAllowed; resting forward-
 * capable past minRest), then ranks by (1) slotFit DESC so a like-for-like body is preferred — this
 * is the "wrong people" fix — then (2) fatigue ASC (freshest), then (3) id (deterministic). Bench
 * bodies stay gated by the 4-usable rule (unless the extra bench has unlocked). Ruled-out / binned
 * players and reserves are never eligible. No rng.
 */
function freshestForwardReplacement(
  rt: TeamRuntime,
  clock: number,
  slot: Position,
): { player: Player; fromBench: boolean } | null {
  const pool: Array<{ player: Player; fromBench: boolean }> = []
  for (const b of rt.bench) {
    if (rt.unavailable.has(b.id) || rt.sinBin.has(b.id) || rt.hiaPending.has(b.id)) continue
    if (isForwardPlayer(b) && benchEntryAllowed(rt, b)) pool.push({ player: b, fromBench: true })
  }
  for (const [, { player }] of rt.resting) {
    if (!isForwardPlayer(player)) continue
    // Minimum rest before a rested player can be brought back on — prevents on/off/on churn.
    const restedSince = rt.restingSince.get(player.id)
    if (restedSince !== undefined && clock - restedSince < ROTATION.minRestMin) continue
    pool.push({ player, fromBench: false })
  }
  // Never place a misfit: a body must at least cover the vacated slot's ROLE (slotFit >= 1). If no
  // role-sensible body is free, the rotation simply declines — e.g. a fatigued hooker stays on when
  // there is no hooker-capable cover, rather than packing a prop into the No.9 role (or vice versa).
  const eligible = pool.filter((c) => slotFit(c.player, slot) >= 1)
  if (eligible.length === 0) return null
  eligible.sort((a, b) => {
    // (1) like-for-like first: a body that can actually play the vacated slot beats a fresher misfit.
    const sa = slotFit(a.player, slot)
    const sb = slotFit(b.player, slot)
    if (sa !== sb) return sb - sa
    // (2) freshest of the equally-suited bodies.
    const fa = rt.fatigue.get(a.player.id) ?? 0
    const fb = rt.fatigue.get(b.player.id) ?? 0
    if (fa !== fb) return fa - fb
    // (3) id tiebreak — fully deterministic, no rng.
    return a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0
  })
  return eligible[0]
}

/**
 * Positional suitability for a FORCED (injury/HIA) backfill — softer than `slotFit` so there is always
 * a sensible pick even when no like-for-like cover sits on the bench. Higher is better:
 *  - a genuine role cover (slotFit > 0) always wins;
 *  - else the closest by proximity — a half slides into a back/centre slot, a back-rower covers the
 *    centre channel, and a front-row prop is the genuine last resort (the "prop for a centre" fix).
 */
function forcedRank(player: Player, slot: Position): number {
  const fit = slotFit(player, slot)
  if (fit > 0) return 30 + fit
  const slotRole = POSITION_META[slot].role
  const roles = new Set(player.naturalPositions.map((p) => POSITION_META[p].role))
  const isEdgeForward = player.naturalPositions.some((p) => p === 'SRL' || p === 'SRR')
  if (slotRole === 'back') {
    if (roles.has('half')) return 22 // a half covers centre / five-eighth cleanly
    if (isEdgeForward) return 16 // a back-rower covers the centre channel before a middle does
    return 10 // a front-row / lock — last resort
  }
  if (slotRole === 'half') {
    if (roles.has('back')) return 22
    if (isEdgeForward) return 14
    return 10
  }
  // A forward slot with no forward cover (very rare): a half is the least-bad option.
  return roles.has('half') ? 14 : 10
}

/**
 * The most position-sensible eligible body to forcibly backfill a vacated `slot` (HIA/injury). Free of
 * the 8 cap but still bound by the 4-usable bench rule. Ranks by forced suitability, then prefers a
 * rested starter (no new body) over a fresh bench call, then freshness. No rng.
 */
function forcedReplacementFor(
  rt: TeamRuntime,
  slot: Position,
): { player: Player; fromBench: boolean } | null {
  const pool: Array<{ player: Player; fromBench: boolean }> = []
  for (const [, { player }] of rt.resting) pool.push({ player, fromBench: false })
  for (const b of rt.bench) {
    if (rt.unavailable.has(b.id) || rt.sinBin.has(b.id) || rt.hiaPending.has(b.id)) continue
    if (benchEntryAllowed(rt, b)) pool.push({ player: b, fromBench: true })
  }
  if (pool.length === 0) return null
  pool.sort((a, b) => {
    const ra = forcedRank(a.player, slot)
    const rb = forcedRank(b.player, slot)
    if (ra !== rb) return rb - ra
    if (a.fromBench !== b.fromBench) return a.fromBench ? 1 : -1
    const fa = rt.fatigue.get(a.player.id) ?? 0
    const fb = rt.fatigue.get(b.player.id) ?? 0
    if (fa !== fb) return fa - fb
    return a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0
  })
  return pool[0]
}

function emptyKickTypes(): Record<KickType, number> {
  return {
    CLEARING: 0,
    BOMB: 0,
    GRUBBER: 0,
    CROSS_FIELD: 0,
    FORTY_TWENTY: 0,
    FIELD_GOAL: 0,
    TOUCH: 0,
  }
}

function emptyStats(): MatchStats {
  return {
    tries: { QLD: 0, NSW: 0 },
    lineBreaks: { QLD: 0, NSW: 0 },
    errors: { QLD: 0, NSW: 0 },
    byChannel: {
      LEFT: { qldTries: 0, nswTries: 0 },
      MIDDLE: { qldTries: 0, nswTries: 0 },
      RIGHT: { qldTries: 0, nswTries: 0 },
    },
    runMetres: { QLD: 0, NSW: 0 },
    completedSets: { QLD: 0, NSW: 0 },
    totalSets: { QLD: 0, NSW: 0 },
    penalties: { QLD: 0, NSW: 0 },
    kicks: { QLD: 0, NSW: 0 },
    kickMetres: { QLD: 0, NSW: 0 },
    fortyTwenties: { QLD: 0, NSW: 0 },
    forcedDropOuts: { QLD: 0, NSW: 0 },
    fieldGoals: { QLD: 0, NSW: 0 },
    kickTypes: { QLD: emptyKickTypes(), NSW: emptyKickTypes() },
    players: {},
  }
}

/**
 * The on-field primary owner of a channel for the contest. Skips any owner who is OFF the field
 * (sin-binned, sent off, or HIA-pending) and uses the next available owner in CHANNEL_OWNERS order.
 * If every owner in the channel is off (so rare it needs a 4-man hole in one channel — beyond the
 * 4-man short-handed cap), falls back to the first on-field player on that side. No rng is drawn,
 * so changing WHICH owner is selected never perturbs the play stream's draw count.
 */
function primaryOwner(
  lineup: Record<Position, Player>,
  channel: Channel,
  offFieldIds?: Set<string>,
): Player {
  const owners = CHANNEL_OWNERS[channel]
  if (offFieldIds && offFieldIds.size > 0) {
    for (const pos of owners) {
      if (!offFieldIds.has(lineup[pos].id)) return lineup[pos]
    }
    // All channel owners are off — fall back to any on-field player on this side.
    for (const pos of STARTING_POSITIONS) {
      if (!offFieldIds.has(lineup[pos].id)) return lineup[pos]
    }
  }
  return lineup[owners[0]]
}

/** Salt for the independent COLOR rng — ASCII 'lor\0'. Mirrors broadcast.ts's salted-rng pattern. */
const COLOR_SALT = 0x6c6f7200

/**
 * The combined per-player effective-attr delta map for a match: each man's pre-set FORM delta with the
 * venue HOME-GROUND EDGE layered on top (home side up, visitor down, scaled by the ground's
 * homeAdvantage). Pure — no rng — so it never perturbs the play stream's draw count; player ids are
 * disjoint across sides, so one global map serves both. A form-free, series-free (or neutral-venue)
 * setup yields a map byte-identical to the legacy form-free match.
 */
function buildFormMap(setup: MatchSetup): ReadonlyMap<string, number> {
  const map = new Map<string, number>(Object.entries(setup.form ?? {}))
  const venue = setup.series?.venue
  if (!venue) return map
  const edge = homeEdgeBySide(venue)
  for (const team of [setup.qld, setup.nsw]) {
    const delta = edge[team.side]
    if (delta === 0) continue
    for (const p of Object.values(team.lineup)) {
      map.set(p.id, (map.get(p.id) ?? 0) + delta)
    }
  }
  return map
}

export function simulateMatch(setup: MatchSetup, seed: number): MatchResult {
  const rng: Rng = makeRng(seed)
  // Independent, salted rng for COLOR commentary — NEVER the match rng, so it cannot perturb the
  // per-play draw count. All fire/skip gates + persona/line picks draw from this and this only.
  const colorRng: Rng = makeRng((seed ^ COLOR_SALT) >>> 0)
  const qld = buildRuntime(setup.qld)
  const nsw = buildRuntime(setup.nsw)
  const runtimes: Record<Side, TeamRuntime> = { QLD: qld, NSW: nsw }

  // Per-player FORM deltas (id -> signed effective-attr points) with the venue HOME-GROUND EDGE layered
  // on, read only as pure arithmetic — set before kickoff, never mid-match, so the play stream's draw
  // count is fixed. Empty when setup.form is absent and the venue is neutral/absent => byte-identical to
  // the legacy form-free match. See buildFormMap.
  const formMap: ReadonlyMap<string, number> = buildFormMap(setup)
  const fdelta = (id: string): number => formMap.get(id) ?? 0
  // Head-knock re-injury multipliers (id -> mult) for DOUBTFUL/play-hurt men; 1 = no extra risk.
  const reinjuryMap: ReadonlyMap<string, number> = new Map(Object.entries(setup.reinjury ?? {}))
  const reinjuryMult = (id: string): number => reinjuryMap.get(id) ?? 1

  const events: MatchEvent[] = []
  const stats = emptyStats()
  const score: Score = { qld: 0, nsw: 0 }
  let seq = 0
  let clock = 0
  let halfTimeDone = false

  // Seed stat lines for every player named in the 19 (both sides).
  for (const side of ['QLD', 'NSW'] as Side[]) {
    const rt = runtimes[side]
    const seen = new Set<string>()
    const register = (p: Player) => {
      if (!p || seen.has(p.id)) return
      seen.add(p.id)
      stats.players[p.id] = {
        id: p.id,
        name: p.name,
        side,
        runs: 0,
        runMetres: 0,
        tackles: 0,
        missedTackles: 0,
        tackleBreaks: 0,
        lineBreaks: 0,
        tries: 0,
        errors: 0,
        kicks: 0,
        kickMetres: 0,
        fortyTwenties: 0,
        forcedDropOuts: 0,
        fieldGoals: 0,
        minutesProxy: 0,
      }
    }
    for (const pos of STARTING_POSITIONS) register(rt.onField[pos])
    for (const b of rt.bench) register(b)
  }

  function statLine(p: Player): PlayerStatLine | null {
    return stats.players[p.id] ?? null
  }

  const channelTargetCounts: Record<Side, Record<Channel, number>> = {
    QLD: { LEFT: 0, MIDDLE: 0, RIGHT: 0 },
    NSW: { LEFT: 0, MIDDLE: 0, RIGHT: 0 },
  }

  const commentaryCtx: CommentaryContext = {
    rng,
    channelTargetCount: 0,
    score: { qld: 0, nsw: 0 },
    lastTemplateIndex: new Map(),
    minute: 0,
    scoreline: 'tight',
    phase: 'early',
    fieldZone: 'middle',
    // Series context (when present) names the venue + game in the live feed; absent = Suncorp/Origin I.
    venue: setup.series?.venue,
    gameLabel: setup.series ? originLabel(setup.series.gameNumber) : undefined,
  }

  // COLOR cadence: suppress a new color within MIN_COLOR_GAP events of the last so the feed never
  // double-stacks (target density ~1 color per 8-12 caller lines). Lead tracking lets a try that
  // changes the leader fire color more often (B4).
  const MIN_COLOR_GAP = 3
  let lastColorSeq = -Infinity

  function emit(input: CommentaryInput, minute: number): void {
    commentaryCtx.score = { qld: score.qld, nsw: score.nsw }
    commentaryCtx.minute = Math.round(minute)
    commentaryCtx.scoreline = bucketScoreline(score)
    commentaryCtx.phase = bucketPhase(minute)
    commentaryCtx.fieldZone = bucketFieldZone(fieldPosition)
    const commentary = renderCommentary(input, commentaryCtx)
    // Attribute the call to a named caller (pure, no rng) so the play-by-play has a voice — the lead
    // takes the moments, the co-caller the grind. COLOR (analyst) events go through emitColor instead.
    const caller = callerFor(input.type)
    events.push({
      minute: Math.round(minute),
      seq: seq++,
      type: input.type,
      side: input.side,
      channel: input.channel,
      attacker: input.attacker,
      defender: input.defender,
      playerOff: input.playerOff,
      playerOn: input.playerOn,
      metres: input.metres,
      kickType: input.kickType,
      setComplete: input.setComplete,
      reason: input.reason,
      persona: caller.name,
      personaRole: caller.role,
      score: { qld: score.qld, nsw: score.nsw },
      commentary,
    })
  }

  /** Defence-rating penalty for a side that's a man (or more) down in the bin / sent off. */
  function defenceDebuffFor(rt: TeamRuntime): number {
    const missing = STARTING_POSITIONS.length - rt.menOnField
    return missing > 0 ? missing * TUNING.drama.shortHandedDefencePenalty : 0
  }

  // ---- COLOR commentary (B3-B5). All randomness here is from `colorRng` — NEVER `rng`. ----

  /** Append a COLOR event right after its trigger so it reads as the analyst replying. */
  function emitColor(persona: string, personaRole: string, line: string, side: Side, minute: number): void {
    events.push({
      minute: Math.round(minute),
      seq: seq++,
      type: 'COLOR',
      side,
      persona,
      personaRole,
      score: { qld: score.qld, nsw: score.nsw },
      commentary: line,
    })
    lastColorSeq = events[events.length - 1].seq
  }

  /** Persona candidate lists per moment (B5). The colorRng picks one of these deterministically. */
  function colorCandidates(moment: ColorMoment, scoringSide: Side): PersonaId[] {
    switch (moment) {
      case 'try':
      case 'break':
        // QLD-scoring leans the Maroon warmth (JT/Locky); NSW-scoring leans Joey. Gus/Freddy spice both.
        return scoringSide === 'QLD'
          ? ['thurston', 'lockyer', 'fittler']
          : ['johns', 'gould', 'fittler']
      case 'middle':
        // Repeated middle targeting — Cam Smith's wheelhouse, Joey/Gus back him.
        return ['smith', 'johns', 'gould']
      case 'discipline':
        // Gus primary, Freddy secondary; Joey for the tactical fallout.
        return ['gould', 'fittler', 'johns']
      case 'swing':
        // Momentum swing (e.g. a 40/20) — Joey's kicking-game read leads, laconic Gus/Freddy spice.
        return ['johns', 'gould', 'fittler']
      case 'late':
        // Late tension (e.g. a field goal) — laconic Gus or Freddy, measured Locky.
        return ['gould', 'fittler', 'lockyer']
    }
  }

  /**
   * Consider a color reply for a just-emitted trigger event. Draws EXACTLY ONE colorRng() fire/skip
   * gate per eligible trigger; if it fires, pickColor draws two more colorRng() values (persona, line)
   * and a COLOR event is appended. Min-gap suppression and the per-moment fire chance keep it sparse.
   */
  function maybeColor(
    moment: ColorMoment,
    chance: number,
    scoringSide: Side,
    minute: number,
    attacker?: Player,
    defender?: Player,
  ): void {
    // Always-fire triggers (SEND_OFF / HIA_FAIL, chance >= 1) bypass the min-gap so a marquee drama
    // moment ALWAYS draws its analyst reply. Probabilistic triggers honour the min-gap so the feed
    // never double-stacks color (target ~1 color per 8-12 caller lines).
    const guaranteed = chance >= 1
    if (!guaranteed && seq - lastColorSeq <= MIN_COLOR_GAP) return
    // ONE gate draw per eligible trigger — deterministic, salted, independent of the play stream.
    if (colorRng() >= chance) return
    const pick = pickColor(colorRng, moment, colorCandidates(moment, scoringSide), {
      attacker: attacker?.name,
      defender: defender?.name,
      score: { qld: score.qld, nsw: score.nsw },
    })
    if (!pick) return
    emitColor(pick.persona, pick.personaRole, pick.line, scoringSide, minute)
  }

  let possession: Side = 'QLD'
  let tackleCount = 0
  // Declared before the kick-off emit so `emit`'s fieldZone read is never in the TDZ (the KICKOFF
  // emit runs before the loop). Starts at the kick-off restart position.
  let fieldPosition = 30
  // True while a set is "open" — i.e. the top-of-loop set counter has already fired for this set.
  // Reset on every possession flip (try/error/turnover/kickoff/half-time); held true across a penalty
  // restart so the same set isn't double-counted when the PENALTY branch zeroes tackleCount.
  let setOpen = false

  emit({ type: 'KICKOFF', side: 'NSW' }, 0)

  while (clock < FULL_MINUTE) {
    const atk = runtimes[possession]
    const defSide: Side = possession === 'QLD' ? 'NSW' : 'QLD'
    const def = runtimes[defSide]
    const defDebuff = defenceDebuffFor(def)

    // Off-field views (sin-bin / send-off / HIA-pending) — excluded from ALL active selection this play.
    const atkOff = offFieldIds(atk)
    const defOff = offFieldIds(def)

    const weights = channelAttackWeights(atk.onField, def.onField, atk.fatigue, def.fatigue, defDebuff, formMap, formMap)
    const channel: Channel = pickChannel(rng, weights)
    const defChannel = defendingChannelFor(channel)

    const attacker = primaryOwner(atk.onField, channel, atkOff)
    const defender = primaryOwner(def.onField, defChannel, defOff)
    const atkUnit = channelUnit(atk.onField, channel, atk.fatigue, 0, formMap)
    const fbCoverSpeed = def.onField.FB.attrs.speed - (def.fatigue.get(def.onField.FB.id) ?? 0) + fdelta(def.onField.FB.id)

    channelTargetCounts[possession][channel] += 1
    commentaryCtx.channelTargetCount = channelTargetCounts[possession][channel]

    const playMinutes = Math.max(0.08, gauss(rng, TUNING.playClockMean, TUNING.playClockSd))

    if (!setOpen) {
      stats.totalSets[possession] += 1
      setOpen = true
    }

    // 1) Error check first (handling under pressure).
    if (resolveError(rng, attacker, atk.fatigue.get(attacker.id) ?? 0, fdelta(attacker.id))) {
      stats.errors[possession] += 1
      bumpStat(attacker, (l) => (l.errors += 1))
      emit({ type: 'ERROR', side: possession, channel, attacker, setComplete: true }, clock)
      flipPossession(defSide, 100 - fieldPosition)
      stepClock(playMinutes)
      continue
    }

    // 2) Penalty check (discipline of weakest-composure owner under pressure). Off-field owners
    // (binned / sent off / HIA) can't concede the penalty, so they're filtered out of the candidate
    // pool first — resolvePenalty still draws exactly one rng() regardless of pool size.
    const penaltyOwners = CHANNEL_OWNERS[defChannel].map((p) => def.onField[p]).filter((p) => !defOff.has(p.id))
    const offender = resolvePenalty(rng, penaltyOwners.length > 0 ? penaltyOwners : CHANNEL_OWNERS[defChannel].map((p) => def.onField[p]), def.fatigue, formMap)
    if (offender) {
      stats.penalties[defSide] += 1
      emit({ type: 'PENALTY', side: defSide, channel: defChannel, defender: offender }, clock)
      // Kick for touch: the side AWARDED the penalty (the attacking side `possession`) takes the kick,
      // gains territory and retains the feed. Territory arithmetic is from the kicker's boot — ZERO
      // extra match rng is drawn here (only the KICK event's own commentary draw), so the penalty
      // calibration is unchanged. The touch-kicker is the HB (→ FE → a middle) as on the last tackle.
      const pAtkOff = offFieldIds(atk)
      const touchKicker = !pAtkOff.has(atk.onField.HB.id)
        ? atk.onField.HB
        : !pAtkOff.has(atk.onField.FE.id)
          ? atk.onField.FE
          : primaryOwner(atk.onField, 'MIDDLE', pAtkOff)
      const touchKs = kickSkill(touchKicker, atk.fatigue.get(touchKicker.id) ?? 0, fdelta(touchKicker.id))
      // A better boot finds touch a few metres further on; folded into the existing penalty advance.
      const touchGain = PENALTY_FIELD_GAIN + Math.round((touchKs - 50) * 0.12)
      const touchDist = clampField(touchGain + 6)
      bumpStat(touchKicker, (l) => {
        l.kicks += 1
        l.kickMetres += touchDist
      })
      stats.kicks[possession] += 1
      stats.kickMetres[possession] += touchDist
      stats.kickTypes[possession].TOUCH += 1
      emit(
        { type: 'KICK', side: possession, channel, attacker: touchKicker, metres: touchDist, kickType: 'TOUCH' },
        clock,
      )
      tackleCount = 0
      fieldPosition = clampField(Math.min(95, fieldPosition + touchGain))
      stepClock(playMinutes)
      continue
    }

    // 3) Contest resolution.
    const outcome = resolveContest(rng, {
      attacker,
      defender,
      attackUnit: atkUnit,
      fullbackSpeed: fbCoverSpeed,
      attackFatigue: atk.fatigue.get(attacker.id) ?? 0,
      defenceFatigue: def.fatigue.get(defender.id) ?? 0,
      defenceDebuff: defDebuff,
      attackerForm: fdelta(attacker.id),
      defenderForm: fdelta(defender.id),
    })

    if (outcome.kind === 'TRY') {
      // Credit the strike carrier (FB/edge), keep the primary-owner defender for the contest signal.
      const runner = pickCarrier(rng, atk.onField, channel, 'STRIKE', atkOff)
      const m = Math.round(Math.max(15, gauss(rng, 26, 8)))
      recordCarry(runner, m)
      bumpStat(runner, (l) => (l.tries += 1))
      scoreTry(possession, channel, runner, defender, m)
      stepClock(playMinutes)
      continue
    }

    if (outcome.kind === 'LINE_BREAK') {
      stats.lineBreaks[possession] += 1
      const runner = pickCarrier(rng, atk.onField, channel, 'STRIKE', atkOff)
      const m = Math.round(Math.max(20, gauss(rng, 36, 8)))
      recordCarry(runner, m)
      bumpStat(runner, (l) => (l.lineBreaks += 1))
      bumpStat(defender, (l) => (l.missedTackles += 1))
      emit({ type: 'LINE_BREAK', side: possession, channel, attacker: runner, defender, metres: m }, clock)
      // COLOR (B4): LINE_BREAK 0.15. Appended before any head-knock so it reads straight off the break.
      maybeColor('break', 0.15, possession, clock, runner, defender)
      fieldPosition = Math.min(96, fieldPosition + m)
      tackleCount += 1
      maybeHeadKnock(def, defender, true)
      stepClock(playMinutes)
      continue
    }

    if (outcome.kind === 'HALF_BREAK') {
      const runner = pickCarrier(rng, atk.onField, channel, 'GRIND', atkOff)
      const m = Math.round(Math.max(8, gauss(rng, 18, 5)))
      recordCarry(runner, m)
      bumpStat(runner, (l) => (l.tackleBreaks += 1))
      emit({ type: 'HALF_BREAK', side: possession, channel, attacker: runner, defender, metres: m }, clock)
      fieldPosition = Math.min(94, fieldPosition + m)
      tackleCount += 1
      stepClock(playMinutes)
      continue
    }

    // HELD: routine tackle, missed-tackle gain, offload, or a hit-up late in the set.
    const missed = resolveMissedTackle(
      rng,
      attacker,
      defender,
      atk.fatigue.get(attacker.id) ?? 0,
      def.fatigue.get(defender.id) ?? 0,
      fdelta(attacker.id),
      fdelta(defender.id),
    )
    let bigCollision = false
    if (missed) {
      const runner = pickCarrier(rng, atk.onField, channel, 'STRIKE', atkOff)
      const m = Math.round(Math.max(4, gauss(rng, 12, 4)))
      recordCarry(runner, m)
      bumpStat(runner, (l) => (l.tackleBreaks += 1))
      bumpStat(defender, (l) => (l.missedTackles += 1))
      emit({ type: 'MISSED_TACKLE', side: possession, channel, attacker: runner, defender, metres: m }, clock)
      // COLOR (B4): only on REPEATED targeting of this channel (>=3), then 0.5 — Cam Smith's middle read.
      if (commentaryCtx.channelTargetCount >= 3) {
        maybeColor('middle', 0.5, possession, clock, runner, defender)
      }
      fieldPosition = Math.min(95, fieldPosition + m)
    } else if (clock < FULL_MINUTE && offloadChance(rng, attacker, atk.fatigue.get(attacker.id) ?? 0, fdelta(attacker.id))) {
      const runner = pickCarrier(rng, atk.onField, channel, 'GRIND', atkOff)
      const m = Math.round(Math.max(3, gauss(rng, 10, 4)))
      recordCarry(runner, m)
      creditTackle(def, defChannel)
      emit({ type: 'OFFLOAD', side: possession, channel, attacker: runner, metres: m }, clock)
      fieldPosition = Math.min(95, fieldPosition + m)
    } else if (tackleCount >= 4) {
      const runner = pickCarrier(rng, atk.onField, channel, 'GRIND', atkOff)
      const m = Math.round(Math.max(2, gauss(rng, 9, 3)))
      recordCarry(runner, m)
      creditTackle(def, defChannel)
      emit({ type: 'HIT_UP', side: possession, channel, attacker: runner, defender, metres: m }, clock)
      fieldPosition = Math.min(95, fieldPosition + m)
      bigCollision = true
    } else {
      const runner = pickCarrier(rng, atk.onField, channel, 'GRIND', atkOff)
      const m = Math.round(Math.max(2, gauss(rng, 9, 3)))
      recordCarry(runner, m)
      creditTackle(def, defChannel)
      emit({ type: 'TACKLE', side: possession, channel, attacker: runner, defender, metres: m }, clock)
      fieldPosition = Math.min(95, fieldPosition + m)
    }

    // Drama hooks on the resolved tackle: a head knock for the runner, foul play by the tackler.
    maybeHeadKnock(atk, attacker, bigCollision)
    maybeFoulPlay(def, defender, attacker, channel)

    tackleCount += 1
    if (tackleCount >= 6) {
      resolveLastTackleKick(atk, def, defSide, channel, defender)
    }
    stepClock(playMinutes)
  }

  emit({ type: 'FULL_TIME', side: 'QLD' }, FULL_MINUTE)

  const winner: Side | 'DRAW' = score.qld > score.nsw ? 'QLD' : score.nsw > score.qld ? 'NSW' : 'DRAW'
  const playerOfMatch = pickPlayerOfMatch(stats, winner)
  const broadcast = buildBroadcast(setup, { finalScore: score, winner, events, stats, playerOfMatch }, seed)
  // The iconic moment: a pure post-hoc scan of the finished stream — zero rng draws, so the
  // play-by-play above is byte-identical with this feature on. Thommo closes the wrap with it.
  const picked = pickIconicMoment(events, winner, playerOfMatch)
  const iconicMoment = picked ? { ...picked, line: renderIconicLine(picked, seed) } : undefined
  if (iconicMoment) broadcast.postGame.push(iconicMomentSegment(iconicMoment))
  return { finalScore: score, winner, events, stats, playerOfMatch, broadcast, ...(iconicMoment ? { iconicMoment } : {}) }

  // ---- inner helpers (close over loop state) ----

  function bumpStat(p: Player, fn: (l: PlayerStatLine) => void): void {
    const l = statLine(p)
    if (l) fn(l)
  }

  function recordCarry(p: Player, metres: number): void {
    const side = sideOf(p)
    if (side) stats.runMetres[side] += metres
    bumpStat(p, (l) => {
      l.runs += 1
      l.runMetres += metres
      l.minutesProxy += 1
    })
  }

  /**
   * Credit a completed tackle: a primary tackler + (~85%) a support man, spread across the defending
   * channel and weighted to the middle. Always consumes a fixed 3 rng() draws (in pickTacklers) so
   * the play stream stays deterministic. Called on routine TACKLE, HIT_UP and OFFLOAD HELD outcomes.
   */
  function creditTackle(defRt: TeamRuntime, defChannel: Channel): void {
    const { primary, support, support2 } = pickTacklers(rng, defRt.onField, defChannel, offFieldIds(defRt))
    bumpStat(primary, (l) => (l.tackles += 1))
    if (support) bumpStat(support, (l) => (l.tackles += 1))
    if (support2) bumpStat(support2, (l) => (l.tackles += 1))
  }

  function sideOf(p: Player): Side | null {
    return statLine(p)?.side ?? null
  }

  function flipPossession(to: Side, newField: number): void {
    possession = to
    tackleCount = 0
    fieldPosition = newField
    setOpen = false
  }

  function stepClock(playMinutes: number): void {
    advanceFatigue(qld, playMinutes)
    advanceFatigue(nsw, playMinutes)
    clock += playMinutes

    for (const side of ['QLD', 'NSW'] as Side[]) {
      resolvePendingDrama(runtimes[side])
      const swaps = maybeRotate(runtimes[side])
      for (const swap of swaps) {
        emit(
          {
            type: 'INTERCHANGE',
            side,
            attacker: swap.on,
            playerOn: swap.on,
            playerOff: swap.off,
            reason: swap.reason,
          },
          Math.min(clock, FULL_MINUTE),
        )
      }
    }

    if (!halfTimeDone && clock >= HALF_MINUTE) {
      halfTimeDone = true
      emit({ type: 'HALF_TIME', side: 'QLD' }, HALF_MINUTE)
      possession = 'NSW'
      tackleCount = 0
      fieldPosition = 30
      setOpen = false
    }
  }

  /**
   * The last-tackle kick (and its outcome). Replaces the old generic "every kick is identical" block.
   * Fixed rng-draw count: chooseKickType draws 1, resolveKick draws exactly 2; the CHASE_TRY branch
   * uses the normal try draws (pickCarrier + conversion inside scoreTry). The kicker is selected with
   * NO rng (HB → FE → a middle) exactly as before, so selection never perturbs the stream.
   */
  function resolveLastTackleKick(
    atk: TeamRuntime,
    def: TeamRuntime,
    defSide: Side,
    channel: Channel,
    defender: Player,
  ): void {
    // The halfback kicks — unless he's off the field (binned / sent off / HIA), in which case the
    // five-eighth steps in, else any on-field middle body. No rng drawn.
    const atkOff = offFieldIds(atk)
    const kicker = !atkOff.has(atk.onField.HB.id)
      ? atk.onField.HB
      : !atkOff.has(atk.onField.FE.id)
        ? atk.onField.FE
        : primaryOwner(atk.onField, 'MIDDLE', atkOff)

    const ks = kickSkill(kicker, atk.fatigue.get(kicker.id) ?? 0, fdelta(kicker.id))
    // (1 draw) what kind of kick.
    const type = chooseKickType(rng, {
      fieldPosition,
      clock,
      scoreMargin: Math.abs(score.qld - score.nsw),
      kickSkill: ks,
    })
    // The catcher is the defending fullback (with fatigue applied to the read attrs).
    const fb = def.onField.FB
    const fbFatigue = def.fatigue.get(fb.id) ?? 0
    const catcherHands = effectiveAttr(fb.attrs.hands, fbFatigue, fdelta(fb.id))
    const catcherSpeed = effectiveAttr(fb.attrs.speed, fbFatigue, fdelta(fb.id))
    // (2 draws) the outcome.
    const oc = resolveKick(rng, type, { fieldPosition, kickSkill: ks, catcherHands, catcherSpeed })

    // Kick distance for the KICK event's `metres` — a believable length per type/field position.
    const dist = kickDistance(type, fieldPosition, oc)

    // Credit the kick (kicker statline + team kicks/kickMetres/kickTypes). The KICK event is NOT a
    // color trigger, so no maybeColor here.
    bumpStat(kicker, (l) => {
      l.kicks += 1
      l.kickMetres += dist
    })
    stats.kicks[possession] += 1
    stats.kickMetres[possession] += dist
    stats.kickTypes[possession][type] += 1
    emit({ type: 'KICK', side: possession, channel, attacker: kicker, metres: dist, kickType: type, setComplete: true }, clock)

    switch (oc.kind) {
      case 'HANDOVER': {
        stats.completedSets[possession] += 1
        emit({ type: 'TURNOVER_DOWNTOWN', side: possession }, clock)
        // fieldGain is how far downfield the kick travels; the defending side restarts that far from
        // THEIR own line (i.e. 100 - reception point of the kicking side).
        flipPossession(defSide, clampField(100 - (fieldPosition + oc.fieldGain)))
        break
      }
      case 'REGAIN': {
        stats.completedSets[possession] += 1
        if (oc.repeatSet) emit({ type: 'REPEAT_SET', side: possession }, clock)
        if (type === 'FORTY_TWENTY') {
          stats.fortyTwenties[possession] += 1
          bumpStat(kicker, (l) => (l.fortyTwenties += 1))
          emit({ type: 'FORTY_TWENTY', side: possession, attacker: kicker }, clock)
          // COLOR (Pass 2): a 40/20 is a momentum swing — Joey's wheelhouse (kicking game). 0.6.
          maybeColor('swing', 0.6, possession, clock, kicker)
        }
        // Keep possession — NOT a flip. Top-of-loop counts the new set.
        tackleCount = 0
        fieldPosition = clampField(oc.newField)
        setOpen = false
        break
      }
      case 'DROP_OUT': {
        // CTO CORRECTION: a forced drop-out is a REGAIN for the KICKING team — the DEFENDING side takes
        // the drop-out and the kicking side receives it ~40m out with a fresh set. No TURNOVER_DOWNTOWN
        // (possession is retained). forcedDropOuts is credited to the kicking side + kicker.
        stats.completedSets[possession] += 1
        stats.forcedDropOuts[possession] += 1
        bumpStat(kicker, (l) => (l.forcedDropOuts += 1))
        emit({ type: 'DROP_OUT', side: possession }, clock)
        tackleCount = 0
        fieldPosition = clampField(57)
        setOpen = false
        break
      }
      case 'CHASE_TRY': {
        // A try off the kick chase — uses the normal try draws (pickCarrier + conversion inside scoreTry).
        const runner = pickCarrier(rng, atk.onField, channel, 'STRIKE', atkOff)
        const m = Math.round(Math.max(8, gauss(rng, 14, 6)))
        recordCarry(runner, m)
        bumpStat(runner, (l) => (l.tries += 1))
        scoreTry(possession, channel, runner, defender, m)
        break
      }
      case 'FIELD_GOAL_MADE': {
        if (possession === 'QLD') score.qld += FIELD_GOAL_POINTS
        else score.nsw += FIELD_GOAL_POINTS
        stats.fieldGoals[possession] += 1
        bumpStat(kicker, (l) => (l.fieldGoals += 1))
        stats.completedSets[possession] += 1
        emit({ type: 'FIELD_GOAL', side: possession, attacker: kicker }, clock)
        // COLOR (Pass 2): a made one-pointer is late-game ice — laconic Gus/Freddy, measured Locky. 0.7.
        maybeColor('late', 0.7, possession, clock, kicker)
        flipPossession(defSide, 30)
        break
      }
      case 'FIELD_GOAL_MISS': {
        stats.completedSets[possession] += 1
        emit({ type: 'TURNOVER_DOWNTOWN', side: possession }, clock)
        flipPossession(defSide, clampField(100 - (fieldPosition + oc.fieldGain)))
        break
      }
    }
  }

  function scoreTry(side: Side, channel: Channel, attacker: Player, defender: Player, metres: number): void {
    const leaderBefore: Side | 'LEVEL' =
      score.qld > score.nsw ? 'QLD' : score.nsw > score.qld ? 'NSW' : 'LEVEL'
    if (side === 'QLD') score.qld += TRY_POINTS
    else score.nsw += TRY_POINTS
    stats.tries[side] += 1
    stats.completedSets[side] += 1
    if (side === 'QLD') stats.byChannel[channel].qldTries += 1
    else stats.byChannel[channel].nswTries += 1
    emit({ type: 'TRY', side, channel, attacker, defender, metres, setComplete: true }, clock)

    // COLOR (B4): TRY base 0.25; 0.5 if the try changed the leader; 0.4 if last10 + tight.
    const leaderAfter: Side | 'LEVEL' =
      score.qld > score.nsw ? 'QLD' : score.nsw > score.qld ? 'NSW' : 'LEVEL'
    const changedLead = leaderAfter !== 'LEVEL' && leaderAfter !== leaderBefore
    const tight = bucketScoreline(score) === 'tight'
    const last10 = bucketPhase(clock) === 'last10'
    const tryChance = changedLead ? 0.5 : last10 && tight ? 0.4 : 0.25
    maybeColor('try', tryChance, side, clock, attacker, defender)

    const team = runtimes[side]
    const kicker = findKicker(team)
    const made = attemptConversion(rng, kicker)
    if (made) {
      if (side === 'QLD') score.qld += CONVERSION_POINTS
      else score.nsw += CONVERSION_POINTS
    }
    emit({ type: 'CONVERSION', side, attacker: kicker }, clock)

    flipPossession(side === 'QLD' ? 'NSW' : 'QLD', 30)
  }

  // ---- drama bookkeeping (all in simulate; resolvers in ratings are pure) ----

  function maybeHeadKnock(rt: TeamRuntime, player: Player, bigCollision: boolean): void {
    if (clock >= FULL_MINUTE) return
    if (rt.unavailable.has(player.id) || rt.hiaPending.has(player.id) || rt.sinBin.has(player.id)) return
    if (!resolveHeadKnock(rng, bigCollision, reinjuryMult(player.id))) return

    const slot = slotOf(rt, player.id)
    if (!slot) return
    const repl = forcedReplacementFor(rt, slot)
    // Player off for an HIA — a FREE replacement (exempt from the 8 cap) covers the slot. The
    // event carries both playerOff + playerOn so the live UI can fold the roster change.
    emit(
      {
        type: 'HEAD_KNOCK',
        side: rt.side,
        attacker: player,
        playerOff: player,
        playerOn: repl?.player,
        reason: 'hia',
      },
      clock,
    )
    if (repl) takeOffForReplacement(rt, player, slot, repl.player, repl.fromBench, 'hia')
    rt.hiaPending.set(player.id, {
      resolveAtClock: clock + 4 + rng() * 6,
      slot,
      replacement: repl?.player ?? null,
    })
  }

  function resolvePendingDrama(rt: TeamRuntime): void {
    // HIA results
    for (const [id, pending] of [...rt.hiaPending]) {
      if (clock < pending.resolveAtClock) continue
      rt.hiaPending.delete(id)
      const player = playerById(rt, id)
      if (!player) continue
      const outcome = resolveHiaOutcome(rng)
      if (outcome === 'PASS') {
        emit({ type: 'HIA_PASS', side: rt.side, attacker: player, reason: 'hia' }, clock)
        // Cleared — becomes available bench cover again (does not auto-return to the field).
        if (!rt.bench.includes(player) && !onFieldHas(rt, player.id)) rt.bench.push(player)
      } else {
        rt.failedHia += 1
        rt.unavailable.add(player.id)
        emit({ type: 'HIA_FAIL', side: rt.side, attacker: player, reason: 'hia' }, clock)
        // COLOR (B4): HIA_FAIL always (1.0) — the player ruled out is the subject ({defender} token).
        maybeColor('discipline', 1, rt.side, clock, undefined, player)
        maybeUnlockExtraBench(rt, 'hia')
      }
    }
    // Sin-bin returns — the player rejoins selection (offFieldIds stops excluding them) and we emit
    // a return event so the live UI can un-strike the name and restore the side to a full thirteen.
    for (const [id, info] of [...rt.sinBin]) {
      if (clock < info.returnAtClock) continue
      rt.sinBin.delete(id)
      rt.menOnField = Math.min(STARTING_POSITIONS.length, rt.menOnField + 1)
      const returning = playerById(rt, id)
      if (returning) {
        emit({ type: 'SIN_BIN_RETURN', side: rt.side, defender: returning, reason: 'sin-bin-return' }, clock)
      }
    }
  }

  function maybeFoulPlay(rt: TeamRuntime, tackler: Player, victim: Player, channel: Channel): void {
    if (clock >= FULL_MINUTE) return
    if (rt.unavailable.has(tackler.id) || rt.sinBin.has(tackler.id) || rt.hiaPending.has(tackler.id)) return
    const foul = resolveFoulPlay(rng, tackler, fdelta(tackler.id))
    if (!foul) return

    stats.penalties[rt.side] += 1
    emit({ type: 'FOUL_PLAY', side: rt.side, channel, defender: tackler, attacker: victim }, clock)

    if (foul.sanction === 'SIN_BIN') {
      const slot = slotOf(rt, tackler.id)
      rt.sinBin.set(tackler.id, { returnAtClock: clock + TUNING.drama.sinBinMinutes, slot: slot ?? 'LK' })
      rt.menOnField = Math.max(STARTING_POSITIONS.length - 4, rt.menOnField - 1)
      emit({ type: 'SIN_BIN', side: rt.side, defender: tackler, reason: 'foul' }, clock)
      // COLOR (B4): SIN_BIN 0.7 — discipline, Gus primary. The offender (rt.side) is the subject.
      maybeColor('discipline', 0.7, rt.side, clock, undefined, tackler)
    } else if (foul.sanction === 'SEND_OFF') {
      rt.unavailable.add(tackler.id)
      rt.menOnField = Math.max(STARTING_POSITIONS.length - 4, rt.menOnField - 1)
      emit({ type: 'SEND_OFF', side: rt.side, defender: tackler, reason: 'foul' }, clock)
      // COLOR (B4): SEND_OFF always (1.0) — bypasses the min-gap so it never gets suppressed.
      maybeColor('discipline', 1, rt.side, clock, undefined, tackler)
    }

    // A carded foul that ends the victim's match: forced (free) replacement + unlock that side's extra bench.
    if (foul.injuredVictim) {
      const vrt = victimSideRuntime(victim)
      if (vrt && !vrt.unavailable.has(victim.id)) {
        const slot = slotOf(vrt, victim.id)
        if (slot) {
          vrt.unavailable.add(victim.id)
          const repl = forcedReplacementFor(vrt, slot)
          emit(
            {
              type: 'INJURY_REPLACEMENT',
              side: vrt.side,
              attacker: victim,
              playerOff: victim,
              playerOn: repl?.player,
              reason: 'foul-injury',
            },
            clock,
          )
          if (repl) takeOffForReplacement(vrt, victim, slot, repl.player, repl.fromBench, 'foul-injury')
          maybeUnlockExtraBench(vrt, 'foul-injury')
        }
      }
    }
  }

  function maybeUnlockExtraBench(rt: TeamRuntime, reason: string): void {
    const byHia = rt.failedHia >= TUNING.drama.failedHiaToUnlock
    if (!rt.extraBenchUnlocked && (byHia || reason === 'foul-injury')) {
      rt.extraBenchUnlocked = true
    }
  }

  function victimSideRuntime(victim: Player): TeamRuntime | null {
    if (onFieldHas(qld, victim.id) || qld.bench.includes(victim)) return qld
    if (onFieldHas(nsw, victim.id) || nsw.bench.includes(victim)) return nsw
    return null
  }

  /**
   * Put `incoming` into `slot`, sending `off` away. `fromBench` swaps consume a distinct bench
   * body (toward the 4-usable limit + unlock-emission). Forced (HIA/injury) swaps are free of the
   * 8 cap; tactical swaps are not — that flag is set by the caller via maybeRotate.
   */
  function takeOffForReplacement(
    rt: TeamRuntime,
    off: Player,
    slot: Position,
    incoming: Player,
    fromBench: boolean,
    reason: string,
  ): void {
    rt.onField[slot] = incoming
    // The incoming body is now on the field — start his on-stint clock + clear any resting timer.
    rt.enteredAt.set(incoming.id, clock)
    rt.restingSince.delete(incoming.id)
    if (fromBench) {
      const wasNew = !rt.benchEntered.has(incoming.id)
      rt.bench = rt.bench.filter((b) => b.id !== incoming.id)
      rt.benchEntered.add(incoming.id)
      if (wasNew && rt.extraBenchUnlocked && isLockedBenchEntry(rt, incoming)) {
        emit({ type: 'RESERVE_ACTIVATED', side: rt.side, attacker: incoming, playerOn: incoming, reason }, clock)
      }
    } else {
      rt.resting.delete(incoming.id)
    }
    // The player going off (if a starter, they could later return; HIA/injured ones are tracked elsewhere).
    if (reason === 'fatigue') {
      rt.resting.set(off.id, { player: off, slot })
      rt.restingSince.set(off.id, clock)
    }
  }

  function isLockedBenchEntry(rt: TeamRuntime, player: Player): boolean {
    return rt.lockedIds.has(player.id)
  }

  /**
   * Forwards-only tactical rotation — AT MOST ONE interchange per team per call. Rotates the single
   * most-fatigued eligible forward (over threshold + past his minimum on-stint), provided the team's
   * minimum interchange-gap has elapsed and a meaningfully fresher replacement exists. Gated by the
   * 8-interchange cap and the 4-usable bench rule. Deterministic: ties broken by fatigue then slot
   * order, never rng. Returns 0 or 1 swap.
   */
  function maybeRotate(rt: TeamRuntime): Array<{ on: Player; off: Player; slot: Position; reason: string }> {
    if (rt.interchangesUsed >= TUNING.interchangeCap) return []
    // Stagger: hold off until the minimum game-time gap since this side's last interchange has passed.
    if (clock - rt.lastInterchangeClock < ROTATION.minInterchangeGapMin) return []

    // Find the single most-fatigued forward who is over the rotate threshold AND has served his
    // minimum on-stint (so we never yank a man who only just came on — that's half the churn fix).
    let target: { slot: Position; player: Player; fatigue: number } | null = null
    for (const slot of STARTING_POSITIONS) {
      if (!isForwardSlot(slot)) continue
      const current = rt.onField[slot]
      if (rt.unavailable.has(current.id) || rt.sinBin.has(current.id) || rt.hiaPending.has(current.id)) continue
      const currentFatigue = rt.fatigue.get(current.id) ?? 0
      if (currentFatigue < TUNING.benchRotateThreshold) continue
      const enteredAt = rt.enteredAt.get(current.id) ?? 0
      if (clock - enteredAt < ROTATION.minStintMin) continue
      // Higher fatigue wins; on equal fatigue the earlier slot in STARTING_POSITIONS order is kept
      // (strict >), so the choice is fully deterministic with no rng.
      if (!target || currentFatigue > target.fatigue) {
        target = { slot, player: current, fatigue: currentFatigue }
      }
    }
    if (!target) return []

    const candidate = freshestForwardReplacement(rt, clock, target.slot)
    if (!candidate) return []
    const candidateFatigue = rt.fatigue.get(candidate.player.id) ?? 0
    // Only swap if the incoming body is meaningfully fresher than the man he replaces.
    if (candidateFatigue + ROTATION.freshnessGap >= target.fatigue) return []

    takeOffForReplacement(rt, target.player, target.slot, candidate.player, candidate.fromBench, 'fatigue')
    rt.interchangesUsed += 1
    rt.lastInterchangeClock = clock
    return [{ on: candidate.player, off: target.player, slot: target.slot, reason: 'fatigue' }]
  }

  function slotOf(rt: TeamRuntime, id: string): Position | null {
    for (const pos of STARTING_POSITIONS) if (rt.onField[pos].id === id) return pos
    return null
  }

  function onFieldHas(rt: TeamRuntime, id: string): boolean {
    return slotOf(rt, id) !== null
  }

  function playerById(rt: TeamRuntime, id: string): Player | null {
    for (const pos of STARTING_POSITIONS) if (rt.onField[pos].id === id) return rt.onField[pos]
    for (const b of rt.bench) if (b.id === id) return b
    for (const [, r] of rt.resting) if (r.player.id === id) return r.player
    if (stats.players[id]) {
      // Player off the field (HIA-pending etc.) — reconstruct minimal Player from setup.
      return findInSetup(id)
    }
    return null
  }

  function findInSetup(id: string): Player | null {
    for (const team of [setup.qld, setup.nsw]) {
      for (const pos of STARTING_POSITIONS) if (team.lineup[pos]?.id === id) return team.lineup[pos]
      for (const pos of BENCH_POSITIONS) if (team.lineup[pos]?.id === id) return team.lineup[pos]
    }
    return null
  }
}

function pickPlayerOfMatch(stats: MatchStats, winner: Side | 'DRAW'): PlayerOfMatch {
  let best: PlayerOfMatch | null = null
  for (const id of Object.keys(stats.players)) {
    const l = stats.players[id]
    let rating =
      l.tries * 12 +
      l.lineBreaks * 5 +
      l.tackleBreaks * 2 +
      l.runMetres * 0.05 +
      l.tackles * 0.6 +
      // Small kicking-game weights (1.8): reward the playmaker who lands 40/20s, field goals, and
      // forces drop-outs. Kept modest so the POTM stays winner-biased (>60%) and tries/runs still lead.
      l.fortyTwenties * 4 +
      l.fieldGoals * 5 +
      l.forcedDropOuts * 1.5 -
      l.missedTackles * 2.5 -
      l.errors * 3
    if (winner !== 'DRAW' && l.side === winner) rating += 6
    if (
      !best ||
      rating > best.rating ||
      (rating === best.rating &&
        ((winner !== 'DRAW' && l.side === winner && best.side !== winner) ||
          l.runMetres > best.line.runMetres))
    ) {
      best = { id: l.id, name: l.name, side: l.side, rating, line: l }
    }
  }
  return best!
}

function findKicker(rt: TeamRuntime): Player {
  for (const pos of STARTING_POSITIONS) {
    if (rt.onField[pos].id === rt.kickerId) return rt.onField[pos]
  }
  let best = rt.onField.FB
  for (const pos of STARTING_POSITIONS) {
    if (rt.onField[pos].goalKicking > best.goalKicking) best = rt.onField[pos]
  }
  return best
}

function attemptConversion(rng: Rng, kicker: Player): boolean {
  const p = 0.35 + (kicker.goalKicking / 99) * 0.6
  return rng() < p
}

/** Clamp a field position into the valid 0–100 band (0 = own line, 100 = opp line). */
function clampField(x: number): number {
  return Math.min(100, Math.max(0, Math.round(x)))
}

/**
 * A believable kick distance (metres) for the KICK event's `metres`, derived from the kick type, the
 * field position, and the resolved outcome. Pure arithmetic — NO rng, so it never perturbs the stream.
 * Clearing/40-20/field-goal-miss are long; bombs/grubbers/cross-field are short, contestable kicks.
 */
function kickDistance(type: KickType, fieldPosition: number, oc: KickOutcome): number {
  switch (type) {
    case 'CLEARING':
      // The clearing kick's length ≈ the territory it won (the HANDOVER fieldGain), with a floor.
      return oc.kind === 'HANDOVER' ? Math.max(28, oc.fieldGain) : 38
    case 'FORTY_TWENTY':
      // A 40/20 (or a missed long kick) travels a long way downfield.
      return oc.kind === 'REGAIN' ? 48 : oc.kind === 'HANDOVER' ? Math.max(40, oc.fieldGain) : 48
    case 'FIELD_GOAL':
      // The drop-goal distance ≈ how far out the kicker is.
      return Math.max(18, 100 - fieldPosition + 10)
    case 'BOMB':
      return 28
    case 'GRUBBER':
      return Math.max(12, 100 - fieldPosition)
    case 'CROSS_FIELD':
      return 24
    case 'TOUCH':
      return 30
  }
}
