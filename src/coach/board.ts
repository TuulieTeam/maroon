import type { SeriesState } from '../series'
import { coachById, successorFor } from './coaches'
import type { Coach } from './coaches'
import { freshPressureFor } from './coachPersist'
import type { CoachEra, CoachState } from './coachPersist'
import { pressureBand } from './pressure'

/**
 * The board. It meets once a year, at season's end, after the pressure index has already absorbed
 * the series result — and it acts on two triggers only, both public knowledge:
 *   1. DEAD MAN WALKING (pressure ≥ 80) after a season close — the seat has burned through.
 *   2. UNDER SIEGE (≥ 60) with a SECOND consecutive lost series — the siege claimed its castle.
 * A sacking closes the era (immutable archive with the board's one-line verdict) and installs the
 * next legend, whose honeymoon level depends on his media temperament. Pure fold — the App boundary
 * owns when it runs (the off-season click).
 */
export interface BoardOutcome {
  sacked: boolean
  /** The closed era, when sacked. */
  era?: CoachEra
  /** The incoming coach, when sacked. */
  successor?: Coach
  /** The board's public line — the off-season screen reads it either way. */
  statement: string
}

const SACK_VERDICTS = [
  '{seasonsWord}, {shieldsWord} — the board thanked {name} for his service and reached for the axe in the same breath.',
  'The {name} era ends after {seasonsWord}. The board called it "a change of direction". Everyone else called it Tuesday.',
  '{name}, gone. {shieldsWord} in {seasonsWord} was not the ledger the board read — they read the back pages.',
]

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

const SURVIVE_LINES: Record<string, string> = {
  untouchable: 'The board met for eleven minutes and spent nine of them on catering. {name} is going nowhere.',
  solid: 'Full support from the board — and this time they even meant it. {name} coaches on.',
  simmering: 'The board "reaffirmed its full confidence" in {name}, which history says is worth about a year.',
  'under-siege': '{name} survives the board meeting — by numbers nobody outside the room will ever know.',
  'dead-man-walking': 'Somehow, {name} walks out still employed. Nobody in the building can explain it.',
}

/**
 * The annual review. `endedYear` labels the era boundary. Deterministic verdict pick (era length
 * indexes the pool — arithmetic, no rng). Returns the outcome AND the next CoachState.
 */
export function boardReview(state: CoachState, completed: SeriesState, endedYear: number): { next: CoachState; outcome: BoardOutcome } {
  const coach = coachById(state.coachId)
  const lostNow = completed.seriesWinner === 'NSW'
  const sacked = state.pressure >= 80 || (state.pressure >= 60 && lostNow && state.lostStreak >= 2)

  if (!sacked) {
    return {
      next: state,
      outcome: {
        sacked: false,
        statement: (SURVIVE_LINES[pressureBand(state.pressure)] ?? SURVIVE_LINES.solid).replaceAll('{name}', coach.name),
      },
    }
  }

  const era: CoachEra = {
    coachId: coach.id,
    coachName: coach.name,
    fromYear: state.eraFromYear || endedYear - Math.max(0, state.eraSeasons - 1),
    toYear: endedYear,
    seasons: state.eraSeasons,
    shields: state.eraShields,
    verdict: SACK_VERDICTS[state.eraSeasons % SACK_VERDICTS.length]
      .replaceAll('{name}', coach.name)
      .replaceAll('{seasonsWord}', plural(state.eraSeasons, 'season'))
      .replaceAll('{shieldsWord}', plural(state.eraShields, 'shield')),
  }
  const successor = successorFor(state.eras.length)
  const next: CoachState = {
    ...state,
    coachId: successor.id,
    pressure: freshPressureFor(successor.id),
    eraFromYear: endedYear + 1,
    eraSeasons: 0,
    eraShields: 0,
    lostStreak: 0,
    eras: [...state.eras, era],
  }
  return {
    next,
    outcome: {
      sacked: true,
      era,
      successor,
      statement: era.verdict,
    },
  }
}
