import type { MatchResult, Score, SelectedTeam, Side, VenueId } from '../engine'
import type { DailyLedger, DailyRecord, DailySummary } from '../daily'
import type { CareerLedger, Difficulty, GameNo } from '../series'

/**
 * The feats system: a pure predicate catalog evaluated at the App boundary — the engine never learns
 * "feat". A feat is a retellable achievement ("3-0 on Hard", "held NSW tryless") that shapes HOW you
 * replay: locked feats are self-imposed challenges, earned ones are the trophy cabinet.
 */

/**
 * The result shape series feats are judged over. Deliberately minimal so BOTH a live completed
 * `SeriesState` and an archived `LedgerEntry` satisfy it structurally — that shared shape is what
 * makes retro-minting old careers possible with the exact same predicates.
 */
export interface SeriesFacts {
  seriesScore: Score
  seriesWinner?: Side
  games: Array<{ gameNumber: GameNo; venueId: VenueId; winner: Side | 'DRAW' }>
  difficulty?: Difficulty
  opponentId?: string
}

/** The three moments a feat can be judged at, with everything each moment actually has in hand. */
export type FeatContext =
  | {
      kind: 'match'
      result: MatchResult
      /** The locked QLD side that played (for lineup-shape feats like No Recognised Halfback). */
      team: SelectedTeam
      difficulty: Difficulty
    }
  | {
      kind: 'daily'
      record: DailyRecord
      summary: DailySummary
      /** The whole daily history — career-scope daily feats (Full Deck) read across it. */
      ledger: DailyLedger
    }
  | {
      kind: 'series'
      /** The COMPLETED series being judged (live state or an archived entry — same predicates). */
      completed: SeriesFacts
      /** The career so far — career-scope feats (Seen 'Em All) read across it. */
      career: CareerLedger
    }

export type FeatScope = FeatContext['kind']

export interface FeatDef {
  /** Stable id persisted in the feats ledger. Never reuse or rename a shipped id. */
  id: string
  /** The trophy's name, e.g. "The Immortals". */
  name: string
  /** One-line flavour shown in the cabinet and on the earn toast. */
  flavour: string
  /** The hint shown on the LOCKED silhouette — a self-imposed challenge, so it names the deed. */
  hint: string
  /** Which context this feat is judged in. */
  scope: FeatScope
  /** Repeatable feats tick a count ("Tryless ×4"); one-shot feats mint once and lock in. */
  repeatable?: boolean
  /**
   * The judgement. Returns false, or true, or a short detail string for the brag
   * (e.g. "Cobbo — 3 tries"). Pure — no rng, no clock, no DOM.
   */
  test: (ctx: FeatContext) => boolean | string
}

/** One earned feat as persisted — the FACT of the earn only, never thresholds or predicates. */
export interface EarnedFeat {
  /** Local date key of the first earn, e.g. "2026-07-06". */
  first: string
  count: number
  detail?: string
}

export const FEATS_SCHEMA_VERSION = 1

export interface FeatsLedger {
  schemaVersion: typeof FEATS_SCHEMA_VERSION
  earned: Record<string, EarnedFeat>
}

export const EMPTY_FEATS_LEDGER: FeatsLedger = { schemaVersion: FEATS_SCHEMA_VERSION, earned: {} }

/** A mint produced by an evaluation pass — what the toast and the share-card line render. */
export interface FeatMint {
  def: FeatDef
  /** True the very first time this feat is earned (repeat earns tick the count quietly). */
  isFirst: boolean
  detail?: string
}
