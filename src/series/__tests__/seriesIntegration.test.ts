import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../../engine'
import type { MatchSetup, SelectedTeam } from '../../engine'
import { POSITION_META, POSITION_ORDER } from '../../data/positions'
import type { Player, PlayerRole, Position } from '../../data/types'
import { QLD_SQUAD } from '../../data/qldSquad'
import { NSW_KICKER_ID, NSW_LINEUP } from '../../data/nswSquad'
import { buildAutoLineup } from '../../data/autoSelect'
import { applyGameResult, initSeries } from '../seriesReducer'
import { buildSeriesContext } from '../buildContext'
import { gameSeed } from '../seed'
import type { GameNo } from '../types'
import { conditionFormDelta, extractCarryover, isAvailable, originPerformanceDelta, reinjuryMult } from '../conditions'
import type { ConditionMap, SeriesState } from '../types'

// This is the one test that pipes REAL simulateMatch output through the series machinery
// (applyGameResult -> extractCarryover + advanceConditions) and back into simulateMatch. The unit tests
// for the reducer/conditions use synthetic events:[]/stats:{} — so nothing else pins the engine<->series
// contract (the event shapes extractCarryover reads, the PlayerStatLine fields performanceScore consumes).
// A field rename in the engine would silently break carryover with all those unit tests still green; here
// it surfaces as a NaN delta or an all-zero score.

const ALL_PLAYERS: Player[] = [...QLD_SQUAD, ...Object.values(NSW_LINEUP)]

function roleOf(id: string): PlayerRole {
  const p = ALL_PLAYERS.find((x) => x.id === id)
  return p ? POSITION_META[p.naturalPositions[0]].role : 'forward'
}

function nswTeam(): SelectedTeam {
  return { side: 'NSW', lineup: { ...NSW_LINEUP }, kickerId: NSW_KICKER_ID }
}

/** Build a real, form-aware QLD XVII from the live squad — exactly as the selection screen would. */
function buildQld(conditions: ConditionMap): SelectedTeam {
  const formDelta = (id: string): number => {
    const c = conditions[id]
    return c ? conditionFormDelta(c) : 0
  }
  const available = QLD_SQUAD.filter((p) => isAvailable(conditions[p.id]))
  const auto = buildAutoLineup(available, formDelta)
  const lineup = {} as Record<Position, Player>
  for (const pos of POSITION_ORDER) {
    const id = auto[pos]
    const player = id ? QLD_SQUAD.find((p) => p.id === id) : undefined
    if (!player) throw new Error(`auto lineup missing a player for ${pos}`)
    lineup[pos] = player
  }
  const kicker = Object.values(lineup).reduce((best, p) => (p.goalKicking > best.goalKicking ? p : best))
  return { side: 'QLD', lineup, kickerId: kicker.id }
}

function lineupIds(team: SelectedTeam): Record<Position, string> {
  return Object.fromEntries(POSITION_ORDER.map((pos) => [pos, team.lineup[pos].id])) as Record<Position, string>
}

/** The engine-boundary maps App builds at kickoff: condition -> signed form delta + re-injury mult. */
function deltas(conditions: ConditionMap): { form: Record<string, number>; reinjury: Record<string, number> } {
  const form: Record<string, number> = {}
  const reinjury: Record<string, number> = {}
  for (const [id, cond] of Object.entries(conditions)) {
    const d = conditionFormDelta(cond)
    if (d !== 0) form[id] = d
    const m = reinjuryMult(cond)
    if (m !== 1) reinjury[id] = m
  }
  return { form, reinjury }
}

interface SeriesRun {
  state: SeriesState
  /** Size of the form map fed to the engine, per game (index 0 = game 1). */
  formMapSizes: number[]
  sawNaN: boolean
  sawOriginDelta: boolean
}

/** Play a full real 3-game series exactly as App would: select -> simulate -> fold -> repeat. */
function playFullSeries(rootSeed: number): SeriesRun {
  let state = initSeries(rootSeed)
  const formMapSizes: number[] = []
  let sawOriginDelta = false
  let sawNaN = false

  for (let g = 1; g <= 3; g++) {
    const game = g as GameNo
    expect(state.currentGame).toBe(game)
    const { form, reinjury } = deltas(state.playerConditions)
    formMapSizes.push(Object.keys(form).length)

    const qld = buildQld(state.playerConditions)
    const setup: MatchSetup = { qld, nsw: nswTeam(), series: buildSeriesContext(state), form, reinjury }
    const result = simulateMatch(setup, gameSeed(state.rootSeed, game))

    // valid match output
    expect(['QLD', 'NSW', 'DRAW']).toContain(result.winner)
    expect(Number.isFinite(result.finalScore.qld)).toBe(true)
    expect(Number.isFinite(result.finalScore.nsw)).toBe(true)

    // pin the contract: performanceScore/originPerformanceDelta must read the real PlayerStatLine
    // fields off live stats — a renamed field shows up as NaN, a broken score as all-zero.
    for (const line of Object.values(result.stats.players)) {
      const d = originPerformanceDelta(line, roleOf(line.id))
      if (Number.isNaN(d)) sawNaN = true
      if (d !== 0) sawOriginDelta = true
    }
    // extractCarryover must consume the real event stream without throwing
    expect(() => extractCarryover(result.events)).not.toThrow()

    state = applyGameResult(state, {
      qldLineup: lineupIds(qld),
      qldKickerId: qld.kickerId,
      finalScore: result.finalScore,
      winner: result.winner,
      events: result.events,
      stats: result.stats,
    })
  }

  return { state, formMapSizes, sawNaN, sawOriginDelta }
}

describe('series integration — real match output round-trips through the series machinery', () => {
  it('runs a full 3-game series end to end with the engine↔series contract intact', () => {
    const { state, formMapSizes, sawNaN, sawOriginDelta } = playFullSeries(20260616)

    // series closed out and tallied from the immutable winners
    expect(state.status).toBe('complete')
    expect(state.games).toHaveLength(3)
    const decisive = state.games.filter((x) => x.winner !== 'DRAW').length
    expect(state.seriesScore.qld + state.seriesScore.nsw).toBe(decisive)
    expect(state.seriesWinner).toBeDefined()

    // the stat contract actually exercised real numbers (not NaN, and some players moved the needle)
    expect(sawNaN).toBe(false)
    expect(sawOriginDelta).toBe(true)
    // carried form reaches the engine: by game 2+ conditions have diverged from neutral
    expect(formMapSizes[1]).toBeGreaterThan(0)
  })

  it('replays a fixed rootSeed to a byte-identical series — scores, winners and final conditions', () => {
    const a = playFullSeries(20260616)
    const b = playFullSeries(20260616)
    // the whole real pipeline (select -> simulate -> carryover -> advance) is deterministic, so the
    // immutable game tally AND the evolved player conditions must reproduce exactly.
    expect(b.state.games).toEqual(a.state.games)
    expect(b.state.seriesScore).toEqual(a.state.seriesScore)
    expect(b.state.seriesWinner).toBe(a.state.seriesWinner)
    expect(b.state.playerConditions).toEqual(a.state.playerConditions)
  })

  it('a played game advances real form for the squad (the club round swings nearly everyone)', () => {
    let state = initSeries(987654)
    const before = state.playerConditions
    const qld = buildQld(state.playerConditions)
    const { form, reinjury } = deltas(state.playerConditions)
    const result = simulateMatch(
      { qld, nsw: nswTeam(), series: buildSeriesContext(state), form, reinjury },
      gameSeed(state.rootSeed, 1),
    )
    state = applyGameResult(state, {
      qldLineup: lineupIds(qld),
      qldKickerId: qld.kickerId,
      finalScore: result.finalScore,
      winner: result.winner,
      events: result.events,
      stats: result.stats,
    })
    const after = state.playerConditions

    let changed = 0
    for (const id of Object.keys(before)) {
      if (Math.abs(after[id].form - before[id].form) > 0.01) changed++
    }
    expect(changed).toBeGreaterThan(30) // the seeded club swing moves essentially every player's form
    expect(state.currentGame).toBe(2)
  })
})
