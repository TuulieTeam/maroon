import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../simulate'
import { TUNING, homeEdgeBySide } from '../ratings'
import type { MatchSetup, SelectedTeam, SeriesContext, Side, Venue } from '../types'
import type { Player, Position } from '../../data/types'
import { ALL_POSITIONS, defaultSetup, makePlayer } from './fixtures'

function venue(homeSide: Side, homeAdvantage: number): Venue {
  return {
    id: homeSide === 'QLD' ? 'SUNCORP' : 'ACCOR_SYD',
    stadium: homeSide === 'QLD' ? 'Suncorp Stadium' : 'Accor Stadium',
    groundShort: homeSide === 'QLD' ? 'Suncorp' : 'Accor',
    city: homeSide === 'QLD' ? 'Brisbane' : 'Sydney',
    homeSide,
    homeAdvantage,
  }
}

function seriesCtx(v: Venue): SeriesContext {
  return { gameNumber: 1, seriesScore: { qld: 0, nsw: 0 }, venue: v, stakes: 'OPENER' }
}

function withVenue(v: Venue): MatchSetup {
  return { ...defaultSetup(), series: seriesCtx(v) }
}

/** A flat, all-equal synthetic side with side-unique ids — so two of them make a true 50/50 contest
 *  and the venue edge becomes the only variable that can tip the result. */
function evenTeam(side: Side, prefix: string, rating = 74): SelectedTeam {
  const lineup = {} as Record<Position, Player>
  for (const pos of ALL_POSITIONS) {
    lineup[pos] = makePlayer(`${prefix}-${pos}`, rating, { attack: rating, speed: rating, hands: rating, composure: rating })
  }
  return { side, lineup, kickerId: `${prefix}-HB` }
}

/** A balanced QLD-vs-NSW setup at a given venue (ids are side-prefixed so the home edge can't cancel). */
function evenMatch(v: Venue): MatchSetup {
  return { qld: evenTeam('QLD', 'q'), nsw: evenTeam('NSW', 'n'), series: seriesCtx(v) }
}

function qldWinShare(setup: MatchSetup, seeds: number[]): number {
  let qld = 0
  for (const s of seeds) if (simulateMatch(setup, s).winner === 'QLD') qld++
  return qld / seeds.length
}

const FORTRESS_QLD = venue('QLD', 1)
const FORTRESS_NSW = venue('NSW', 1)
const NEUTRAL = venue('QLD', 0) // homeAdvantage 0 — side is irrelevant, no edge either way

describe('homeEdgeBySide — the per-side venue delta', () => {
  it('a neutral or unset homeAdvantage yields no edge for either side', () => {
    expect(homeEdgeBySide({ homeSide: 'QLD', homeAdvantage: 0 })).toEqual({ QLD: 0, NSW: 0 })
    expect(homeEdgeBySide({ homeSide: 'NSW' })).toEqual({ QLD: 0, NSW: 0 })
  })

  it('a full-strength home ground lifts the host and docks the visitor by the tuned points', () => {
    const qHome = homeEdgeBySide({ homeSide: 'QLD', homeAdvantage: 1 })
    expect(qHome).toEqual({ QLD: TUNING.homeEdge.home, NSW: -TUNING.homeEdge.away })
    const nHome = homeEdgeBySide({ homeSide: 'NSW', homeAdvantage: 1 })
    expect(nHome).toEqual({ QLD: -TUNING.homeEdge.away, NSW: TUNING.homeEdge.home })
  })

  it('homeAdvantage scales the edge linearly', () => {
    const half = homeEdgeBySide({ homeSide: 'QLD', homeAdvantage: 0.5 })
    expect(half.QLD).toBeCloseTo(TUNING.homeEdge.home * 0.5)
    expect(half.NSW).toBeCloseTo(-TUNING.homeEdge.away * 0.5)
  })

  it('clamps an out-of-range homeAdvantage into [0,1]', () => {
    expect(homeEdgeBySide({ homeSide: 'QLD', homeAdvantage: 5 })).toEqual({
      QLD: TUNING.homeEdge.home,
      NSW: -TUNING.homeEdge.away,
    })
    expect(homeEdgeBySide({ homeSide: 'QLD', homeAdvantage: -3 })).toEqual({ QLD: 0, NSW: 0 })
  })
})

describe('home edge — stream effects', () => {
  it('a fortress venue perturbs the match stream vs a neutral one (same seed)', () => {
    const fortress = simulateMatch(withVenue(FORTRESS_QLD), 7)
    const neutral = simulateMatch(withVenue(NEUTRAL), 7)
    expect(fortress.events).not.toEqual(neutral.events)
  })

  it('a neutral venue is byte-identical to the form-free, series-free default (same seed)', () => {
    // homeAdvantage 0 must add nothing — the legacy guarantee that an attached series context with no
    // rating edge never touches the play stream.
    for (const seed of [1, 42, 909]) {
      const neutral = simulateMatch(withVenue(NEUTRAL), seed)
      const bare = simulateMatch(defaultSetup(), seed)
      expect(neutral.events).toEqual(bare.events)
    }
  })

  it('a home-edge match is still deterministic for a fixed seed', () => {
    const setup = withVenue(FORTRESS_QLD)
    expect(simulateMatch(setup, 31).events).toEqual(simulateMatch(setup, 31).events)
    expect(simulateMatch(setup, 31).finalScore).toEqual(simulateMatch(setup, 31).finalScore)
  })
})

describe('home edge — directional outcome shift (statistical)', () => {
  it('an evenly-matched side wins more at home, least away, neutral in between', () => {
    const seeds = Array.from({ length: 260 }, (_, i) => i * 7 + 1)
    const atHome = qldWinShare(evenMatch(FORTRESS_QLD), seeds)
    const atNeutral = qldWinShare(evenMatch(NEUTRAL), seeds)
    const away = qldWinShare(evenMatch(FORTRESS_NSW), seeds)
    // Monotonic by host: most QLD wins at a QLD fortress, fewest at an NSW fortress, neutral in
    // between (ties allowed at the shoulders, strict across the full home→away swing).
    expect(atHome).toBeGreaterThanOrEqual(atNeutral)
    expect(atNeutral).toBeGreaterThanOrEqual(away)
    expect(atHome).toBeGreaterThan(away)
  })
})
