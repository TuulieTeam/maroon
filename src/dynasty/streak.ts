import type { Score, Side } from '../engine'

/**
 * The shield streak — the long arc's scoreboard. Queensland's holy grail is the 8-in-a-row, and
 * the record book is cruel about what counts: only a series won OUTRIGHT extends the streak. A
 * drawn series keeps the shield in the cabinet but resets the count ("retained, not won"), an NSW
 * win resets it, and a Casual-difficulty season can't carry a legend (same stance as the feats).
 */

/** The minimal facts a season needs to be judged — both a live SeriesState and an archived
 *  LedgerEntry satisfy it structurally (the SeriesFacts trick, again). */
export interface StreakFacts {
  seriesWinner?: Side
  seriesScore: Score
  difficulty?: string
}

/** Won outright: QLD holds the shield AND the score isn't level AND it wasn't a Casual stroll. */
export function outrightWin(f: StreakFacts): boolean {
  return f.seriesWinner === 'QLD' && f.seriesScore.qld > f.seriesScore.nsw && f.difficulty !== 'casual'
}

export interface ShieldStreak {
  /** Consecutive outright wins ending at the most recent season. */
  current: number
  /** The best run anywhere in the history. */
  best: number
}

/** Fold a chronological season history into the streak read. Pure. */
export function shieldStreak(seasons: StreakFacts[]): ShieldStreak {
  let current = 0
  let best = 0
  for (const s of seasons) {
    current = outrightWin(s) ? current + 1 : 0
    if (current > best) best = current
  }
  return { current, best }
}

/** Queensland's record — the 8-in-a-row (2006–2013). The strip the hub fills toward. */
export const THE_RECORD = 8
