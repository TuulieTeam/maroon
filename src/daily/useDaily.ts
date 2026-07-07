import { useCallback, useMemo, useState } from 'react'
import { buildDailyChallenge } from './dailyChallenge'
import type { DailyChallenge } from './dailyChallenge'
import { recordDaily, recordForDay, summariseDaily } from './dailyLedger'
import type { DailyRecord, DailySummary } from './dailyLedger'
import { loadDaily, saveDaily } from './dailyPersist'

export interface UseDaily {
  /** Today's deterministic challenge — same date, same match, always re-derivable. */
  challenge: DailyChallenge
  /** Today's result, once played — the one-attempt lock the UI renders around. */
  todayRecord: DailyRecord | undefined
  /** Streak / best / lifetime record as of today. */
  summary: DailySummary
  /** Fold a played Daily into the ledger and persist. No-ops if today was already recorded. */
  record: (record: DailyRecord) => void
}

/**
 * The Daily Origin's state hook — owns the persisted ledger the way useSeries owns the series save.
 * `todayKey` comes from the caller (App computes it from the wall clock) so everything below this
 * line stays pure and testable.
 */
export function useDaily(todayKey: string): UseDaily {
  const [ledger, setLedger] = useState(loadDaily)

  const challenge = useMemo(() => buildDailyChallenge(todayKey), [todayKey])
  const todayRecord = useMemo(() => recordForDay(ledger, todayKey), [ledger, todayKey])
  const summary = useMemo(() => summariseDaily(ledger, todayKey), [ledger, todayKey])

  const record = useCallback((rec: DailyRecord) => {
    setLedger((prev) => {
      const next = recordDaily(prev, rec)
      if (next !== prev) saveDaily(next)
      return next
    })
  }, [])

  return { challenge, todayRecord, summary, record }
}
