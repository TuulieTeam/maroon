import type { Venue, VenueId } from '../engine'
import type { GameNo } from './types'

/** The three Origin grounds. `homeSide` is flavour-only for v1 — no rating effect yet. */
export const VENUES: Record<VenueId, Venue> = {
  SUNCORP: { id: 'SUNCORP', stadium: 'Suncorp Stadium', groundShort: 'Suncorp', city: 'Brisbane', homeSide: 'QLD' },
  ACCOR_SYD: { id: 'ACCOR_SYD', stadium: 'Accor Stadium', groundShort: 'Accor', city: 'Sydney', homeSide: 'NSW' },
  MCG: { id: 'MCG', stadium: 'the MCG', groundShort: 'the MCG', city: 'Melbourne', homeSide: 'NSW' },
}

/** Venue rotation: Origin I in Brisbane, II in Sydney, III (decider / dead rubber) at the MCG. */
export const SERIES_SCHEDULE: Record<GameNo, VenueId> = {
  1: 'SUNCORP',
  2: 'ACCOR_SYD',
  3: 'MCG',
}

export function venueForGame(game: GameNo): Venue {
  return VENUES[SERIES_SCHEDULE[game]]
}
