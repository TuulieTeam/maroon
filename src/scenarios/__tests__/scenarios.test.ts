import { describe, expect, it } from 'vitest'
import { BLUES_IDS } from '../../data/bluesVariants'
import { buildAutoLineup } from '../../data/autoSelect'
import { MATCHDAY_POSITIONS, RESERVE_POSITIONS } from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import { simulateMatch } from '../../engine'
import { evaluateFeats } from '../../feats/evaluate'
import { EMPTY_FEATS_LEDGER } from '../../feats/types'
import { SCENARIOS, scenarioById } from '../catalog'
import { buildScenarioSetup, scenarioChallenge } from '../challenge'
import { recordScenarioRun, scenariosDone } from '../scenarioLedger'
import { buildScenarioShareCard } from '../shareCard'
import { EMPTY_SCENARIO_LEDGER } from '../types'
import type { ScenarioLedger } from '../types'
import { referenceTeam } from './helpers'

describe('scenario catalog — integrity', () => {
  it('ids are unique and every opponent/venue is a real one', () => {
    const ids = new Set(SCENARIOS.map((s) => s.id))
    expect(ids.size).toBe(SCENARIOS.length)
    for (const s of SCENARIOS) {
      expect(BLUES_IDS, `${s.id} opponent`).toContain(s.opponentId)
      expect(['SUNCORP', 'ACCOR_SYD', 'MCG'], `${s.id} venue`).toContain(s.venueId)
    }
  })

  it('every scenario leaves a full, valid 19 + 2 pickable after its constraint', () => {
    for (const s of SCENARIOS) {
      const out = new Set(s.constraint?.ruledOut?.(QLD_SQUAD) ?? [])
      const remaining = QLD_SQUAD.filter((p) => !out.has(p.id))
      const lineup = buildAutoLineup(remaining)
      for (const pos of [...MATCHDAY_POSITIONS, ...RESERVE_POSITIONS]) {
        expect(lineup[pos], `scenario "${s.id}" cannot fill ${pos}`).toBeTruthy()
      }
    }
  })

  it('WINNABILITY: the reference side meets every win condition on its pinned seed', () => {
    // The load-bearing guard. A scenario whose pinned match can't be won by a solid,
    // position-correct side CANNOT ship — retune the seed in catalog.ts if this ever trips
    // (e.g. after an engine balance change).
    for (const def of SCENARIOS) {
      const team = referenceTeam(def)
      const result = simulateMatch(buildScenarioSetup(def, team), def.seed)
      expect(
        def.winCondition(result, team),
        `"${def.id}" is not winnable on its pinned seed (${def.seed}) — final ${result.finalScore.qld}-${result.finalScore.nsw}`,
      ).not.toBe(false)
    }
  })

  it('pinned means pinned: the same scenario replays byte-identically', () => {
    const def = scenarioById('neville-nobodies')!
    const team = referenceTeam(def)
    const a = simulateMatch(buildScenarioSetup(def, team), def.seed)
    const b = simulateMatch(buildScenarioSetup(def, team), def.seed)
    expect(b.finalScore).toEqual(a.finalScore)
    expect(b.events.map((e) => e.commentary)).toEqual(a.events.map((e) => e.commentary))
  })

  it('the challenge adapter carries the constraint into the daily picker shape', () => {
    const def = scenarioById('neville-nobodies')!
    const c = scenarioChallenge(def)
    expect(c.seed).toBe(def.seed)
    expect(c.opponent.id).toBe(def.opponentId)
    expect(c.venue.id).toBe(def.venueId)
    expect(c.twist.nswFormDelta).toBe(def.constraint?.nswFormDelta)
    expect(new Set(c.twist.ruledOut!(QLD_SQUAD)).size).toBe(4)
  })

  it('constraints bite through the engine: the career-best Blues tilt the pinned match', () => {
    const def = scenarioById('immortal-territory')!
    const team = referenceTeam(def)
    const flat = { ...def, constraint: undefined }
    let tilted = 0
    let neutral = 0
    for (let seed = 1; seed <= 30; seed++) {
      tilted += simulateMatch(buildScenarioSetup(def, team), seed).finalScore.nsw
      neutral += simulateMatch(buildScenarioSetup(flat, team), seed).finalScore.nsw
    }
    expect(tilted).toBeGreaterThan(neutral)
  })
})

describe('scenario ledger', () => {
  it('attempts always tick; the conquest is write-once', () => {
    let l: ScenarioLedger = EMPTY_SCENARIO_LEDGER
    l = recordScenarioRun(l, 'first-stand', false, '2026-07-01')
    expect(l.entries['first-stand']).toEqual({ attempts: 1 })
    l = recordScenarioRun(l, 'first-stand', true, '2026-07-02', 'Won by 8')
    expect(l.entries['first-stand']).toEqual({ attempts: 2, firstDone: '2026-07-02', bestDetail: 'Won by 8' })
    // A later, flashier conquest can't rewrite the first date.
    l = recordScenarioRun(l, 'first-stand', true, '2026-07-09', 'Won by 40')
    expect(l.entries['first-stand'].firstDone).toBe('2026-07-02')
    expect(l.entries['first-stand'].bestDetail).toBe('Won by 8')
    expect(l.entries['first-stand'].attempts).toBe(3)
    expect(scenariosDone(l)).toBe(1)
  })
})

describe('scenario feats', () => {
  const ctx = (passed: boolean, ledger: ScenarioLedger) => ({
    kind: 'scenario' as const,
    scenarioId: 'first-stand',
    passed,
    ledger,
  })

  it('Off the Script mints on the first conquest, not on a failed run', () => {
    const fail = evaluateFeats(ctx(false, EMPTY_SCENARIO_LEDGER), EMPTY_FEATS_LEDGER, '2026-07-01')
    expect(fail.mints.map((m) => m.def.id)).not.toContain('off-the-script')
    const win = evaluateFeats(ctx(true, EMPTY_SCENARIO_LEDGER), EMPTY_FEATS_LEDGER, '2026-07-01')
    expect(win.mints.map((m) => m.def.id)).toContain('off-the-script')
  })

  it('The Historian needs every scenario conquered', () => {
    let almost: ScenarioLedger = EMPTY_SCENARIO_LEDGER
    for (const s of SCENARIOS.slice(0, -1)) almost = recordScenarioRun(almost, s.id, true, '2026-07-01')
    const not = evaluateFeats(ctx(true, almost), EMPTY_FEATS_LEDGER, '2026-07-01')
    expect(not.mints.map((m) => m.def.id)).not.toContain('the-historian')

    const all = recordScenarioRun(almost, SCENARIOS.at(-1)!.id, true, '2026-07-02')
    const done = evaluateFeats(ctx(true, all), EMPTY_FEATS_LEDGER, '2026-07-02')
    expect(done.mints.map((m) => m.def.id)).toContain('the-historian')
  })
})

describe('scenario share card', () => {
  it('brags the pass and admits the miss', () => {
    const def = scenarioById('the-shutout')!
    const passed = buildScenarioShareCard(def, { qld: 20, nsw: 4 }, 'QLD', true, 'Not one try conceded')
    expect(passed).toContain('✅')
    expect(passed).toContain(def.title)
    expect(passed).toContain('Not one try conceded')
    const missed = buildScenarioShareCard(def, { qld: 20, nsw: 16 }, 'QLD', false)
    expect(missed).toContain('❌')
  })
})
