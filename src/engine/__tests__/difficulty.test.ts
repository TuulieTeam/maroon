import { describe, expect, it } from 'vitest'
import { POSITION_ORDER } from '../../data/positions'
import { NSW_LINEUP } from '../../data/nswSquad'
import { DIFFICULTY_TUNING, buildShareCard, nswDifficultyDelta } from '../../series'
import type { Difficulty, SeriesState } from '../../series'
import type { Player, Position } from '../../data/types'
import type { SelectedTeam } from '../types'
import { simulateMatch } from '../simulate'
import { defaultQldLineup } from './fixtures'

describe('difficulty — tuning', () => {
  it('is monotonic and neutral at Origin', () => {
    expect(DIFFICULTY_TUNING.casual).toBeLessThan(0)
    expect(DIFFICULTY_TUNING.origin).toBe(0)
    expect(DIFFICULTY_TUNING.hard).toBeGreaterThan(0)
    expect(nswDifficultyDelta('origin')).toBe(0)
    // A pre-dial save (or omitted value) reads as neutral — same as Origin.
    expect(nswDifficultyDelta(undefined)).toBe(0)
  })
})

describe('difficulty — bites through the engine', () => {
  const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1)
  const nsw: SelectedTeam = { side: 'NSW', lineup: NSW_LINEUP, kickerId: 'nsw-hb' }

  // Competitive QLD (uniform 84) so the dial has room to move the result either way.
  function competitiveQld(): SelectedTeam {
    const base = defaultQldLineup()
    const lineup = {} as Record<Position, Player>
    for (const pos of POSITION_ORDER) {
      lineup[pos] = { ...base[pos], attrs: { attack: 84, defence: 84, speed: 84, hands: 84, composure: 84 } }
    }
    return { side: 'QLD', lineup, kickerId: 'def-HB' }
  }

  // Apply the dial exactly as App.tsx does: a uniform delta on every NSW player in the form map.
  function avgNswMargin(difficulty: Difficulty): number {
    const delta = nswDifficultyDelta(difficulty)
    const form: Record<string, number> = {}
    if (delta !== 0) for (const p of Object.values(NSW_LINEUP)) form[p.id] = delta
    const qld = competitiveQld()
    let total = 0
    for (const seed of SEEDS) {
      const r = simulateMatch({ qld, nsw, form }, seed)
      total += r.finalScore.nsw - r.finalScore.qld
    }
    return total / SEEDS.length
  }

  it('a harder dial makes the Blues stronger — monotonic NSW margin, meaningful swing', () => {
    const casual = avgNswMargin('casual')
    const origin = avgNswMargin('origin')
    const hard = avgNswMargin('hard')
    expect(casual, `casual ${casual} should be < origin ${origin}`).toBeLessThan(origin)
    expect(origin, `origin ${origin} should be < hard ${hard}`).toBeLessThan(hard)
    // The dial has to actually matter. Observed avg NSW margins vs the uniform-84 yardstick:
    // casual ≈ -6, origin ≈ +8, hard ≈ +27 (a ~33pt swing). Guard the swing loosely so a future
    // squad-data nudge won't false-fail, while still catching the dial going limp.
    expect(hard - casual, `margins casual ${casual.toFixed(1)} / origin ${origin.toFixed(1)} / hard ${hard.toFixed(1)}`).toBeGreaterThan(12)
  })
})

describe('difficulty — share card', () => {
  const base: SeriesState = {
    schemaVersion: 3,
    rootSeed: 1,
    opponentId: 'classic',
    currentGame: 3,
    seriesScore: { qld: 2, nsw: 1 },
    games: [],
    status: 'complete',
    seriesWinner: 'QLD',
    playerConditions: {},
  }

  it('every card ends with the deployed game link', () => {
    expect(buildShareCard(base, null).trim().endsWith('https://tuulieteam.github.io/maroon/')).toBe(true)
  })

  it('brags a non-default difficulty and stays clean at Origin', () => {
    expect(buildShareCard({ ...base, difficulty: 'hard' }, null)).toContain('Hard')
    expect(buildShareCard({ ...base, difficulty: 'casual' }, null)).toContain('Casual')
    expect(buildShareCard({ ...base, difficulty: 'origin' }, null)).not.toContain('Difficulty')
    // Omitted difficulty (a pre-dial save) reads as Origin — no difficulty line.
    expect(buildShareCard(base, null)).not.toContain('Difficulty')
  })
})
