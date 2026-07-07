import type { PlayerOfMatch, Score, Side, VenueId } from '../engine'
import type { Difficulty } from './difficulty'
import type { GameNo, SeriesState } from './types'

/** The series MVP as an archived label — a result, never a squad attribute. */
export interface LedgerMvp {
  id: string
  name: string
  side: Side
  rating: number
}

/** One game's immutable result within an archived series. */
export interface LedgerGame {
  gameNumber: GameNo
  venueId: VenueId
  finalScore: Score
  winner: Side | 'DRAW'
}

/** An archived defining play — a frozen result string, never re-renderable (see the MVP-label rule). */
export interface LedgerIconicMoment {
  playerId: string
  playerName: string
  side: Side
  gameNumber: GameNo
  minute: number
  kind: string
  line: string
}

/** The Blues danger man who owned a series — an immutable damage tally, crowned at series end. */
export interface LedgerNemesis {
  id: string
  name: string
  tries: number
  lineBreaks: number
  damage: number
}

/**
 * One archived COMPLETED series — immutable results only (score tally + venue + the MVP label), keyed
 * by its unique `rootSeed`. No squad attributes and no lineups are stored, mirroring the ID-only
 * discipline of the live save, so a later squad/tuning change can never retroactively rewrite history.
 *
 * v2 additions are all OPTIONAL (a v1 entry upgrades by simply lacking them): the series' difficulty
 * and drawn opponent (for the feats system), plus reserved slots the chase layer fills as it ships —
 * the iconic moment, the nemesis, and the dynasty year label.
 */
export interface LedgerEntry {
  rootSeed: number
  seriesScore: Score
  seriesWinner: Side
  /** True when the series was drawn and QLD retained the shield without winning outright. */
  retained: boolean
  games: LedgerGame[]
  mvp: LedgerMvp | null
  difficulty?: Difficulty
  opponentId?: string
  year?: number
  iconicMoment?: LedgerIconicMoment
  nemesis?: LedgerNemesis
}

export const CAREER_SCHEMA_VERSION = 2

/** The whole career: every completed series the player has finished, oldest first. */
export interface CareerLedger {
  schemaVersion: typeof CAREER_SCHEMA_VERSION
  entries: LedgerEntry[]
}

export const EMPTY_LEDGER: CareerLedger = { schemaVersion: CAREER_SCHEMA_VERSION, entries: [] }

export interface MvpTally {
  name: string
  side: Side
  count: number
  bestRating: number
}

export interface CareerSummary {
  seriesPlayed: number
  /** Series in which QLD held the shield at the end (outright wins + drawn-series retains). */
  shieldsWon: number
  shieldsLost: number
  /** Outright series results from QLD's view (a drawn series counts as neither). */
  seriesWon: number
  seriesLost: number
  seriesDrawn: number
  gameWins: number
  gameLosses: number
  gameDraws: number
  /** Series MVPs across the career, most-decorated first. */
  mvpHallOfFame: MvpTally[]
}

function toMvp(mvp: PlayerOfMatch | null): LedgerMvp | null {
  return mvp ? { id: mvp.id, name: mvp.name, side: mvp.side, rating: mvp.rating } : null
}

/**
 * Archive a COMPLETED series into the career ledger. Pure — never mutates `ledger`. No-ops when the
 * series isn't complete, has no shield holder, or is already archived (deduped by its unique rootSeed),
 * so it is safe to call more than once for the same series.
 */
export function addCompletedSeries(
  ledger: CareerLedger,
  state: SeriesState,
  mvp: PlayerOfMatch | null,
): CareerLedger {
  if (state.status !== 'complete' || !state.seriesWinner) return ledger
  if (ledger.entries.some((e) => e.rootSeed === state.rootSeed)) return ledger
  const entry: LedgerEntry = {
    rootSeed: state.rootSeed,
    seriesScore: { ...state.seriesScore },
    seriesWinner: state.seriesWinner,
    retained: state.seriesWinner === 'QLD' && state.seriesScore.qld === state.seriesScore.nsw,
    games: state.games.map((g) => ({
      gameNumber: g.gameNumber,
      venueId: g.venueId,
      finalScore: { ...g.finalScore },
      winner: g.winner,
    })),
    mvp: toMvp(mvp),
    // v2: how it was won matters to the record — the dial and the drawn Blues side are results too.
    difficulty: state.difficulty ?? 'origin',
    opponentId: state.opponentId,
  }
  return { ...ledger, entries: [...ledger.entries, entry] }
}

/** Fold the ledger into the all-time totals shown on the hub. Pure reducer over the archived results. */
export function summariseCareer(ledger: CareerLedger): CareerSummary {
  const summary: CareerSummary = {
    seriesPlayed: ledger.entries.length,
    shieldsWon: 0,
    shieldsLost: 0,
    seriesWon: 0,
    seriesLost: 0,
    seriesDrawn: 0,
    gameWins: 0,
    gameLosses: 0,
    gameDraws: 0,
    mvpHallOfFame: [],
  }
  const byPlayer = new Map<string, MvpTally>()
  for (const e of ledger.entries) {
    if (e.seriesWinner === 'QLD') summary.shieldsWon += 1
    else summary.shieldsLost += 1
    if (e.seriesScore.qld > e.seriesScore.nsw) summary.seriesWon += 1
    else if (e.seriesScore.qld < e.seriesScore.nsw) summary.seriesLost += 1
    else summary.seriesDrawn += 1
    for (const g of e.games) {
      if (g.winner === 'QLD') summary.gameWins += 1
      else if (g.winner === 'NSW') summary.gameLosses += 1
      else summary.gameDraws += 1
    }
    if (e.mvp) {
      const key = `${e.mvp.side}:${e.mvp.name}`
      const cur = byPlayer.get(key)
      if (cur) {
        cur.count += 1
        cur.bestRating = Math.max(cur.bestRating, e.mvp.rating)
      } else {
        byPlayer.set(key, { name: e.mvp.name, side: e.mvp.side, count: 1, bestRating: e.mvp.rating })
      }
    }
  }
  summary.mvpHallOfFame = [...byPlayer.values()].sort(
    (a, b) => b.count - a.count || b.bestRating - a.bestRating || a.name.localeCompare(b.name),
  )
  return summary
}
