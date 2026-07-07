import type { Player, Position } from '../data/types'
import { STARTING_POSITIONS, MATCHDAY_POSITIONS } from '../data/positions'
import { buildAutoLineup } from '../data/autoSelect'
import type { SelectedTeam } from '../engine'
import type { ConditionMap } from '../series'

/**
 * The Back Page's raw material: what was BOLD about this team sheet. Derived purely from data the
 * app already has at lock-in — the picked 19+2 versus what the media expected (last game's XVII
 * mid-series, or the form-aware auto-selection for a game 1: the "selectors' XVII" the papers would
 * have printed that morning). The media takes a position on the boldest call before kick-off and is
 * proven right or wrong by the result — that loop is the drama engine.
 */
export type StorylineKind =
  | 'axed-star' // a star the media expected is out, and not through injury
  | 'recalled-outcast' // a discarded man (real-world status 'dropped') is back in
  | 'blooded-rookie' // an uncapped rookie starts
  | 'kept-faith' // an out-of-form man keeps his jersey
  | 'gamble-doubtful' // a doubtful body is risked
  | 'positional-shock' // a starter named out of his natural position

export interface Storyline {
  kind: StorylineKind
  playerId: string
  playerName: string
  /** Extra colour for the templates, e.g. the position label for a positional shock. */
  note?: string
}

/** Priority when the papers pick THE story — the axing always beats the debut. */
const BOLDNESS: StorylineKind[] = [
  'axed-star',
  'recalled-outcast',
  'gamble-doubtful',
  'blooded-rookie',
  'positional-shock',
  'kept-faith',
]

const overall = (p: Player) =>
  (p.attrs.attack + p.attrs.defence + p.attrs.speed + p.attrs.hands + p.attrs.composure) / 5

export interface StorylineInputs {
  /** The locked team about to run out. */
  team: SelectedTeam
  /** The full squad pool (status/tags read from here). */
  squad: Player[]
  /** Live conditions — injuries excuse an "axing"; cold form makes keeping faith a story. */
  conditions: ConditionMap
  /** Last game's XVII (ids by position), when one exists — otherwise the media's auto-expected side. */
  priorLineup?: Partial<Record<Position, string>>
}

/**
 * Every storyline this sheet carries, boldest first. Pure and deterministic — same sheet, same
 * stories. The FIRST entry is the back-page splash.
 */
export function deriveStorylines(inputs: StorylineInputs): Storyline[] {
  const { team, squad, conditions } = inputs
  const byId = new Map(squad.map((p) => [p.id, p]))
  const stories: Storyline[] = []

  // What the media expected: the prior XVII, or the form-aware auto side for an opener.
  const expected =
    inputs.priorLineup ??
    buildAutoLineup(
      squad.filter((p) => {
        const k = conditions[p.id]?.injury.kind
        return k !== 'out' && k !== 'suspended'
      }),
    )
  const pickedIds = new Set(MATCHDAY_POSITIONS.map((pos) => team.lineup[pos]?.id).filter(Boolean))

  // Axed star: expected on the sheet, good enough to be news, missing — and fit (injury is no story).
  for (const pos of MATCHDAY_POSITIONS) {
    const id = expected[pos]
    if (!id || pickedIds.has(id)) continue
    const p = byId.get(id)
    if (!p) continue
    const injured = conditions[id]?.injury.kind
    if (injured === 'out' || injured === 'suspended') continue
    if (overall(p) >= 78 || p.tag === 'veteran') stories.push({ kind: 'axed-star', playerId: id, playerName: p.name })
  }

  for (const pos of STARTING_POSITIONS) {
    const picked = team.lineup[pos]
    if (!picked) continue
    const p = byId.get(picked.id)
    if (p?.status === 'dropped') stories.push({ kind: 'recalled-outcast', playerId: p.id, playerName: p.name })
    if (p?.tag === 'rookie') stories.push({ kind: 'blooded-rookie', playerId: p.id, playerName: p.name })
    if (conditions[picked.id]?.injury.kind === 'doubtful')
      stories.push({ kind: 'gamble-doubtful', playerId: picked.id, playerName: picked.name })
    const form = conditions[picked.id]?.form
    if (form !== undefined && form <= 30)
      stories.push({ kind: 'kept-faith', playerId: picked.id, playerName: picked.name })
    if (!picked.naturalPositions.includes(pos))
      stories.push({ kind: 'positional-shock', playerId: picked.id, playerName: picked.name, note: pos })
  }

  // One story per man — a player who is both doubtful AND cold gets his boldest angle only
  // (two headlines about the same bloke reads like a paper padding its page). Boldest first.
  const seen = new Set<string>()
  return [...stories]
    .sort((a, b) => BOLDNESS.indexOf(a.kind) - BOLDNESS.indexOf(b.kind))
    .filter((s) => {
      if (seen.has(s.playerId)) return false
      seen.add(s.playerId)
      return true
    })
}
