import { QLD_SQUAD } from '../data/qldSquad'
import { POSITION_META } from '../data/positions'
import type { Player } from '../data/types'
import { makeRng } from '../engine'
import type { SeriesState } from '../series'
import { AGING_TUNING, ageOf, retirementChance, seasonDrift } from './aging'
import { eraLine, farewellLine, moverNote } from './narrative'
import { offseasonSeed } from './seed'
import type { AttrDelta, DynastyState, OffseasonReport, YearArchive, YearOverlay } from './types'

/**
 * The off-season — the dynasty's ONE state transition. Archives the finished year, ages every
 * active player, rolls retirements, and rolls the calendar. Pure and deterministic: the whole pass
 * derives from `offseasonSeed(dynastySeed, year)`, with a FIXED 7 rng draws per active player
 * (sorted by id) before any variable-count narrative draws — the advanceConditions discipline, so
 * a squad edit or branch can never desync the stream mid-loop.
 *
 * M1 interim rule (until the rookie class ships in the next drop): probabilistic retirements are
 * viability-capped — a man "goes around one more year" rather than leave the squad unfillable —
 * but the age-36 hard cap ALWAYS retires (no immortals). Rookie intake replaces the cap in M2.
 */
export const VIABILITY = {
  /** Never let probabilistic retirements shrink the pool below this (auto-fill needs 21). */
  minSquad: 24,
  /** Every natural position keeps at least this many fits among the unretired. */
  minNaturalFits: 2,
  /** The absolute floor even FORCED (36+) retirements respect in M1 — "someone has to go around
   *  one more year". Removed when rookie intake (M2) starts refilling the pool. */
  forcedFloor: 22,
} as const

export function runOffseason(
  state: DynastyState,
  completed: SeriesState,
  base: Player[] = QLD_SQUAD,
): { next: DynastyState; report: OffseasonReport } {
  const year = state.currentYear
  const rng = makeRng(offseasonSeed(state.dynastySeed, year))
  const alreadyRetired = new Set(state.overlay.retired)
  const active = base.filter((p) => !alreadyRetired.has(p.id)).sort((a, b) => (a.id < b.id ? -1 : 1))

  // ---- Fixed-draw section: 6 drift draws + 1 retirement roll per active player, in id order. ----
  const drifts = new Map<string, AttrDelta>()
  const rolls = new Map<string, number>()
  for (const p of active) {
    drifts.set(p.id, seasonDrift(p, ageOf(p, year), rng))
    rolls.set(p.id, rng())
  }

  // ---- Decisions (no draws): retirements, oldest considered first, viability-capped. ----
  const cumulative = (p: Player): AttrDelta => sumDelta(state.overlay.attrDeltas[p.id], drifts.get(p.id))
  const resolvedOverall = (p: Player): number => {
    const d = cumulative(p)
    return (
      (p.attrs.attack + d.attack + p.attrs.defence + d.defence + p.attrs.speed + d.speed +
        p.attrs.hands + d.hands + p.attrs.composure + d.composure) / 5
    )
  }
  const remaining = new Set(active.map((p) => p.id))
  const retirees: Player[] = []
  const canRetire = (p: Player): boolean => {
    if (remaining.size - 1 < VIABILITY.minSquad) return false
    for (const pos of p.naturalPositions) {
      const fits = active.filter((q) => remaining.has(q.id) && q.id !== p.id && q.naturalPositions.includes(pos))
      if (fits.length < VIABILITY.minNaturalFits) return false
    }
    return true
  }
  for (const p of [...active].sort((a, b) => ageOf(b, year) - ageOf(a, year) || (a.id < b.id ? -1 : 1))) {
    const age = ageOf(p, year)
    const chance = retirementChance(age, resolvedOverall(p))
    const forced = age >= AGING_TUNING.retirementForcedAge
    const allowed = forced ? remaining.size - 1 >= VIABILITY.forcedFloor : canRetire(p)
    if (rolls.get(p.id)! < chance && allowed) {
      remaining.delete(p.id)
      retirees.push(p)
    }
  }

  // ---- Fold into the cumulative overlay. ----
  const attrDeltas: Record<string, AttrDelta> = {}
  for (const p of active) {
    if (!remaining.has(p.id)) continue
    attrDeltas[p.id] = cumulative(p)
  }
  const overlay: YearOverlay = {
    attrDeltas,
    retired: [...state.overlay.retired, ...retirees.map((p) => p.id)],
  }

  // ---- Narrative (variable draws AFTER the fixed section — decisions above are deterministic). ----
  const report: OffseasonReport = {
    endedYear: year,
    nextYear: year + 1,
    retirements: retirees.map((p) => {
      const age = ageOf(p, year)
      const position = POSITION_META[p.naturalPositions[0]].label
      return { id: p.id, name: p.name, age, position, farewell: farewellLine(p.name, age, position, rng) }
    }),
    risers: [],
    faders: [],
    eraLine: '',
  }
  const movers = active
    .filter((p) => remaining.has(p.id))
    .map((p) => ({ p, net: netDrift(drifts.get(p.id)!) }))
    .sort((a, b) => b.net - a.net)
  report.risers = movers.slice(0, 3).filter((m) => m.net > 0).map((m) => ({ name: m.p.name, note: moverNote(true, rng) }))
  report.faders = movers.slice(-3).filter((m) => m.net < 0).reverse().map((m) => ({ name: m.p.name, note: moverNote(false, rng) }))

  // ---- Archive the finished year + roll the calendar. ----
  const archive: YearArchive = {
    year,
    seriesRootSeed: completed.rootSeed,
    seriesScore: { ...completed.seriesScore },
    seriesWinner: completed.seriesWinner ?? 'QLD',
    retained: completed.seriesWinner === 'QLD' && completed.seriesScore.qld === completed.seriesScore.nsw,
    retirements: report.retirements.map((r) => ({ name: r.name, age: r.age })),
  }
  const years = [...state.years, archive]
  const shields = years.filter((y) => y.seriesWinner === 'QLD').length
  let straight = 0
  for (let i = years.length - 1; i >= 0 && years[i].seriesWinner === 'QLD'; i--) straight++
  report.eraLine = eraLine(year + 1, state.startYear, shields, straight)

  return {
    next: { ...state, overlay, years, currentYear: year + 1 },
    report,
  }
}

function sumDelta(a: AttrDelta | undefined, b: AttrDelta | undefined): AttrDelta {
  return {
    attack: (a?.attack ?? 0) + (b?.attack ?? 0),
    defence: (a?.defence ?? 0) + (b?.defence ?? 0),
    speed: (a?.speed ?? 0) + (b?.speed ?? 0),
    hands: (a?.hands ?? 0) + (b?.hands ?? 0),
    composure: (a?.composure ?? 0) + (b?.composure ?? 0),
    stamina: (a?.stamina ?? 0) + (b?.stamina ?? 0),
  }
}

function netDrift(d: AttrDelta): number {
  return d.attack + d.defence + d.speed + d.hands + d.composure + d.stamina
}
