import { describe, expect, it } from 'vitest'
import type { Score, Side } from '../../engine'
import { buildDailyShareCard } from '../dailyShareCard'
import type { DailyLedger, DailyRecord } from '../dailyLedger'
import { EMPTY_DAILY_LEDGER, daysBetween, recordDaily, recordForDay, summariseDaily } from '../dailyLedger'

function rec(dateKey: string, winner: Side | 'DRAW', score?: Score): DailyRecord {
  return {
    dateKey,
    twistId: 'full-80',
    opponentId: 'classic',
    venueId: 'SUNCORP',
    finalScore: score ?? (winner === 'QLD' ? { qld: 20, nsw: 12 } : { qld: 12, nsw: 20 }),
    winner,
  }
}

function ledgerOf(...records: DailyRecord[]): DailyLedger {
  return records.reduce(recordDaily, EMPTY_DAILY_LEDGER)
}

describe('daily ledger — one attempt per day', () => {
  it('records once and refuses a second attempt on the same date', () => {
    const first = recordDaily(EMPTY_DAILY_LEDGER, rec('2026-07-06', 'QLD'))
    const second = recordDaily(first, rec('2026-07-06', 'NSW'))
    expect(second).toBe(first)
    expect(recordForDay(second, '2026-07-06')?.winner).toBe('QLD')
  })

  it('keeps results date-ordered even if recorded out of order', () => {
    const l = ledgerOf(rec('2026-07-07', 'QLD'), rec('2026-07-06', 'NSW'))
    expect(l.results.map((r) => r.dateKey)).toEqual(['2026-07-06', '2026-07-07'])
  })

  it('daysBetween crosses month and year boundaries', () => {
    expect(daysBetween('2026-07-31', '2026-08-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-07-06', '2026-07-06')).toBe(0)
    expect(daysBetween('2026-07-01', '2026-07-08')).toBe(7)
  })
})

describe('daily ledger — streak semantics (Wordle rules)', () => {
  it('consecutive daily wins build the streak', () => {
    const l = ledgerOf(rec('2026-07-04', 'QLD'), rec('2026-07-05', 'QLD'), rec('2026-07-06', 'QLD'))
    const s = summariseDaily(l, '2026-07-06')
    expect(s.streak).toBe(3)
    expect(s.bestStreak).toBe(3)
    expect(s.wins).toBe(3)
    expect(s.played).toBe(3)
  })

  it('a loss snaps the streak; a draw is not a win', () => {
    const lost = ledgerOf(rec('2026-07-05', 'QLD'), rec('2026-07-06', 'NSW'))
    expect(summariseDaily(lost, '2026-07-06').streak).toBe(0)
    const drew = ledgerOf(rec('2026-07-05', 'QLD'), rec('2026-07-06', 'DRAW', { qld: 14, nsw: 14 }))
    expect(summariseDaily(drew, '2026-07-06').streak).toBe(0)
    // The 1-win run before the slip still counts as a best.
    expect(summariseDaily(lost, '2026-07-06').bestStreak).toBe(1)
  })

  it('a skipped day snaps the chain even between two wins', () => {
    const l = ledgerOf(rec('2026-07-03', 'QLD'), rec('2026-07-04', 'QLD'), rec('2026-07-06', 'QLD'))
    const s = summariseDaily(l, '2026-07-06')
    expect(s.streak).toBe(1)
    expect(s.bestStreak).toBe(2)
  })

  it("yesterday's unbroken streak is still alive today, but lapses the day after", () => {
    const l = ledgerOf(rec('2026-07-04', 'QLD'), rec('2026-07-05', 'QLD'))
    expect(summariseDaily(l, '2026-07-06').streak).toBe(2) // yet to play today — still on the line
    expect(summariseDaily(l, '2026-07-07').streak).toBe(0) // missed the 6th — gone
    expect(summariseDaily(l, '2026-07-07').bestStreak).toBe(2) // history keeps the high-water mark
  })

  it('an empty ledger reads all zeroes', () => {
    expect(summariseDaily(EMPTY_DAILY_LEDGER, '2026-07-06')).toEqual({
      streak: 0,
      bestStreak: 0,
      played: 0,
      wins: 0,
    })
  })
})

describe('daily share card', () => {
  it('brags the day, the twist, the score, and the fire', () => {
    const l = ledgerOf(rec('2026-07-05', 'QLD'), rec('2026-07-06', 'QLD'))
    const card = buildDailyShareCard(l.results[1], summariseDaily(l, '2026-07-06'))
    expect(card).toContain('The Daily Origin')
    expect(card).toContain('6 Jul 2026')
    expect(card).toContain('⚡ The Full 80')
    expect(card).toContain('🟩 QLD 20–12 at Suncorp')
    expect(card).toContain('🔥 Streak 2')
    // Every card ends with the deployed link — a brag nobody can click is a dead end.
    expect(card.trim().endsWith('https://tuulieteam.github.io/maroon/')).toBe(true)
  })

  it('a loss shows the red square and drops the fire', () => {
    const l = ledgerOf(rec('2026-07-06', 'NSW'))
    const card = buildDailyShareCard(l.results[0], summariseDaily(l, '2026-07-06'))
    expect(card).toContain('🟥 QLD 12–20')
    expect(card).not.toContain('🔥')
    expect(card).toContain('Won 0/1')
  })
})
