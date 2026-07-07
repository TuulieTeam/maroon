import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDaily } from '../daily'
import { loadCareer } from '../series'
import { retroMint, evaluateFeats } from './evaluate'
import { loadFeats, saveFeats } from './featsPersist'
import type { FeatContext, FeatMint, FeatsLedger } from './types'

export interface UseFeats {
  ledger: FeatsLedger
  /** Judge a context now; persists any earns and returns the mints for the toast/share line. */
  evaluate: (ctx: FeatContext, dateKey: string) => FeatMint[]
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
    const r = evaluateFeats(ctx, ledgerRef.current, dateKey)
    if (r.ledger !== ledgerRef.current) {
      ledgerRef.current = r.ledger
      saveFeats(r.ledger)
      setLedger(r.ledger)
    }
    return r.mints
  }, [])

  return { ledger, evaluate }
}
