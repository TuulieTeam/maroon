import { QLD_SQUAD } from '../data/qldSquad'
import { NSW_LINEUP } from '../data/nswSquad'
import { STARTING_FORM, STARTING_INJURY } from '../data/startingForm'
import type { Position } from '../data/types'
import type { MatchEvent, MatchStats, Score, Side } from '../engine'
import { advanceConditions, extractCarryover, initConditions } from './conditions'
import { gameSeed } from './seed'
import type { GameNo, SeriesGameRecord, SeriesState } from './types'
import { SERIES_SCHEDULE } from './venues'

type Winner = Side | 'DRAW'

/** Every player whose condition the series tracks — the QLD pool plus the fixed NSW 21. */
const ALL_PLAYERS = [...QLD_SQUAD, ...Object.values(NSW_LINEUP)]

/** A finished game's inputs, ready to fold into the series. Lineup is player IDs, not Player objects. */
export interface PlayedGame {
  qldLineup: Record<Position, string>
  qldKickerId: string
  finalScore: Score
  winner: Winner
  /** The finished match's event stream + per-player stats — consumed transiently (NOT persisted) to
   *  advance form/injury between games. */
  events: MatchEvent[]
  stats: MatchStats
}

/** A fresh series, parked on game 1, scoreless, with conditions seeded from the real-world form notes. */
export function initSeries(rootSeed: number): SeriesState {
  return {
    schemaVersion: 2,
    rootSeed: rootSeed >>> 0,
    currentGame: 1,
    seriesScore: { qld: 0, nsw: 0 },
    games: [],
    status: 'in-progress',
    playerConditions: initConditions(ALL_PLAYERS, STARTING_FORM, STARTING_INJURY),
  }
}

/**
 * Fold a completed game into the series: append an immutable record, recount the series score from
 * every winner, set the shield holder by the two-win rule (drawn series → QLD retains), and advance
 * the cursor or close the series after game 3. Pure — never mutates `state`. A no-op once complete.
 */
export function applyGameResult(state: SeriesState, played: PlayedGame): SeriesState {
  if (state.status === 'complete') return state
  const game = state.currentGame
  const record: SeriesGameRecord = {
    gameNumber: game,
    venueId: SERIES_SCHEDULE[game],
    seed: gameSeed(state.rootSeed, game),
    qldLineup: { ...played.qldLineup },
    qldKickerId: played.qldKickerId,
    finalScore: { ...played.finalScore },
    winner: played.winner,
  }
  const games = [...state.games, record]
  const seriesScore = tallyWins(games)
  const playedAll = game === 3
  const status: SeriesState['status'] = playedAll ? 'complete' : 'in-progress'
  const seriesWinner = resolveShield(seriesScore, status)
  const nextGame: GameNo = playedAll ? 3 : ((game + 1) as GameNo)
  // The club round runs only when there's a next game to play — fold this game's performance + any
  // injuries into every player's form/injury for the upcoming match.
  const playerConditions = playedAll
    ? state.playerConditions
    : advanceConditions(state.playerConditions, {
        rootSeed: state.rootSeed,
        nextGameNumber: nextGame,
        players: ALL_PLAYERS,
        lines: played.stats.players,
        carryover: extractCarryover(played.events),
      })
  return {
    ...state,
    games,
    seriesScore,
    currentGame: nextGame,
    status,
    playerConditions,
    ...(seriesWinner ? { seriesWinner } : {}),
  }
}

/**
 * Close out a series early — used when the player skips a dead rubber (shield already decided). Only
 * acts when a side has clinched (two wins); otherwise the game is live and cannot be skipped, so the
 * state is returned unchanged.
 */
export function concludeSeries(state: SeriesState): SeriesState {
  if (state.status === 'complete') return state
  if (state.seriesScore.qld < 2 && state.seriesScore.nsw < 2) return state
  return {
    ...state,
    status: 'complete',
    seriesWinner: state.seriesScore.qld >= 2 ? 'QLD' : 'NSW',
  }
}

function tallyWins(games: SeriesGameRecord[]): Score {
  return games.reduce<Score>(
    (acc, g) => ({
      qld: acc.qld + (g.winner === 'QLD' ? 1 : 0),
      nsw: acc.nsw + (g.winner === 'NSW' ? 1 : 0),
    }),
    { qld: 0, nsw: 0 },
  )
}

function resolveShield(score: Score, status: SeriesState['status']): Side | undefined {
  if (score.qld >= 2) return 'QLD'
  if (score.nsw >= 2) return 'NSW'
  if (status === 'complete') return 'QLD' // drawn series — incumbent QLD retains the shield
  return undefined
}
