import { describe, expect, it } from 'vitest'
import { POSITION_ORDER } from '../../data/positions'
import { NSW_KICKER_ID, NSW_LINEUP } from '../../data/nswSquad'
import {
  BLUES_IDS,
  BLUES_VARIANTS,
  bluesById,
  bluesForSeed,
} from '../../data/bluesVariants'
import type { Player, Position } from '../../data/types'
import type { SelectedTeam } from '../types'
import { simulateMatch } from '../simulate'
import { defaultQldLineup } from './fixtures'

describe('bluesVariants — structure', () => {
  it('every variant is a complete, internally-consistent 21-man team sheet', () => {
    for (const v of BLUES_VARIANTS) {
      // All 21 positions present.
      for (const pos of POSITION_ORDER) {
        expect(v.lineup[pos], `${v.id} missing ${pos}`).toBeTruthy()
      }
      // Player ids are unique within the side (no accidental dupes from the builder).
      const ids = Object.values(v.lineup).map((p) => p.id)
      expect(new Set(ids).size, `${v.id} has duplicate ids`).toBe(POSITION_ORDER.length)
      // The goal-kicker is actually in the side.
      expect(ids, `${v.id} kicker not in lineup`).toContain(v.kickerId)
      // A non-empty scouting profile with a primary threat.
      expect(v.edgeThreats.length).toBeGreaterThan(0)
      expect(v.name.length).toBeGreaterThan(0)
      expect(v.blurb.length).toBeGreaterThan(0)
    }
  })

  it('the three sides threaten three different zones (the whole point of the variety)', () => {
    const primaryChannels = BLUES_VARIANTS.map((v) => v.edgeThreats[0].channel)
    expect(new Set(primaryChannels)).toEqual(new Set(['LEFT', 'MIDDLE', 'RIGHT']))
  })

  it('the canonical side is byte-identical to the legacy NSW lineup', () => {
    const classic = bluesById('classic')
    expect(classic.lineup).toBe(NSW_LINEUP)
    expect(classic.kickerId).toBe(NSW_KICKER_ID)
  })
})

describe('bluesVariants — selection', () => {
  it('bluesForSeed is deterministic and reaches every side across the seed space', () => {
    expect(bluesForSeed(42).id).toBe(bluesForSeed(42).id)
    const seen = new Set<string>()
    for (let seed = 0; seed < 30; seed++) seen.add(bluesForSeed(seed).id)
    expect(seen).toEqual(new Set(BLUES_IDS))
  })

  it('bluesById falls back to the canonical side for an unknown id', () => {
    expect(bluesById('no-such-side').id).toBe('classic')
    expect(bluesById(undefined).id).toBe('classic')
  })
})

describe('bluesVariants — balance', () => {
  // Each side is built to ~equal overall strength but a different shape. Against a fixed, competitive
  // QLD (every attribute 84) simulate a run per variant: assert none is a runaway and the three sit
  // close together — i.e. which Blues you draw changes the SHAPE of the contest, not its difficulty.
  const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1)

  // A solid QLD baseline that makes every side a real contest (the neutral 70-rated fixture gets swept
  // by any real Blues lineup, which can't discriminate between variants). Bench stays forward-capable.
  function competitiveQld(): SelectedTeam {
    const base = defaultQldLineup()
    const lineup = {} as Record<Position, Player>
    for (const pos of POSITION_ORDER) {
      lineup[pos] = {
        ...base[pos],
        attrs: { attack: 84, defence: 84, speed: 84, hands: 84, composure: 84 },
      }
    }
    return { side: 'QLD', lineup, kickerId: 'def-HB' }
  }

  function asTeam(id: string): SelectedTeam {
    const v = bluesById(id)
    return { side: 'NSW', lineup: v.lineup, kickerId: v.kickerId, edgeThreats: v.edgeThreats }
  }

  function run(id: string): { nswWins: number; avgMargin: number } {
    const qld = competitiveQld()
    let nswWins = 0
    let total = 0
    for (const seed of SEEDS) {
      const r = simulateMatch({ qld, nsw: asTeam(id) }, seed)
      if (r.winner === 'NSW') nswWins += 1
      total += r.finalScore.nsw - r.finalScore.qld
    }
    return { nswWins, avgMargin: total / SEEDS.length }
  }

  it('no variant is a runaway either way against a competitive QLD', () => {
    for (const id of BLUES_IDS) {
      const { nswWins } = run(id)
      const rate = nswWins / SEEDS.length
      expect(rate, `${id} NSW win rate ${rate}`).toBeGreaterThan(0.2)
      expect(rate, `${id} NSW win rate ${rate}`).toBeLessThan(0.85)
    }
  })

  it('the three sides sit within ~one converted try of each other on average margin', () => {
    const stats = BLUES_IDS.map((id) => ({ id, ...run(id) }))
    const margins = stats.map((s) => s.avgMargin)
    const spread = Math.max(...margins) - Math.min(...margins)
    const report = JSON.stringify(
      stats.map((s) => [s.id, Math.round(s.avgMargin * 10) / 10, `${s.nswWins}/${SEEDS.length}`]),
    )
    // Observed spread ≈ 3.8 pts (classic +7.8, leftshift +8.0, forwards +4.2); 7 leaves headroom for
    // squad-data nudges while still catching a real balance drift.
    expect(spread, `avg NSW margins by side: ${report}`).toBeLessThan(7)
  })
})
