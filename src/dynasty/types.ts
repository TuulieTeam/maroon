import type { Player } from '../data/types'
import type { Score, Side } from '../engine'

/**
 * THE DYNASTY — multi-season state. The core idea: the base squad data stays authored and mutable;
 * a dynasty stores only a cumulative OVERLAY (signed attribute deltas + who has retired), and every
 * year's playable roster is resolved fresh from base + overlay. So a base-data rebalance still
 * propagates into a running dynasty (deltas compose), while HISTORY — who retired when, what the
 * results were — is hardened into the save and can never be rewritten by a future tuning change.
 */

/** Cumulative signed drift vs BASE data for one player. Absent attr = no drift. */
export interface AttrDelta {
  attack: number
  defence: number
  speed: number
  hands: number
  composure: number
  stamina: number
}

/** The generated-world state for the CURRENT year, cumulative since the dynasty began. */
export interface YearOverlay {
  /** Per-player cumulative drift, keyed by player id (base ids and generated rookie ids alike). */
  attrDeltas: Record<string, AttrDelta>
  /** Players who have retired — filtered out of every resolved roster, forever. */
  retired: string[]
  /** Every generated rookie, stored VERBATIM (full Player + birthYear) — the save is their only
   *  home, so a future generator/name-pool edit can never rewrite an existing class. Retired
   *  rookies stay in the list (history) and are filtered at resolution like anyone else. */
  rookies: Player[]
  /** Generated Blues, keyed by the RETIRED man's canonical name key (see nsw.ts) — his replacement
   *  in every sheet he occupied. Stored verbatim; chains resolve when replacements retire too. */
  nswReplacements: Record<string, Player>
}

/** One archived season — immutable results + the names history remembers. */
export interface YearArchive {
  year: number
  /** The series that season played (its rootSeed keys the career-ledger entry). */
  seriesRootSeed: number
  seriesScore: Score
  seriesWinner: Side
  retained: boolean
  /** Name labels only — never attributes (the LedgerMvp rule). */
  retirements: Array<{ name: string; age: number }>
}

export const DYNASTY_SCHEMA_VERSION = 1

export interface DynastyState {
  schemaVersion: typeof DYNASTY_SCHEMA_VERSION
  /** The world seed — every off-season's aging/retirement rolls derive from it. */
  dynastySeed: number
  startYear: number
  currentYear: number
  overlay: YearOverlay
  years: YearArchive[]
  /** Sydney's coaching carousel: who holds their clipboard, and how many straight series they've
   *  lost to you (two straight and their board acts). Normalised in on old saves. */
  nswCoach: { index: number; lostStreak: number }
}

/** What the off-season screen narrates — pure data, recomputable, never persisted whole. */
export interface OffseasonReport {
  endedYear: number
  nextYear: number
  retirements: Array<{ id: string; name: string; age: number; position: string; farewell: string }>
  /** The biggest movers of the off-season, by net attribute drift. */
  risers: Array<{ name: string; note: string }>
  faders: Array<{ name: string; note: string }>
  /** The summer's rookie class — the scouting report. */
  rookieClass: Array<{ id: string; name: string; age: number; club: string; positions: string; note: string }>
  /** Across the border: Blues who hung it up, the generated men who replaced them, and (when their
   *  board finally acts) the coaching change. */
  nswRetirements: Array<{ name: string; age: number; replacedBy: string }>
  nswCoachLine: string | null
  /** The era line, e.g. "Year 3 of the dynasty · 2 shields". */
  eraLine: string
}
