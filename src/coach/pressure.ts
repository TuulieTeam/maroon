import type { SeriesState } from '../series'

/**
 * The hot seat. A 0–100 pressure index on the coach, persisted across series: results move it in
 * big honest steps (a lost decider burns; a shield buys real air), the media's settled positions
 * nudge it game by game (a savaged call that fails adds heat; one that works buys aura). Pure fold
 * functions — the App boundary owns when they run. The SACK consequence lands with the Dynasty
 * (an era needs years to end); until then the bands are the story the hub tells.
 */
export const PRESSURE_TUNING = {
  start: 30,
  /** Series results (applied once, at completion). */
  seriesWin: -20,
  seriesSweepBonus: -10, // a 3-0 on top of the win credit
  seriesRetainDraw: -8, // kept the shield without winning it — air, but thin air
  seriesLoss: +22,
  seriesSweptBonus: +14, // 0-3 on top of the loss
  seriesDeciderLostBonus: +8, // losing a live game 3 stings extra
  /** Per-game media nudges (applied with the post-game back page). */
  savagedCallFails: +5, // the paper attacked the call and QLD lost
  savagedCallWins: -3, // the paper attacked the call and QLD won — aura
  backedCallFails: +2, // even a backed call leaks a little heat in a loss
  min: 0,
  max: 100,
} as const

export type PressureBand = 'untouchable' | 'solid' | 'simmering' | 'under-siege' | 'dead-man-walking'

export const PRESSURE_BANDS: Record<PressureBand, { label: string; blurb: string }> = {
  untouchable: { label: 'Untouchable', blurb: 'Statues get built in this range. The press box purrs.' },
  solid: { label: 'Solid', blurb: 'The board is relaxed, the columns are kind enough.' },
  simmering: { label: 'Simmering', blurb: 'Questions at every presser now. Nothing a win won’t fix.' },
  'under-siege': { label: 'Under Siege', blurb: 'Back pages daily, "sources close to the board" quoted. It’s on.' },
  'dead-man-walking': { label: 'Dead Man Walking', blurb: 'They’re writing the succession pieces. Only a shield saves this.' },
}

export function pressureBand(pressure: number): PressureBand {
  if (pressure < 20) return 'untouchable'
  if (pressure < 40) return 'solid'
  if (pressure < 60) return 'simmering'
  if (pressure < 80) return 'under-siege'
  return 'dead-man-walking'
}

function clamp(x: number): number {
  return Math.max(PRESSURE_TUNING.min, Math.min(PRESSURE_TUNING.max, Math.round(x)))
}

/** Fold one game's settled media position into the index (call with the post-game back page). */
export function applyGameHeat(pressure: number, stance: 'backs' | 'savages', qldWon: boolean): number {
  const t = PRESSURE_TUNING
  if (stance === 'savages') return clamp(pressure + (qldWon ? t.savagedCallWins : t.savagedCallFails))
  return clamp(pressure + (qldWon ? 0 : t.backedCallFails))
}

/** Fold a COMPLETED series into the index. Pure; call exactly once per completed series. */
export function applySeriesPressure(pressure: number, completed: SeriesState): number {
  const t = PRESSURE_TUNING
  const { seriesScore: s, seriesWinner } = completed
  if (seriesWinner === 'QLD' && s.qld === s.nsw) return clamp(pressure + t.seriesRetainDraw)
  if (seriesWinner === 'QLD') {
    return clamp(pressure + t.seriesWin + (s.qld === 3 ? t.seriesSweepBonus : 0))
  }
  // Lost the shield. A live game-3 loss (decider) stings extra; a 0-3 is a crisis.
  const g3 = completed.games.find((g) => g.gameNumber === 3)
  const first2 = completed.games.filter((g) => g.gameNumber <= 2)
  const wasDecider =
    g3 != null &&
    first2.filter((g) => g.winner === 'QLD').length < 2 &&
    first2.filter((g) => g.winner === 'NSW').length < 2
  return clamp(
    pressure +
      t.seriesLoss +
      (s.nsw === 3 ? t.seriesSweptBonus : 0) +
      (wasDecider && g3.winner === 'NSW' ? t.seriesDeciderLostBonus : 0),
  )
}
