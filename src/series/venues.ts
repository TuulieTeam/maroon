import type { Venue, VenueId } from '../engine'
import type { GameNo } from './types'

/**
 * The three Origin grounds. `homeAdvantage` (0..1) scales the home-ground rating edge: Suncorp is a
 * genuine fortress (1), Accor a hostile but never one-sided Sydney home (0.5 — half those stands are
 * expat Queenslanders anyway), and the MCG a near-neutral interstate deck where the nominal NSW
 * "home" barely counts (0.2). See TUNING.homeEdge for the points; realBalance.test.ts for the feel.
 */
export const VENUES: Record<VenueId, Venue> = {
  SUNCORP: { id: 'SUNCORP', stadium: 'Suncorp Stadium', groundShort: 'Suncorp', city: 'Brisbane', homeSide: 'QLD', homeAdvantage: 1 },
  ACCOR_SYD: { id: 'ACCOR_SYD', stadium: 'Accor Stadium', groundShort: 'Accor', city: 'Sydney', homeSide: 'NSW', homeAdvantage: 0.5 },
  MCG: { id: 'MCG', stadium: 'the MCG', groundShort: 'the MCG', city: 'Melbourne', homeSide: 'NSW', homeAdvantage: 0.2 },
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
