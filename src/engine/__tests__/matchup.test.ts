import { describe, expect, it } from 'vitest'
import type { Channel, Player, Position } from '../../data/types'
import { NSW_LINEUP } from '../../data/nswSquad'
import { channelUnit } from '../ratings'
import { channelStrength, matchupRead } from '../matchup'
import { defaultQldLineup, makePlayer } from './fixtures'

const CHANNELS: Channel[] = ['LEFT', 'MIDDLE', 'RIGHT']

describe('channelStrength mirrors channelUnit (faithfulness to the sim)', () => {
  it('equals channelUnit attack/defence (rounded) for all three channels on a full lineup', () => {
    const lineup = defaultQldLineup()
    const noFatigue = new Map<string, number>()
    for (const ch of CHANNELS) {
      const unit = channelUnit(lineup, ch, noFatigue)
      const read = channelStrength(lineup, ch)
      expect(read).not.toBeNull()
      expect(read!.attack).toBe(Math.round(unit.attackRating))
      expect(read!.defence).toBe(Math.round(unit.defenceRating))
    }
  })

  it('also matches for the real NSW lineup across all channels', () => {
    const noFatigue = new Map<string, number>()
    for (const ch of CHANNELS) {
      const unit = channelUnit(NSW_LINEUP, ch, noFatigue)
      const read = channelStrength(NSW_LINEUP, ch)!
      expect(read.attack).toBe(Math.round(unit.attackRating))
      expect(read.defence).toBe(Math.round(unit.defenceRating))
    }
  })
})

describe('channelStrength is null-safe on an incomplete channel', () => {
  it('returns null when any one of a channel’s four owners is unassigned', () => {
    const full = defaultQldLineup()
    // LEFT owners are CL, WL, SRL, FE — drop FE so the LEFT channel is incomplete.
    const partial: Partial<Record<Position, Player>> = { ...full }
    delete partial.FE
    expect(channelStrength(partial, 'LEFT')).toBeNull()
    // The untouched MIDDLE / RIGHT channels still resolve.
    expect(channelStrength(partial, 'MIDDLE')).not.toBeNull()
    expect(channelStrength(partial, 'RIGHT')).not.toBeNull()
  })
})

describe('matchupRead vs the real Blues', () => {
  it('flags an at-risk LEFT defence when the left edge is soft against NSW’s right attack', () => {
    // Build a QLD lineup whose LEFT edge owners (CL/WL/SRL/FE) defend poorly. NSW's RIGHT-side
    // attack (Staggs/Nawaqanitawase, defendingChannelFor(LEFT)=RIGHT) runs at this soft left edge.
    const lineup = defaultQldLineup()
    const softLeft: Partial<Record<Position, Player>> = {
      ...lineup,
      CL: makePlayer('soft-cl', 30, { attack: 70, speed: 70 }),
      WL: makePlayer('soft-wl', 32, { attack: 68, speed: 72 }),
      SRL: makePlayer('soft-srl', 34, { attack: 66, speed: 66 }),
      FE: makePlayer('soft-fe', 36, { attack: 70, speed: 70 }),
    }

    const read = matchupRead(softLeft, NSW_LINEUP)
    const left = read.find((e) => e.channel === 'LEFT')!

    expect(left.opponentChannel).toBe('RIGHT')
    expect(left.defence).not.toBeNull()
    // Their strong right attack vs your soft left defence -> at-risk.
    expect(left.defence!.verdict).toBe('at-risk')
    expect(left.defence!.diff).toBeLessThanOrEqual(-5)

    console.log(
      `[matchup] soft-LEFT defence you=${left.defence!.you} opp=${left.defence!.opp} ` +
        `diff=${left.defence!.diff} verdict=${left.defence!.verdict}`,
    )
  })

  it('produces a head-to-head for every edge with a full lineup, cross-wired correctly', () => {
    const read = matchupRead(defaultQldLineup(), NSW_LINEUP)
    expect(read.map((e) => e.channel)).toEqual(['LEFT', 'MIDDLE', 'RIGHT'])
    expect(read.map((e) => e.opponentChannel)).toEqual(['RIGHT', 'MIDDLE', 'LEFT'])
    for (const edge of read) {
      expect(edge.attack).not.toBeNull()
      expect(edge.defence).not.toBeNull()
    }
  })
})
