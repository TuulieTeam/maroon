import { describe, expect, it } from 'vitest'
import type { MatchEvent } from '../types'
import type { Player, Position } from '../../data/types'
import {
  INTERCHANGE_CAP,
  POSITION_META,
  RESERVE_POSITIONS,
  STARTING_POSITIONS,
  USABLE_BENCH_NORMAL,
} from '../../data/positions'
import { simulateMatch } from '../simulate'
import { defaultSetup, makePlayer } from './fixtures'
import { NSW_LINEUP } from '../../data/nswSquad'

const SEEDS = Array.from({ length: 80 }, (_, i) => i + 1)

/**
 * A QLD setup whose STARTING forwards are forward-tagged (like the real squad), so rested forwards
 * are eligible to return and the full rotation cycle exercises — the synthetic default tags starters
 * as backs, which suppresses second-half returns. This is the setup the staggering/churn test uses.
 */
function fwdTaggedSetup() {
  const fwdSlots: Position[] = ['PR', 'HK', 'PL', 'SRL', 'SRR', 'LK']
  const overrides: Partial<Record<Position, Player>> = {}
  for (const pos of fwdSlots) {
    overrides[pos] = { ...makePlayer(`def-${pos}`, 72), naturalPositions: ['PL', 'PR', 'LK', 'SRL'] }
  }
  return defaultSetup(overrides)
}

/** Ids that are NEVER allowed on the field via an in-match personnel event (the 20th/21st man). */
function reserveIds(): Set<string> {
  const ids = new Set<string>()
  for (const pos of RESERVE_POSITIONS) {
    // QLD reserves come from the synthetic fixture (def-RES20/21); NSW from NSW_LINEUP.
    ids.add(`def-${pos}`)
    ids.add(NSW_LINEUP[pos].id)
  }
  return ids
}

/** Whether this match-day saw the extra bench unlocked for the given side. */
function extraBenchUnlocked(events: MatchEvent[], side: 'QLD' | 'NSW'): boolean {
  return events.some(
    (e) =>
      e.side === side &&
      (e.type === 'RESERVE_ACTIVATED' ||
        e.type === 'HIA_FAIL' ||
        (e.type === 'SIN_BIN' && side !== e.side) /* never */),
  )
}

describe('2026 bench rules', () => {
  it('never makes more than the interchange cap of tactical/return swaps per side (HIA/injury subs are exempt)', () => {
    for (const seed of SEEDS) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        // INTERCHANGE events are exactly the capped swaps (fatigue rotations + rested returns).
        const capped = result.events.filter((e) => e.type === 'INTERCHANGE' && e.side === side).length
        expect(capped).toBeLessThanOrEqual(INTERCHANGE_CAP)
      }
    }
  })

  it('the 20th/21st man never appear via an in-match personnel event', () => {
    const reserves = reserveIds()
    const PERSONNEL = new Set([
      'INTERCHANGE',
      'INJURY_REPLACEMENT',
      'RESERVE_ACTIVATED',
      'HEAD_KNOCK',
      'HIA_PASS',
      'HIA_FAIL',
    ])
    for (const seed of SEEDS) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const e of result.events) {
        if (!PERSONNEL.has(e.type)) continue
        for (const p of [e.attacker, e.playerOn, e.playerOff]) {
          if (p) expect(reserves.has(p.id)).toBe(false)
        }
      }
    }
  })

  it('without an unlock, at most 4 DISTINCT bench players enter the field', () => {
    let checkedNoUnlockSeeds = 0
    for (const seed of SEEDS) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const unlocked = result.events.some((e) => e.type === 'RESERVE_ACTIVATED' && e.side === side)
        if (unlocked) continue
        checkedNoUnlockSeeds += 1
        // Distinct incoming bench bodies across all personnel-on events.
        const entered = new Set<string>()
        for (const e of result.events) {
          if (e.side !== side) continue
          const on = e.playerOn ?? (e.type === 'INTERCHANGE' ? e.attacker : undefined)
          if (on) entered.add(on.id)
        }
        // Rested-starter returns reuse a starter id, but those starters are not "bench" — the
        // synthetic starters are def-FB..def-LK; bench are def-INT*. Count only INT bench bodies.
        const benchEntered = new Set(
          [...entered].filter((id) => id.includes('INT') || id.includes('int')),
        )
        expect(benchEntered.size).toBeLessThanOrEqual(USABLE_BENCH_NORMAL)
      }
    }
    expect(checkedNoUnlockSeeds).toBeGreaterThan(0)
  })

  it('RESERVE_ACTIVATED (5th/6th bench) only ever follows an unlock trigger for that side', () => {
    for (const seed of SEEDS) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const activations = result.events.filter((e) => e.type === 'RESERVE_ACTIVATED' && e.side === side)
        if (activations.length === 0) continue
        // A trigger (3rd HIA fail, or a foul-injury INJURY_REPLACEMENT) must precede the activation.
        const firstActivation = activations[0].seq
        const failsBefore = result.events.filter(
          (e) => e.side === side && e.type === 'HIA_FAIL' && e.seq < firstActivation,
        ).length
        const foulInjuryBefore = result.events.some(
          (e) =>
            e.side === side &&
            e.type === 'INJURY_REPLACEMENT' &&
            e.reason === 'foul-injury' &&
            e.seq < firstActivation,
        )
        expect(failsBefore >= 3 || foulInjuryBefore).toBe(true)
        void extraBenchUnlocked
      }
    }
  })
})

describe('interchange rotation is staggered, not bunched, and free of off→on→off churn', () => {
  const ROTATION_SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
  // Mirrors the sim's own gates (simulate.ts ROTATION block).
  const MIN_STINT = 12

  it('a team\'s interchanges are spread across the match — never all in one tiny window', () => {
    let checked = 0
    for (const seed of ROTATION_SEEDS) {
      const result = simulateMatch(fwdTaggedSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const mins = result.events
          .filter((e) => e.type === 'INTERCHANGE' && e.side === side)
          .map((e) => e.minute)
        if (mins.length < 2) continue
        checked += 1
        // At most one interchange per team in any single 1-minute bucket (no bunching at ~minute 17).
        const buckets = new Map<number, number>()
        for (const m of mins) buckets.set(m, (buckets.get(m) ?? 0) + 1)
        for (const n of buckets.values()) expect(n).toBeLessThanOrEqual(1)
        // And the interchanges genuinely span time, not a single instant.
        const spread = Math.max(...mins) - Math.min(...mins)
        expect(spread).toBeGreaterThan(0)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('no player goes off→on→off (or on→off→on) inside the minimum-stint window', () => {
    for (const seed of ROTATION_SEEDS) {
      const result = simulateMatch(fwdTaggedSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const timeline = new Map<string, Array<{ min: number; dir: 'on' | 'off' }>>()
        const note = (id: string, min: number, dir: 'on' | 'off') => {
          const arr = timeline.get(id) ?? []
          arr.push({ min, dir })
          timeline.set(id, arr)
        }
        for (const e of result.events) {
          if (e.type !== 'INTERCHANGE' || e.side !== side) continue
          if (e.playerOff) note(e.playerOff.id, e.minute, 'off')
          if (e.playerOn) note(e.playerOn.id, e.minute, 'on')
        }
        for (const seq of timeline.values()) {
          seq.sort((a, b) => a.min - b.min)
          for (let i = 0; i < seq.length - 1; i++) {
            // Adjacent direction flips (a stint or a rest) must be at least the minimum stint apart.
            if (seq[i].dir !== seq[i + 1].dir) {
              expect(seq[i + 1].min - seq[i].min).toBeGreaterThanOrEqual(MIN_STINT)
            }
          }
        }
      }
    }
  })

  it('still respects the 8-interchange cap with the staggered scheme', () => {
    for (const seed of ROTATION_SEEDS) {
      const result = simulateMatch(fwdTaggedSetup(), seed)
      for (const side of ['QLD', 'NSW'] as const) {
        const n = result.events.filter((e) => e.type === 'INTERCHANGE' && e.side === side).length
        expect(n).toBeLessThanOrEqual(INTERCHANGE_CAP)
      }
    }
  })
})

/**
 * Pass A like-for-like substitution. Tactical interchanges (reason 'fatigue') should bring on a
 * ROLE-SENSIBLE forward for the vacated slot — not just the freshest body anywhere ("wrong people"
 * bug). slotFit mirrors the sim's own scorer: 3 = exact slot, 2 = same role+channel, 1 = same role,
 * 0 = wrong role. We derive the vacated slot from playerOff's id (synthetic ids are `def-<SLOT>`),
 * falling back to the slot the player names first; the incoming body must score >= 1 for it.
 */
function slotFitForTest(player: Player, slot: Position): number {
  if (player.naturalPositions.includes(slot)) return 3
  const slotMeta = POSITION_META[slot]
  const sameRole = player.naturalPositions.some((p) => POSITION_META[p].role === slotMeta.role)
  if (!sameRole) return 0
  const sameChannel = player.naturalPositions.some(
    (p) => POSITION_META[p].role === slotMeta.role && POSITION_META[p].channel === slotMeta.channel,
  )
  return sameChannel ? 2 : 1
}

function isForwardPlayerForTest(player: Player): boolean {
  return player.naturalPositions.some((p) => POSITION_META[p].role === 'forward')
}

/** The synthetic-fixture starting slot the player off the field vacated (def-<SLOT> ids). */
function vacatedSlotFrom(playerOff: Player): Position | null {
  const id = playerOff.id
  if (id.startsWith('def-')) {
    const slot = id.slice('def-'.length) as Position
    if ((STARTING_POSITIONS as string[]).includes(slot)) return slot
  }
  // Real-squad NSW starters: map by the slot they occupy in NSW_LINEUP.
  for (const pos of STARTING_POSITIONS) {
    if (NSW_LINEUP[pos]?.id === id) return pos
  }
  return null
}

describe('like-for-like tactical substitution (Pass A)', () => {
  const SUB_SEEDS = Array.from({ length: 60 }, (_, i) => i + 1)

  it('every tactical interchange brings on a forward (never a back) for a forward slot', () => {
    let checked = 0
    for (const seed of SUB_SEEDS) {
      const result = simulateMatch(fwdTaggedSetup(), seed)
      for (const e of result.events) {
        if (e.type !== 'INTERCHANGE' || e.reason !== 'fatigue' || !e.playerOn) continue
        checked += 1
        expect(isForwardPlayerForTest(e.playerOn), `incoming ${e.playerOn.id} is forward-capable`).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('the incoming body is role-sensible (slotFit >= 1) for the vacated slot, prop slots middle-filled', () => {
    let checkedWithKnownSlot = 0
    let propRotations = 0
    let propMiddleFilled = 0
    for (const seed of SUB_SEEDS) {
      const result = simulateMatch(fwdTaggedSetup(), seed)
      for (const e of result.events) {
        if (e.type !== 'INTERCHANGE' || e.reason !== 'fatigue' || !e.playerOn || !e.playerOff) continue
        const slot = vacatedSlotFrom(e.playerOff)
        if (!slot) continue
        checkedWithKnownSlot += 1
        // HARD per-event guarantee: the incoming body always fits the vacated slot's ROLE — a
        // forward replaces a forward; a back is never thrown into a forward slot.
        const fit = slotFitForTest(e.playerOn, slot)
        expect(fit, `incoming ${e.playerOn.id} -> slot ${slot} fit`).toBeGreaterThanOrEqual(1)
        // AGGREGATE: a vacated PROP slot should usually pull a middle/prop-capable body — but when
        // none is eligible (4-usable + rest gating) the picker correctly falls back to a same-role
        // edge forward (slotFit 1), so assert the overwhelming majority, not every single one.
        if (slot === 'PR' || slot === 'PL') {
          propRotations += 1
          const middleForward = e.playerOn.naturalPositions.some(
            (p) => POSITION_META[p].role === 'forward' && POSITION_META[p].channel === 'MIDDLE',
          )
          if (middleForward) propMiddleFilled += 1
        }
      }
    }
    expect(checkedWithKnownSlot).toBeGreaterThan(0)
    if (propRotations > 0) {
      expect(propMiddleFilled / propRotations).toBeGreaterThan(0.75)
    }
  })

  it('prefers a like-for-like prop over a fresher non-prop when both are available', () => {
    // A vacated prop should pull the available PROP cover (slotFit 2) ahead of a back-row-only body
    // (slotFit 1), even if the back-rower is marginally fresher. Build a QLD bench with exactly one
    // middle-prop cover and otherwise edge-only (SR) forwards, and verify the prop slots, when
    // rotated, are taken by the prop-capable body.
    const propCover: Player = {
      ...makePlayer('int-prop', 72),
      naturalPositions: ['PR', 'PL', 'LK'],
    }
    const edgeOnly = (id: string): Player => ({
      ...makePlayer(id, 72),
      naturalPositions: ['SRL', 'SRR'],
    })
    // Forward-tagged starters so the prop slots are real forward slots that rotate.
    const fwdSlots: Position[] = ['PR', 'HK', 'PL', 'SRL', 'SRR', 'LK']
    const overrides: Partial<Record<Position, Player>> = {
      INT1: propCover,
      INT2: edgeOnly('int-sr2'),
      INT3: edgeOnly('int-sr3'),
      INT4: edgeOnly('int-sr4'),
    }
    for (const pos of fwdSlots) {
      overrides[pos] = { ...makePlayer(`def-${pos}`, 72), naturalPositions: ['PL', 'PR', 'LK', 'SRL'] }
    }

    let propRotations = 0
    let propTakenByPropCapable = 0
    for (const seed of SUB_SEEDS) {
      const result = simulateMatch(defaultSetup(overrides), seed)
      for (const e of result.events) {
        if (e.type !== 'INTERCHANGE' || e.reason !== 'fatigue' || e.side !== 'QLD' || !e.playerOn || !e.playerOff)
          continue
        const slot = vacatedSlotFrom(e.playerOff)
        if (slot !== 'PR' && slot !== 'PL') continue
        propRotations += 1
        const propCapable = e.playerOn.naturalPositions.some(
          (p) => POSITION_META[p].role === 'forward' && POSITION_META[p].channel === 'MIDDLE',
        )
        if (propCapable) propTakenByPropCapable += 1
      }
    }
    expect(propRotations).toBeGreaterThan(0)
    // With like-for-like ranking, prop rotations are filled by a middle/prop-capable body whenever
    // one is eligible. Availability (4-usable rule + rest gating) can occasionally force an SR-only
    // body in, so assert the overwhelming majority — not an exact count — are like-for-like.
    expect(propTakenByPropCapable / propRotations).toBeGreaterThan(0.9)
  })

  it('a very-low-stamina starter rotates earlier than a very-high-stamina one (same slot, controlled)', () => {
    // Two identical setups except the starting LOCK's stamina. Stamina modulates fatigue accrual, so
    // the low-stamina lock should cross the rotate threshold (and be subbed) earlier on average.
    function meanFirstLkSubMinute(stamina: number): number {
      const fwdSlots: Position[] = ['PR', 'HK', 'PL', 'SRL', 'SRR']
      let total = 0
      let count = 0
      for (const seed of SUB_SEEDS) {
        const overrides: Partial<Record<Position, Player>> = {
          LK: { ...makePlayer('def-LK', 72), naturalPositions: ['LK', 'PL', 'PR'], stamina },
        }
        // Forward-tag the other middles/edges so only the LK's stamina differs between runs.
        for (const pos of fwdSlots) {
          overrides[pos] = { ...makePlayer(`def-${pos}`, 72), naturalPositions: ['PL', 'PR', 'LK', 'SRL'] }
        }
        const result = simulateMatch(defaultSetup(overrides), seed)
        const firstLkOff = result.events.find(
          (e) => e.type === 'INTERCHANGE' && e.reason === 'fatigue' && e.playerOff?.id === 'def-LK',
        )
        if (firstLkOff) {
          total += firstLkOff.minute
          count += 1
        }
      }
      return count > 0 ? total / count : Number.POSITIVE_INFINITY
    }

    const lowStaminaSubMinute = meanFirstLkSubMinute(50)
    const highStaminaSubMinute = meanFirstLkSubMinute(99)
     
    console.log(
      `[stamina-timing] mean first LK sub minute: lowStamina=${lowStaminaSubMinute.toFixed(1)} ` +
        `highStamina=${highStaminaSubMinute.toFixed(1)}`,
    )
    expect(lowStaminaSubMinute).toBeLessThan(highStaminaSubMinute)
  })
})
