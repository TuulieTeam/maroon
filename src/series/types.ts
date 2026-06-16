import type { Position } from '../data/types'
import type { Score, Side, VenueId } from '../engine'

/** Re-exported from the engine, where `deriveWrap` lives (the booth needs it at broadcast time). */
export type { SeriesWrap } from '../engine'

/** A game's ordinal within the best-of-three series. */
export type GameNo = 1 | 2 | 3

/** A 0–100 form rating, 50 = neutral. Clamped to [0,100]. The engine never sees this — the UI converts
 *  it to a signed effective-attribute delta at the boundary. */
export type FormRating = number

export type InjuryKind = 'fit' | 'doubtful' | 'out' | 'suspended'

export type InjuryCause = 'failed-hia' | 'foul-injury' | 'send-off' | 'head-knock' | 'club-knock'

/** A player's injury status for the NEXT game. `gamesOut` counts down for out/suspended (0 otherwise). */
export interface InjuryState {
  kind: InjuryKind
  gamesOut: number
  cause?: InjuryCause
  /** True the game a previously OUT/SUSPENDED man is back (returns DOUBTFUL after an OUT spell). */
  returnedHurt?: boolean
}

export interface PlayerCondition {
  form: FormRating
  injury: InjuryState
}

/** Per-player condition, keyed by Player.id — covers the QLD pool and the fixed NSW 21. */
export type ConditionMap = Record<string, PlayerCondition>

/**
 * Immutable record of one completed Origin game within a series. Lineups are stored as player IDs
 * (not `Player` objects) so edited squad attributes never freeze into the save, and `finalScore`/
 * `winner` are the source-of-truth tally a later engine/tuning change can never retroactively rewrite.
 * The 80-minute events stream is deliberately NOT stored — it is re-derivable from `seed` + lineup.
 */
export interface SeriesGameRecord {
  gameNumber: GameNo
  venueId: VenueId
  seed: number
  qldLineup: Record<Position, string>
  qldKickerId: string
  finalScore: Score
  winner: Side | 'DRAW'
}

/**
 * The whole series, owned by the UI (App / useSeries) and persisted verbatim to localStorage.
 * `seriesScore` counts games WON (draws don't count). `seriesWinner` is set the instant a side
 * reaches two wins; on a drawn series (no side on two after three games) QLD retains as holder.
 */
export interface SeriesState {
  schemaVersion: 2
  rootSeed: number
  currentGame: GameNo
  seriesScore: Score
  games: SeriesGameRecord[]
  status: 'in-progress' | 'complete'
  seriesWinner?: Side
  /** Per-player form + injury (QLD pool + NSW), evolved each club round and persisted. */
  playerConditions: ConditionMap
}

/** Final series summary: scoreline, the shield holder, and when it became a dead rubber (if ever). */
export interface SeriesResult {
  seriesScore: Score
  seriesWinner: Side
  /** The game number from which the series was a dead rubber (shield already decided), or null. */
  deadRubberFrom: GameNo | null
}
