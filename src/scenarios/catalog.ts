import { MATCHDAY_POSITIONS } from '../data/positions'
import type { Player } from '../data/types'
import type { MatchResult } from '../engine'
import type { ScenarioDef } from './types'

/**
 * The authored scenario library, easy → legendary. All flavour is Queensland mythology over the
 * CURRENT squad and the existing Blues variants — no historical roster layer, deliberately: the
 * question each scenario asks is "could YOUR Maroons do what that day demanded?".
 *
 * Every pinned seed is proven winnable in scenarios.test.ts: a reference side built from the
 * post-constraint pool passes the win condition through the real engine. An unwinnable scenario
 * cannot ship. Seeds were tuned against that guard — retune there if the engine's balance moves.
 */

const overall = (p: Player) =>
  (p.attrs.attack + p.attrs.defence + p.attrs.speed + p.attrs.hands + p.attrs.composure) / 5

/** The squad's top N men by overall — "the men the jersey is built around". */
const topMen = (squad: Player[], n: number): string[] =>
  [...squad]
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, n)
    .map((p) => p.id)

const won = (r: MatchResult) => r.winner === 'QLD'
const margin = (r: MatchResult) => r.finalScore.qld - r.finalScore.nsw

export const SCENARIOS: ScenarioDef[] = [
  // ---- Easy — the door in ----
  {
    id: 'first-stand',
    title: '1980 — The First Stand',
    blurb:
      'Lang Park, the night the concept was born. For the first time the Queenslanders in New South Wales jerseys came home. Win the night that started it all.',
    tier: 'easy',
    seed: 5,
    opponentId: 'classic',
    venueId: 'SUNCORP',
    winLabel: 'Win the game.',
    winCondition: (r) => won(r),
  },
  {
    id: 'perfect-camp',
    title: 'The Perfect Camp',
    blurb:
      'No injuries, no headlines, ten days of the best preparation of your life. Every Maroon is flying. Nights like this are not for winning — they are for statements.',
    tier: 'easy',
    seed: 7,
    opponentId: 'classic',
    venueId: 'SUNCORP',
    constraint: { qldFormDelta: 3 },
    winLabel: 'Win by 12 or more.',
    winCondition: (r) => (won(r) && margin(r) >= 12 ? `Won by ${margin(r)}` : false),
  },

  // ---- Origin — the standard ----
  {
    id: 'neville-nobodies',
    title: '1995 — The Neville Nobodies',
    blurb:
      'Super League took every star you had, and the papers laughed at the team sheet. Fatty believed. Win with the four best men in Queensland watching from the stands.',
    tier: 'origin',
    seed: 7,
    opponentId: 'classic',
    venueId: 'SUNCORP',
    constraint: { ruledOut: (squad) => topMen(squad, 4), nswFormDelta: 3 },
    winLabel: 'Win without your four best players.',
    winCondition: (r) => won(r),
  },
  {
    id: 'hold-the-cauldron',
    title: 'Into the Cauldron',
    blurb:
      "Eighty thousand in sky blue and the left-field Blues running their strike moves at your right edge. Sydney decider footy: it isn't enough to score — you have to strangle them.",
    tier: 'hard',
    seed: 17,
    opponentId: 'leftshift',
    venueId: 'ACCOR_SYD',
    constraint: { nswFormDelta: 3 },
    winLabel: 'Win and hold NSW under 12.',
    winCondition: (r) => (won(r) && r.finalScore.nsw < 12 ? `Held them to ${r.finalScore.nsw}` : false),
  },
  {
    id: 'half-a-chance',
    title: 'No Recognised No.7',
    blurb:
      'Every man who has ever worn the seven for his club is unavailable in one apocalyptic week. Someone plays out of position, and Queensland finds a way. Queensland always finds a way.',
    tier: 'origin',
    seed: 7,
    opponentId: 'classic',
    venueId: 'SUNCORP',
    constraint: {
      ruledOut: (squad) => squad.filter((p) => p.naturalPositions.includes('HB')).map((p) => p.id),
      nswFormDelta: 3,
    },
    winLabel: 'Win without a recognised halfback in the squad.',
    winCondition: (r) => won(r),
  },

  // ---- Hard — the deeds ----
  {
    id: 'wall-at-the-g',
    title: "The Wall at the 'G",
    blurb:
      'Ninety thousand neutrals in Melbourne and the biggest, ugliest Blues pack ever assembled grinding at your middle. Beat the Wall — and barely let it over your line.',
    tier: 'hard',
    seed: 47,
    opponentId: 'forwards',
    venueId: 'MCG',
    constraint: { nswFormDelta: 4 },
    winLabel: 'Win and hold the Wall to one try or none.',
    winCondition: (r) => (won(r) && r.stats.tries.NSW <= 1 ? `${r.stats.tries.NSW} Blues ${r.stats.tries.NSW === 1 ? 'try' : 'tries'} conceded` : false),
  },
  {
    id: 'kids-crusade',
    title: "The Kids' Crusade",
    blurb:
      'The selectors rested every veteran and handed the future its audition — and an audition means the kids have to DO something, not just survive the night.',
    tier: 'legendary',
    seed: 48,
    opponentId: 'classic',
    venueId: 'SUNCORP',
    constraint: { ruledOut: (squad) => squad.filter((p) => p.tag === 'veteran').map((p) => p.id) },
    winLabel: 'Win with a rookie scoring a try.',
    winCondition: (r, team) => {
      if (!won(r)) return false
      for (const pos of MATCHDAY_POSITIONS) {
        const p = team.lineup[pos]
        if (p?.tag === 'rookie' && (r.stats.players[p.id]?.tries ?? 0) > 0) {
          return `${p.name} scored on the crusade`
        }
      }
      return false
    },
  },
  {
    id: 'answer-the-ambush',
    title: 'Answer the Ambush',
    blurb:
      "They moved their whole attack to the other edge and dared you to adjust. Don't just adjust — humiliate the idea. A close win rewards the experiment; a hiding ends it.",
    tier: 'hard',
    seed: 21,
    opponentId: 'leftshift',
    venueId: 'ACCOR_SYD',
    constraint: { nswFormDelta: 2 },
    winLabel: 'Beat the left-shift Blues by 12 or more, in Sydney.',
    winCondition: (r) => (won(r) && margin(r) >= 12 ? `Won by ${margin(r)}` : false),
  },

  // ---- Legendary — frame it ----
  {
    id: 'immortal-territory',
    title: 'Immortal Territory',
    blurb:
      'Their best seventeen, in the form of their lives, at home, with everything on the line. The nights that make Immortals are exactly the nights nobody gives you a chance.',
    tier: 'legendary',
    seed: 97,
    opponentId: 'classic',
    venueId: 'ACCOR_SYD',
    constraint: { nswFormDelta: 10 },
    winLabel: 'Beat the Blues at their career best, in Sydney.',
    winCondition: (r) => won(r),
  },
  {
    id: 'the-shutout',
    title: 'The Shutout',
    blurb:
      'Great sides win. Feared sides win without letting the other mob cross at all — eighty minutes of goal-line hate the Blues remember for a decade.',
    tier: 'legendary',
    seed: 45,
    opponentId: 'classic',
    venueId: 'SUNCORP',
    constraint: { nswFormDelta: 3 },
    winLabel: 'Win and keep New South Wales tryless.',
    winCondition: (r) => (won(r) && r.stats.tries.NSW === 0 ? 'Not one try conceded' : false),
  },
]

export function scenarioById(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export const TIER_ORDER: ScenarioDef['tier'][] = ['easy', 'origin', 'hard', 'legendary']

export const TIER_LABELS: Record<ScenarioDef['tier'], string> = {
  easy: 'The Door In',
  origin: 'The Standard',
  hard: 'The Deeds',
  legendary: 'Frame It',
}
