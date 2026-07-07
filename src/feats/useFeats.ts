import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDaily } from '../daily'
import { loadCareer } from '../series'
import { retroMint, evaluateFeats } from './evaluate'
import { loadFeats, saveFeats } from './featsPersist'
import { nearMisses } from './nearMiss'
import type { NearMiss } from './nearMiss'
import type { FeatContext, FeatMint, FeatsLedger } from './types'

export interface UseFeats {
  ledger: FeatsLedger
  /** Judge a context now; persists any earns and returns the mints for the toast/share line. */
  evaluate: (ctx: FeatContext, dateKey: string) => FeatMint[]
  /** Fold this run's near-misses into the best-ever approach book (facts only, best per feat). */
  recordApproaches: (misses: NearMiss[], dateKey: string) => void
  /** The full judgement: evaluate, then scan the same context for near-misses against the
   *  POST-MINT ledger (a feat you just earned never teases) and remember the best approaches. */
  judge: (ctx: FeatContext, dateKey: string) => { mints: FeatMint[]; misses: NearMiss[] }
}

/**
 * The trophy cabinet's React boundary. On mount it runs the one-off retro pass over the career and
 * daily archives — idempotent (already-earned feats no-op), so running it every launch is safe and
 * catches history written by other devices/sessions.
 *
 * `evaluate` must hand its mints straight back to the caller (the toast renders them THIS event),
 * so the working ledger lives in a ref that updates synchronously — two evaluations in one tick
 * (match feats then series feats on a decider) chain correctly — and state trails it for rendering.
 */
export function useFeats(todayKey: string): UseFeats {
  const [ledger, setLedger] = useState(loadFeats)
  const ledgerRef = useRef(ledger)

  useEffect(() => {
    ledgerRef.current = ledger
  }, [ledger])

  useEffect(() => {
    const { ledger: next } = retroMint(loadCareer(), loadDaily(), ledgerRef.current, todayKey)
    if (next !== ledgerRef.current) {
      ledgerRef.current = next
      saveFeats(next)
      setLedger(next)
    }
  }, [todayKey])

  const evaluate = useCallback((ctx: FeatContext, dateKey: string): FeatMint[] => {
    let r = evaluateFeats(ctx, ledgerRef.current, dateKey)
    // A mint retires its approach entry — the chase is over, the trophy is in the cabinet.
    if (r.mints.length > 0 && r.ledger.approaches) {
      const approaches = { ...r.ledger.approaches }
      let changed = false
      for (const m of r.mints) {
        if (approaches[m.def.id]) {
          delete approaches[m.def.id]
          changed = true
        }
      }
      if (changed) r = { ...r, ledger: { ...r.ledger, approaches } }
    }
    if (r.ledger !== ledgerRef.current) {
      ledgerRef.current = r.ledger
      saveFeats(r.ledger)
      setLedger(r.ledger)
    }
    return r.mints
  }, [])

  const recordApproaches = useCallback((misses: NearMiss[], dateKey: string) => {
    if (misses.length === 0) return
    const prior = ledgerRef.current.approaches ?? {}
    const approaches = { ...prior }
    let changed = false
    for (const m of misses) {
      if (ledgerRef.current.earned[m.featId]) continue
      const best = approaches[m.featId]
      if (!best || m.closeness > best.closeness) {
        approaches[m.featId] = { date: dateKey, line: m.line, closeness: m.closeness }
        changed = true
      }
    }
    if (!changed) return
    const next = { ...ledgerRef.current, approaches }
    ledgerRef.current = next
    saveFeats(next)
    setLedger(next)
  }, [])

  const judge = useCallback(
    (ctx: FeatContext, dateKey: string): { mints: FeatMint[]; misses: NearMiss[] } => {
      const mints = evaluate(ctx, dateKey)
      const misses = nearMisses(ctx, ledgerRef.current)
      recordApproaches(misses, dateKey)
      return { mints, misses }
    },
    [evaluate, recordApproaches],
  )

  return { ledger, evaluate, recordApproaches, judge }
}
