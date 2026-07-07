import type { Player } from '../data/types'
import type { MatchResult, SelectedTeam, VenueId } from '../engine'

/**
 * Scenarios — "This Day in Origin". A scenario is a hand-authored, PINNED match: an explicit seed,
 * an explicit Blues side and ground, an optional constraint in the Daily twist vocabulary, and a
 * WIN CONDITION beyond merely winning. Nothing is drawn from a date or a hash — pinned means pinned,
 * so every retry replays the exact same match and the scenario is learnable like a puzzle. The only
 * variable is the 19 you pick. Everything composes at the App kickoff boundary; the engine never
 * learns "scenario".
 */

export type ScenarioTier = 'easy' | 'origin' | 'hard' | 'legendary'

/** The Daily twist constraint vocabulary, reused verbatim (form deltas + a live-squad ruled-out set). */
export interface ScenarioConstraint {
  /** Uniform effective-attr delta folded into every NSW player's form entry. */
  nswFormDelta?: number
  /** Uniform effective-attr delta folded into every QLD player's form entry. */
  qldFormDelta?: number
  /** The scenario's unavailable men, derived from the live squad (pure — no ids frozen in). */
  ruledOut?: (squad: Player[]) => string[]
}

export interface ScenarioDef {
  /** Stable id persisted in the scenario ledger. Never reuse or rename a shipped id. */
  id: string
  /** The billing, e.g. "1995 — The Neville Nobodies". */
  title: string
  /** Era-flavoured scene-setting — why this day mattered. */
  blurb: string
  tier: ScenarioTier
  /** The pinned match seed — the whole point. Same seed, same play stream, every retry. */
  seed: number
  /** The pinned Blues side (a bluesVariants id — falls back to canonical if ever retired). */
  opponentId: string
  /** The pinned ground. */
  venueId: VenueId
  constraint?: ScenarioConstraint
  /** The condition as the player reads it, e.g. "Win and hold NSW under 12". */
  winLabel: string
  /**
   * The judgement, beyond just winning. Returns false, true, or a short detail string for the brag
   * (the feat-test convention). Pure — no rng, no clock, no DOM.
   */
  winCondition: (result: MatchResult, team: SelectedTeam) => boolean | string
}

export const SCENARIOS_SCHEMA_VERSION = 1

/** One scenario's persisted facts — attempts spent and the first conquest. Never predicates. */
export interface ScenarioEntry {
  /** Completed runs (a browse or an abandoned picker costs nothing). */
  attempts: number
  /** Local date key of the first time the win condition was met. Write-once. */
  firstDone?: string
  /** The detail string from the first conquest, e.g. "Held them to 8". */
  bestDetail?: string
}

export interface ScenarioLedger {
  schemaVersion: typeof SCENARIOS_SCHEMA_VERSION
  entries: Record<string, ScenarioEntry>
}

export const EMPTY_SCENARIO_LEDGER: ScenarioLedger = {
  schemaVersion: SCENARIOS_SCHEMA_VERSION,
  entries: {},
}
