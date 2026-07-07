import { describe, expect, it } from 'vitest'
import type { MatchEvent, PlayerOfMatch, Score, Side } from '../types'
import { pickIconicMoment, renderIconicLine } from '../iconicMoment'
import { simulateMatch } from '../simulate'
import { defaultSetup } from './fixtures'

// ---- synthetic stream builder --------------------------------------------------------------------

let seq = 0
function ev(
  type: MatchEvent['type'],
  side: Side,
  minute: number,
  score: Score,
  attacker?: { id: string; name: string },
  metres?: number,
): MatchEvent {
  return {
    minute,
    seq: seq++,
    type,
    side,
    ...(attacker ? { attacker: { id: attacker.id, name: attacker.name } as MatchEvent['attacker'] } : {}),
    ...(metres !== undefined ? { metres } : {}),
    score,
    commentary: '',
  }
}

const POTM: PlayerOfMatch = { id: 'hero', name: 'Hammer', side: 'QLD', rating: 9, line: {} as PlayerOfMatch['line'] }
const cobbo = { id: 'cobbo', name: 'Selwyn Cobbo' }
const cleary = { id: 'nsw-hb', name: 'Nathan Cleary' }

describe('iconic moment — the priority ladder', () => {
  it('rung 1: a late field goal in a one-score game is the dagger', () => {
    const events = [
      ev('TRY', 'QLD', 20, { qld: 4, nsw: 0 }, cobbo),
      ev('TRY', 'NSW', 50, { qld: 4, nsw: 4 }, cleary),
      ev('FIELD_GOAL', 'QLD', 78, { qld: 5, nsw: 4 }, { id: 'hb', name: 'Sam Walker' }),
      ev('FULL_TIME', 'QLD', 80, { qld: 5, nsw: 4 }),
    ]
    const m = pickIconicMoment(events, 'QLD', POTM)!
    expect(m.kind).toBe('FIELD_GOAL')
    expect(m.playerName).toBe('Sam Walker')
    expect(m.minute).toBe(78)
  })

  it('rung 2: the last lead-taking try is the match-winner — even when the lead arrived off the boot', () => {
    const events = [
      ev('TRY', 'NSW', 10, { qld: 0, nsw: 4 }, cleary),
      ev('TRY', 'QLD', 30, { qld: 4, nsw: 4 }, cobbo), // levels it
      ev('CONVERSION', 'QLD', 31, { qld: 6, nsw: 4 }), // the lead technically arrives here
      ev('TRY', 'QLD', 70, { qld: 10, nsw: 4 }, { id: 'x', name: 'Other' }),
      ev('FULL_TIME', 'QLD', 80, { qld: 10, nsw: 4 }),
    ]
    const m = pickIconicMoment(events, 'QLD', POTM)!
    expect(m.kind).toBe('TRY')
    expect(m.playerName).toBe('Selwyn Cobbo') // the try, not the conversion — and not the padding try
    expect(m.minute).toBe(30)
  })

  it('crowned regardless of side: an NSW match-winner is still the moment', () => {
    const events = [
      ev('TRY', 'QLD', 10, { qld: 4, nsw: 0 }, cobbo),
      ev('TRY', 'NSW', 75, { qld: 4, nsw: 8 }, cleary),
      ev('FULL_TIME', 'QLD', 80, { qld: 4, nsw: 8 }),
    ]
    const m = pickIconicMoment(events, 'NSW', POTM)!
    expect(m.side).toBe('NSW')
    expect(m.playerName).toBe('Nathan Cleary')
  })

  it('rung 3: in a wire-to-wire blowout, the second-half back-breaker beats the forgettable opener', () => {
    const events = [
      ev('TRY', 'QLD', 5, { qld: 6, nsw: 0 }, { id: 'a', name: 'Early Try' }),
      ev('TRY', 'QLD', 25, { qld: 12, nsw: 0 }, { id: 'b', name: 'Second Try' }),
      ev('TRY', 'QLD', 55, { qld: 18, nsw: 0 }, { id: 'c', name: 'Back Breaker' }), // margin passes 12 in half two
      ev('TRY', 'QLD', 70, { qld: 24, nsw: 0 }, { id: 'd', name: 'Garbage Time' }),
      ev('FULL_TIME', 'QLD', 80, { qld: 24, nsw: 0 }),
    ]
    const m = pickIconicMoment(events, 'QLD', POTM)!
    expect(m.playerName).toBe('Back Breaker')
    expect(m.minute).toBe(55)
  })

  it('rung 4: a draw still has a moment — the POTM’s best play', () => {
    const events = [
      ev('LINE_BREAK', 'QLD', 22, { qld: 0, nsw: 0 }, { id: 'hero', name: 'Hammer' }, 40),
      ev('LINE_BREAK', 'QLD', 60, { qld: 6, nsw: 6 }, { id: 'hero', name: 'Hammer' }, 65),
      ev('FULL_TIME', 'QLD', 80, { qld: 6, nsw: 6 }),
    ]
    const m = pickIconicMoment(events, 'DRAW', POTM)!
    expect(m.kind).toBe('LINE_BREAK')
    expect(m.minute).toBe(60) // the longer of his breaks
  })

  it('renders a deterministic line naming the player, ours vs theirs voiced differently', () => {
    const m = pickIconicMoment(
      [ev('TRY', 'QLD', 65, { qld: 4, nsw: 0 }, cobbo), ev('FULL_TIME', 'QLD', 80, { qld: 4, nsw: 0 })],
      'QLD',
      POTM,
    )!
    const a = renderIconicLine(m, 12345)
    expect(a).toBe(renderIconicLine(m, 12345))
    expect(a).toContain('Selwyn Cobbo')
    expect(a).toContain('65')
    const theirs = renderIconicLine({ ...m, side: 'NSW' }, 12345)
    expect(theirs).not.toBe(a)
  })
})

describe('iconic moment — through the engine', () => {
  it('simulateMatch crowns a moment, Thommo closes the wrap with it, and the stream is untouched', () => {
    const a = simulateMatch(defaultSetup(), 42)
    const b = simulateMatch(defaultSetup(), 42)
    // Byte-identical replays, iconic moment included.
    expect(b.iconicMoment).toEqual(a.iconicMoment)
    expect(a.events.map((e) => e.commentary)).toEqual(b.events.map((e) => e.commentary))
    if (a.iconicMoment) {
      // The crowned man actually appears in the stream, and the wrap's last word is the moment.
      expect(a.events.some((e) => e.attacker?.id === a.iconicMoment!.playerId)).toBe(true)
      const last = a.broadcast.postGame[a.broadcast.postGame.length - 1]
      expect(last.persona).toBe('Mat Thompson')
      expect(last.line).toBe(a.iconicMoment.line)
      expect(a.iconicMoment.line).toContain(a.iconicMoment.playerName)
    }
  })

  it('most matches produce a moment (scannable across seeds)', () => {
    let crowned = 0
    for (let seed = 1; seed <= 20; seed++) {
      if (simulateMatch(defaultSetup(), seed).iconicMoment) crowned++
    }
    expect(crowned).toBeGreaterThanOrEqual(18)
  })
})
