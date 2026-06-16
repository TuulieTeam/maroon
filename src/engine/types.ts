import type { Channel, Player, Position } from '../data/types'

export type Side = 'QLD' | 'NSW'

/**
 * The kind of kick a side puts up on the last tackle (or off a penalty). Lives here in engine/types
 * so `ratings.ts` (which owns chooseKickType/resolveKick) can import it without a cycle — engine/types
 * imports only from ../data/types, and ratings imports from ./types, so the dependency stays one-way.
 *  - CLEARING — the default downfield kick to flip the field and hand over.
 *  - BOMB — a high ball hung up for the chasers (redzone / 60m+ territory) to force a drop-out or error.
 *  - GRUBBER — a low rolling kick into the in-goal (redzone) chasing a try or a drop-out.
 *  - CROSS_FIELD — a wide kick to a winger in the corner (redzone) chasing a try.
 *  - FORTY_TWENTY — a kick from inside one's own 40 that bounces out inside the opp 20 (regains the feed).
 *  - FIELD_GOAL — a one-point drop goal attempt (late, tight, in range).
 *  - TOUCH — a penalty kick for touch (gains territory, retains possession). Set by the penalty branch.
 */
export type KickType =
  | 'CLEARING'
  | 'BOMB'
  | 'GRUBBER'
  | 'CROSS_FIELD'
  | 'FORTY_TWENTY'
  | 'FIELD_GOAL'
  | 'TOUCH'

export type MatchEventType =
  | 'KICKOFF'
  | 'HIT_UP'
  | 'TACKLE'
  | 'MISSED_TACKLE'
  | 'HALF_BREAK'
  | 'LINE_BREAK'
  | 'OFFLOAD'
  | 'ERROR'
  | 'PENALTY'
  | 'KICK'
  | 'TRY'
  | 'CONVERSION'
  | 'TURNOVER_DOWNTOWN'
  /** A forced goal-line drop-out — the kicking side bombed/grubbered it dead in-goal and gets it back. */
  | 'DROP_OUT'
  /** A successful 40/20 — the kick found touch inside the opp 20; the kicking side keeps the feed. */
  | 'FORTY_TWENTY'
  /** A one-point field goal (drop goal) made. */
  | 'FIELD_GOAL'
  /** A repeat set — possession retained off a regained kick (bomb knocked back / drop-out). */
  | 'REPEAT_SET'
  | 'INTERCHANGE'
  | 'HEAD_KNOCK'
  | 'HIA_PASS'
  | 'HIA_FAIL'
  | 'FOUL_PLAY'
  | 'SIN_BIN'
  | 'SIN_BIN_RETURN'
  | 'SEND_OFF'
  | 'INJURY_REPLACEMENT'
  | 'RESERVE_ACTIVATED'
  | 'HALF_TIME'
  | 'FULL_TIME'
  /** Live color commentary — an analyst's reply, appended right after a triggering play. */
  | 'COLOR'

export interface Score {
  qld: number
  nsw: number
}

export interface SelectedTeam {
  side: Side
  lineup: Record<Position, Player>
  kickerId: string
}

/** The three Origin venues, in series order. Flavour-only for v1 — no rating effect yet. */
export type VenueId = 'SUNCORP' | 'ACCOR_SYD' | 'MCG'

export interface Venue {
  id: VenueId
  /** Full display name, e.g. "Suncorp Stadium", "Accor Stadium", "the MCG". */
  stadium: string
  /** Short, sentence-safe ground name the booth uses inline, e.g. "Suncorp", "Accor", "the MCG". */
  groundShort: string
  /** Host city, e.g. "Brisbane", "Sydney", "Melbourne". */
  city: string
  /** Which side is at home (flavour-only for v1; a future home-edge would read this). */
  homeSide: Side
}

/**
 * Maroon-perspective pre-kickoff stakes for a game, derived from (gameNumber, series wins so far).
 * Draws are a no-result, so the "after a draw" variants reuse opener/decider phrasing with a level
 * series strip. See src/series/stakes.ts for the (gameNumber, seriesScore) -> stakes mapping.
 */
export type SeriesStakes =
  | 'OPENER'
  | 'G2_OPEN_AFTER_DRAW'
  | 'G2_CAN_CLINCH'
  | 'G2_MUST_WIN'
  | 'G3_DECIDER'
  | 'G3_DECIDER_AFTER_DRAW'
  | 'G3_DEAD_RUBBER_QLD_UP'
  | 'G3_DEAD_RUBBER_QLD_DOWN'

/**
 * Post-game wrap bucket — the resolved series consequence of a game, from (gameNumber, series wins
 * before, this game's winner). Drives the post-game booth clause and the UI ResultScreen copy.
 * Derived by `deriveWrap` (engine/series.ts) because the booth needs `result.winner`, which only the
 * engine has at broadcast time. Maroon-perspective.
 */
export type SeriesWrap =
  | 'LEAD_TAKEN'
  | 'TRAILING'
  | 'STALEMATE'
  | 'SERIES_CLINCHED_QLD'
  | 'LEVELLED_DECIDER'
  | 'KEPT_ALIVE_DECIDER'
  | 'SERIES_LOST_QLD'
  | 'G2_DRAW'
  | 'DECIDER_WON_QLD'
  | 'DECIDER_LOST_QLD'
  | 'DECIDER_DRAW_RETAIN'
  | 'SWEEP_QLD'
  | 'DEAD_RUBBER_CONSOLATION_NSW'
  | 'DEAD_RUBBER_CONSOLATION_QLD'
  | 'WHITEWASH_QLD'
  | 'DEAD_RUBBER_DRAW'

/**
 * Optional series context the booth reads to name the situation (game number, venue, stakes). Plain
 * data — no React/DOM, never touched by the match play-loop. It rides `setup` into buildBroadcast, so
 * `simulateMatch`/`buildBroadcast` keep their signatures and `series === undefined` is byte-identical
 * to the legacy single-match (Origin I, Brisbane) behaviour. Series tally/progression live in the UI.
 */
export interface SeriesContext {
  gameNumber: 1 | 2 | 3
  /** Games WON before this match (QLD/NSW). Draws don't count. */
  seriesScore: Score
  venue: Venue
  stakes: SeriesStakes
  /** Pre-match addresses already shown earlier this series — excluded so a speech never repeats. */
  usedSpeechTitles?: string[]
}

export interface MatchSetup {
  qld: SelectedTeam
  nsw: SelectedTeam
  /** When set, the booth narrates the series situation. Absent = legacy single-match behaviour. */
  series?: SeriesContext
  /**
   * Per-player FORM as a signed effective-attribute delta (player id -> points), already including any
   * play-hurt penalty. Read only as pure arithmetic in `effectiveAttr` — set before kickoff, never
   * mid-match. Absent/empty = form-free (byte-identical legacy behaviour).
   */
  form?: Record<string, number>
  /**
   * Per-player head-knock probability multiplier (player id -> multiplier) for DOUBTFUL/play-hurt men
   * carrying a re-injury risk. Scales the existing head-knock roll; absent = 1 (no extra risk).
   */
  reinjury?: Record<string, number>
}

export interface MatchEvent {
  minute: number
  seq: number
  type: MatchEventType
  side: Side
  channel?: Channel
  attacker?: Player
  defender?: Player
  /** For INTERCHANGE / personnel events: the player leaving the field. */
  playerOff?: Player
  /** For personnel events: the player coming onto the field. */
  playerOn?: Player
  /** Approx metres made on a carry (contest events). On a KICK event, the kick distance. */
  metres?: number
  /** For a KICK event: which kind of kick it was (clearing / bomb / 40-20 / field goal / touch …). */
  kickType?: KickType
  /** True on the play that completes/ends a set (kick on the last, or a try-ending raid). */
  setComplete?: boolean
  /** Why a personnel/discipline event happened: 'fatigue' | 'return' | 'hia' | 'foul-injury' | clock string. */
  reason?: string
  /** For COLOR events: the analyst's broadcast name (e.g. "Phil Gould"). */
  persona?: string
  /** For COLOR events: the analyst's role badge (e.g. "Analyst"). */
  personaRole?: string
  score: Score
  commentary: string
}

export interface ChannelTryBreakdown {
  qldTries: number
  nswTries: number
}

export interface PlayerStatLine {
  id: string
  name: string
  side: Side
  runs: number
  runMetres: number
  tackles: number
  missedTackles: number
  tackleBreaks: number
  lineBreaks: number
  tries: number
  errors: number
  /** Kicks attempted by this player (last-tackle kicks + kicks for touch off a penalty). */
  kicks: number
  /** Total kick distance (metres) by this player. */
  kickMetres: number
  /** Successful 40/20s landed by this player. */
  fortyTwenties: number
  /** Goal-line drop-outs forced by this player's kick (bomb/grubber dead in-goal). */
  forcedDropOuts: number
  /** One-point field goals made by this player. */
  fieldGoals: number
  /** Rough proxy of involvement (carries + tackles) — a stand-in for minutes played. */
  minutesProxy: number
}

export interface MatchStats {
  tries: Record<Side, number>
  lineBreaks: Record<Side, number>
  errors: Record<Side, number>
  byChannel: Record<Channel, ChannelTryBreakdown>
  runMetres: Record<Side, number>
  completedSets: Record<Side, number>
  totalSets: Record<Side, number>
  penalties: Record<Side, number>
  /** Total kicks per side (last-tackle kicks + kicks for touch off a penalty). */
  kicks: Record<Side, number>
  /** Total kick metres per side. */
  kickMetres: Record<Side, number>
  /** Successful 40/20s per side. */
  fortyTwenties: Record<Side, number>
  /** Goal-line drop-outs forced per side. */
  forcedDropOuts: Record<Side, number>
  /** One-point field goals made per side. */
  fieldGoals: Record<Side, number>
  /** Count of each kick type put up, per side (sums to `kicks[side]`). */
  kickTypes: Record<Side, Record<KickType, number>>
  players: Record<string, PlayerStatLine>
}

export interface PlayerOfMatch {
  id: string
  name: string
  side: Side
  rating: number
  line: PlayerStatLine
}

export type SegmentSlot = 'preGame' | 'halfTime' | 'postGame'

export interface Segment {
  /** Display name of the broadcaster speaking (e.g. "Andrew Johns"). */
  persona: string
  /** Their role badge (e.g. "Analyst", "Sideline"). */
  role: string
  /** The fully-rendered line — no unsubstituted tokens. */
  line: string
}

/** A Phil "Gus" Gould-style pre-game address — the stirring send-off shown right before kick off. */
export interface PreMatchSpeech {
  /** The address title, e.g. "The First Hit". */
  title: string
  /** The address, one line per paragraph, in order. */
  lines: string[]
}

export interface MatchBroadcast {
  preGame: Segment[]
  halfTime: Segment[]
  postGame: Segment[]
  /** The Gus Gould address for this game (mood-matched to the series stakes, seeded + deterministic). */
  preMatchSpeech: PreMatchSpeech
}

/** Coarse match-state buckets used to tag context-aware in-play commentary + broadcast facts. */
export type ScorelineBucket =
  | 'tight'
  | 'handy-lead-qld'
  | 'handy-lead-nsw'
  | 'blowout-qld'
  | 'blowout-nsw'

export type PhaseBucket = 'early' | 'middle' | 'last10' | 'post-siren'

export interface MatchResult {
  finalScore: Score
  winner: Side | 'DRAW'
  events: MatchEvent[]
  stats: MatchStats
  playerOfMatch: PlayerOfMatch
  /** Pre/half/post-game broadcaster build-up & wrap, always populated by simulateMatch. */
  broadcast: MatchBroadcast
}
