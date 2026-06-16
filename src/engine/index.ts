export type {
  Side,
  Score,
  KickType,
  MatchEvent,
  MatchEventType,
  MatchResult,
  MatchSetup,
  MatchStats,
  SelectedTeam,
  Venue,
  VenueId,
  SeriesStakes,
  SeriesWrap,
  SeriesContext,
  ChannelTryBreakdown,
  PlayerStatLine,
  PlayerOfMatch,
  MatchBroadcast,
  PreMatchSpeech,
  Segment,
  SegmentSlot,
  ScorelineBucket,
  PhaseBucket,
} from './types'
export { simulateMatch } from './simulate'
export { makeRng, chance, pick, gauss } from './rng'
export type { Rng } from './rng'
export { TUNING, chooseKickType, resolveKick, kickSkill } from './ratings'
export type { KickOutcome, KickContext, KickResolveContext } from './ratings'
export { channelStrength, matchupRead, verdict, MATCHUP_EDGE } from './matchup'
export type { EdgeMatchup, HeadToHead, MatchupVerdict } from './matchup'
export { originLabel, deriveWrap } from './series'
export { renderCommentary, bucketScoreline, bucketPhase } from './commentary'
export type { CommentaryContext, CommentaryInput } from './commentary'
export { buildBroadcast, yourEdgeFor, yourEdgePhrase } from './broadcast'
export { PERSONAS, MAROONS_VOICES, BLUES_VOICES } from './personas'
export type { Persona, PersonaId, PersonaRole } from './personas'
