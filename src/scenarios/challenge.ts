import { bluesById } from '../data/bluesVariants'
import type { MatchSetup, SelectedTeam } from '../engine'
import { VENUES } from '../series/venues'
import type { DailyChallenge } from '../daily'
import type { ScenarioDef } from './types'

/**
 * Adapt a scenario into the shape the daily picker kit already consumes. The "twist" here is
 * SYNTHESIZED from the scenario's constraint — it never enters DAILY_TWISTS, the daily ledger, or a
 * seeded draw. Deliberately does NOT go through challengeFromSeed: nothing about a scenario is
 * drawn, everything is pinned by its author.
 */
export function scenarioChallenge(def: ScenarioDef): DailyChallenge {
  return {
    dateKey: `scenario:${def.id}`,
    seed: def.seed >>> 0,
    opponent: bluesById(def.opponentId),
    venue: VENUES[def.venueId],
    twist: {
      id: `scenario:${def.id}`,
      label: def.title,
      blurb: def.blurb,
      nswFormDelta: def.constraint?.nswFormDelta,
      qldFormDelta: def.constraint?.qldFormDelta,
      ruledOut: def.constraint?.ruledOut,
    },
  }
}

/**
 * The scenario's kickoff-boundary composition — the ONE builder shared by App and the winnability
 * guard, so the tested match and the played match can never drift apart. Identical in shape to the
 * daily/gauntlet composition: uniform form-map deltas, the pinned ground riding a one-off OPENER
 * context, engine untouched.
 */
export function buildScenarioSetup(def: ScenarioDef, qld: SelectedTeam): MatchSetup {
  const opponent = bluesById(def.opponentId)
  const c = def.constraint
  const form: Record<string, number> = {}
  if (c?.nswFormDelta) for (const p of Object.values(opponent.lineup)) form[p.id] = c.nswFormDelta
  if (c?.qldFormDelta) for (const p of Object.values(qld.lineup)) form[p.id] = c.qldFormDelta
  return {
    qld,
    nsw: {
      side: 'NSW',
      lineup: { ...opponent.lineup },
      kickerId: opponent.kickerId,
      edgeThreats: opponent.edgeThreats,
    },
    series: { gameNumber: 1, seriesScore: { qld: 0, nsw: 0 }, venue: VENUES[def.venueId], stakes: 'OPENER' },
    form,
  }
}
