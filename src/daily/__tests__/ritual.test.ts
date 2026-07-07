import { describe, expect, it } from 'vitest'
import { buildDailyChallenge, challengeFromSeed, dailySeed } from '../dailyChallenge'
import { buildGauntletShareCard, gauntletFromParam, gauntletUrl } from '../gauntlet'
import { EMPTY_DAILY_LEDGER, recordDaily } from '../dailyLedger'
import type { DailyRecord } from '../dailyLedger'
import { buildWeekCard, lastSevenSquares, mondayOf, shiftKey } from '../week'

function rec(dateKey: string, winner: 'QLD' | 'NSW'): DailyRecord {
  return { dateKey, twistId: 'full-80', opponentId: 'classic', venueId: 'SUNCORP', finalScore: { qld: 20, nsw: 12 }, winner }
}

describe('the gauntlet — same match, your team sheet', () => {
  it('a gauntlet built from the daily seed IS the daily challenge', () => {
    const daily = buildDailyChallenge('2026-07-06')
    const gauntlet = gauntletFromParam(String(dailySeed('2026-07-06')))!
    expect(gauntlet.seed).toBe(daily.seed)
    expect(gauntlet.opponent.id).toBe(daily.opponent.id)
    expect(gauntlet.venue.id).toBe(daily.venue.id)
    expect(gauntlet.twist.id).toBe(daily.twist.id)
  })

  it('rejects garbage params and round-trips through its own URL', () => {
    expect(gauntletFromParam(null)).toBeNull()
    expect(gauntletFromParam('not-a-seed')).toBeNull()
    expect(gauntletFromParam('-5')).toBeNull()
    const url = gauntletUrl(123456789)
    expect(url).toContain('?g=123456789')
    const fromUrl = gauntletFromParam(new URL(url).searchParams.get('g'))!
    expect(fromUrl.seed).toBe(123456789)
    expect(fromUrl).toEqual(challengeFromSeed(123456789, 'gauntlet'))
  })

  it('the gauntlet card names the twist, shows the square, and carries the challenge link onward', () => {
    const c = challengeFromSeed(42, 'gauntlet')
    const card = buildGauntletShareCard(c, { qld: 18, nsw: 16 }, 'QLD')
    expect(card).toContain('The Gauntlet')
    expect(card).toContain(c.twist.label)
    expect(card).toContain('🟩 QLD 18–16')
    expect(card).toContain('?g=42')
  })
})

describe('the week — strip and card', () => {
  it('mondayOf finds the ISO Monday across week boundaries', () => {
    expect(mondayOf('2026-07-06')).toBe('2026-07-06') // a Monday
    expect(mondayOf('2026-07-12')).toBe('2026-07-06') // the Sunday of that week
    expect(mondayOf('2026-07-05')).toBe('2026-06-29') // the Sunday of the PRIOR week
    expect(shiftKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('the strip covers the last seven days oldest-first with the right squares', () => {
    let ledger = EMPTY_DAILY_LEDGER
    ledger = recordDaily(ledger, rec('2026-07-05', 'QLD'))
    ledger = recordDaily(ledger, rec('2026-07-06', 'NSW'))
    const strip = lastSevenSquares(ledger, '2026-07-06')
    expect(strip).toHaveLength(7)
    expect(strip[0].key).toBe('2026-06-30')
    expect(strip.map((s) => s.square).join('')).toBe('⬛⬛⬛⬛⬛🟩🟥')
  })

  it('the week card counts the week, blanks the future, and stays null on an untouched week', () => {
    let ledger = EMPTY_DAILY_LEDGER
    ledger = recordDaily(ledger, rec('2026-07-06', 'QLD')) // Monday
    ledger = recordDaily(ledger, rec('2026-07-07', 'QLD')) // Tuesday
    ledger = recordDaily(ledger, rec('2026-07-08', 'NSW')) // Wednesday (today)
    const card = buildWeekCard(ledger, '2026-07-08')!
    expect(card).toContain('the week')
    expect(card).toContain('🟩🟩🟥⬛⬛⬛⬛')
    expect(card).toContain('Won 2/3 this week')
    expect(card).toContain('https://tuulieteam.github.io/maroon/')
    // Records exist, but not THIS week → no card.
    expect(buildWeekCard(ledger, '2026-08-20')).toBeNull()
  })
})
