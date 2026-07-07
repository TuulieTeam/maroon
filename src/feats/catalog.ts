import { MATCHDAY_POSITIONS } from '../data/positions'
import { DAILY_TWISTS } from '../daily'
import { SCENARIOS } from '../scenarios/catalog'
import { scenariosDone } from '../scenarios/scenarioLedger'
import type { FeatContext, FeatDef } from './types'

/**
 * The launch catalog — 18 trophies spread across series shape, the difficulty chase, the Blues
 * variants, single-match stat lines, and the Daily, so the cabinet shapes replay in every mode.
 * Series and match feats don't count on Casual (that dial is for learning, not legends — the locked
 * hint says so). Predicates are pure and pinned one-by-one in catalog.test.ts.
 */

/** Series/match feats don't mint on Casual. Absent difficulty (a v1 archive) is taken at its word. */
function meaningful(difficulty: string | undefined): boolean {
  return difficulty !== 'casual'
}

/** Wins per side over the first two games — the decider test (draws leave both short of two). */
function decidedInGameThree(ctx: Extract<FeatContext, { kind: 'series' }>): boolean {
  const { completed } = ctx
  const first2 = completed.games.filter((g) => g.gameNumber <= 2)
  const q = first2.filter((g) => g.winner === 'QLD').length
  const n = first2.filter((g) => g.winner === 'NSW').length
  const g3 = completed.games.find((g) => g.gameNumber === 3)
  return q < 2 && n < 2 && g3?.winner === 'QLD' && completed.seriesWinner === 'QLD'
}

export const FEATS: FeatDef[] = [
  // ---- Series shape ----
  {
    id: 'queenslander',
    name: 'Queenslander',
    flavour: 'Your first shield. They can never take it off you.',
    hint: 'Win a series.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' && ctx.completed.seriesWinner === 'QLD' && meaningful(ctx.completed.difficulty),
  },
  {
    id: 'the-sweep',
    name: 'The Sweep',
    flavour: 'Three games, three wins. Not a crumb left for them.',
    hint: 'Win a series 3-0.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' &&
      ctx.completed.seriesWinner === 'QLD' &&
      ctx.completed.seriesScore.qld === 3 &&
      meaningful(ctx.completed.difficulty),
  },
  {
    id: 'decider-football',
    name: 'Decider Football',
    flavour: 'All square, one game for the shield — and your men stood up.',
    hint: 'Win a live game 3 with the series undecided.',
    scope: 'series',
    test: (ctx) => ctx.kind === 'series' && meaningful(ctx.completed.difficulty) && decidedInGameThree(ctx),
  },
  {
    id: 'road-warrior',
    name: 'Road Warrior',
    flavour: 'Sydney and Melbourne, both silenced in one series.',
    hint: 'Win both away games in a single series.',
    scope: 'series',
    test: (ctx) => {
      if (ctx.kind !== 'series' || !meaningful(ctx.completed.difficulty)) return false
      const away = ctx.completed.games.filter((g) => g.venueId !== 'SUNCORP')
      return away.length === 2 && away.every((g) => g.winner === 'QLD')
    },
  },
  {
    id: 'the-comeback',
    name: 'The Comeback',
    flavour: 'They had the jump. You had the last word.',
    hint: 'Lose game 1, win the series.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' &&
      meaningful(ctx.completed.difficulty) &&
      ctx.completed.seriesWinner === 'QLD' &&
      ctx.completed.games.find((g) => g.gameNumber === 1)?.winner === 'NSW',
  },
  {
    id: 'held-the-line',
    name: 'Held the Line',
    flavour: 'Nobody won it. Queensland kept it. That is the rule.',
    hint: 'Retain the shield in a drawn series.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' &&
      meaningful(ctx.completed.difficulty) &&
      ctx.completed.seriesWinner === 'QLD' &&
      ctx.completed.seriesScore.qld === ctx.completed.seriesScore.nsw,
  },

  // ---- The difficulty chase ----
  {
    id: 'hard-yards',
    name: 'Hard Yards',
    flavour: 'The Blues at their most ruthless, and you still took it home.',
    hint: 'Win a series on Hard.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' && ctx.completed.seriesWinner === 'QLD' && ctx.completed.difficulty === 'hard',
  },
  {
    id: 'the-immortals',
    name: 'The Immortals',
    flavour: '3-0 on Hard. Frame it.',
    hint: 'Sweep a series 3-0 on Hard.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' &&
      ctx.completed.difficulty === 'hard' &&
      ctx.completed.seriesWinner === 'QLD' &&
      ctx.completed.seriesScore.qld === 3,
  },

  // ---- The Blues variants ----
  {
    id: 'wall-breaker',
    name: 'Wall Breaker',
    flavour: 'The Big Blue Wall came to grind. You went through it.',
    hint: 'Beat the middle-bashing Blues pack.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' &&
      meaningful(ctx.completed.difficulty) &&
      ctx.completed.seriesWinner === 'QLD' &&
      ctx.completed.opponentId === 'forwards',
  },
  {
    id: 'seen-em-all',
    name: "Seen 'Em All",
    flavour: 'Every shape they threw at you, beaten.',
    hint: 'Beat all three Blues sides across your career.',
    scope: 'series',
    test: (ctx) => {
      if (ctx.kind !== 'series') return false
      const beaten = new Set(
        ctx.career.entries
          .filter((e) => e.seriesWinner === 'QLD' && e.opponentId && meaningful(e.difficulty))
          .map((e) => e.opponentId as string),
      )
      if (ctx.completed.seriesWinner === 'QLD' && ctx.completed.opponentId && meaningful(ctx.completed.difficulty))
        beaten.add(ctx.completed.opponentId)
      return beaten.size >= 3
    },
  },

  // ---- Single-match stat lines (repeatable — the count is the brag) ----
  {
    id: 'tryless',
    name: 'Tryless',
    flavour: 'Eighty minutes, and New South Wales never crossed. Defence wins Origins.',
    hint: 'Win while holding NSW to zero tries.',
    scope: 'match',
    repeatable: true,
    test: (ctx) =>
      ctx.kind === 'match' &&
      meaningful(ctx.difficulty) &&
      ctx.result.winner === 'QLD' &&
      ctx.result.stats.tries.NSW === 0,
  },
  {
    id: 'hat-trick-hero',
    name: 'Hat-Trick Hero',
    flavour: 'Three for one man. The kind of night statues get built for.',
    hint: 'A Queenslander scores a hat-trick.',
    scope: 'match',
    repeatable: true,
    test: (ctx) => {
      if (ctx.kind !== 'match' || !meaningful(ctx.difficulty)) return false
      const hero = Object.values(ctx.result.stats.players).find((p) => p.side === 'QLD' && p.tries >= 3)
      return hero ? `${hero.name} — ${hero.tries} tries` : false
    },
  },
  {
    id: 'one-point-in-it',
    name: 'One Point In It',
    flavour: 'A single point, off a boot, with the whole state holding its breath.',
    hint: 'Win by exactly one with a QLD field goal in the game.',
    scope: 'match',
    repeatable: true,
    test: (ctx) =>
      ctx.kind === 'match' &&
      meaningful(ctx.difficulty) &&
      ctx.result.winner === 'QLD' &&
      ctx.result.finalScore.qld - ctx.result.finalScore.nsw === 1 &&
      ctx.result.stats.fieldGoals.QLD >= 1,
  },
  {
    id: 'demolition',
    name: 'Demolition',
    flavour: 'That was not a football match. That was a statement.',
    hint: 'Win a game by 30 or more.',
    scope: 'match',
    repeatable: true,
    test: (ctx) =>
      ctx.kind === 'match' &&
      meaningful(ctx.difficulty) &&
      ctx.result.winner === 'QLD' &&
      ctx.result.finalScore.qld - ctx.result.finalScore.nsw >= 30,
  },
  {
    id: 'no-recognised-halfback',
    name: 'No Recognised Halfback',
    flavour: 'No specialist No.7 anywhere in the 19 — and it did not matter.',
    hint: 'Win without a natural halfback on the team sheet.',
    scope: 'match',
    repeatable: true,
    test: (ctx) => {
      if (ctx.kind !== 'match' || !meaningful(ctx.difficulty) || ctx.result.winner !== 'QLD') return false
      return MATCHDAY_POSITIONS.every((pos) => !ctx.team.lineup[pos]?.naturalPositions.includes('HB'))
    },
  },

  // ---- The coach's chase (live judgements only — these read state the archive never stored) ----
  {
    id: 'survived-the-siege',
    name: 'Survived the Siege',
    flavour: 'They were writing the succession pieces. You handed the board a shield instead.',
    hint: 'Win a series while the coach is Under Siege.',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' &&
      meaningful(ctx.completed.difficulty) &&
      ctx.completed.seriesWinner === 'QLD' &&
      (ctx.coachPressure ?? 0) >= 60,
  },
  {
    id: 'faith-rewarded',
    name: 'Faith Rewarded',
    flavour: 'The papers savaged the pick. He answered with a Player of the Series medal.',
    hint: 'A selection the media questioned wins Player of the Series (in a won series).',
    scope: 'series',
    test: (ctx) =>
      ctx.kind === 'series' &&
      meaningful(ctx.completed.difficulty) &&
      ctx.completed.seriesWinner === 'QLD' &&
      ctx.mvpId != null &&
      (ctx.underFireIds ?? []).includes(ctx.mvpId),
  },
  {
    id: 'silenced',
    name: 'Silenced',
    flavour: 'He owned you last time. This series he barely touched the ball. Grudge settled.',
    hint: 'Beat a returning nemesis while holding him under half his old damage.',
    scope: 'series',
    test: (ctx) => {
      if (ctx.kind !== 'series' || !meaningful(ctx.completed.difficulty)) return false
      if (ctx.completed.seriesWinner !== 'QLD' || !ctx.completed.nswDamage || !ctx.nswNames) return false
      const tallies = Object.values(ctx.completed.nswDamage)
      for (let i = ctx.career.entries.length - 1; i >= 0; i--) {
        const prior = ctx.career.entries[i].nemesis
        // The grudge only settles against a man who actually RAN OUT this series (an untallied
        // returnee did literally nothing all series — silenced completely).
        if (!prior || !ctx.nswNames.includes(prior.name)) continue
        const now = tallies.find((t) => t.name === prior.name)
        if ((now?.damage ?? 0) < prior.damage / 2) {
          return `${prior.name} — held to ${now?.damage ?? 0} (was ${prior.damage})`
        }
      }
      return false
    },
  },

  // ---- The Daily ----
  {
    id: 'magnificent-seven',
    name: 'Magnificent Seven',
    flavour: 'Seven days, seven wins. The Daily bows to you.',
    hint: 'Build a 7-day Daily win streak.',
    scope: 'daily',
    test: (ctx) => ctx.kind === 'daily' && ctx.summary.bestStreak >= 7,
  },
  {
    id: 'cauldron-silencer',
    name: 'Cauldron Silencer',
    flavour: '80,000 of them booing, and you sent every one of them home flat.',
    hint: 'Win a Hostile Cauldron daily.',
    scope: 'daily',
    test: (ctx) => ctx.kind === 'daily' && ctx.record.winner === 'QLD' && ctx.record.twistId === 'hostile-cauldron',
  },
  {
    id: 'full-deck',
    name: 'Full Deck',
    flavour: 'Depleted, hostile, short-turnaround — every twist beaten at least once.',
    hint: 'Win a Daily under every twist.',
    scope: 'daily',
    test: (ctx) => {
      if (ctx.kind !== 'daily') return false
      const wonUnder = new Set(ctx.ledger.results.filter((r) => r.winner === 'QLD').map((r) => r.twistId))
      if (ctx.record.winner === 'QLD') wonUnder.add(ctx.record.twistId)
      return wonUnder.size >= DAILY_TWISTS.length
    },
  },

  // ---- This Day in Origin ----
  {
    id: 'off-the-script',
    name: 'Off the Script',
    flavour: 'History asked its question and you answered it. The first page is yours.',
    hint: 'Conquer your first This Day in Origin scenario.',
    scope: 'scenario',
    test: (ctx) => ctx.kind === 'scenario' && ctx.passed,
  },
  {
    id: 'the-historian',
    name: 'The Historian',
    flavour: 'Every day Origin ever asked of Queensland, answered by your teams.',
    hint: 'Conquer every scenario in the library.',
    scope: 'scenario',
    test: (ctx) => ctx.kind === 'scenario' && scenariosDone(ctx.ledger) >= SCENARIOS.length,
  },
]

export function featById(id: string): FeatDef | undefined {
  return FEATS.find((f) => f.id === id)
}
