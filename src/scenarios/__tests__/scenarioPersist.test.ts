import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadScenarios, saveScenarios } from '../scenarioPersist'
import { recordScenarioRun } from '../scenarioLedger'
import { EMPTY_SCENARIO_LEDGER } from '../types'

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

const KEY = 'maroon.scenarios.v1'

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('scenarioPersist', () => {
  it('round-trips a lived-in ledger', () => {
    let l = EMPTY_SCENARIO_LEDGER
    l = recordScenarioRun(l, 'first-stand', true, '2026-07-01', 'Won by 8')
    l = recordScenarioRun(l, 'the-shutout', false, '2026-07-02')
    saveScenarios(l)
    expect(loadScenarios()).toEqual(l)
  })

  it('unknown scenario ids are kept — a retired scenario stays conquered', () => {
    const l = recordScenarioRun(EMPTY_SCENARIO_LEDGER, 'retired-scenario', true, '2026-07-01')
    saveScenarios(l)
    expect(loadScenarios().entries['retired-scenario'].firstDone).toBe('2026-07-01')
  })

  it.each([
    ['garbage', 'not json {{{'],
    ['wrong schema', JSON.stringify({ schemaVersion: 99, entries: {} })],
    ['entries as array', JSON.stringify({ schemaVersion: 1, entries: [] })],
    ['malformed entry', JSON.stringify({ schemaVersion: 1, entries: { x: { attempts: 'many' } } })],
    ['negative attempts', JSON.stringify({ schemaVersion: 1, entries: { x: { attempts: -2 } } })],
  ])('falls back to empty on %s', (_name, raw) => {
    localStorage.setItem(KEY, raw)
    expect(loadScenarios()).toEqual(EMPTY_SCENARIO_LEDGER)
  })

  it('missing key loads empty', () => {
    expect(loadScenarios()).toEqual(EMPTY_SCENARIO_LEDGER)
  })
})
