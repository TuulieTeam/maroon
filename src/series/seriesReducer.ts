import { QLD_SQUAD } from '../data/qldSquad'
import { bluesById, bluesForSeed } from '../data/bluesVariants'
import { STARTING_FORM, STARTING_INJURY } from '../data/startingForm'
import type { Player, Position } from '../data/types'
import type { IconicMoment, MatchEvent, MatchStats, Score, Side } from '../engine'
import { advanceConditions, extractCarryover, initConditions } from './conditions'
import { foldNswDamage } from './nemesis'
import type { Difficulty } from './difficulty'
import { gameSeed } from './seed'
import type { GameNo, SeriesGameRecord, SeriesState } from './types'
import { SERIES_SCHEDULE } from './venues'

type Winner = Side | 'DRAW'

/** Every player whose condition a series tracks — the QLD pool plus the drawn NSW side's 21.
 *  The pool is a parameter so a dynasty year's RESOLVED roster flows through; it defaults to the
 *  base 2026 squad, keeping every existing caller byte-identical. */
function allPlayersFor(opponentId: string, qldPool: Player[] = QLD_SQUAD): Player[] {
  return [...qldPool, ...Object.values(bluesById(opponentId).lineup)]
}

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
  /** The match's crowned play — an NSW-side moment feeds the nemesis tally (+bonus damage). */
  iconicMoment?: IconicMoment
}

/** A fresh series, parked on game 1, scoreless, with conditions seeded from the real-world form notes.
 *  The Blues opponent is drawn deterministically from the seed and fixed for the whole series; the
 *  difficulty (adjustable until game 1 kicks off) defaults to Origin.
 *
 *  `qldPool` lets a dynasty year pass its resolved roster; `neutralStart` skips the authored 2026
 *  form/injury tables (they are facts about THIS season — a 2029 campaign starts everyone level and
 *  lets the club rounds swing it). Defaults preserve the standalone behaviour byte-for-byte. */
export function initSeries(
  rootSeed: number,
  difficulty: Difficulty = 'origin',
  qldPool: Player[] = QLD_SQUAD,
  neutralStart = false,
): SeriesState {
  const opponentId = bluesForSeed(rootSeed).id
  const players = allPlayersFor(opponentId, qldPool)
  return {
    schemaVersion: 3,
    rootSeed: rootSeed >>> 0,
    opponentId,
    difficulty,
    currentGame: 1,
    seriesScore: { qld: 0, nsw: 0 },
    games: [],
    status: 'in-progress',
    playerConditions: neutralStart
      ? initConditions(players, {}, {})
      : initConditions(players, STARTING_FORM, STARTING_INJURY),
  }
}

/**
 * Fold a completed game into the series: append an immutable record, recount the series score from
 * every winner, set the shield holder by the two-win rule (drawn series → QLD retains), and advance
 * the cursor or close the series after game 3. Pure — never mutates `state`. A no-op once complete.
 */
export function applyGameResult(state: SeriesState, played: PlayedGame, qldPool: Player[] = QLD_SQUAD): SeriesState {
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
        players: allPlayersFor(state.opponentId, qldPool),
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
    // The nemesis tally — who is hurting you, accumulating toward the series-end crowning.
    nswDamage: foldNswDamage(state.nswDamage, played.stats, played.iconicMoment),
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
