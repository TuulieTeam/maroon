export type Position =
  | 'FB'
  | 'WL'
  | 'WR'
  | 'CL'
  | 'CR'
  | 'FE'
  | 'HB'
  | 'HK'
  | 'PL'
  | 'PR'
  | 'SRL'
  | 'SRR'
  | 'LK'
  | 'INT1'
  | 'INT2'
  | 'INT3'
  | 'INT4'
  | 'INT5'
  | 'INT6'
  | 'RES20'
  | 'RES21'

export type Channel = 'LEFT' | 'MIDDLE' | 'RIGHT'

export type PlayerRole = 'back' | 'forward' | 'half'

export type PlayerTag = 'veteran' | 'bolter' | 'rookie' | 'workhorse'

export type PlayerStatus = 'available' | 'injured' | 'suspended' | 'dropped'

export interface Attributes {
  attack: number
  defence: number
  speed: number
  hands: number
  composure: number
}

export interface Player {
  id: string
  name: string
  club: string
  naturalPositions: Position[]
  attrs: Attributes
  goalKicking: number
  /** Aerobic engine 1-99. Modulates fatigue accrual ONLY; default 75. */
  stamina?: number
  tag?: PlayerTag
  /** Real-world 2026 availability. Undefined = available. Players stay pickable regardless (single-player sandbox). */
  status?: PlayerStatus
  /** Short real-world form / availability note shown on the player card. */
  formNote?: string
  /** Birth year, carried by GENERATED players (dynasty rookies). Authored players use data/ages.ts. */
  birthYear?: number
}

export interface PositionMeta {
  position: Position
  channel: Channel | null
  role: PlayerRole
  isCover: boolean
  jersey: number
  label: string
}

/**
 * A scouting-report line for an opponent's dangerous channel — the booth's pre-game read of where a
 * side will hurt you. `channel` is the OPPONENT'S attacking channel (LEFT/MIDDLE/RIGHT); the booth maps
 * it to the Maroon defensive edge under pressure. Travels on `SelectedTeam.edgeThreats` so the engine
 * stays opponent-agnostic — different Blues sides ship their own threat geography as plain data.
 */
export interface EdgeThreat {
  channel: Channel
  headline: string
  detail: string
  dangerMen: string[]
}
