// Broadcast personas — pure data. The commentary booth + studio + sideline for the Origin call.
// Real commentator/legend names are intentional (single-player game). Each persona carries a
// `lean` (who their heart's with) and a `voice` descriptor that the broadcast template pools honour.

import type { MatchEventType } from './types'

export type PersonaRole = 'Caller' | 'Analyst' | 'Host' | 'Sideline'

export type PersonaId =
  | 'thompson'
  | 'psaltis'
  | 'johns'
  | 'gould'
  | 'smith'
  | 'fittler'
  | 'lockyer'
  | 'thurston'
  | 'bracey'
  | 'mason'

export interface Persona {
  id: PersonaId
  /** Full broadcast name shown in the panel. */
  name: string
  /** Short familiar handle the others might use. */
  short: string
  role: PersonaRole
  lean: 'QLD' | 'NSW' | 'neutral'
  /** What this voice is known for — guides the tone of their lines. */
  voice: string
}

export const PERSONAS: Record<PersonaId, Persona> = {
  thompson: {
    id: 'thompson',
    name: 'Mat Thompson',
    short: 'Thommo',
    role: 'Caller',
    lean: 'neutral',
    voice: 'lead play-by-play caller — sets the scene, rides the momentum, big on the moment',
  },
  psaltis: {
    id: 'psaltis',
    name: 'Peter Psaltis',
    short: 'Petero',
    role: 'Caller',
    lean: 'neutral',
    voice: 'caller — crisp, descriptive, lets the game breathe',
  },
  johns: {
    id: 'johns',
    name: 'Andrew Johns',
    short: 'Joey',
    role: 'Analyst',
    lean: 'NSW',
    voice: 'halves play & tactical detail — kicking game, ruck speed, what the spine is doing',
  },
  gould: {
    id: 'gould',
    name: 'Phil Gould',
    short: 'Gus',
    role: 'Analyst',
    lean: 'NSW',
    voice: 'big-picture, blunt, contrarian — opens with "I\'ll tell you what"',
  },
  smith: {
    id: 'smith',
    name: 'Cameron Smith',
    short: 'Smithy',
    role: 'Analyst',
    lean: 'QLD',
    voice: 'forwards, dummy-half & game-management — dry, understated, reads the middle',
  },
  fittler: {
    id: 'fittler',
    name: 'Brad Fittler',
    short: 'Freddy',
    role: 'Analyst',
    lean: 'NSW',
    voice: 'laconic, instinctive — feel of the game over the stat sheet',
  },
  lockyer: {
    id: 'lockyer',
    name: 'Darren Lockyer',
    short: 'Locky',
    role: 'Analyst',
    lean: 'QLD',
    voice: 'measured, Maroons lens — calm, respectful, sees the long game',
  },
  thurston: {
    id: 'thurston',
    name: 'Johnathan Thurston',
    short: 'JT',
    role: 'Analyst',
    lean: 'QLD',
    voice: 'halfback craft, warm, all Queensland heart — emotional, generous',
  },
  bracey: {
    id: 'bracey',
    name: 'James Bracey',
    short: 'Bracey',
    role: 'Host',
    lean: 'neutral',
    voice: 'studio host — links the segments, frames the questions, throws to the desk',
  },
  mason: {
    id: 'mason',
    name: 'Danika Mason',
    short: 'Danika',
    role: 'Sideline',
    lean: 'neutral',
    voice: 'sideline — colour, injury updates, dressing-room mood, player quotes',
  },
}

/** Maroons-hearted analysts — the verdict leans on these when QLD win. */
export const MAROONS_VOICES: PersonaId[] = ['lockyer', 'thurston', 'smith']
/** Blues-hearted analysts — the verdict leans on these when NSW win. */
export const BLUES_VOICES: PersonaId[] = ['fittler', 'johns', 'gould']

/**
 * The two-caller booth split. The LEAD caller (Thommo — "big on the moment") takes the peaks: scoring,
 * line breaks, the kicking dividends, and the drama. The co-caller (Petero — "lets the game breathe")
 * calls the grind: hit-ups, tackles, kicks, errors, the ball-work in between. Mapping an event to its
 * caller is pure + deterministic (no rng), so it never perturbs the play stream.
 */
const LEAD_CALLER_EVENTS = new Set<MatchEventType>([
  'KICKOFF',
  'HALF_BREAK',
  'LINE_BREAK',
  'TRY',
  'FORTY_TWENTY',
  'FIELD_GOAL',
  'DROP_OUT',
  'HEAD_KNOCK',
  'HIA_PASS',
  'HIA_FAIL',
  'FOUL_PLAY',
  'SIN_BIN',
  'SIN_BIN_RETURN',
  'SEND_OFF',
  'INJURY_REPLACEMENT',
  'RESERVE_ACTIVATED',
  'HALF_TIME',
  'FULL_TIME',
])

/** Which caller's voice carries a given play-by-play event. COLOR (analyst) lines never come here. */
export function callerFor(type: MatchEventType): Persona {
  return PERSONAS[LEAD_CALLER_EVENTS.has(type) ? 'thompson' : 'psaltis']
}
