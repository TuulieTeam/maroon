import type { Player } from '../data/types'
import type { IconicMoment, MatchResult } from '../engine'
import type { CareerLedger, LedgerNemesis } from './career'
// (Player is still used by returningNemesis — the drawn sheet the grudge scans.)

/**
 * The nemesis — the Blues danger man who owns you across a series. Damage accrues game by game
 * from stats that actually exist (tries, line breaks, tackle breaks) plus a bonus for producing
 * the match's iconic moment; the max-damage man is crowned at series end IF he was a genuine
 * series-long problem (threshold), archived immutably, and — the payoff — called out in a future
 * series' scouting report when he runs out against you again. Matching is by NAME, not id: the
 * same man wears different ids across the three Blues sheets, and a grudge follows the man.
 */
export const NEMESIS_TUNING = {
  perTry: 8,
  perLineBreak: 4,
  perTackleBreak: 1,
  /** He didn't just hurt you — he produced THE moment (an NSW-side iconic moment). */
  iconicBonus: 8,
  /** Roughly two converted tries' worth of pain — a series-long problem, not one good night. */
  crownThreshold: 24,
} as const

/** Per-NSW-player running damage across a series, NAME included at fold time — so a generated
 *  replacement Blue (whose id resolves in no authored sheet) can still be crowned and remembered.
 *  Persisted on SeriesState (ids + name labels + tallies only). */
export type NemesisTally = Record<string, { name?: string; tries: number; lineBreaks: number; damage: number }>

/**
 * Fold one finished game into the tally. Pure — returns a new map; `prev` may be undefined
 * (a pre-drop-7 save mid-series simply starts counting from its next game).
 */
export function foldNswDamage(
  prev: NemesisTally | undefined,
  stats: MatchResult['stats'],
  iconicMoment: IconicMoment | undefined,
): NemesisTally {
  const next: NemesisTally = { ...(prev ?? {}) }
  for (const line of Object.values(stats.players)) {
    if (line.side !== 'NSW') continue
    const gained =
      line.tries * NEMESIS_TUNING.perTry +
      line.lineBreaks * NEMESIS_TUNING.perLineBreak +
      line.tackleBreaks * NEMESIS_TUNING.perTackleBreak
    if (gained === 0 && !next[line.id]) continue
    const cur = next[line.id] ?? { tries: 0, lineBreaks: 0, damage: 0 }
    next[line.id] = {
      name: line.name,
      tries: cur.tries + line.tries,
      lineBreaks: cur.lineBreaks + line.lineBreaks,
      damage: cur.damage + gained,
    }
  }
  if (iconicMoment && iconicMoment.side === 'NSW') {
    const cur = next[iconicMoment.playerId] ?? { tries: 0, lineBreaks: 0, damage: 0 }
    next[iconicMoment.playerId] = { ...cur, name: cur.name ?? iconicMoment.playerName, damage: cur.damage + NEMESIS_TUNING.iconicBonus }
  }
  return next
}

/**
 * Crown the series nemesis: the max-damage man, iff he cleared the threshold. Ties break by id
 * ascending for determinism. The name was captured at fold time; an entry from an older save that
 * never recorded one simply can't be crowned.
 */
export function crownNemesis(tally: NemesisTally | undefined): LedgerNemesis | null {
  if (!tally) return null
  let best: { id: string; name?: string; tries: number; lineBreaks: number; damage: number } | null = null
  for (const [id, t] of Object.entries(tally).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (t.damage > (best?.damage ?? -1)) best = { id, ...t }
  }
  if (!best || best.damage < NEMESIS_TUNING.crownThreshold || !best.name) return null
  return { id: best.id, name: best.name, tries: best.tries, lineBreaks: best.lineBreaks, damage: best.damage }
}

/**
 * The grudge callback: the most recent archived nemesis who appears (BY NAME) in the newly drawn
 * Blues sheet. Returns the line the scouting report opens with, or null when no ghost returns.
 */
export function returningNemesis(
  career: CareerLedger,
  nswPlayers: Player[],
): { nemesis: LedgerNemesis; year?: number; line: string } | null {
  const names = new Set(nswPlayers.map((p) => p.name))
  for (let i = career.entries.length - 1; i >= 0; i--) {
    const e = career.entries[i]
    if (!e.nemesis || !names.has(e.nemesis.name)) continue
    const when = e.year ? `in ’${String(e.year).slice(2)}` : 'last series'
    const stats = [
      e.nemesis.tries > 0 ? `${e.nemesis.tries} ${e.nemesis.tries === 1 ? 'try' : 'tries'}` : null,
      e.nemesis.lineBreaks > 0 ? `${e.nemesis.lineBreaks} line ${e.nemesis.lineBreaks === 1 ? 'break' : 'breaks'}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    return {
      nemesis: e.nemesis,
      year: e.year,
      line: `☠️ ${e.nemesis.name} owned you ${when}${stats ? ` — ${stats}` : ''}. He’s back.`,
    }
  }
  return null
}
