import { describe, expect, it } from 'vitest'
import { buildAutoLineup } from '../../data/autoSelect'
import { bluesById, bluesForSeed, BLUES_IDS } from '../../data/bluesVariants'
import { QLD_SQUAD } from '../../data/qldSquad'
import { STARTING_INJURY } from '../../data/startingForm'
import type { Player, Position } from '../../data/types'
import { simulateMatch } from '../../engine'
import type { MatchSetup, SelectedTeam, VenueId } from '../../engine'
import { nswDifficultyDelta } from '../difficulty'
import type { Difficulty } from '../difficulty'
import { gameSeed } from '../seed'
import { VENUES } from '../venues'

/**
 * THE REAL-SQUAD BALANCE GUARD — the test the game shipped without. Every other calibration suite
 * runs synthetic/uniform fixtures; this one fields the actual authored QLD_SQUAD (as a fresh save
 * sees it: game-1 OUT men unavailable, auto-picked best legal side, best boot on the tee) against
 * the real Blues sheets, and pins the product target the user chose ("Maroon-tinted"):
 *
 *   Origin difficulty, well-picked side → ~60% match win at Suncorp, ~50% away,
 *   losses mostly close (blowouts ≥24 rare). Hard ~35%. Casual ~75%.
 *
 * This is the tune→measure→re-pin loop's instrument: it prints a per-cell report every run.
 * If a data/tuning change moves the numbers outside the bands, the FEEL of the game moved —
 * retune the data (see qldSquad.ts) rather than loosening the bands.
 */

/** The best legal 19+2 a fresh save can actually field (mirrors scenarios' referenceTeam). */
function qldRealSide(): SelectedTeam {
  const pool = QLD_SQUAD.filter((p) => STARTING_INJURY[p.id] !== 'out')
  const auto = buildAutoLineup(pool) // statusPenalty keeps dropped/doubtful men out naturally
  const byId = new Map(pool.map((p) => [p.id, p]))
  const lineup = {} as Record<Position, Player>
  for (const [pos, id] of Object.entries(auto)) {
    const player = id ? byId.get(id) : undefined
    if (player) lineup[pos as Position] = player
  }
  const kicker = [...Object.values(lineup)].sort((a, b) => b.goalKicking - a.goalKicking)[0]
  return { side: 'QLD', lineup, kickerId: kicker.id }
}

/**
 * The App.tsx kickoff composition, mirrored: the venue rides the series context (the ENGINE folds
 * the home edge in buildFormMap — never hand-add it here, that double-counts), and difficulty is a
 * uniform NSW form-map delta. No QLD form map: this is the neutral-form parity lens.
 */
function setupFor(qld: SelectedTeam, variantId: string, venueId: VenueId, difficulty: Difficulty): MatchSetup {
  const opponent = bluesById(variantId)
  const form: Record<string, number> = {}
  const delta = nswDifficultyDelta(difficulty)
  if (delta !== 0) for (const p of Object.values(opponent.lineup)) form[p.id] = delta
  return {
    qld,
    nsw: {
      side: 'NSW',
      lineup: { ...opponent.lineup },
      kickerId: opponent.kickerId,
      edgeThreats: opponent.edgeThreats,
    },
    series: { gameNumber: 1, seriesScore: { qld: 0, nsw: 0 }, venue: VENUES[venueId], stakes: 'OPENER' },
    form,
  }
}

interface CellStats {
  n: number
  winRate: number // QLD wins / n (a draw is not a win)
  avgMargin: number // mean (qld - nsw)
  medianAbs: number
  blowoutRate: number // |margin| >= 24
}

function statsOf(margins: number[]): CellStats {
  const n = margins.length
  const wins = margins.filter((m) => m > 0).length
  const avg = margins.reduce((a, b) => a + b, 0) / n
  const abs = margins.map(Math.abs).sort((a, b) => a - b)
  const medianAbs = abs[Math.floor(n / 2)]
  const blowouts = margins.filter((m) => Math.abs(m) >= 24).length
  return { n, winRate: wins / n, avgMargin: avg, medianAbs, blowoutRate: blowouts / n }
}

const fmt = (s: CellStats) =>
  `win ${(s.winRate * 100).toFixed(0)}% · avg margin ${s.avgMargin >= 0 ? '+' : ''}${s.avgMargin.toFixed(1)} · median |m| ${s.medianAbs} · blowouts ${(s.blowoutRate * 100).toFixed(0)}% (n=${s.n})`

const ORIGIN_SEEDS = 50
const VENUE_IDS: VenueId[] = ['SUNCORP', 'ACCOR_SYD', 'MCG']

describe('real-squad balance — the Maroon-tinted target', () => {
  // One QLD side + all margins computed once; every assertion reads from this.
  const qld = qldRealSide()

  const originByVenue = new Map<VenueId, number[]>()
  for (const venueId of VENUE_IDS) {
    const margins: number[] = []
    for (const variantId of BLUES_IDS) {
      for (let seed = 1; seed <= ORIGIN_SEEDS; seed++) {
        const r = simulateMatch(setupFor(qld, variantId, venueId, 'origin'), seed)
        margins.push(r.finalScore.qld - r.finalScore.nsw)
      }
    }
    originByVenue.set(venueId, margins)
  }

  const hardMargins: number[] = []
  const casualMargins: number[] = []
  for (let seed = 1; seed <= 60; seed++) {
    const h = simulateMatch(setupFor(qld, 'classic', 'SUNCORP', 'hard'), seed)
    hardMargins.push(h.finalScore.qld - h.finalScore.nsw)
    const c = simulateMatch(setupFor(qld, 'classic', 'SUNCORP', 'casual'), seed)
    casualMargins.push(c.finalScore.qld - c.finalScore.nsw)
  }

  // The report first — the tune loop reads this whether or not the pins hold.
  console.log(
    [
      '--- real-squad balance report ---',
      ...VENUE_IDS.map((v) => `origin @ ${v}: ${fmt(statsOf(originByVenue.get(v)!))}`),
      `hard   @ SUNCORP: ${fmt(statsOf(hardMargins))}`,
      `casual @ SUNCORP: ${fmt(statsOf(casualMargins))}`,
    ].join('\n'),
  )

  it('Origin at Suncorp is Maroon-tinted (~60%) and Origin away is a contest (~50%)', () => {
    const suncorp = statsOf(originByVenue.get('SUNCORP')!)
    const accor = statsOf(originByVenue.get('ACCOR_SYD')!)
    const mcg = statsOf(originByVenue.get('MCG')!)
    // Tightened around the tuned numbers (61% / 43% / 47% at ship): a drift outside these bands
    // means the FEEL moved — retune the data, don't loosen the pins.
    expect(suncorp.winRate).toBeGreaterThanOrEqual(0.55)
    expect(suncorp.winRate).toBeLessThanOrEqual(0.67)
    expect(accor.winRate).toBeGreaterThanOrEqual(0.4)
    expect(accor.winRate).toBeLessThanOrEqual(0.52)
    expect(mcg.winRate).toBeGreaterThanOrEqual(0.42)
    expect(mcg.winRate).toBeLessThanOrEqual(0.54)
    expect(suncorp.avgMargin).toBeGreaterThanOrEqual(2)
    expect(suncorp.avgMargin).toBeLessThanOrEqual(8)
    expect(accor.avgMargin).toBeGreaterThanOrEqual(-5)
    expect(accor.avgMargin).toBeLessThanOrEqual(2)
  })

  it('losses are mostly close — the game is contested, not a procession', () => {
    const all = VENUE_IDS.flatMap((v) => originByVenue.get(v)!)
    const pooled = statsOf(all)
    expect(pooled.medianAbs).toBeLessThanOrEqual(14)
    expect(pooled.blowoutRate).toBeLessThanOrEqual(0.2)
  })

  it('the difficulty dial means what it says against the real squad', () => {
    expect(statsOf(hardMargins).winRate).toBeGreaterThanOrEqual(0.24)
    expect(statsOf(hardMargins).winRate).toBeLessThanOrEqual(0.38)
    expect(statsOf(casualMargins).winRate).toBeGreaterThanOrEqual(0.8)
  })

  it('the fixture is deterministic (same setup + seed twice)', () => {
    const a = simulateMatch(setupFor(qld, 'classic', 'SUNCORP', 'origin'), 7)
    const b = simulateMatch(setupFor(qld, 'classic', 'SUNCORP', 'origin'), 7)
    expect(b.finalScore).toEqual(a.finalScore)
  })

  it('series shape (diagnostic — printed, loosely pinned)', () => {
    // The real three-game arc: Suncorp → Accor → MCG on each root's drawn Blues side.
    let seriesWins = 0
    const roots = 30
    for (let root = 1; root <= roots; root++) {
      const variant = bluesForSeed(root).id
      let q = 0
      let n = 0
      VENUE_IDS.forEach((venueId, i) => {
        const r = simulateMatch(setupFor(qld, variant, venueId, 'origin'), gameSeed(root, (i + 1) as 1 | 2 | 3))
        if (r.finalScore.qld > r.finalScore.nsw) q++
        else if (r.finalScore.nsw > r.finalScore.qld) n++
      })
      if (q > n) seriesWins++
    }
    // eslint-disable-next-line no-console
    console.log(`series diagnostic: QLD wins ${seriesWins}/${roots} (${((seriesWins / roots) * 100).toFixed(0)}%)`)
    // Very loose — the per-venue pins above are the real guard; this catches gross series-level drift.
    expect(seriesWins / roots).toBeGreaterThanOrEqual(0.4)
    expect(seriesWins / roots).toBeLessThanOrEqual(0.85)
  })
})
