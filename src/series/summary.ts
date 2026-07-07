import type { PlayerOfMatch, Side } from '../engine'
import type { GameNo, SeriesGameRecord, SeriesResult } from './types'

/**
 * Final series summary: scoreline, the shield holder (drawn series → QLD retains), and the game from
 * which the series became a dead rubber (the shield was already decided), or null if it went the
 * distance / was a live decider. Pure reducer over the immutable game records.
 */
export function summariseSeries(games: SeriesGameRecord[]): SeriesResult {
  let qld = 0
  let nsw = 0
  let decidedAt: GameNo | null = null
  for (const g of games) {
    if (g.winner === 'QLD') qld += 1
    if (g.winner === 'NSW') nsw += 1
    if (decidedAt === null && (qld >= 2 || nsw >= 2)) decidedAt = g.gameNumber
  }
  const seriesWinner: Side = qld >= 2 ? 'QLD' : nsw >= 2 ? 'NSW' : 'QLD'
  const deadRubberFrom =
    decidedAt !== null && games.length > decidedAt ? ((decidedAt + 1) as GameNo) : null
  return { seriesScore: { qld, nsw }, seriesWinner, deadRubberFrom }
}

/**
 * The SHIELD-DECIDING game: the one where a side reached two wins, or — when nobody did (the drawn
 * retain) — the last game played. This is the game whose iconic moment the career remembers; the
 * scarcity is deliberate (one remembered moment per series is what makes it legend). Null only when
 * no games were played at all.
 */
export function decidingGame(games: SeriesGameRecord[]): GameNo | null {
  let qld = 0
  let nsw = 0
  for (const g of games) {
    if (g.winner === 'QLD') qld += 1
    if (g.winner === 'NSW') nsw += 1
    if (qld >= 2 || nsw >= 2) return g.gameNumber
  }
  return games.length > 0 ? games[games.length - 1].gameNumber : null
}

/**
 * Series MVP across the played games — the highest player-of-match rating, ties broken by player id
 * ascending for determinism. Takes the in-memory POTMs (which are not persisted) so the stored series
 * stays lightweight. Precondition: at least one game has been played.
 */
export function pickSeriesMvp(potms: PlayerOfMatch[]): PlayerOfMatch {
  return potms.reduce((best, p) =>
    p.rating > best.rating || (p.rating === best.rating && p.id < best.id) ? p : best,
  )
}
