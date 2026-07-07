import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addCompletedSeries, EMPTY_LEDGER } from '../career'
import type { CareerLedger } from '../career'
import { clearCareer, loadCareer, saveCareer } from '../careerPersist'
import type { Position } from '../../data/types'
import type { Score, Side, VenueId } from '../../engine'
import type { GameNo, SeriesGameRecord, SeriesState } from '../types'

const CAREER_KEY = 'maroon.career.v1'

function makeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  }
}

function game(gameNumber: GameNo, venueId: VenueId, winner: Side | 'DRAW', qld: number, nsw: number): SeriesGameRecord {
  return {
    gameNumber,
    venueId,
    seed: gameNumber,
    qldLineup: {} as Record<Position, string>,
    qldKickerId: 'ponga',
    finalScore: { qld, nsw },
    winner,
  }
}

function completed(rootSeed: number, score: Score, winner: Side): SeriesState {
  return {
    schemaVersion: 3,
    rootSeed,
    opponentId: 'classic',
    currentGame: 3,
    seriesScore: score,
    games: [game(1, 'SUNCORP', 'QLD', 20, 10), game(2, 'ACCOR_SYD', 'NSW', 8, 14), game(3, 'MCG', 'QLD', 16, 12)],
    status: 'complete',
    seriesWinner: winner,
    playerConditions: {},
  }
}

function sampleLedger(): CareerLedger {
  return addCompletedSeries(EMPTY_LEDGER, completed(7, { qld: 2, nsw: 1 }, 'QLD'), null)
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('careerPersist — round trip', () => {
  it('saves and loads an equal ledger', () => {
    const led = sampleLedger()
    saveCareer(led)
    expect(loadCareer()).toEqual(led)
  })

  it('returns the empty ledger when nothing is stored', () => {
    expect(loadCareer()).toEqual(EMPTY_LEDGER)
  })

  it('clearCareer removes the archive', () => {
    saveCareer(sampleLedger())
    clearCareer()
    expect(loadCareer()).toEqual(EMPTY_LEDGER)
  })

  it('uses its own key, independent of the live series save', () => {
    saveCareer(sampleLedger())
    expect(localStorage.getItem(CAREER_KEY)).not.toBeNull()
    expect(localStorage.getItem('maroon.series.v2')).toBeNull()
  })
})

describe('careerPersist — v1 → v2 upgrade', () => {
  it('a stored v1 archive upgrades in place instead of being wiped', () => {
    const v1Entry = {
      rootSeed: 42,
      seriesScore: { qld: 2, nsw: 1 },
      seriesWinner: 'QLD',
      retained: false,
      games: [{ gameNumber: 1, venueId: 'SUNCORP', finalScore: { qld: 20, nsw: 10 }, winner: 'QLD' }],
      mvp: null,
    }
    localStorage.setItem(CAREER_KEY, JSON.stringify({ schemaVersion: 1, entries: [v1Entry] }))
    const loaded = loadCareer()
    expect(loaded.schemaVersion).toBe(2)
    expect(loaded.entries).toHaveLength(1)
    expect(loaded.entries[0].rootSeed).toBe(42)
    // v2 fields are simply absent on an upgraded v1 entry — never fabricated.
    expect(loaded.entries[0].difficulty).toBeUndefined()
    expect(loaded.entries[0].opponentId).toBeUndefined()
  })

  it('new archives record how the series was won (difficulty + opponent)', () => {
    const led = sampleLedger()
    expect(led.entries[0].difficulty).toBe('origin')
    expect(led.entries[0].opponentId).toBe('classic')
  })

  it('rejects a present-but-bad v2 field', () => {
    const bad = { ...sampleLedger().entries[0], nemesis: { id: 1 } }
    localStorage.setItem(CAREER_KEY, JSON.stringify({ schemaVersion: 2, entries: [bad] }))
    expect(loadCareer()).toEqual(EMPTY_LEDGER)
  })
})

describe('careerPersist — defensive discard', () => {
  it('discards a wrong schema version', () => {
    localStorage.setItem(CAREER_KEY, JSON.stringify({ schemaVersion: 99, entries: [] }))
    expect(loadCareer()).toEqual(EMPTY_LEDGER)
  })

  it('discards a malformed entry (bad winner)', () => {
    localStorage.setItem(
      CAREER_KEY,
      JSON.stringify({
        schemaVersion: 1,
        entries: [{ rootSeed: 1, seriesScore: { qld: 2, nsw: 1 }, seriesWinner: 'DRAW', retained: false, games: [], mvp: null }],
      }),
    )
    expect(loadCareer()).toEqual(EMPTY_LEDGER)
  })

  it('discards unparseable JSON', () => {
    localStorage.setItem(CAREER_KEY, '{ not json')
    expect(loadCareer()).toEqual(EMPTY_LEDGER)
  })
})
