import { describe, expect, it } from 'vitest'
import { buildAutoLineup } from '../../data/autoSelect'
import { bluesById, BLUES_IDS } from '../../data/bluesVariants'
import { QLD_SQUAD } from '../../data/qldSquad'
import { STARTING_FORM, STARTING_INJURY } from '../../data/startingForm'
import type { Player, Position } from '../../data/types'
import { simulateMatch } from '../../engine'
import type { SelectedTeam, VenueId } from '../../engine'
import { CONDITIONS_TUNING } from '../conditions'
import { VENUES } from '../venues'

/**
 * SCORE-SHAPE GUARD — "generally realistic, with the occasional real-life blowout, but never a
 * cricket score". Buckets the margin + total distribution over the full real-game-1 seed grid
 * (starting form on QLD + home edge + every venue + every Blues variant = a fixed, deterministic
 * 1,080-game sample, so the min/max are CONSTANTS, safe to pin). This is the scenario with the
 * fattest natural tail (hot starting form stacks with the home edge), so it's the honest ceiling
 * guard. The game-management dampener (TUNING.gameManagement) is what keeps the tail here honest —
 * flattening a runaway once a side is 24+ up late, without touching the healthy ~10% blowout rate.
 */

function qldSide(): SelectedTeam {
  const pool = QLD_SQUAD.filter((p) => STARTING_INJURY[p.id] !== 'out')
  const auto = buildAutoLineup(pool)
  const byId = new Map(pool.map((p) => [p.id, p]))
  const lineup = {} as Record<Position, Player>
  for (const [pos, id] of Object.entries(auto)) {
    const pl = id ? byId.get(id) : undefined
    if (pl) lineup[pos as Position] = pl
  }
  const kicker = [...Object.values(lineup)].sort((a, b) => b.goalKicking - a.goalKicking)[0]
  return { side: 'QLD', lineup, kickerId: kicker.id }
}

describe('score-shape — realistic spread, occasional blowout, no cricket scores', () => {
  const qld = qldSide()
  const form: Record<string, number> = {}
  for (const p of Object.values(qld.lineup)) {
    form[p.id] = ((STARTING_FORM[p.id] ?? 50) - CONDITIONS_TUNING.ratingNeutral) * CONDITIONS_TUNING.toAttrScale
  }
  const venues: VenueId[] = ['SUNCORP', 'ACCOR_SYD', 'MCG']
  const margins: number[] = []
  const totals: number[] = []
  for (const vid of venues) {
    for (const variant of BLUES_IDS) {
      const opp = bluesById(variant)
      for (let seed = 1; seed <= 120; seed++) {
        const r = simulateMatch(
          {
            qld,
            nsw: { side: 'NSW', lineup: { ...opp.lineup }, kickerId: opp.kickerId, edgeThreats: opp.edgeThreats },
            series: { gameNumber: 1, seriesScore: { qld: 0, nsw: 0 }, venue: VENUES[vid], stakes: 'OPENER' },
            form,
          },
          seed,
        )
        margins.push(r.finalScore.qld - r.finalScore.nsw)
        totals.push(r.finalScore.qld + r.finalScore.nsw)
      }
    }
  }
  const abs = margins.map(Math.abs)
  const rate = (f: (x: number) => boolean, arr: number[]) => arr.filter(f).length / arr.length

  const report = {
    close12: rate((x) => x <= 12, abs),
    blowout25: rate((x) => x > 24, abs),
    drubbing35: rate((x) => x > 34, abs),
    maxMargin: Math.max(...abs),
    maxTotal: Math.max(...totals),
    over60: rate((x) => x > 60, totals),
  }
  console.log(
    `score-shape: close(≤12) ${(report.close12 * 100).toFixed(0)}% · blowout(25+) ${(report.blowout25 * 100).toFixed(0)}% · drubbing(35+) ${(report.drubbing35 * 100).toFixed(0)}% · maxMargin ${report.maxMargin} · maxTotal ${report.maxTotal} · 60+ ${(report.over60 * 100).toFixed(1)}%`,
  )

  it('most games are close — a majority land within two scores', () => {
    expect(report.close12).toBeGreaterThanOrEqual(0.5)
  })

  it('the occasional blowout still happens — variance is real, not clamped flat', () => {
    // The whole point: DO NOT over-clamp. Real footy produces the odd drubbing; keep the tail alive.
    expect(report.blowout25).toBeGreaterThanOrEqual(0.05)
  })

  it('but no cricket scores — the ceiling holds (the 70-24 / 80-12 guard)', () => {
    // Fixed sample → these maxima are deterministic constants. A real demolition tops out ~44-0;
    // an 80-12 must be impossible. If a retune breaches these, the game-management dampener needs it.
    expect(report.drubbing35).toBeLessThanOrEqual(0.04)
    expect(report.maxMargin).toBeLessThanOrEqual(50)
    expect(report.maxTotal).toBeLessThanOrEqual(88)
    expect(report.over60).toBeLessThanOrEqual(0.03)
  })
})
