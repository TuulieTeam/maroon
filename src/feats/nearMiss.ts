import { DAILY_TWISTS } from '../daily'
import { THE_RECORD } from '../dynasty/streak'
import { SCENARIOS } from '../scenarios/catalog'
import { scenariosDone } from '../scenarios/scenarioLedger'
import { featById, streakThrough } from './catalog'
import type { FeatContext, FeatsLedger } from './types'

/**
 * Near-miss detection — the chase made visible. After every judgement, the same contexts the feats
 * read are scanned for QUANTIFIABLE almost-theres ("Hamiso: 2 tries — one short of Hat-Trick Hero"),
 * shown on the result screen and remembered (best-ever per feat) for the hub's chase panel.
 *
 * A near-miss REVEALS the locked feat's name — that's the pull. The cabinet silhouette stays ?????:
 * getting close is how you learn what a trophy is called.
 */

export interface NearMiss {
  featId: string
  name: string
  line: string
  /** 0..1 — how close it came; ranks the chase panel. */
  closeness: number
}

type Measure = (ctx: FeatContext) => { closeness: number; line: string } | null

/** Series/match near-misses keep the feats' own stance: Casual runs don't count, so they don't tease. */
const meaningful = (difficulty: string | undefined): boolean => difficulty !== 'casual'

/**
 * The authored approach table — only feats with a measurable distance-to-go. Predicate-shaped feats
 * (Queenslander, Off the Script) have no "almost"; they simply happen. Drop-in entries per feat id.
 */
const APPROACHES: Record<string, Measure> = {
  'hat-trick-hero': (ctx) => {
    if (ctx.kind !== 'match' || !meaningful(ctx.difficulty)) return null
    const closest = Object.values(ctx.result.stats.players)
      .filter((p) => p.side === 'QLD' && p.tries === 2)
      .sort((a, b) => b.tries - a.tries)[0]
    return closest
      ? { closeness: 0.85, line: `${closest.name}: 2 tries — one short of Hat-Trick Hero` }
      : null
  },
  demolition: (ctx) => {
    if (ctx.kind !== 'match' || !meaningful(ctx.difficulty) || ctx.result.winner !== 'QLD') return null
    const margin = ctx.result.finalScore.qld - ctx.result.finalScore.nsw
    if (margin < 18 || margin >= 30) return null
    return { closeness: margin / 30, line: `Won by ${margin} — Demolition needs 30` }
  },
  tryless: (ctx) => {
    if (ctx.kind !== 'match' || !meaningful(ctx.difficulty) || ctx.result.winner !== 'QLD') return null
    if (ctx.result.stats.tries.NSW !== 1) return null
    return { closeness: 0.85, line: 'NSW crossed once — Tryless needs zero' }
  },
  'one-point-in-it': (ctx) => {
    if (ctx.kind !== 'match' || !meaningful(ctx.difficulty) || ctx.result.winner !== 'QLD') return null
    const margin = ctx.result.finalScore.qld - ctx.result.finalScore.nsw
    const kickedOne = ctx.result.stats.fieldGoals.QLD >= 1
    if (margin === 1 && !kickedOne) {
      return { closeness: 0.8, line: 'Won by 1 — One Point In It also wants a field goal in the game' }
    }
    if (margin >= 2 && margin <= 3 && kickedOne) {
      return { closeness: 0.75, line: `Won by ${margin} with a field goal — One Point In It needs exactly one` }
    }
    return null
  },
  'magnificent-seven': (ctx) => {
    if (ctx.kind !== 'daily') return null
    const s = ctx.summary.streak
    if (s < 4 || s >= 7) return null
    return { closeness: s / 7, line: `${s}-day streak — Magnificent Seven lives at 7` }
  },
  'full-deck': (ctx) => {
    if (ctx.kind !== 'daily') return null
    const wonUnder = new Set(ctx.ledger.results.filter((r) => r.winner === 'QLD').map((r) => r.twistId))
    const total = DAILY_TWISTS.length
    const short = total - wonUnder.size
    if (short < 1 || short > 2) return null
    return {
      closeness: wonUnder.size / total,
      line: `${wonUnder.size}/${total} twists beaten — Full Deck wants every one`,
    }
  },
  'the-sweep': (ctx) => {
    if (ctx.kind !== 'series' || !meaningful(ctx.completed.difficulty)) return null
    if (ctx.completed.seriesWinner !== 'QLD' || ctx.completed.seriesScore.qld !== 2) return null
    return { closeness: 0.7, line: 'Series won 2–1 — The Sweep wanted all three' }
  },
  'hard-yards': (ctx) => {
    if (ctx.kind !== 'series' || ctx.completed.difficulty !== 'hard') return null
    if (ctx.completed.seriesWinner === 'QLD') return null
    if (ctx.completed.seriesScore.qld !== 1 || ctx.completed.seriesScore.nsw !== 2) return null
    return { closeness: 0.6, line: 'A game away on Hard — Hard Yards is right there' }
  },
  'three-peat': (ctx) => {
    if (ctx.kind !== 'series') return null
    if (streakThrough(ctx) !== 2) return null
    return { closeness: 2 / 3, line: '2 shields straight — Three-Peat wants the third' }
  },
  'the-eight': (ctx) => {
    if (ctx.kind !== 'series') return null
    const s = streakThrough(ctx)
    if (s < 5 || s >= THE_RECORD) return null
    return { closeness: s / THE_RECORD, line: `${s} straight — The Eight is the record` }
  },
  'the-historian': (ctx) => {
    if (ctx.kind !== 'scenario') return null
    const done = scenariosDone(ctx.ledger)
    const total = SCENARIOS.length
    const short = total - done
    if (short < 1 || short > 2) return null
    return { closeness: done / total, line: `${done}/${total} scenarios conquered — The Historian wants the set` }
  },
}

/**
 * Scan one judged context for near-misses. Pure. Every LOCKED feat with a registered measure gets a
 * shot; earned feats (including anything minted this very pass — judge first, then scan) never
 * tease, and a broken measure can't take the result screen down with it.
 */
export function nearMisses(ctx: FeatContext, ledger: FeatsLedger): NearMiss[] {
  const out: NearMiss[] = []
  for (const [featId, measure] of Object.entries(APPROACHES)) {
    if (ledger.earned[featId]) continue
    const def = featById(featId)
    if (!def) continue
    const hit = measure(ctx)
    if (hit) out.push({ featId, name: def.name, line: hit.line, closeness: hit.closeness })
  }
  return out.sort((a, b) => b.closeness - a.closeness)
}
