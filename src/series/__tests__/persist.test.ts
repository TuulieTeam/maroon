import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Position } from '../../data/types'
import { POSITION_ORDER } from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import { clearSeries, loadSeries, saveSeries } from '../persist'
import type { SeriesState } from '../types'

const STORAGE_KEY = 'maroon.series.v2'
const KNOWN_ID = QLD_SQUAD[0].id

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

function validLineup(): Record<Position, string> {
  const map = {} as Record<Position, string>
  for (const pos of POSITION_ORDER) map[pos] = KNOWN_ID
  return map
}

function validState(): SeriesState {
  return {
    schemaVersion: 2,
    rootSeed: 12345,
    currentGame: 2,
    seriesScore: { qld: 1, nsw: 0 },
    games: [
      {
        gameNumber: 1,
        venueId: 'SUNCORP',
        seed: 12345,
        qldLineup: validLineup(),
        qldKickerId: KNOWN_ID,
        finalScore: { qld: 20, nsw: 10 },
        winner: 'QLD',
      },
    ],
    status: 'in-progress',
    playerConditions: { [KNOWN_ID]: { form: 60, injury: { kind: 'fit', gamesOut: 0 } } },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('persist — round trip', () => {
  it('saves and loads an equal series', () => {
    const state = validState()
    saveSeries(state)
    expect(loadSeries()).toEqual(state)
  })

  it('returns null when nothing is stored', () => {
    expect(loadSeries()).toBeNull()
  })

  it('clearSeries removes a stored series', () => {
    saveSeries(validState())
    clearSeries()
    expect(loadSeries()).toBeNull()
  })
})

describe('persist — defensive discard', () => {
  it('discards unparseable JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{ not valid json')
    expect(loadSeries()).toBeNull()
  })

  it('discards a schema-version mismatch (an old v1 save)', () => {
    const stale = { ...validState(), schemaVersion: 1 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stale))
    expect(loadSeries()).toBeNull()
  })

  it('discards a malformed player-condition entry', () => {
    const bad = validState()
    bad.playerConditions[KNOWN_ID] = { form: 200, injury: { kind: 'fit', gamesOut: 0 } } // form out of range
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bad))
    expect(loadSeries()).toBeNull()
    const bad2 = validState()
    // @ts-expect-error — deliberately corrupting the injury kind for the test
    bad2.playerConditions[KNOWN_ID].injury.kind = 'sprained'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bad2))
    expect(loadSeries()).toBeNull()
  })

  it('discards a stored lineup referencing an unknown player id', () => {
    const drifted = validState()
    drifted.games[0].qldLineup.HB = 'not-a-real-player'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drifted))
    expect(loadSeries()).toBeNull()
  })

  it('discards an unknown kicker id', () => {
    const drifted = validState()
    drifted.games[0].qldKickerId = 'ghost-kicker'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drifted))
    expect(loadSeries()).toBeNull()
  })

  it('discards a malformed winner / bad shape', () => {
    const bad = validState()
    // @ts-expect-error — deliberately corrupting the winner for the test
    bad.games[0].winner = 'MAYBE'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bad))
    expect(loadSeries()).toBeNull()
  })

  it('discards a non-object payload', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(42))
    expect(loadSeries()).toBeNull()
  })
})

describe('persist — resilience', () => {
  it('saveSeries does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    })
    expect(() => saveSeries(validState())).not.toThrow()
  })
})
