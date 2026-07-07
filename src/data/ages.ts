/**
 * Authored birth years for the QLD pool — the Dynasty's clock. Kept as a parallel table (not on
 * qldSquad.ts entries) so roster diffs stay readable. Approximate real birth years for the 2026
 * squad; a missing id falls back to a deterministic tag-band derivation in dynasty/aging.ts, so a
 * future roster addition can never crash the aging pass.
 */
export const BIRTH_YEARS: Record<string, number> = {
  // Fullbacks
  ponga: 1998,
  walsh: 2002,
  // Wingers
  cobbo: 2002,
  jfifita: 2003,
  taulagi: 1998,
  coates: 2001,
  holmes: 1995,
  // Centres
  toia: 2004,
  htf: 2001,
  shibasaki: 1998,
  // Halves
  munster: 1994,
  walker: 2002,
  dearden: 2001,
  dce: 1989,
  mam: 2003,
  hunt: 1990,
  // Hookers
  grant: 1998,
  plath: 2001,
  // Props
  tino: 2000,
  flegler: 1999,
  collins: 1995,
  fotuaika: 1999,
  // Back row & lock
  cotter: 1998,
  capewell: 1993,
  nikora: 1998,
  finefeuiaki: 2004,
  luki: 2001,
  carrigan: 1998,
  nanai: 2003,
  dfifita: 2000,
  arrow: 1995,
  sua: 1997,
}
