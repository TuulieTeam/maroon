import type { Channel, Player, Position } from '../data/types'
import { CHANNEL_OWNERS } from '../data/positions'
import {
  defendingChannelFor,
  effectiveAttr,
  ownerAttackContribution,
  ownerDefenceContribution,
  weightedBlend,
} from './ratings'

/** Rating gap (you - opp) at or beyond which an edge is called an advantage / at-risk. */
export const MATCHUP_EDGE = 5

export type MatchupVerdict = 'advantage' | 'even' | 'at-risk'

export function verdict(diff: number): MatchupVerdict {
  if (diff >= MATCHUP_EDGE) return 'advantage'
  if (diff <= -MATCHUP_EDGE) return 'at-risk'
  return 'even'
}

/** One head-to-head: your rating vs the opponent's, the gap, and the verdict. */
export interface HeadToHead {
  you: number
  opp: number
  diff: number
  verdict: MatchupVerdict
}

export interface EdgeMatchup {
  /** Your attacking channel. */
  channel: Channel
  /** The opponent channel your channel is contested against (cross-wired). */
  opponentChannel: Channel
  /** Your attack vs their defence where YOUR channel attacks. Null if your channel is incomplete. */
  attack: HeadToHead | null
  /** Your defence vs their attack where THEIR attack hits your channel. Null if your channel is incomplete. */
  defence: HeadToHead | null
}

/**
 * Full-strength (fatigue 0, no rng) attack/defence read for a channel. MIRRORS `channelUnit` — both
 * blend the SAME per-owner contributions (ownerAttackContribution / ownerDefenceContribution) with
 * the SAME `TUNING.ownerWeights` via `weightedBlend`, so the selection read can't drift from the
 * contest math. Returns null if ANY of the channel's four owners is unassigned in `lineup`.
 * Values are rounded to integers for display.
 */
export function channelStrength(
  lineup: Partial<Record<Position, Player>>,
  channel: Channel,
  /** Per-player form deltas (id -> signed effective-attr points). Empty/omitted = form-free. */
  form?: ReadonlyMap<string, number>,
): { attack: number; defence: number } | null {
  const owners = CHANNEL_OWNERS[channel]
  const players: Player[] = []
  for (const pos of owners) {
    const player = lineup[pos]
    if (!player) return null
    players.push(player)
  }
  // Full strength: fatigue 0, so each effective attr is the base nudged by the per-game form delta —
  // routed through `effectiveAttr` (same clamp) exactly as `ownerViews` does, so the selection read can
  // never drift from how the game actually plays.
  const ea = (attr: number, p: Player) => effectiveAttr(attr, 0, form?.get(p.id) ?? 0)
  const attack = weightedBlend(
    players.map((p) =>
      ownerAttackContribution({ attack: ea(p.attrs.attack, p), speed: ea(p.attrs.speed, p), hands: ea(p.attrs.hands, p) }),
    ),
  )
  const defence = weightedBlend(
    players.map((p) => ownerDefenceContribution({ defence: ea(p.attrs.defence, p), speed: ea(p.attrs.speed, p) })),
  )
  return { attack: Math.round(attack), defence: Math.round(defence) }
}

function head(you: number, opp: number): HeadToHead {
  const diff = you - opp
  return { you, opp, diff, verdict: verdict(diff) }
}

/**
 * The selection-time matchup read. For each of your channels (LEFT / MIDDLE / RIGHT), compares it
 * against the cross-wired opponent channel it actually contests (`defendingChannelFor`):
 *  - attack: where YOUR channel attacks — your attack vs their defence.
 *  - defence: where THEIR attack hits your channel — your defence vs their attack.
 * So your LEFT edge faces NSW's RIGHT-side threat, and vice-versa; MIDDLE faces MIDDLE.
 * Pure + deterministic (no rng, no fatigue). An incomplete channel yields null attack/defence.
 */
export function matchupRead(
  you: Partial<Record<Position, Player>>,
  opp: Record<Position, Player>,
  /** Your players' form deltas, so the read reflects who's hot/cold. Opp form stays hidden. */
  youForm?: ReadonlyMap<string, number>,
): EdgeMatchup[] {
  const channels: Channel[] = ['LEFT', 'MIDDLE', 'RIGHT']
  return channels.map((channel) => {
    const opponentChannel = defendingChannelFor(channel)
    const yours = channelStrength(you, channel, youForm)
    const theirs = channelStrength(opp, opponentChannel)
    if (!yours || !theirs) {
      return { channel, opponentChannel, attack: null, defence: null }
    }
    return {
      channel,
      opponentChannel,
      attack: head(yours.attack, theirs.defence),
      defence: head(yours.defence, theirs.attack),
    }
  })
}
