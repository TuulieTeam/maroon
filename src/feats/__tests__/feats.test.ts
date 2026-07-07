import { describe, expect, it } from 'vitest'
import type { MatchResult, SelectedTeam } from '../../engine'
import type { CareerLedger, LedgerEntry, SeriesState } from '../../series'
import { buildShareCard } from '../../series'
import type { DailyLedger, DailyRecord } from '../../daily'
import { buildDailyShareCard, DAILY_TWISTS, EMPTY_DAILY_LEDGER, recordDaily, summariseDaily } from '../../daily'
import { defaultQldLineup } from '../../engine/__tests__/fixtures'
import { FEATS, featById } from '../catalog'
import { evaluateFeats, retroMint } from '../evaluate'
import { EMPTY_FEATS_LEDGER } from '../types'
import type { FeatContext, SeriesFacts } from '../types'

const DATE = '2026-07-06'

// ---- context builders -------------------------------------------------------------------------

function series(over: Partial<SeriesFacts> = {}, careerEntries: LedgerEntry[] = []): FeatContext {
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
  const career: CareerLedger = { schemaVersion: 2, entries: careerEntries }
  return { kind: 'series', completed, career }
}

/** A minimal QLD-won MatchResult with just the fields the match predicates read. */
function match(over: {
  qld?: number
  nsw?: number
  nswTries?: number
  qldFieldGoals?: number
  heroTries?: number
  team?: SelectedTeam
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
  const team: SelectedTeam = over.team ?? { side: 'QLD', lineup: defaultQldLineup(), kickerId: 'def-HB' }
  return { kind: 'match', result, team, difficulty: over.difficulty ?? 'origin' }
}

function dailyCtx(record: DailyRecord, ledger: DailyLedger): FeatContext {
  return { kind: 'daily', record, summary: summariseDaily(ledger, record.dateKey), ledger }
}

function dRec(dateKey: string, winner: 'QLD' | 'NSW', twistId = 'full-80'): DailyRecord {
  return { dateKey, twistId, opponentId: 'classic', venueId: 'SUNCORP', finalScore: { qld: 20, nsw: 12 }, winner }
}

function idsOf(ctx: FeatContext): string[] {
  return evaluateFeats(ctx, EMPTY_FEATS_LEDGER, DATE).mints.map((m) => m.def.id)
}

// ---- catalog ----------------------------------------------------------------------------------

describe('feats — series predicates', () => {
  it('a 2-1 decider win mints Queenslander + Decider Football (and nothing louder)', () => {
    const ids = idsOf(series())
    expect(ids).toContain('queenslander')
    expect(ids).toContain('decider-football')
    expect(ids).not.toContain('the-sweep')
    expect(ids).not.toContain('the-comeback')
    expect(ids).not.toContain('road-warrior') // lost the Accor leg
  })

  it('a sweep mints The Sweep + Road Warrior; on Hard it also mints The Immortals', () => {
    const sweep: Partial<SeriesFacts> = {
      seriesScore: { qld: 3, nsw: 0 },
      games: [
        { gameNumber: 1, venueId: 'SUNCORP', winner: 'QLD' },
        { gameNumber: 2, venueId: 'ACCOR_SYD', winner: 'QLD' },
        { gameNumber: 3, venueId: 'MCG', winner: 'QLD' },
      ],
    }
    expect(idsOf(series(sweep))).toEqual(
      expect.arrayContaining(['queenslander', 'the-sweep', 'road-warrior']),
    )
    expect(idsOf(series(sweep))).not.toContain('the-immortals')
    const onHard = idsOf(series({ ...sweep, difficulty: 'hard' }))
    expect(onHard).toContain('the-immortals')
    expect(onHard).toContain('hard-yards')
  })

  it('losing game 1 then winning mints The Comeback; a drawn retain mints Held the Line', () => {
    expect(
      idsOf(
        series({
          games: [
            { gameNumber: 1, venueId: 'SUNCORP', winner: 'NSW' },
            { gameNumber: 2, venueId: 'ACCOR_SYD', winner: 'QLD' },
            { gameNumber: 3, venueId: 'MCG', winner: 'QLD' },
          ],
        }),
      ),
    ).toContain('the-comeback')
    expect(
      idsOf(
        series({
          seriesScore: { qld: 1, nsw: 1 },
          games: [
            { gameNumber: 1, venueId: 'SUNCORP', winner: 'QLD' },
            { gameNumber: 2, venueId: 'ACCOR_SYD', winner: 'NSW' },
            { gameNumber: 3, venueId: 'MCG', winner: 'DRAW' },
          ],
        }),
      ),
    ).toContain('held-the-line')
  })

  it('nothing series-shaped mints on Casual, and a lost series mints nothing', () => {
    expect(idsOf(series({ difficulty: 'casual' }))).toEqual([])
    expect(idsOf(series({ seriesWinner: 'NSW', seriesScore: { qld: 1, nsw: 2 } }))).toEqual([])
  })

  it("Wall Breaker needs the forwards variant; Seen 'Em All needs all three across the career", () => {
    expect(idsOf(series({ opponentId: 'forwards' }))).toContain('wall-breaker')
    const priorWins = (['classic', 'leftshift'] as const).map(
      (opp, i) =>
        ({
          rootSeed: i,
          seriesScore: { qld: 2, nsw: 1 },
          seriesWinner: 'QLD',
          retained: false,
          games: [],
          mvp: null,
          difficulty: 'origin',
          opponentId: opp,
        }) as LedgerEntry,
    )
    expect(idsOf(series({ opponentId: 'forwards' }, priorWins))).toContain('seen-em-all')
    expect(idsOf(series({ opponentId: 'forwards' }, priorWins.slice(0, 1)))).not.toContain('seen-em-all')
  })
})

describe('feats — match predicates', () => {
  it('Tryless, One Point In It, Demolition, Hat-Trick Hero (with the detail brag)', () => {
    expect(idsOf(match({ nswTries: 0 }))).toContain('tryless')
    expect(idsOf(match({ qld: 13, nsw: 12, qldFieldGoals: 1 }))).toContain('one-point-in-it')
    expect(idsOf(match({ qld: 13, nsw: 12 }))).not.toContain('one-point-in-it') // no field goal
    expect(idsOf(match({ qld: 44, nsw: 12 }))).toContain('demolition')
    const r = evaluateFeats(match({ heroTries: 3 }), EMPTY_FEATS_LEDGER, DATE)
    const hero = r.mints.find((m) => m.def.id === 'hat-trick-hero')
    expect(hero?.detail).toBe('Hammer — 3 tries')
  })

  it('No Recognised Halfback checks the 19 (fixture lineup has natural HBs only at HB/FE slots)', () => {
    // The default fixture puts CL-natural players everywhere, so no natural HB is on the sheet.
    expect(idsOf(match({}))).toContain('no-recognised-halfback')
    const lineup = defaultQldLineup()
    lineup.HB = { ...lineup.HB, naturalPositions: ['HB'] }
    expect(idsOf(match({ team: { side: 'QLD', lineup, kickerId: 'def-HB' } }))).not.toContain(
      'no-recognised-halfback',
    )
  })

  it('match feats do not mint on Casual or in a loss', () => {
    expect(idsOf(match({ nswTries: 0, difficulty: 'casual' }))).toEqual([])
    expect(idsOf(match({ qld: 0, nsw: 12, nswTries: 0 }))).toEqual([])
  })
})

describe('feats — daily predicates', () => {
  it('Cauldron Silencer on a hostile-cauldron win; Full Deck once every twist is beaten', () => {
    let ledger = EMPTY_DAILY_LEDGER
    ledger = recordDaily(ledger, dRec('2026-07-01', 'QLD', 'hostile-cauldron'))
    expect(idsOf(dailyCtx(ledger.results[0], ledger))).toContain('cauldron-silencer')

    DAILY_TWISTS.forEach((t, i) => {
      ledger = recordDaily(ledger, dRec(`2026-08-${String(i + 1).padStart(2, '0')}`, 'QLD', t.id))
    })
    const last = ledger.results[ledger.results.length - 1]
    expect(idsOf(dailyCtx(last, ledger))).toContain('full-deck')
  })

  it('Magnificent Seven needs a 7-day best streak', () => {
    let ledger = EMPTY_DAILY_LEDGER
    for (let d = 1; d <= 7; d++) ledger = recordDaily(ledger, dRec(`2026-07-0${d}`, 'QLD'))
    const last = ledger.results[6]
    expect(idsOf(dailyCtx(last, ledger))).toContain('magnificent-seven')
    expect(idsOf(dailyCtx(ledger.results[5], { ...ledger, results: ledger.results.slice(0, 6) }))).not.toContain(
      'magnificent-seven',
    )
  })
})

// ---- ledger mechanics ---------------------------------------------------------------------------

describe('feats — ledger mechanics', () => {
  it('one-shot feats mint once; repeatable feats tick the count with isFirst=false', () => {
    const first = evaluateFeats(series(), EMPTY_FEATS_LEDGER, DATE)
    expect(first.ledger.earned['queenslander']).toEqual({ first: DATE, count: 1 })
    const again = evaluateFeats(series(), first.ledger, '2026-08-01')
    expect(again.mints.map((m) => m.def.id)).not.toContain('queenslander')
    expect(again.ledger.earned['queenslander'].count).toBe(1)

    const t1 = evaluateFeats(match({ nswTries: 0 }), EMPTY_FEATS_LEDGER, DATE)
    const t2 = evaluateFeats(match({ nswTries: 0 }), t1.ledger, '2026-08-01')
    expect(t2.ledger.earned['tryless']).toMatchObject({ first: DATE, count: 2 })
    expect(t2.mints.find((m) => m.def.id === 'tryless')?.isFirst).toBe(false)
  })

  it('retroMint back-fills series + daily history but never stat-based match feats', () => {
    const career: CareerLedger = {
      schemaVersion: 2,
      entries: [
        {
          rootSeed: 1,
          seriesScore: { qld: 3, nsw: 0 },
          seriesWinner: 'QLD',
          retained: false,
          games: [
            { gameNumber: 1, venueId: 'SUNCORP', finalScore: { qld: 20, nsw: 10 }, winner: 'QLD' },
            { gameNumber: 2, venueId: 'ACCOR_SYD', finalScore: { qld: 20, nsw: 10 }, winner: 'QLD' },
            { gameNumber: 3, venueId: 'MCG', finalScore: { qld: 20, nsw: 10 }, winner: 'QLD' },
          ],
          mvp: null,
          // A v1-era entry: no difficulty, no opponentId — shape feats mint, gated feats stay honest.
        },
      ],
    }
    let daily = EMPTY_DAILY_LEDGER
    daily = recordDaily(daily, dRec('2026-07-01', 'QLD', 'hostile-cauldron'))
    const { ledger, minted } = retroMint(career, daily, EMPTY_FEATS_LEDGER, DATE)
    const ids = minted.map((m) => m.def.id)
    expect(ids).toEqual(expect.arrayContaining(['queenslander', 'the-sweep', 'road-warrior', 'cauldron-silencer']))
    expect(ids).not.toContain('hard-yards') // difficulty unknown on the v1 entry
    expect(ids).not.toContain('tryless') // stats were never archived
    expect(ledger.earned['cauldron-silencer'].first).toBe('2026-07-01') // daily earns keep their real date
  })

  it('share cards brag first earns only when there are any', () => {
    const state: SeriesState = {
      schemaVersion: 3,
      rootSeed: 1,
      opponentId: 'classic',
      currentGame: 3,
      seriesScore: { qld: 2, nsw: 1 },
      games: [],
      status: 'complete',
      seriesWinner: 'QLD',
      playerConditions: {},
    }
    expect(buildShareCard(state, null, ['The Immortals'])).toContain('🏅 First: The Immortals')
    expect(buildShareCard(state, null)).not.toContain('🏅')
    const rec = dRec('2026-07-06', 'QLD')
    const summary = summariseDaily(recordDaily(EMPTY_DAILY_LEDGER, rec), '2026-07-06')
    expect(buildDailyShareCard(rec, summary, ['Cauldron Silencer'])).toContain('🏅 First: Cauldron Silencer')
    expect(buildDailyShareCard(rec, summary)).not.toContain('🏅')
  })

  it('the coach-chase feats: Survived the Siege, Faith Rewarded, Silenced', () => {
    const base = series()
    if (base.kind !== 'series') throw new Error('unreachable')
    // Survived the Siege: the same won series, judged with the seat boiling vs calm.
    expect(idsOf({ ...base, coachPressure: 65 })).toContain('survived-the-siege')
    expect(idsOf({ ...base, coachPressure: 40 })).not.toContain('survived-the-siege')
    // Faith Rewarded: the MVP was one of the men the media put under fire.
    expect(idsOf({ ...base, mvpId: 'dce', underFireIds: ['dce', 'walsh'] })).toContain('faith-rewarded')
    expect(idsOf({ ...base, mvpId: 'ponga', underFireIds: ['dce'] })).not.toContain('faith-rewarded')
    // Silenced: a prior nemesis ran out again and was held under half his old damage.
    const career: CareerLedger = {
      schemaVersion: 2,
      entries: [
        {
          rootSeed: 5,
          seriesScore: { qld: 1, nsw: 2 },
          seriesWinner: 'NSW',
          retained: false,
          games: [],
          mvp: null,
          nemesis: { id: 'x', name: 'Latrell Mitchell', tries: 4, lineBreaks: 2, damage: 40 },
        },
      ],
    }
    const silencedCtx: FeatContext = {
      ...base,
      career,
      nswNames: ['Latrell Mitchell', 'Someone Else'],
      completed: { ...base.completed, nswDamage: { 'nsw-cl': { name: 'Latrell Mitchell', tries: 1, lineBreaks: 0, damage: 12 } } },
    }
    const mints = evaluateFeats(silencedCtx, EMPTY_FEATS_LEDGER, DATE).mints
    const silenced = mints.find((m) => m.def.id === 'silenced')
    expect(silenced?.detail).toContain('held to 12 (was 40)')
    // He wasn't in the drawn sheet → no grudge to settle; big damage again → not silenced either.
    expect(idsOf({ ...silencedCtx, nswNames: ['Someone Else'] })).not.toContain('silenced')
    expect(
      idsOf({
        ...silencedCtx,
        completed: { ...base.completed, nswDamage: { 'nsw-cl': { name: 'Latrell Mitchell', tries: 3, lineBreaks: 2, damage: 32 } } },
      }),
    ).not.toContain('silenced')
  })

  it('every feat id is unique and every hint/flavour is non-empty', () => {
    expect(new Set(FEATS.map((f) => f.id)).size).toBe(FEATS.length)
    for (const f of FEATS) {
      expect(f.name.length).toBeGreaterThan(0)
      expect(f.flavour.length).toBeGreaterThan(0)
      expect(f.hint.length).toBeGreaterThan(0)
    }
    expect(featById('the-immortals')?.name).toBe('The Immortals')
  })
})
