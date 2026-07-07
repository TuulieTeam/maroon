import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../../engine'
import type { MatchSetup, SelectedTeam } from '../../engine'
import { defaultQldLineup } from '../../engine/__tests__/fixtures'
import { buildDailyChallenge } from '../dailyChallenge'
import type { DailyChallenge } from '../dailyChallenge'

/**
 * Assemble the daily MatchSetup exactly as App.tsx does at the daily kickoff boundary: the twist's
 * uniform side deltas folded into the form map, the challenge's venue riding a one-off OPENER series
 * context. Mirrors the difficulty-dial contract test — if App's composition drifts from this, the
 * daily determinism promise ("same date, same match") is what breaks, so it's pinned here.
 */
function dailySetup(challenge: DailyChallenge, qld: SelectedTeam): MatchSetup {
  const form: Record<string, number> = {}
  const { nswFormDelta, qldFormDelta } = challenge.twist
  if (nswFormDelta) for (const p of Object.values(challenge.opponent.lineup)) form[p.id] = nswFormDelta
  if (qldFormDelta) for (const p of Object.values(qld.lineup)) form[p.id] = qldFormDelta
  return {
    qld,
    nsw: {
      side: 'NSW',
      lineup: { ...challenge.opponent.lineup },
      kickerId: challenge.opponent.kickerId,
      edgeThreats: challenge.opponent.edgeThreats,
    },
    series: { gameNumber: 1, seriesScore: { qld: 0, nsw: 0 }, venue: challenge.venue, stakes: 'OPENER' },
    form,
  }
}

function qldFixture(): SelectedTeam {
  return { side: 'QLD', lineup: defaultQldLineup(), kickerId: 'def-HB' }
}

describe('daily origin — through the engine', () => {
  it('the same date and the same picked side replay byte-identically', () => {
    const challenge = buildDailyChallenge('2026-07-06')
    const a = simulateMatch(dailySetup(challenge, qldFixture()), challenge.seed)
    const b = simulateMatch(dailySetup(challenge, qldFixture()), challenge.seed)
    expect(b.finalScore).toEqual(a.finalScore)
    expect(b.events.length).toBe(a.events.length)
    expect(b.events.map((e) => e.commentary)).toEqual(a.events.map((e) => e.commentary))
  })

  it('a side-tilting twist actually bites through the engine', () => {
    // Find a date whose twist tilts a side, then compare against the same day WITHOUT the tilt.
    let challenge: DailyChallenge | null = null
    for (let d = 1; d <= 60 && !challenge; d++) {
      const day = new Date(Date.UTC(2026, 0, d))
      const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`
      const c = buildDailyChallenge(key)
      if (c.twist.nswFormDelta || c.twist.qldFormDelta) challenge = c
    }
    expect(challenge, 'no side-tilting twist drawn in 60 days — catalog weighting broke').not.toBeNull()

    // Average margins over many seeds so a single seed's noise can't mask the tilt.
    const flat: DailyChallenge = { ...challenge!, twist: { id: 'full-80', label: '', blurb: '' } }
    let tilted = 0
    let neutral = 0
    for (let seed = 1; seed <= 40; seed++) {
      const t = simulateMatch(dailySetup(challenge!, qldFixture()), seed)
      const n = simulateMatch(dailySetup(flat, qldFixture()), seed)
      tilted += t.finalScore.nsw - t.finalScore.qld
      neutral += n.finalScore.nsw - n.finalScore.qld
    }
    // Every side-tilting twist in the catalog favours NSW (their lift or your fatigue).
    expect(tilted / 40, `tilted ${tilted / 40} vs neutral ${neutral / 40}`).toBeGreaterThan(neutral / 40)
  })

  it('the booth calls the right ground on a daily away day', () => {
    // Find a daily at a non-Suncorp venue and check the venue rides into the broadcast context.
    let challenge: DailyChallenge | null = null
    for (let d = 1; d <= 60 && !challenge; d++) {
      const day = new Date(Date.UTC(2026, 3, d))
      const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`
      const c = buildDailyChallenge(key)
      if (c.venue.id !== 'SUNCORP') challenge = c
    }
    expect(challenge).not.toBeNull()
    const result = simulateMatch(dailySetup(challenge!, qldFixture()), challenge!.seed)
    const preGame = result.broadcast.preGame.map((s) => s.line).join(' ')
    // The booth names the host city ("it's Sydney") or the ground itself — either proves the
    // challenge's venue reached the broadcast context instead of defaulting to Brisbane.
    const namesVenue = preGame.includes(challenge!.venue.city) || preGame.includes(challenge!.venue.groundShort)
    expect(namesVenue, `pre-game never names ${challenge!.venue.city}: ${preGame.slice(0, 120)}…`).toBe(true)
  })
})
