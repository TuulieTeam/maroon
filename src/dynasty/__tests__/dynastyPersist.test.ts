import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadDynasty, saveDynasty } from '../dynastyPersist'
import { runOffseason } from '../offseason'
import { resolveRoster } from '../roster'
import { QLD_SQUAD } from '../../data/qldSquad'
import type { SeriesState } from '../../series'
import type { DynastyState } from '../types'

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

const KEY = 'maroon.dynasty.v1'

function fresh(): DynastyState {
  return {
    schemaVersion: 1,
    dynastySeed: 777,
    startYear: 2026,
    currentYear: 2026,
    overlay: { attrDeltas: {}, retired: [], rookies: [], nswReplacements: {} },
    years: [],
    nswCoach: { index: 0, lostStreak: 0 },
  }
}

function completed(rootSeed: number): SeriesState {
  return {
    schemaVersion: 3,
    rootSeed,
    opponentId: 'classic',
    currentGame: 3,
    seriesScore: { qld: 2, nsw: 1 },
    games: [],
    status: 'complete',
    seriesWinner: 'QLD',
    playerConditions: {},
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dynastyPersist', () => {
  it('round-trips a lived-in dynasty and re-resolves the identical roster', () => {
    const { next } = runOffseason(fresh(), completed(777))
    saveDynasty(next)
    const loaded = loadDynasty()
    expect(loaded).toEqual(next)
    const a = resolveRoster(QLD_SQUAD, next.overlay, next.currentYear, next.startYear)
    const b = resolveRoster(QLD_SQUAD, loaded!.overlay, loaded!.currentYear, loaded!.startYear)
    expect(b).toEqual(a)
  })

  it('returns null when nothing is stored (the caller adopts the live series)', () => {
    expect(loadDynasty()).toBeNull()
  })

  it('discards garbage, wrong versions, and malformed overlays', () => {
    localStorage.setItem(KEY, '{ not json')
    expect(loadDynasty()).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ ...fresh(), schemaVersion: 99 }))
    expect(loadDynasty()).toBeNull()
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...fresh(), overlay: { attrDeltas: { ponga: { attack: 'big' } }, retired: [] } }),
    )
    expect(loadDynasty()).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ ...fresh(), currentYear: 2020 })) // before startYear
    expect(loadDynasty()).toBeNull()
  })

  it('a drop-3 save (overlay without rookies) upgrades in place with an empty class', () => {
    const preRookie = { ...fresh(), overlay: { attrDeltas: {}, retired: ['dce'] } }
    localStorage.setItem(KEY, JSON.stringify(preRookie))
    const loaded = loadDynasty()
    expect(loaded).not.toBeNull()
    expect(loaded!.overlay.rookies).toEqual([])
    expect(loaded!.overlay.retired).toEqual(['dce'])
  })

  it('round-trips a dynasty with a stored rookie class verbatim', () => {
    let state = fresh()
    for (let i = 0; i < 3; i++) {
      state = runOffseason(state, completed(777 + i)).next
    }
    expect(state.overlay.rookies.length).toBeGreaterThan(0)
    saveDynasty(state)
    expect(loadDynasty()).toEqual(state)
  })

  it('a retired id that no longer resolves in base data is harmless at resolution', () => {
    const state = { ...fresh(), overlay: { attrDeltas: {}, retired: ['some-removed-player'], rookies: [], nswReplacements: {} } }
    saveDynasty(state)
    const loaded = loadDynasty()!
    const roster = resolveRoster(QLD_SQUAD, loaded.overlay, 2027, 2026)
    expect(roster).toHaveLength(QLD_SQUAD.length) // nothing real was filtered
  })
})
