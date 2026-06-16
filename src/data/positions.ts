import type { Position, PositionMeta } from './types'

export const POSITION_META: Record<Position, PositionMeta> = {
  FB: { position: 'FB', channel: null, role: 'back', isCover: true, jersey: 1, label: 'Fullback' },
  WR: { position: 'WR', channel: 'RIGHT', role: 'back', isCover: false, jersey: 2, label: 'Right Wing' },
  CR: { position: 'CR', channel: 'RIGHT', role: 'back', isCover: false, jersey: 3, label: 'Right Centre' },
  CL: { position: 'CL', channel: 'LEFT', role: 'back', isCover: false, jersey: 4, label: 'Left Centre' },
  WL: { position: 'WL', channel: 'LEFT', role: 'back', isCover: false, jersey: 5, label: 'Left Wing' },
  FE: { position: 'FE', channel: 'LEFT', role: 'half', isCover: false, jersey: 6, label: 'Five-Eighth' },
  HB: { position: 'HB', channel: 'RIGHT', role: 'half', isCover: false, jersey: 7, label: 'Halfback' },
  PR: { position: 'PR', channel: 'MIDDLE', role: 'forward', isCover: false, jersey: 8, label: 'Front Row Prop' },
  HK: { position: 'HK', channel: 'MIDDLE', role: 'forward', isCover: false, jersey: 9, label: 'Hooker' },
  PL: { position: 'PL', channel: 'MIDDLE', role: 'forward', isCover: false, jersey: 10, label: 'Front Row Prop' },
  SRL: { position: 'SRL', channel: 'LEFT', role: 'forward', isCover: false, jersey: 11, label: 'Left Second Row' },
  SRR: { position: 'SRR', channel: 'RIGHT', role: 'forward', isCover: false, jersey: 12, label: 'Right Second Row' },
  LK: { position: 'LK', channel: 'MIDDLE', role: 'forward', isCover: false, jersey: 13, label: 'Lock' },
  INT1: { position: 'INT1', channel: null, role: 'forward', isCover: false, jersey: 14, label: 'Interchange' },
  INT2: { position: 'INT2', channel: null, role: 'forward', isCover: false, jersey: 15, label: 'Interchange' },
  INT3: { position: 'INT3', channel: null, role: 'forward', isCover: false, jersey: 16, label: 'Interchange' },
  INT4: { position: 'INT4', channel: null, role: 'forward', isCover: false, jersey: 17, label: 'Interchange' },
  INT5: { position: 'INT5', channel: null, role: 'forward', isCover: false, jersey: 18, label: 'Interchange (locked)' },
  INT6: { position: 'INT6', channel: null, role: 'forward', isCover: false, jersey: 19, label: 'Interchange (locked)' },
  RES20: { position: 'RES20', channel: null, role: 'forward', isCover: false, jersey: 20, label: '20th Man' },
  RES21: { position: 'RES21', channel: null, role: 'forward', isCover: false, jersey: 21, label: '21st Man' },
}

export const POSITION_ORDER: Position[] = [
  'FB', 'WR', 'CR', 'CL', 'WL', 'FE', 'HB', 'PR', 'HK', 'PL', 'SRL', 'SRR', 'LK',
  'INT1', 'INT2', 'INT3', 'INT4', 'INT5', 'INT6', 'RES20', 'RES21',
]

export const STARTING_POSITIONS: Position[] = POSITION_ORDER.filter(
  (p) => !p.startsWith('INT') && !p.startsWith('RES'),
)

export const BENCH_POSITIONS: Position[] = ['INT1', 'INT2', 'INT3', 'INT4', 'INT5', 'INT6']

/** The two locked bench slots (jerseys 18–19) — only usable once extra-bench unlocks in-match. */
export const LOCKED_BENCH_POSITIONS: Position[] = ['INT5', 'INT6']

/** Pre-game camp-injury cover only (20th & 21st man) — never an in-match interchange. */
export const RESERVE_POSITIONS: Position[] = ['RES20', 'RES21']

/** The 19 named to the match-day team sheet (starting 13 + 6-man bench). */
export const MATCHDAY_POSITIONS: Position[] = [...STARTING_POSITIONS, ...BENCH_POSITIONS]

/** Distinct bench players allowed onto the field in normal play (before any unlock). */
export const USABLE_BENCH_NORMAL = 4
/** Interchange cap per side (tactical swaps + rested-starter returns; HIA/injury subs are exempt). */
export const INTERCHANGE_CAP = 8

/** Channel owners for attacking/defending contests, weighted (first listed carries more of the channel). */
export const CHANNEL_OWNERS: Record<'LEFT' | 'MIDDLE' | 'RIGHT', Position[]> = {
  LEFT: ['CL', 'WL', 'SRL', 'FE'],
  MIDDLE: ['LK', 'PL', 'PR', 'HK'],
  RIGHT: ['CR', 'WR', 'SRR', 'HB'],
}
