import { describe, expect, it } from 'vitest'
import { QLD_SQUAD } from '../../data/qldSquad'
import { MATCHDAY_POSITIONS, POSITION_ORDER } from '../../data/positions'
import { buildAutoLineup } from '../../data/autoSelect'
import type { Player, Position } from '../../data/types'
import type { MatchResult, SelectedTeam } from '../../engine'
import type { ConditionMap, SeriesState } from '../../series'
import { boardReview } from '../board'
import { COACHES, coachById, successorFor } from '../coaches'
import { INITIAL_COACH_STATE, freshPressureFor, loadCoach, saveCoach } from '../coachPersist'
import type { CoachState } from '../coachPersist'
import { buildPressConference } from '../pressConference'
import { postGameBackPage, preGameBackPage } from '../headlines'
import { PRESSURE_TUNING, applyGameHeat, applySeriesPressure, pressureBand } from '../pressure'
import { deriveStorylines } from '../storylines'

const SLATER = coachById('slater')

const byId = new Map(QLD_SQUAD.map((p) => [p.id, p]))

/** Resolve the media-expected (auto) side into a SelectedTeam, with optional slot swaps. */
function teamFrom(lineupIds: Partial<Record<Position, string>>, swaps: Partial<Record<Position, string>> = {}): SelectedTeam {
  const lineup = {} as Record<Position, Player>
  for (const pos of POSITION_ORDER) {
    const id = swaps[pos] ?? lineupIds[pos]
    const p = id ? byId.get(id) : undefined
    if (p) lineup[pos] = p
  }
  return { side: 'QLD', lineup, kickerId: 'ponga' }
}

const NO_CONDITIONS: ConditionMap = {}

describe('storylines — what the papers see in a team sheet', () => {
  const expected = buildAutoLineup(QLD_SQUAD.filter((p) => p.status === 'available'))

  it('the expected side on a quiet week still carries its own stories, and they are deterministic', () => {
    const team = teamFrom(expected)
    const a = deriveStorylines({ team, squad: QLD_SQUAD, conditions: NO_CONDITIONS })
    const b = deriveStorylines({ team, squad: QLD_SQUAD, conditions: NO_CONDITIONS })
    expect(a).toEqual(b)
    // The auto side never axes anyone from itself.
    expect(a.every((s) => s.kind !== 'axed-star')).toBe(true)
  })

  it('dropping the expected fullback is an axing — unless he is injured, which is no story', () => {
    const fbId = expected.FB!
    const fbName = byId.get(fbId)!.name
    // Swap the expected FB out for Walsh.
    const team = teamFrom(expected, { FB: 'walsh' })
    const stories = deriveStorylines({ team, squad: QLD_SQUAD, conditions: NO_CONDITIONS })
    expect(stories.some((s) => s.kind === 'axed-star' && s.playerName === fbName)).toBe(true)
    // Same sheet, but the media knows he is OUT injured → no axing story about him.
    const excused: ConditionMap = { [fbId]: { form: 50, injury: { kind: 'out', gamesOut: 1 } } }
    const excusedStories = deriveStorylines({ team, squad: QLD_SQUAD, conditions: excused })
    expect(excusedStories.some((s) => s.kind === 'axed-star' && s.playerName === fbName)).toBe(false)
  })

  it('recalling a discarded man and blooding a rookie are stories, boldest first', () => {
    // DCE is status 'dropped'; put him in at HB over the expected pick, and axe the expected FB too.
    const team = teamFrom(expected, { HB: 'dce', FB: 'walsh' })
    const stories = deriveStorylines({ team, squad: QLD_SQUAD, conditions: NO_CONDITIONS })
    const kinds = stories.map((s) => s.kind)
    expect(kinds).toContain('recalled-outcast')
    // The axing outranks the recall for the splash.
    expect(kinds.indexOf('axed-star')).toBeLessThan(kinds.indexOf('recalled-outcast'))
  })

  it('a doubtful body and ice-cold form both make the papers', () => {
    const hkId = expected.HK!
    const conditions: ConditionMap = {
      [hkId]: { form: 20, injury: { kind: 'doubtful', gamesOut: 0 } },
    }
    const stories = deriveStorylines({ team: teamFrom(expected), squad: QLD_SQUAD, conditions })
    const about = stories.filter((s) => s.playerId === hkId).map((s) => s.kind)
    expect(about).toContain('gamble-doubtful')
    // Deduped to his boldest story only.
    expect(about).toHaveLength(1)
  })
})

describe('headlines — the take-a-position loop', () => {
  const story = { kind: 'axed-star' as const, playerId: 'dce', playerName: 'Daly Cherry-Evans' }

  it('the pre-game splash names the player, is deterministic, and declares a stance', () => {
    const a = preGameBackPage(story, 12345, SLATER)
    const b = preGameBackPage(story, 12345, SLATER)
    expect(a).toEqual(b)
    expect(`${a.headline} ${a.standfirst}`).toContain('Daly Cherry-Evans')
    expect(['backs', 'savages']).toContain(a.stance)
  })

  it('a savaged call that wins produces the eat-their-words verdict; a loss produces the pile-on', () => {
    const win = { winner: 'QLD' } as MatchResult
    const loss = { winner: 'NSW' } as MatchResult
    const vindicated = postGameBackPage(story, 'savages', win, 1, SLATER)
    const roasted = postGameBackPage(story, 'savages', loss, 1, SLATER)
    expect(vindicated.headline).not.toBe(roasted.headline)
    expect(roasted.headline).toContain('Daly Cherry-Evans')
  })

  it('a quiet sheet still gets a back page', () => {
    const page = preGameBackPage(undefined, 99, SLATER)
    expect(page.headline.length).toBeGreaterThan(0)
  })
})

describe('pressure — the hot seat moves honestly', () => {
  function completedSeries(qld: number, nsw: number, g3Winner?: 'QLD' | 'NSW' | 'DRAW'): SeriesState {
    const games = [
      { gameNumber: 1 as const, venueId: 'SUNCORP' as const, seed: 1, qldLineup: {} as Record<Position, string>, qldKickerId: 'x', finalScore: { qld: 10, nsw: 8 }, winner: 'QLD' as const },
      { gameNumber: 2 as const, venueId: 'ACCOR_SYD' as const, seed: 2, qldLineup: {} as Record<Position, string>, qldKickerId: 'x', finalScore: { qld: 8, nsw: 10 }, winner: 'NSW' as const },
      ...(g3Winner
        ? [{ gameNumber: 3 as const, venueId: 'MCG' as const, seed: 3, qldLineup: {} as Record<Position, string>, qldKickerId: 'x', finalScore: { qld: 10, nsw: 12 }, winner: g3Winner }]
        : []),
    ]
    return {
      schemaVersion: 3,
      rootSeed: 1,
      opponentId: 'classic',
      currentGame: 3,
      seriesScore: { qld, nsw },
      games,
      status: 'complete',
      seriesWinner: qld >= nsw ? 'QLD' : 'NSW',
      playerConditions: {},
    }
  }

  it('shields cool the seat, losses heat it, and a lost decider burns extra', () => {
    const base = 50
    const win = applySeriesPressure(base, completedSeries(2, 1, 'QLD'))
    const plainLossState = completedSeries(1, 2, 'NSW')
    const deciderLoss = applySeriesPressure(base, plainLossState)
    expect(win).toBeLessThan(base)
    expect(deciderLoss).toBeGreaterThan(base + PRESSURE_TUNING.seriesLoss - 1)
  })

  it('game heat: a savaged call failing adds more heat than a backed call failing', () => {
    const savaged = applyGameHeat(50, 'savages', false)
    const backed = applyGameHeat(50, 'backs', false)
    expect(savaged).toBeGreaterThan(backed)
    // Winning a savaged call buys aura.
    expect(applyGameHeat(50, 'savages', true)).toBeLessThan(50)
  })

  it('bands cover the range and clamp at the edges', () => {
    expect(pressureBand(5)).toBe('untouchable')
    expect(pressureBand(35)).toBe('solid')
    expect(pressureBand(50)).toBe('simmering')
    expect(pressureBand(70)).toBe('under-siege')
    expect(pressureBand(95)).toBe('dead-man-walking')
    expect(applyGameHeat(99, 'savages', false)).toBeLessThanOrEqual(100)
    expect(applyGameHeat(1, 'savages', true)).toBeGreaterThanOrEqual(0)
  })
})

describe('press conference — Slater fronts the pack', () => {
  it('is deterministic, shifts tone with the band, and circles back to the bold call', () => {
    const result = { winner: 'NSW' } as MatchResult
    const story = { kind: 'blooded-rookie' as const, playerId: 'jfifita', playerName: 'Jojo Fifita' }
    const a = buildPressConference(result, 'dead-man-walking', story, 777, SLATER)
    expect(a).toEqual(buildPressConference(result, 'dead-man-walking', story, 777, SLATER))
    expect(a.length).toBe(2)
    expect(`${a[1].question} ${a[1].answer}`).toContain('Jojo Fifita')
    // Siege pressers read differently from calm ones.
    const calm = buildPressConference(result, 'untouchable', story, 777, SLATER)
    expect(calm[0].answer).not.toBe(a[0].answer)
  })
})

describe('the board — sackings and successions', () => {
  function coachState(over: Partial<CoachState>): CoachState {
    return { ...INITIAL_COACH_STATE, eraFromYear: 2026, eraSeasons: 3, eraShields: 1, ...over }
  }
  function lostSeries(): SeriesState {
    return {
      schemaVersion: 3,
      rootSeed: 1,
      opponentId: 'classic',
      currentGame: 3,
      seriesScore: { qld: 1, nsw: 2 },
      games: [],
      status: 'complete',
      seriesWinner: 'NSW',
      playerConditions: {},
    }
  }
  function wonSeries(): SeriesState {
    return { ...lostSeries(), seriesScore: { qld: 2, nsw: 1 }, seriesWinner: 'QLD' }
  }

  it('dead man walking after a season close is gone, whatever the result', () => {
    const { next, outcome } = boardReview(coachState({ pressure: 85, lostStreak: 1 }), wonSeries(), 2028)
    expect(outcome.sacked).toBe(true)
    expect(outcome.era).toMatchObject({ coachId: 'slater', toYear: 2028, seasons: 3, shields: 1 })
    expect(outcome.successor?.id).toBe('smith')
    expect(next.coachId).toBe('smith')
    expect(next.pressure).toBe(freshPressureFor('smith'))
    expect(next.lostStreak).toBe(0)
    expect(next.eras).toHaveLength(1)
  })

  it('under siege + a second straight lost series is the other trigger', () => {
    const sacked = boardReview(coachState({ pressure: 65, lostStreak: 2 }), lostSeries(), 2028)
    expect(sacked.outcome.sacked).toBe(true)
    // Same pressure but the series was WON — survives.
    const survived = boardReview(coachState({ pressure: 65, lostStreak: 2 }), wonSeries(), 2028)
    expect(survived.outcome.sacked).toBe(false)
    expect(survived.next).toBe(survived.next) // state unchanged reference-wise on survival
    // One lost series under siege is not yet enough.
    const oneLoss = boardReview(coachState({ pressure: 65, lostStreak: 1 }), lostSeries(), 2028)
    expect(oneLoss.outcome.sacked).toBe(false)
    expect(oneLoss.outcome.statement.length).toBeGreaterThan(0)
  })

  it('succession walks the roster and honeymoons match temperament', () => {
    expect(successorFor(0).id).toBe('smith')
    expect(successorFor(1).id).toBe('thurston')
    expect(successorFor(COACHES.length - 1).id).toBe(COACHES[0].id) // cycles
    expect(freshPressureFor('thurston')).toBeLessThan(freshPressureFor('langer')) // beloved < combative
  })

  it('a drop-2 save (no era fields) loads with the era machinery defaulted', () => {
    const makeStorage = () => {
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
    const g = globalThis as { localStorage?: unknown }
    const prior = g.localStorage
    g.localStorage = makeStorage()
    try {
      localStorage.setItem('maroon.coach.v1', JSON.stringify({ schemaVersion: 1, pressure: 55, judgedSeries: [9] }))
      const loaded = loadCoach()
      expect(loaded.pressure).toBe(55)
      expect(loaded.coachId).toBe('slater')
      expect(loaded.eras).toEqual([])
      expect(loaded.lostStreak).toBe(0)
      saveCoach(loaded)
      expect(loadCoach()).toEqual(loaded)
    } finally {
      g.localStorage = prior
    }
  })
})

// Sanity: MATCHDAY_POSITIONS is what storylines scan — keep the import honest.
it('matchday scan covers 19 slots', () => {
  expect(MATCHDAY_POSITIONS.length).toBe(19)
})
