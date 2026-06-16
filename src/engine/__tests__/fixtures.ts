import type { Player, PlayerStatus, Position } from '../../data/types'
import { BENCH_POSITIONS, POSITION_ORDER, RESERVE_POSITIONS } from '../../data/positions'
import { NSW_LINEUP, NSW_KICKER_ID } from '../../data/nswSquad'
import type { MatchSetup, SelectedTeam } from '../types'

/**
 * A neutral synthetic QLD 19 (+ 2 reserves) for engine tests — deliberately decoupled from the
 * live QLD_SQUAD data so squad/form updates never break the suite. Tests override only the slots
 * they care about (e.g. CL in the causal-chain test, the bench in the rotation test). Bench and
 * reserve bodies are forward-capable so fatigue rotation fires.
 */
export function defaultQldLineup(): Record<Position, Player> {
  const map = {} as Record<Position, Player>
  const benchOrReserve = new Set<Position>([...BENCH_POSITIONS, ...RESERVE_POSITIONS])
  for (const pos of POSITION_ORDER) {
    map[pos] = benchOrReserve.has(pos)
      ? { ...makePlayer(`def-${pos}`, 70), naturalPositions: ['PL', 'PR', 'LK'] }
      : makePlayer(`def-${pos}`, 70)
  }
  return map
}

export function qldTeam(overrides?: Partial<Record<Position, Player>>): SelectedTeam {
  const lineup = { ...defaultQldLineup(), ...overrides }
  return { side: 'QLD', lineup, kickerId: 'def-HB' }
}

export function nswTeam(): SelectedTeam {
  return { side: 'NSW', lineup: { ...NSW_LINEUP }, kickerId: NSW_KICKER_ID }
}

export function defaultSetup(qldOverrides?: Partial<Record<Position, Player>>): MatchSetup {
  return { qld: qldTeam(qldOverrides), nsw: nswTeam() }
}

export function makePlayer(
  id: string,
  defence: number,
  extra?: Partial<Player['attrs']>,
  status?: PlayerStatus,
): Player {
  return {
    id,
    name: id,
    club: 'Test',
    naturalPositions: ['CL'],
    attrs: { attack: 70, defence, speed: 75, hands: 70, composure: 70, ...extra },
    goalKicking: 10,
    tag: 'workhorse',
    ...(status ? { status, formNote: `test note: ${status}` } : {}),
  }
}

export const ALL_POSITIONS = POSITION_ORDER
