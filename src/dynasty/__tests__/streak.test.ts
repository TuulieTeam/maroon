import { describe, expect, it } from 'vitest'
import type { CareerLedger, LedgerEntry } from '../../series'
import { evaluateFeats, retroMint } from '../../feats/evaluate'
import { EMPTY_FEATS_LEDGER } from '../../feats/types'
import { EMPTY_DAILY_LEDGER } from '../../daily'
import { outrightWin, shieldStreak } from '../streak'
import { eraCardLine } from '../narrative'
import type { StreakFacts } from '../streak'

/** A season in shorthand: W = outright win, D = drawn retain, L = NSW win, C = casual win. */
function season(kind: 'W' | 'D' | 'L' | 'C'): StreakFacts {
  if (kind === 'W') return { seriesWinner: 'QLD', seriesScore: { qld: 2, nsw: 1 }, difficulty: 'origin' }
  if (kind === 'D') return { seriesWinner: 'QLD', seriesScore: { qld: 1, nsw: 1 }, difficulty: 'origin' }
  if (kind === 'C') return { seriesWinner: 'QLD', seriesScore: { qld: 2, nsw: 1 }, difficulty: 'casual' }
  return { seriesWinner: 'NSW', seriesScore: { qld: 1, nsw: 2 }, difficulty: 'origin' }
}

const run = (...kinds: Array<'W' | 'D' | 'L' | 'C'>) => shieldStreak(kinds.map(season))

describe('shieldStreak — the record-book rules', () => {
  it('outright wins chain; everything else resets', () => {
    expect(run('W', 'W', 'W')).toEqual({ current: 3, best: 3 })
    expect(run('W', 'L', 'W')).toEqual({ current: 1, best: 1 })
    expect(run('W', 'W', 'L')).toEqual({ current: 0, best: 2 })
  })

  it('a drawn retain keeps the shield but SNAPS the streak — retained is not won', () => {
    expect(run('W', 'D', 'W')).toEqual({ current: 1, best: 1 })
    expect(season('D').seriesWinner).toBe('QLD') // the shield stayed home...
    expect(outrightWin(season('D'))).toBe(false) // ...but the record book says no
  })

  it('a Casual season cannot carry a legend', () => {
    expect(run('W', 'C', 'W')).toEqual({ current: 1, best: 1 })
  })

  it('best survives a later collapse; an empty history is 0/0', () => {
    expect(run('W', 'W', 'W', 'W', 'L', 'W')).toEqual({ current: 1, best: 4 })
    expect(shieldStreak([])).toEqual({ current: 0, best: 0 })
  })
})

describe('the long-arc feats', () => {
  /** An archived outright win, unique rootSeed per call. */
  let seed = 0
  function entry(kind: 'W' | 'D' | 'L'): LedgerEntry {
    const s = season(kind)
    return {
      rootSeed: ++seed,
      seriesScore: s.seriesScore,
      seriesWinner: s.seriesWinner!,
      retained: kind === 'D',
      games: [
        { gameNumber: 1, venueId: 'SUNCORP', finalScore: { qld: 20, nsw: 10 }, winner: 'QLD' },
        { gameNumber: 2, venueId: 'ACCOR_SYD', finalScore: { qld: 10, nsw: 20 }, winner: 'NSW' },
        { gameNumber: 3, venueId: 'MCG', finalScore: { qld: 20, nsw: 10 }, winner: 'QLD' },
      ],
      mvp: null,
      difficulty: s.difficulty as LedgerEntry['difficulty'],
      opponentId: 'classic',
    }
  }

  it('Three-Peat mints live on the third straight outright win — a retain in the middle blocks it', () => {
    const twoStraight: CareerLedger = { schemaVersion: 2, entries: [entry('W'), entry('W')] }
    const live = evaluateFeats(
      { kind: 'series', completed: entry('W'), career: twoStraight },
      EMPTY_FEATS_LEDGER,
      '2026-07-07',
    )
    expect(live.mints.map((m) => m.def.id)).toContain('three-peat')

    const withRetain: CareerLedger = { schemaVersion: 2, entries: [entry('W'), entry('D')] }
    const blocked = evaluateFeats(
      { kind: 'series', completed: entry('W'), career: withRetain },
      EMPTY_FEATS_LEDGER,
      '2026-07-07',
    )
    expect(blocked.mints.map((m) => m.def.id)).not.toContain('three-peat')
  })

  it('The Eight needs the full eight; retro-mint back-fills an existing dynasty career', () => {
    const eight: CareerLedger = {
      schemaVersion: 2,
      entries: Array.from({ length: 8 }, () => entry('W')),
    }
    const { ledger } = retroMint(eight, EMPTY_DAILY_LEDGER, EMPTY_FEATS_LEDGER, '2026-07-07')
    expect(ledger.earned['the-eight']).toBeTruthy()
    expect(ledger.earned['three-peat']).toBeTruthy()

    // Seven straight retro-mints the three-peat but NOT the eight.
    const seven: CareerLedger = { schemaVersion: 2, entries: Array.from({ length: 7 }, () => entry('W')) }
    const r7 = retroMint(seven, EMPTY_DAILY_LEDGER, EMPTY_FEATS_LEDGER, '2026-07-07')
    expect(r7.ledger.earned['the-eight']).toBeUndefined()
  })

  it('Decade of Origin counts seasons, not results', () => {
    const nine: CareerLedger = { schemaVersion: 2, entries: Array.from({ length: 9 }, () => entry('L')) }
    const tenth = evaluateFeats(
      { kind: 'series', completed: entry('L'), career: nine },
      EMPTY_FEATS_LEDGER,
      '2026-07-07',
    )
    expect(tenth.mints.map((m) => m.def.id)).toContain('dynasty-decade')
  })
})

describe('eraCardLine — aligned to the record-book rule', () => {
  const y = (winnerQld: boolean, retained = false) => ({
    seriesWinner: winnerQld ? ('QLD' as const) : ('NSW' as const),
    retained,
  })

  it('a retain in the chain caps the "straight" count', () => {
    // Three archived outright wins + this outright win = 4 straight on the card.
    expect(eraCardLine([y(true), y(true), y(true)], true, 4)).toContain('4 straight')
    // The same but the middle year was a drawn retain: straight = 2 → below the ≥3 display bar.
    expect(eraCardLine([y(true), y(true, true), y(true)], true, 4)).not.toContain('straight')
    // This year itself a retain: no streak brag at all.
    expect(eraCardLine([y(true), y(true), y(true)], true, 4, true)).not.toContain('straight')
  })
})
