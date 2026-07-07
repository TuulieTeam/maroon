import type { DailyLedger } from '../daily'
import { summariseDaily } from '../daily'
import type { CareerLedger } from '../series'
import { FEATS } from './catalog'
import type { FeatContext, FeatMint, FeatsLedger } from './types'

/**
 * Judge one context against the whole catalog and fold the earns into the ledger. Pure — returns
 * the next ledger plus the mints (for the toast / share-card line). A one-shot feat already earned
 * no-ops; a repeatable one ticks its count (quietly — `isFirst` is false on repeats).
 */
export function evaluateFeats(
  ctx: FeatContext,
  ledger: FeatsLedger,
  /** Local date key stamped on first earns, e.g. "2026-07-06". */
  dateKey: string,
): { ledger: FeatsLedger; mints: FeatMint[] } {
  const mints: FeatMint[] = []
  let earned = ledger.earned
  for (const def of FEATS) {
    if (def.scope !== ctx.kind) continue
    const prior = earned[def.id]
    if (prior && !def.repeatable) continue
    const verdict = def.test(ctx)
    if (verdict === false) continue
    const detail = typeof verdict === 'string' ? verdict : undefined
    if (prior) {
      earned = { ...earned, [def.id]: { ...prior, count: prior.count + 1, detail: detail ?? prior.detail } }
      mints.push({ def, isFirst: false, detail })
    } else {
      earned = { ...earned, [def.id]: { first: dateKey, count: 1, ...(detail ? { detail } : {}) } }
      mints.push({ def, isFirst: true, detail })
    }
  }
  return { ledger: earned === ledger.earned ? ledger : { ...ledger, earned }, mints }
}

/**
 * One-off back-mint over everything the archives can still prove: every archived series is re-judged
 * with the live series predicates (the v1 entries simply lack difficulty/opponent, so the feats that
 * need those fields stay honest and unminted), and every archived daily is replayed through the daily
 * predicates. Stat-based match feats can't retro-mint — the career ledger never stored stats, and
 * that's the correct price of the IDs-only save discipline.
 */
export function retroMint(
  career: CareerLedger,
  daily: DailyLedger,
  ledger: FeatsLedger,
  dateKey: string,
): { ledger: FeatsLedger; minted: FeatMint[] } {
  let next = ledger
  const minted: FeatMint[] = []
  for (const entry of career.entries) {
    const r = evaluateFeats({ kind: 'series', completed: entry, career }, next, dateKey)
    next = r.ledger
    minted.push(...r.mints.filter((m) => m.isFirst))
  }
  const summary = summariseDaily(daily, dateKey)
  for (const record of daily.results) {
    const r = evaluateFeats({ kind: 'daily', record, summary, ledger: daily }, next, record.dateKey)
    next = r.ledger
    minted.push(...r.mints.filter((m) => m.isFirst))
  }
  return { ledger: next, minted }
}
