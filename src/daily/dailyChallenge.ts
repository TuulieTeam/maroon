import { bluesForSeed } from '../data/bluesVariants'
import type { BluesTeamSheet } from '../data/bluesVariants'
import type { Venue, VenueId } from '../engine'
import { VENUES } from '../series/venues'
import { DAILY_TWISTS } from './twists'
import type { DailyTwist } from './twists'

/**
 * The Daily Origin: one match a day, the same match for everyone who opens the game that day.
 * The local calendar date is the whole setup — it hashes to a seed that draws the Blues side, the
 * ground, and the day's twist, and then seeds the match itself. Nothing about the challenge is
 * persisted except your RESULT: the challenge is always re-derivable from its date key, the same
 * IDs-only discipline as the series save.
 */
export interface DailyChallenge {
  /** Local calendar date key, e.g. "2026-07-06". The single source of the whole challenge. */
  dateKey: string
  /** The match seed — feed straight to simulateMatch. */
  seed: number
  opponent: BluesTeamSheet
  venue: Venue
  twist: DailyTwist
}

/** The local calendar date as a stable key, e.g. "2026-07-06". The UI passes `new Date()`. */
export function dailyKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** FNV-1a over the key — a well-mixed uint32 so consecutive dates land on unrelated seeds. */
export function dailySeed(dateKey: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** All three Origin grounds rotate through the Daily — away days at Accor and the MCG included. */
const DAILY_VENUE_POOL: VenueId[] = ['SUNCORP', 'ACCOR_SYD', 'MCG']

/**
 * Build a one-shot challenge from a raw SEED — the shared core of the Daily (seed = date hash) and
 * the Gauntlet (seed = whatever a mate's link carried). Pure and deterministic: the same seed always
 * yields the same Blues side, ground, twist, and match. The three draws use decorrelated bit ranges
 * so (for example) drawing the forward pack doesn't always drag the game to the same ground.
 *
 * NOTE: the twist draw is `% DAILY_TWISTS.length`, so expanding the catalog re-rolls the twist for
 * every FUTURE date and for any previously shared gauntlet seed. Both are fine by design: the Daily
 * makes no forward promises, and the Gauntlet is ephemeral (the share card is the record).
 */
export function challengeFromSeed(seed: number, dateKey: string): DailyChallenge {
  const s = seed >>> 0
  const opponent = bluesForSeed(s)
  const twist = DAILY_TWISTS[(s >>> 8) % DAILY_TWISTS.length]
  const venueId = twist.forceVenue ?? DAILY_VENUE_POOL[(s >>> 16) % DAILY_VENUE_POOL.length]
  return { dateKey, seed: s, opponent, venue: VENUES[venueId], twist }
}

/** The day's challenge — the same challenge for every mate who opens the game that day. */
export function buildDailyChallenge(dateKey: string): DailyChallenge {
  return challengeFromSeed(dailySeed(dateKey), dateKey)
}
