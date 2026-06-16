import type { InjuryKind } from '../series/types'

/**
 * Each Maroon's STARTING form rating (0–100, 50 = neutral) going into Origin I, hand-set to match his
 * real-world form note so selection bites from the very first game — a red-hot bolter rates high, a
 * dropped/slumping veteran low. Players omitted here (the NSW 21) start neutral (50). The first club
 * round then nudges everyone from this baseline.
 */
export const STARTING_FORM: Record<string, number> = {
  ponga: 62, // reclaimed the No.1, starred on his return
  walsh: 46, // mixed start, electric but inconsistent
  cobbo: 70, // red-hot — four tries in three
  jfifita: 64, // the Titans' leading try-scorer, a star in the making
  taulagi: 50, // back from concussion, reliable
  coates: 55, // first-choice winger (but injured)
  holmes: 40, // dropped for poor club form
  toia: 56, // tough defender on a try-scoring edge
  htf: 68, // red-hot touch off a flying club season
  shibasaki: 48, // genuine depth (carrying a knock)
  munster: 60, // shook off an early slump, the Maroon heartbeat
  walker: 54, // creative and dangerous, but green
  dearden: 58, // first-choice halfback, reigning medallist (but injured)
  dce: 42, // ex-captain not recalled, the legs have slowed
  mam: 38, // axed, at a low ebb
  hunt: 50, // veteran utility depth
  grant: 66, // two-time Dally M hooker, a match-winner
  plath: 52, // uncapped, energetic motor
  tino: 54, // pack leader, but ordinary club form
  flegler: 58, // returned to form
  collins: 54, // consistent impact
  fotuaika: 50, // reliable depth
  cotter: 62, // relentless engine, his club's captain
  capewell: 54, // defensively dependable
  nikora: 58, // strong club form, pushing for a start
  finefeuiaki: 52, // raw, athletic bolter
  luki: 48, // fringe, knocking on the door
  carrigan: 60, // elite lock (but injured)
  nanai: 54, // attacking edge, leaky defence
  dfifita: 44, // freakish but maddeningly inconsistent
  arrow: 50, // honest middle/lock depth
  sua: 50, // does the unseen work
}

/**
 * Players who begin the series carrying a real-world injury — they miss (OUT) or are doubtful for
 * Origin I, then return as the games count down. This is what forces a genuine Game-1 reshuffle.
 */
export const STARTING_INJURY: Record<string, InjuryKind> = {
  coates: 'out', // Achilles surgery
  dearden: 'out', // ankle surgery
  carrigan: 'out', // ankle injury
  shibasaki: 'doubtful', // carrying a knock
}
