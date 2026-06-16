import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import type { MatchEvent, MatchEventType, MatchSetup } from '../types'
import type { Player, Position } from '../../data/types'
import { defaultSetup, nswTeam, qldTeam } from './fixtures'

/** Elite-boot QLD HB so 40/20s + field goals fire — mirrors the kicking.test.ts helper. */
function eliteKicker(): Player {
  return {
    id: 'def-HB',
    name: 'Elite HB',
    club: 'Test',
    naturalPositions: ['HB'],
    attrs: { attack: 90, defence: 82, speed: 80, hands: 90, composure: 95 },
    goalKicking: 95,
    stamina: 88,
  }
}

/** A balanced strong setup + elite kicker so late games stay tight and field goals occasionally fire. */
function balancedSetup(): MatchSetup {
  const nsw = nswTeam()
  const qld = qldTeam({ HB: eliteKicker() })
  for (const pos of Object.keys(qld.lineup) as Position[]) {
    const p = qld.lineup[pos]
    qld.lineup[pos] = { ...p, attrs: { ...p.attrs, attack: 84, defence: 82, hands: 84, composure: 84 } }
  }
  return { qld, nsw }
}

// The only play events that may be IMMEDIATELY followed by a COLOR reply (B4 trigger set).
// Pass 2 adds the kicking-game momentum moments: a 40/20 (swing) and a made field goal (late).
const COLOR_TRIGGERS = new Set<MatchEventType>([
  'TRY',
  'LINE_BREAK',
  'MISSED_TACKLE',
  'SIN_BIN',
  'SEND_OFF',
  'HIA_FAIL',
  'FORTY_TWENTY',
  'FIELD_GOAL',
])

const HIGH_FREQ: MatchEventType[] = [
  'HIT_UP',
  'TACKLE',
  'MISSED_TACKLE',
  'LINE_BREAK',
  'TRY',
  'ERROR',
  'KICK',
  'TURNOVER_DOWNTOWN',
]

const SEEDS = [1, 2, 3, 7, 11, 42, 99, 100, 256, 404, 777, 808, 2024, 31337]

describe('COLOR commentary determinism', () => {
  it('the full event stream (incl. COLOR) is identical for the same seed', () => {
    for (const seed of [1, 99, 2024]) {
      const a = simulateMatch(defaultSetup(), seed)
      const b = simulateMatch(defaultSetup(), seed)
      // Compare the COLOR projection explicitly, on top of the global stream equality.
      const projA = a.events.map((e) => [e.seq, e.type, e.persona, e.personaRole, e.commentary])
      const projB = b.events.map((e) => [e.seq, e.type, e.persona, e.personaRole, e.commentary])
      expect(projA).toEqual(projB)
    }
  })

  it('different seeds produce different color streams', () => {
    const colorOf = (seed: number) =>
      simulateMatch(defaultSetup(), seed)
        .events.filter((e) => e.type === 'COLOR')
        .map((e) => `${e.persona}:${e.commentary}`)
        .join('|')
    expect(colorOf(1)).not.toEqual(colorOf(9999))
  })
})

describe('high-frequency caller variety (B1)', () => {
  it('each high-frequency type yields >10 distinct caller lines across seeds', () => {
    const distinct: Record<string, Set<string>> = {}
    for (const t of HIGH_FREQ) distinct[t] = new Set<string>()
    for (const seed of SEEDS) {
      const result = simulateMatch(defaultSetup(), seed)
      for (const e of result.events) {
        if (distinct[e.type]) distinct[e.type].add(e.commentary)
      }
    }
    for (const t of HIGH_FREQ) {
      expect(distinct[t].size, `${t} distinct lines`).toBeGreaterThan(10)
    }
  })
})

describe('COLOR is sparse and valid (B3-B5)', () => {
  it('exists, is well-formed, and each color immediately follows a valid trigger', () => {
    let anyColor = false
    for (const seed of SEEDS) {
      const { events } = simulateMatch(defaultSetup(), seed)
      for (let i = 0; i < events.length; i++) {
        const e = events[i]
        if (e.type !== 'COLOR') continue
        anyColor = true
        // Non-empty, no unsubstituted tokens, persona + role present.
        expect(e.commentary.trim().length).toBeGreaterThan(0)
        expect(e.commentary).not.toMatch(/\{[a-zA-Z]+\}/)
        expect(e.persona && e.persona.trim().length).toBeTruthy()
        expect(e.personaRole && e.personaRole.trim().length).toBeTruthy()
        // The immediate predecessor (by stream order) must be a valid trigger.
        const pred: MatchEvent | undefined = events[i - 1]
        expect(pred).toBeDefined()
        expect(COLOR_TRIGGERS.has(pred!.type), `predecessor of COLOR was ${pred?.type}`).toBe(true)
      }
    }
    expect(anyColor).toBe(true)
  })

  it('color density stays well below the caller-line count (avg color < caller/6)', () => {
    let color = 0
    let caller = 0
    for (const seed of SEEDS) {
      const { events } = simulateMatch(defaultSetup(), seed)
      for (const e of events) {
        if (e.type === 'COLOR') color += 1
        else caller += 1
      }
    }
    expect(color).toBeGreaterThan(0)
    expect(color).toBeLessThan(caller / 6)
  })

  it('a 40/20 can draw a swing color reply (Pass 2)', () => {
    // Elite-boot kicker so 40/20s fire; scan seeds for a 40/20 immediately followed by COLOR.
    const setup = (): MatchSetup => defaultSetup({ HB: eliteKicker() })
    let drewColor = false
    let sawFortyTwenty = false
    for (let seed = 0; seed < 400 && !drewColor; seed++) {
      const { events } = simulateMatch(setup(), seed)
      for (let i = 0; i < events.length; i++) {
        if (events[i].type !== 'FORTY_TWENTY') continue
        sawFortyTwenty = true
        const next = events[i + 1]
        if (next && next.type === 'COLOR') {
          drewColor = true
          expect(next.commentary).not.toMatch(/\{[a-zA-Z]+\}/)
          expect(next.commentary.trim().length).toBeGreaterThan(0)
          break
        }
      }
    }
    expect(sawFortyTwenty, 'expected at least one 40/20 across the seed scan').toBe(true)
    expect(drewColor, 'expected a 40/20 to draw a COLOR reply on at least one seed').toBe(true)
  })

  it('a field goal can draw a late color reply (Pass 2)', () => {
    const setup = balancedSetup()
    let drewColor = false
    let sawFieldGoal = false
    for (let seed = 0; seed < 400 && !drewColor; seed++) {
      const { events } = simulateMatch(setup, seed)
      for (let i = 0; i < events.length; i++) {
        if (events[i].type !== 'FIELD_GOAL') continue
        sawFieldGoal = true
        const next = events[i + 1]
        if (next && next.type === 'COLOR') {
          drewColor = true
          expect(next.commentary).not.toMatch(/\{[a-zA-Z]+\}/)
          expect(next.commentary.trim().length).toBeGreaterThan(0)
          break
        }
      }
    }
    expect(sawFieldGoal, 'expected at least one field goal across the seed scan').toBe(true)
    expect(drewColor, 'expected a field goal to draw a COLOR reply on at least one seed').toBe(true)
  })

  it('a send-off ALWAYS gets a color follow-up', () => {
    // Scan a wide seed range so we actually encounter send-offs (they are rare).
    let sendOffs = 0
    for (let seed = 0; seed < 400; seed++) {
      const { events } = simulateMatch(defaultSetup(), seed)
      for (let i = 0; i < events.length; i++) {
        if (events[i].type !== 'SEND_OFF') continue
        sendOffs += 1
        const next = events[i + 1]
        expect(next, `event after SEND_OFF (seed ${seed})`).toBeDefined()
        expect(next.type).toBe('COLOR')
      }
    }
    expect(sendOffs).toBeGreaterThan(0)
  })
})
