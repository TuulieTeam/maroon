import { describe, expect, it } from 'vitest'
import { pickPreMatchSpeech } from '../speeches'
import type { SeriesStakes } from '../types'

// Titles grouped by the mood they belong to (kept in sync with SPEECHES in speeches.ts).
const OPENER = new Set([
  'The First Hit',
  'The Jersey Remembers',
  'No Easy Metres',
  'Old Rivalry, New Scars',
  'The Middle Chapter',
  'Earn the Right',
  'The Game Within the Game',
])
const PRESSURE = new Set(['Answer Back', 'The Longest Night', 'Backs to the Wall'])
const DECIDER = new Set([
  'The Decider',
  'For the Ones Watching',
  'The Quiet Before',
  'Eighty Minutes From Forever',
  'One Last Time',
])

describe('pickPreMatchSpeech', () => {
  it('is deterministic for the same seed + stakes', () => {
    const a = pickPreMatchSpeech(4242, 'G3_DECIDER')
    const b = pickPreMatchSpeech(4242, 'G3_DECIDER')
    expect(a).toEqual(b)
  })

  it('returns a well-formed, token-free, game-agnostic address', () => {
    for (let seed = 0; seed < 120; seed++) {
      const s = pickPreMatchSpeech(seed * 2654435761, seed % 2 ? 'G3_DECIDER' : undefined)
      expect(s.title.trim().length).toBeGreaterThan(0)
      expect(s.lines.length).toBeGreaterThan(2)
      for (const line of s.lines) {
        expect(line.trim().length).toBeGreaterThan(0)
        expect(line).not.toMatch(/\{[a-zA-Z]+\}/)
        // No surviving "Game One/Two/Three" references that would contradict the slot.
        expect(line).not.toMatch(/\bGame (One|Two|Three|1|2|3)\b/)
      }
    }
  })

  const moodCases: Array<{ stakes: SeriesStakes | undefined; pool: Set<string>; label: string }> = [
    { stakes: undefined, pool: OPENER, label: 'no series' },
    { stakes: 'OPENER', pool: OPENER, label: 'opener' },
    { stakes: 'G2_CAN_CLINCH', pool: OPENER, label: 'can clinch' },
    { stakes: 'G3_DEAD_RUBBER_QLD_UP', pool: OPENER, label: 'dead rubber up' },
    { stakes: 'G2_MUST_WIN', pool: PRESSURE, label: 'must win' },
    { stakes: 'G3_DEAD_RUBBER_QLD_DOWN', pool: PRESSURE, label: 'dead rubber down' },
    { stakes: 'G3_DECIDER', pool: DECIDER, label: 'decider' },
    { stakes: 'G3_DECIDER_AFTER_DRAW', pool: DECIDER, label: 'decider after draw' },
  ]

  it.each(moodCases)('$label stakes only ever draws from its mood pool', ({ stakes, pool }) => {
    for (let seed = 0; seed < 60; seed++) {
      const s = pickPreMatchSpeech(seed * 40503 + 7, stakes)
      expect(pool.has(s.title), `unexpected "${s.title}" for ${stakes}`).toBe(true)
    }
  })

  it('varies within a mood across seeds', () => {
    const titles = new Set<string>()
    for (let seed = 0; seed < 80; seed++) titles.add(pickPreMatchSpeech(seed * 2654435761, 'OPENER').title)
    expect(titles.size).toBeGreaterThan(1)
  })
})
