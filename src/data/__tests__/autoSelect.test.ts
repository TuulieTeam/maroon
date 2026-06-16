import { describe, expect, it } from 'vitest'
import { buildAutoLineup } from '../autoSelect'
import { QLD_SQUAD } from '../qldSquad'
import {
  BENCH_POSITIONS,
  MATCHDAY_POSITIONS,
  POSITION_META,
  RESERVE_POSITIONS,
  STARTING_POSITIONS,
} from '../positions'

const byId = (id: string) => QLD_SQUAD.find((p) => p.id === id)!

describe('autoFill selection', () => {
  const lineup = buildAutoLineup(QLD_SQUAD)

  it('fills all 19 matchday slots + 2 reserves with distinct players', () => {
    const all = [...MATCHDAY_POSITIONS, ...RESERVE_POSITIONS]
    for (const pos of all) expect(lineup[pos], `slot ${pos} empty`).toBeTruthy()
    expect(new Set(all.map((p) => lineup[p])).size).toBe(all.length)
  })

  it('every starter plays a position in their natural list (no out-of-position starter)', () => {
    for (const pos of STARTING_POSITIONS) {
      const p = byId(lineup[pos]!)
      expect(p.naturalPositions, `${p.name} at ${POSITION_META[pos].label}`).toContain(pos)
    }
  })

  it('the prop slots hold genuine front-rowers, not a hooker (the Plath-at-prop bug)', () => {
    for (const pos of ['PR', 'PL'] as const) {
      const p = byId(lineup[pos]!)
      // A real front-rower lists a prop slot as their PRIMARY (first) position.
      expect(['PR', 'PL'], `${p.name} starting at ${pos}`).toContain(p.naturalPositions[0])
    }
    expect(lineup.PR).not.toBe('plath')
    expect(lineup.PL).not.toBe('plath')
  })

  it('the hooker slot holds a specialist hooker', () => {
    expect(byId(lineup.HK!).naturalPositions[0]).toBe('HK')
  })

  it('the bench (INT1-6) is all forward-capable for rotation cover', () => {
    for (const pos of BENCH_POSITIONS) {
      const p = byId(lineup[pos]!)
      const forwardCapable = p.naturalPositions.some((n) => POSITION_META[n].role === 'forward')
      expect(forwardCapable, `${p.name} on bench ${pos}`).toBe(true)
    }
  })

  it('is deterministic', () => {
    expect(buildAutoLineup(QLD_SQUAD)).toEqual(lineup)
  })
})
