import type { EdgeThreat, Player, PlayerTag, Position } from './types'
import { NSW_EDGE_THREATS, NSW_KICKER_ID, NSW_LINEUP } from './nswSquad'

/**
 * NSW opponent variety. The user never PICKS their opponent (that would break the spectator stance) —
 * one of these Blues sides is drawn deterministically per series from the root seed, revealed in the
 * scouting report, and runs out all three games (evolving through the existing form/injury carryover).
 *
 * Each side carries its own lineup, goal-kicker, and `edgeThreats` scouting profile. They are built to
 * ~EQUAL overall strength but DIFFERENT shape, so the series stays competitive whoever you draw and the
 * variety is in *where* and *how* they hurt you — which changes your counter-selection every series:
 *   - `classic`   — the canonical Blues: a lethal RIGHT edge that hunts your LEFT-side defence.
 *   - `leftshift` — Latrell + Martin stack the LEFT edge, turning the heat onto your RIGHT side.
 *   - `forwards`  — a monster pack that grinds it up the MIDDLE and asks your forwards to last 80.
 *
 * `classic` reuses NSW_LINEUP verbatim, so a series that draws it is byte-identical to the legacy
 * single-opponent behaviour (and every existing fixture/calibration baseline still holds).
 */
export interface BluesTeamSheet {
  /** Stable id persisted in the series save (see series/persist.ts validation). */
  id: string
  /** The side's billing, shown in the scouting report / hub, e.g. "The Big Blue Wall". */
  name: string
  /** One-line scouting summary surfaced pre-series so you know who you're up against before you pick. */
  blurb: string
  lineup: Record<Position, Player>
  kickerId: string
  edgeThreats: EdgeThreat[]
}

/** Terse player builder — keeps two 21-man sheets readable and hard to fat-finger. */
function p(
  id: string,
  name: string,
  club: string,
  pos: Position[],
  a: number,
  d: number,
  s: number,
  h: number,
  c: number,
  stamina: number,
  tag: PlayerTag,
  goalKicking = 0,
): Player {
  return {
    id,
    name,
    club,
    naturalPositions: pos,
    attrs: { attack: a, defence: d, speed: s, hands: h, composure: c },
    goalKicking,
    stamina,
    tag,
  }
}

// ----------------------------------------------------------------------------------------------
// LEFT-SHIFT BLUES — the threat is stacked on their LEFT, so it runs at YOUR right-side defence.
// Latrell + Martin + Burton give the left edge real class; the right edge is honest but containable.
// Spine built around Moses' boot. Comparable total class to the canonical side, mirror-imaged.
// ----------------------------------------------------------------------------------------------
const LEFT_SHIFT_LINEUP: Record<Position, Player> = {
  FB: p('nsl-fb', 'Dylan Edwards', 'Panthers', ['FB'], 80, 84, 84, 82, 88, 92, 'workhorse'),
  WR: p('nsl-wr', 'Daniel Tupou', 'Roosters', ['WR', 'WL'], 79, 76, 80, 78, 80, 78, 'veteran'),
  CR: p('nsl-cr', 'Bradman Best', 'Knights', ['CR'], 82, 78, 82, 79, 76, 80, 'bolter'),
  CL: p('nsl-cl', 'Latrell Mitchell', 'Rabbitohs', ['CL', 'FB'], 92, 82, 84, 88, 80, 82, 'veteran', 80),
  WL: p('nsl-wl', "Brian To'o", 'Panthers', ['WL'], 84, 80, 86, 80, 84, 86, 'workhorse'),
  FE: p('nsl-fe', 'Jarome Luai', 'Tigers', ['FE', 'HB'], 84, 78, 82, 85, 84, 82, 'veteran', 40),
  HB: p('nsl-hb', 'Mitchell Moses', 'Eels', ['HB'], 88, 80, 80, 88, 87, 84, 'veteran', 88),
  PR: p('nsl-pr', 'Payne Haas', 'Broncos', ['PR', 'PL'], 82, 88, 70, 74, 82, 78, 'veteran'),
  HK: p('nsl-hk', 'Damien Cook', 'Rabbitohs', ['HK'], 80, 82, 86, 84, 82, 88, 'veteran'),
  PL: p('nsl-pl', 'Stefano Utoikamanu', 'Storm', ['PL', 'PR'], 78, 84, 70, 72, 76, 76, 'bolter'),
  SRL: p('nsl-srl', 'Liam Martin', 'Panthers', ['SRL', 'SRR'], 80, 86, 80, 76, 82, 90, 'workhorse'),
  SRR: p('nsl-srr', 'Angus Crichton', 'Roosters', ['SRR', 'SRL'], 78, 84, 76, 74, 78, 84, 'veteran'),
  LK: p('nsl-lk', 'Cameron Murray', 'Rabbitohs', ['LK', 'PL'], 80, 86, 80, 82, 84, 92, 'workhorse'),
  INT1: p('nsl-int1', 'Isaah Yeo', 'Panthers', ['LK', 'SRL'], 84, 88, 74, 86, 90, 94, 'veteran'),
  INT2: p('nsl-int2', 'Spencer Leniu', 'Roosters', ['PR', 'PL'], 80, 84, 68, 70, 74, 70, 'workhorse'),
  INT3: p('nsl-int3', 'Keaon Koloamatangi', 'Rabbitohs', ['SRL', 'PL', 'LK'], 80, 84, 78, 76, 78, 84, 'workhorse'),
  INT4: p('nsl-int4', 'Blayke Brailey', 'Sharks', ['HK'], 76, 82, 76, 84, 80, 84, 'workhorse'),
  INT5: p('nsl-int5', 'Matt Burton', 'Bulldogs', ['CL', 'FE', 'WL'], 83, 78, 80, 84, 78, 82, 'bolter', 70),
  INT6: p('nsl-int6', 'Connor Watson', 'Roosters', ['FE', 'HK', 'FB'], 78, 78, 80, 80, 78, 80, 'veteran'),
  RES20: p('nsl-res20', 'Clint Gutherson', 'Dragons', ['FB', 'CR', 'CL'], 80, 80, 82, 80, 82, 86, 'veteran'),
  RES21: p('nsl-res21', 'Terrell May', 'Tigers', ['PR', 'PL'], 80, 84, 66, 72, 74, 70, 'bolter'),
}

const LEFT_SHIFT_THREATS: EdgeThreat[] = [
  {
    channel: 'LEFT',
    headline: 'The Blues have stacked their left edge',
    detail:
      "Latrell Mitchell and Liam Martin run at your RIGHT-side defence all night, with Moses pulling them across. If your right centre can't hold up, they'll live in that channel.",
    dangerMen: ['Latrell Mitchell', 'Liam Martin', 'Matt Burton'],
  },
  {
    channel: 'RIGHT',
    headline: 'Their right edge is honest, not deadly',
    detail:
      "Best and Tupou will take what's on offer down the short side, but it's containable — shut it down and they go straight back to Latrell.",
    dangerMen: ['Bradman Best', 'Daniel Tupou'],
  },
]

// ----------------------------------------------------------------------------------------------
// THE BIG BLUE WALL — no edge to speak of; they want the arm-wrestle through the MIDDLE. A relentless,
// high-stamina pack (Haas/AFB/Yeo/Murray) batters your ruck and asks your forwards to last 80. The
// halves are game-managers, not magicians — the points come from go-forward, not a flash play.
// ----------------------------------------------------------------------------------------------
const FORWARDS_LINEUP: Record<Position, Player> = {
  FB: p('nsm-fb', 'James Tedesco', 'Roosters', ['FB'], 82, 82, 84, 84, 88, 84, 'veteran'),
  WR: p('nsm-wr', 'Josh Addo-Carr', 'Bulldogs', ['WR', 'WL'], 80, 74, 90, 78, 78, 80, 'veteran'),
  CR: p('nsm-cr', 'Kotoni Staggs', 'Broncos', ['CR'], 84, 84, 82, 82, 82, 82, 'veteran', 70),
  CL: p('nsm-cl', 'Stephen Crichton', 'Bulldogs', ['CL', 'CR'], 83, 88, 82, 82, 84, 84, 'veteran'),
  WL: p('nsm-wl', 'Zac Lomax', 'Eels', ['WL', 'CR'], 80, 78, 80, 80, 80, 82, 'veteran', 80),
  FE: p('nsm-fe', 'Luke Keary', 'Roosters', ['FE', 'HB'], 82, 76, 78, 86, 84, 80, 'veteran', 40),
  HB: p('nsm-hb', 'Jamal Fogarty', 'Raiders', ['HB'], 80, 80, 76, 84, 84, 84, 'veteran', 80),
  PR: p('nsm-pr', 'Payne Haas', 'Broncos', ['PR', 'PL'], 84, 88, 72, 76, 84, 84, 'veteran'),
  HK: p('nsm-hk', 'Reece Robson', 'Cowboys', ['HK'], 78, 86, 74, 86, 84, 90, 'workhorse'),
  PL: p('nsm-pl', 'Addin Fonua-Blake', 'Sharks', ['PL', 'PR'], 86, 86, 68, 76, 82, 76, 'veteran'),
  SRL: p('nsm-srl', 'Keaon Koloamatangi', 'Rabbitohs', ['SRL', 'PL'], 82, 84, 78, 78, 80, 86, 'workhorse'),
  SRR: p('nsm-srr', 'Hudson Young', 'Raiders', ['SRR', 'SRL'], 80, 84, 78, 80, 80, 86, 'workhorse'),
  LK: p('nsm-lk', 'Isaah Yeo', 'Panthers', ['LK'], 84, 88, 74, 86, 90, 94, 'veteran'),
  INT1: p('nsm-int1', 'Cameron Murray', 'Rabbitohs', ['LK', 'PL', 'PR'], 82, 86, 80, 82, 84, 92, 'workhorse'),
  INT2: p('nsm-int2', 'Stefano Utoikamanu', 'Storm', ['PR', 'PL'], 80, 84, 70, 72, 76, 78, 'bolter'),
  INT3: p('nsm-int3', 'Spencer Leniu', 'Roosters', ['PR', 'PL'], 82, 84, 68, 70, 74, 72, 'workhorse'),
  INT4: p('nsm-int4', 'Apisai Koroisau', 'Tigers', ['HK'], 78, 80, 74, 86, 84, 80, 'veteran'),
  INT5: p('nsm-int5', 'Terrell May', 'Tigers', ['PR', 'PL'], 82, 84, 66, 72, 74, 72, 'bolter'),
  INT6: p('nsm-int6', 'Victor Radley', 'Roosters', ['LK', 'SRL', 'SRR'], 78, 86, 76, 74, 74, 84, 'workhorse'),
  RES20: p('nsm-res20', 'Connor Watson', 'Roosters', ['HK', 'FE', 'FB'], 78, 78, 80, 80, 78, 80, 'veteran'),
  RES21: p('nsm-res21', 'Max King', 'Dragons', ['PR', 'PL'], 78, 82, 66, 70, 72, 70, 'workhorse'),
}

const FORWARDS_THREATS: EdgeThreat[] = [
  {
    channel: 'MIDDLE',
    headline: 'They want to win the arm-wrestle through the middle',
    detail:
      'Haas, Fonua-Blake and Yeo will batter your ruck and ask your middles to hold up for 80 minutes. If your forward pack tires, the line cracks right in front of the posts.',
    dangerMen: ['Payne Haas', 'Addin Fonua-Blake', 'Isaah Yeo'],
  },
  {
    channel: 'LEFT',
    headline: 'Crichton lurks on the left',
    detail:
      'Stephen Crichton is their one genuine edge weapon — but this side lives and dies through the middle, not out wide.',
    dangerMen: ['Stephen Crichton'],
  },
]

const CLASSIC: BluesTeamSheet = {
  id: 'classic',
  name: 'The Full-Strength Blues',
  blurb:
    'Cleary pulls the strings and the right edge is lethal — Staggs and Nawaqanitawase hunt your left-side defence.',
  lineup: NSW_LINEUP,
  kickerId: NSW_KICKER_ID,
  edgeThreats: NSW_EDGE_THREATS,
}

const LEFT_SHIFT: BluesTeamSheet = {
  id: 'leftshift',
  name: "Daley's Left-Side Blues",
  blurb:
    'Latrell and Martin stack the left edge behind Moses’ boot — this time the pressure is on your right-side defence.',
  lineup: LEFT_SHIFT_LINEUP,
  kickerId: 'nsl-hb',
  edgeThreats: LEFT_SHIFT_THREATS,
}

const FORWARDS: BluesTeamSheet = {
  id: 'forwards',
  name: 'The Big Blue Wall',
  blurb:
    'A monster pack with no interest in the edges — Haas, Fonua-Blake and Yeo grind it up the middle and dare your forwards to last 80.',
  lineup: FORWARDS_LINEUP,
  kickerId: 'nsm-hb',
  edgeThreats: FORWARDS_THREATS,
}

/** Every Blues side that can be drawn. `classic` first so index 0 is the legacy opponent. */
export const BLUES_VARIANTS: BluesTeamSheet[] = [CLASSIC, LEFT_SHIFT, FORWARDS]

/** Valid opponent ids — the series-save validator checks the stored opponentId against this. */
export const BLUES_IDS: string[] = BLUES_VARIANTS.map((v) => v.id)

/**
 * The Blues side a series faces, chosen deterministically from its root seed so replays and the career
 * ledger (deduped by rootSeed) stay stable. One opponent for the whole series.
 */
export function bluesForSeed(rootSeed: number): BluesTeamSheet {
  return BLUES_VARIANTS[(rootSeed >>> 0) % BLUES_VARIANTS.length]
}

/** Resolve a stored opponent id back to its team sheet; falls back to the canonical side if unknown. */
export function bluesById(id: string | undefined): BluesTeamSheet {
  return BLUES_VARIANTS.find((v) => v.id === id) ?? CLASSIC
}
