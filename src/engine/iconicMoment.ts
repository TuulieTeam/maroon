import type { IconicMoment, MatchEvent, PlayerOfMatch, Score, Segment, Side } from './types'

/**
 * The iconic moment — the booth crowns a match's defining play. THE ONE RULE THAT MAKES THIS SAFE:
 * this is a pure, ZERO-RNG post-hoc scan over the COMPLETED events array. It draws nothing from the
 * match stream and runs after the final whistle, so the play-by-play is byte-identical with the
 * feature on (pinned by the determinism suite). Line variety comes from hashing seed × minute —
 * arithmetic, never rng.
 *
 * The priority ladder, best story first:
 *   1. The dagger — a field goal by the winner in the last ten of a one-score game.
 *   2. The match-winner — the last score that put the eventual winner in front for good (crowned on
 *      the try, even when the lead technically arrived with the boot).
 *   3. The back-breaker — in a blowout won wire-to-wire, the second-half try that killed the contest.
 *   4. The fallback — the player of the match's best play (a draw still has a defining moment).
 * Crowned REGARDLESS of side: when a Blue produces it, the booth says so through gritted teeth —
 * and the nemesis system feeds on exactly that.
 */

/** From `side`'s point of view, the margin of a score. */
function marginFor(side: Side, score: Score): number {
  return side === 'QLD' ? score.qld - score.nsw : score.nsw - score.qld
}

export function pickIconicMoment(
  events: MatchEvent[],
  winner: Side | 'DRAW',
  playerOfMatch: PlayerOfMatch,
): IconicMoment | null {
  const finalScore = events[events.length - 1]?.score ?? { qld: 0, nsw: 0 }

  if (winner !== 'DRAW') {
    const finalMargin = marginFor(winner, finalScore)

    // 1. The dagger: a winner's field goal in the last ten of what stayed a one-score game.
    if (finalMargin <= 6) {
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i]
        if (e.type === 'FIELD_GOAL' && e.side === winner && e.minute >= 70 && e.attacker) {
          return toMoment(e, 'FIELD_GOAL', e.attacker.id, e.attacker.name)
        }
      }
    }

    // 2. The match-winner: the LAST transition into the lead — by construction, the score after
    // which the winner never trailed again. If the lead arrived with a conversion, crown its try.
    let leadEventIdx = -1
    let prev: Score = { qld: 0, nsw: 0 }
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (marginFor(winner, prev) <= 0 && marginFor(winner, e.score) > 0) leadEventIdx = i
      prev = e.score
    }
    if (leadEventIdx >= 0) {
      let crowned = events[leadEventIdx]
      if (crowned.type === 'CONVERSION') {
        for (let i = leadEventIdx - 1; i >= 0; i--) {
          const e = events[i]
          if (e.type === 'TRY' && e.side === crowned.side) {
            crowned = e
            break
          }
        }
      }
      // 3. In a wire-to-wire blowout the "match-winner" is some early try nobody remembers — the
      // story is the second-half score that broke them. Prefer it when the final margin says rout.
      if (finalMargin >= 18 && crowned.minute < 40) {
        for (const e of events) {
          if (e.type === 'TRY' && e.side === winner && e.minute >= 40 && marginFor(winner, e.score) > 12 && e.attacker) {
            return toMoment(e, 'TRY', e.attacker.id, e.attacker.name)
          }
        }
      }
      if (crowned.type === 'TRY' && crowned.attacker) {
        return toMoment(crowned, 'TRY', crowned.attacker.id, crowned.attacker.name)
      }
      if (crowned.type === 'FIELD_GOAL' && crowned.attacker) {
        return toMoment(crowned, 'FIELD_GOAL', crowned.attacker.id, crowned.attacker.name)
      }
    }
  }

  // 4. Fallback (draws, or a winner who never "took" the lead in a scannable way): the POTM's best.
  let latestTry: MatchEvent | null = null
  let longestBreak: MatchEvent | null = null
  for (const e of events) {
    if (e.attacker?.id !== playerOfMatch.id) continue
    if (e.type === 'TRY') latestTry = e
    if (e.type === 'LINE_BREAK' && (longestBreak === null || (e.metres ?? 0) > (longestBreak.metres ?? 0)))
      longestBreak = e
  }
  const best = latestTry ?? longestBreak
  if (!best) return null
  return toMoment(best, best.type === 'TRY' ? 'TRY' : 'LINE_BREAK', playerOfMatch.id, playerOfMatch.name)
}

function toMoment(e: MatchEvent, kind: IconicMoment['kind'], playerId: string, playerName: string): IconicMoment {
  return { playerId, playerName, side: e.side, minute: e.minute, kind, scoreAfter: { ...e.score }, line: '' }
}

// ---- The booth line: Thommo, big on the moment. {name} / {minute} tokens. ----

const LINES: Record<IconicMoment['kind'], { ours: string[]; theirs: string[] }> = {
  FIELD_GOAL: {
    ours: [
      'The {name} field goal, {minute} minutes in, ice in his veins — they’ll replay that one forever.',
      'One point off the boot of {name} in the {minute}th. Pubs from Cairns to Coolangatta just erupted.',
    ],
    theirs: [
      'The {name} field goal in the {minute}th — the quietest 82,000 people you’ll ever hear.',
      'A single point from {name}, minute {minute}, and it lands like a piano. That’s the match.',
    ],
  },
  TRY: {
    ours: [
      'The {name} try in the {minute}th — that’s the one they’ll still be talking about in twenty years.',
      '{name}, minute {minute}. Kids will tape that number to their bedroom walls tonight.',
      'When they write this one up, it starts with the {name} try in the {minute}th. What a moment.',
    ],
    theirs: [
      'The {name} try in the {minute}th broke Queensland hearts — credit where it’s due, that was the play.',
      'Say it through gritted teeth: the {name} try, minute {minute}, was the moment of the match.',
    ],
  },
  LINE_BREAK: {
    ours: [
      'That {name} burst in the {minute}th — no points off the back of it needed. THAT was the statement.',
      'The play of the night wasn’t a try at all: {name}, minute {minute}, tearing the line to ribbons.',
    ],
    theirs: [
      'The {name} break in the {minute}th told the story — Queensland chasing shadows.',
    ],
  },
}

/** Render the frozen booth line. Pure arithmetic pick — seed × minute, never rng. */
export function renderIconicLine(moment: IconicMoment, seed: number): string {
  const pool = LINES[moment.kind][moment.side === 'QLD' ? 'ours' : 'theirs']
  const idx = ((seed ^ Math.imul(moment.minute + 1, 0x9e3779b9)) >>> 0) % pool.length
  return pool[idx].replaceAll('{name}', moment.playerName).replaceAll('{minute}', String(moment.minute))
}

/** The post-game beat — Thommo gets the moment (he is "big on the moment" by charter). */
export function iconicMomentSegment(moment: IconicMoment): Segment {
  return { persona: 'Mat Thompson', role: 'Caller', line: moment.line }
}
