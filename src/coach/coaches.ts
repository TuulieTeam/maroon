/**
 * The coach roster. Billy Slater holds the clipboard first; when the board acts, the next legend in
 * the succession takes over — each with a media TEMPERAMENT that sets where his honeymoon starts
 * (the press give a beloved favourite son more rope than a combative outsider) and colours the
 * presser voice. Succession is deterministic: the roster order, cycling if a dynasty somehow burns
 * through all six.
 */
export type CoachTemperament = 'beloved' | 'measured' | 'combative'

export interface Coach {
  /** Stable id persisted in maroon.coach.v1. Never reuse a shipped id. */
  id: string
  name: string
  /** Surname the back pages shout, e.g. "SLATER AXES..." */
  surname: string
  /** First name for the softer columns. */
  first: string
  /** The billing the appointment gets, e.g. "the favourite son". */
  billing: string
  temperament: CoachTemperament
}

/** Where each temperament's hot seat starts a fresh era. */
export const TEMPERAMENT_START: Record<CoachTemperament, number> = {
  beloved: 25,
  measured: 30,
  combative: 35,
}

export const COACHES: Coach[] = [
  { id: 'slater', name: 'Billy Slater', surname: 'Slater', first: 'Billy', billing: 'the favourite son', temperament: 'beloved' },
  { id: 'smith', name: 'Cameron Smith', surname: 'Smith', first: 'Cameron', billing: 'the accountant of the game', temperament: 'measured' },
  { id: 'thurston', name: 'Johnathan Thurston', surname: 'Thurston', first: 'JT', billing: 'the heartbeat of the north', temperament: 'beloved' },
  { id: 'lockyer', name: 'Darren Lockyer', surname: 'Lockyer', first: 'Darren', billing: 'the quiet general', temperament: 'measured' },
  { id: 'langer', name: 'Allan Langer', surname: 'Langer', first: 'Alfie', billing: "the battlers' pick", temperament: 'combative' },
  { id: 'meninga', name: 'Mal Meninga', surname: 'Meninga', first: 'Mal', billing: 'the godfather, back one more time', temperament: 'measured' },
]

export function coachById(id: string | undefined): Coach {
  return COACHES.find((c) => c.id === id) ?? COACHES[0]
}

/** The next man up after `erasSoFar` sackings — roster order, cycling past the end. */
export function successorFor(erasSoFar: number): Coach {
  return COACHES[(erasSoFar + 1) % COACHES.length]
}
