import { buildAutoLineup } from '../../data/autoSelect'
import { QLD_SQUAD } from '../../data/qldSquad'
import type { Player, Position } from '../../data/types'
import type { SelectedTeam } from '../../engine'
import type { ScenarioDef } from '../types'

/**
 * The reference side the winnability guard fields: the auto-selector's best legal 19+2 from the
 * post-constraint pool, kicker = best boot in the side. This is what "provably winnable" means —
 * a solid, position-correct side (not a perfect one) meets the win condition on the pinned seed.
 */
export function referenceTeam(def: ScenarioDef): SelectedTeam {
  const out = new Set(def.constraint?.ruledOut?.(QLD_SQUAD) ?? [])
  const pool = QLD_SQUAD.filter((p) => !out.has(p.id))
  const auto = buildAutoLineup(pool)
  const byId = new Map(pool.map((p) => [p.id, p]))
  const lineup = {} as Record<Position, Player>
  for (const [pos, id] of Object.entries(auto)) {
    const player = id ? byId.get(id) : undefined
    if (player) lineup[pos as Position] = player
  }
  const kicker = [...Object.values(lineup)].sort((a, b) => b.goalKicking - a.goalKicking)[0]
  return { side: 'QLD', lineup, kickerId: kicker.id }
}
