import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchResult, SelectedTeam } from '../../engine'
import type { DailyLedger, DailyRecord } from '../../daily'
import { EMPTY_DAILY_LEDGER, DAILY_TWISTS, recordDaily, summariseDaily } from '../../daily'
import { defaultQldLineup } from '../../engine/__tests__/fixtures'
import { evaluateFeats } from '../evaluate'
import { loadFeats, saveFeats } from '../featsPersist'
import { nearMisses } from '../nearMiss'
import { EMPTY_FEATS_LEDGER } from '../types'
import type { FeatContext, FeatsLedger, SeriesFacts } from '../types'

const DATE = '2026-07-06'

// ---- context builders (the feats.test.ts shapes) ------------------------------------------------

function match(over: {
  qld?: number
  nsw?: number
  nswTries?: number
  qldFieldGoals?: number
  heroTries?: number
  difficulty?: 'casual' | 'origin' | 'hard'
}): FeatContext {
  const qld = over.qld ?? 20
  const nsw = over.nsw ?? 12
  const result = {
    finalScore: { qld, nsw },
    winner: qld > nsw ? 'QLD' : nsw > qld ? 'NSW' : 'DRAW',
    stats: {
      tries: { QLD: 3, NSW: over.nswTries ?? 2 },
      fieldGoals: { QLD: over.qldFieldGoals ?? 0, NSW: 0 },
      players: {
        hero: { id: 'hero', name: 'Hammer', side: 'QLD', tries: over.heroTries ?? 1 },
      },
    },
  } as unknown as MatchResult
  const team: SelectedTeam = { side: 'QLD', lineup: defaultQldLineup(), kickerId: 'def-HB' }
  return { kind: 'match', result, team, difficulty: over.difficulty ?? 'origin' }
}

function series(over: Partial<SeriesFacts> = {}): FeatContext {
  const completed: SeriesFacts = {
    seriesScore: { qld: 2, nsw: 1 },
    seriesWinner: 'QLD',
    games: [
      { gameNumber: 1, venueId: 'SUNCORP', winner: 'QLD' },
      { gameNumber: 2, venueId: 'ACCOR_SYD', winner: 'NSW' },
      { gameNumber: 3, venueId: 'MCG', winner: 'QLD' },
    ],
    difficulty: 'origin',
    opponentId: 'classic',
    ...over,
  }
  return { kind: 'series', completed, career: { schemaVersion: 2, entries: [] } }
}

function dailyCtx(record: DailyRecord, ledger: DailyLedger): FeatContext {
  return { kind: 'daily', record, summary: summariseDaily(ledger, record.dateKey), ledger }
}

function dRec(dateKey: string, winner: 'QLD' | 'NSW', twistId = 'full-80'): DailyRecord {
  return { dateKey, twistId, opponentId: 'classic', venueId: 'SUNCORP', finalScore: { qld: 20, nsw: 12 }, winner }
}

const missIds = (ctx: FeatContext, ledger: FeatsLedger = EMPTY_FEATS_LEDGER) =>
  nearMisses(ctx, ledger).map((m) => m.featId)

// ---- the measures, one by one -------------------------------------------------------------------

describe('near-miss measures', () => {
  it('a two-try man teases Hat-Trick Hero with his name; three tries mints instead', () => {
    const two = nearMisses(match({ heroTries: 2 }), EMPTY_FEATS_LEDGER)
    const hit = two.find((m) => m.featId === 'hat-trick-hero')
    expect(hit?.line).toBe('Hammer: 2 tries — one short of Hat-Trick Hero')
    // At the threshold the feat MINTS — and a just-minted feat must not also tease.
    const ctx = match({ heroTries: 3 })
    const { ledger } = evaluateFeats(ctx, EMPTY_FEATS_LEDGER, DATE)
    expect(missIds(ctx, ledger)).not.toContain('hat-trick-hero')
  })

  it('a 20-something margin teases Demolition; 30 is the feat, 17 is nothing', () => {
    expect(missIds(match({ qld: 38, nsw: 12 }))).toContain('demolition') // by 26
    expect(missIds(match({ qld: 29, nsw: 12 }))).not.toContain('demolition') // by 17
    expect(missIds(match({ qld: 42, nsw: 12 }))).not.toContain('demolition') // by 30 = the feat itself
  })

  it('one NSW try teases Tryless; a loss with one try does not', () => {
    expect(missIds(match({ nswTries: 1 }))).toContain('tryless')
    expect(missIds(match({ qld: 10, nsw: 12, nswTries: 1 }))).not.toContain('tryless')
  })

  it('One Point In It teases from both directions', () => {
    // Won by 1 without the boot...
    expect(missIds(match({ qld: 13, nsw: 12, qldFieldGoals: 0 }))).toContain('one-point-in-it')
    // ...and won by 2-3 with it.
    expect(missIds(match({ qld: 14, nsw: 12, qldFieldGoals: 1 }))).toContain('one-point-in-it')
    // The feat itself is silent here.
    expect(missIds(match({ qld: 13, nsw: 12, qldFieldGoals: 1 }))).not.toContain('one-point-in-it')
  })

  it('nothing teases on Casual', () => {
    expect(missIds(match({ heroTries: 2, difficulty: 'casual' }))).toEqual([])
  })

  it('a 4-6 day streak teases Magnificent Seven', () => {
    let ledger = EMPTY_DAILY_LEDGER
    for (let d = 1; d <= 5; d++) ledger = recordDaily(ledger, dRec(`2026-07-0${d}`, 'QLD'))
    const ctx = dailyCtx(ledger.results[4], ledger)
    const hit = nearMisses(ctx, EMPTY_FEATS_LEDGER).find((m) => m.featId === 'magnificent-seven')
    expect(hit?.line).toContain('5-day streak')
  })

  it('one or two twists short teases Full Deck', () => {
    let ledger = EMPTY_DAILY_LEDGER
    const most = DAILY_TWISTS.slice(0, -2)
    most.forEach((t, i) => {
      ledger = recordDaily(ledger, dRec(`2026-08-${String(i + 1).padStart(2, '0')}`, 'QLD', t.id))
    })
    const last = ledger.results[ledger.results.length - 1]
    const hit = nearMisses(dailyCtx(last, ledger), EMPTY_FEATS_LEDGER).find((m) => m.featId === 'full-deck')
    expect(hit?.line).toContain(`${most.length}/${DAILY_TWISTS.length} twists beaten`)
  })

  it('a 2-1 series win teases The Sweep; a 1-2 Hard loss teases Hard Yards', () => {
    expect(missIds(series())).toContain('the-sweep')
    expect(
      missIds(
        series({
          seriesScore: { qld: 1, nsw: 2 },
          seriesWinner: 'NSW',
          difficulty: 'hard',
        }),
      ),
    ).toContain('hard-yards')
  })

  it('an earned feat never teases again', () => {
    const earned: FeatsLedger = {
      schemaVersion: 1,
      earned: { 'the-sweep': { first: DATE, count: 1 } },
    }
    expect(missIds(series(), earned)).not.toContain('the-sweep')
  })

  it('misses come back ranked, closest first', () => {
    const misses = nearMisses(match({ qld: 38, nsw: 12, heroTries: 2 }), EMPTY_FEATS_LEDGER)
    expect(misses.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < misses.length; i++) {
      expect(misses[i - 1].closeness).toBeGreaterThanOrEqual(misses[i].closeness)
    }
  })
})

// ---- the approach book survives garbage ---------------------------------------------------------

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

describe('feats persist — the approaches field', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips approaches next to the earns', () => {
    const ledger: FeatsLedger = {
      schemaVersion: 1,
      earned: { queenslander: { first: DATE, count: 1 } },
      approaches: { demolition: { date: DATE, line: 'Won by 26 — Demolition needs 30', closeness: 26 / 30 } },
    }
    saveFeats(ledger)
    expect(loadFeats()).toEqual(ledger)
  })

  it('a malformed approaches field is dropped WITHOUT melting the trophies', () => {
    localStorage.setItem(
      'maroon.feats.v1',
      JSON.stringify({
        schemaVersion: 1,
        earned: { queenslander: { first: DATE, count: 1 } },
        approaches: 'garbage',
      }),
    )
    const loaded = loadFeats()
    expect(loaded.earned.queenslander).toEqual({ first: DATE, count: 1 })
    expect(loaded.approaches).toBeUndefined()
  })

  it('individually malformed approach entries are dropped, sane ones kept', () => {
    localStorage.setItem(
      'maroon.feats.v1',
      JSON.stringify({
        schemaVersion: 1,
        earned: {},
        approaches: {
          good: { date: DATE, line: 'so close', closeness: 0.9 },
          bad: { date: DATE, line: 'over unity', closeness: 2 },
          worse: { nope: true },
        },
      }),
    )
    const loaded = loadFeats()
    expect(loaded.approaches).toEqual({ good: { date: DATE, line: 'so close', closeness: 0.9 } })
  })
})
