import type { Score, Side } from '../engine'
import { GAME_URL } from '../gameUrl'
import type { DailyChallenge } from './dailyChallenge'
import { challengeFromSeed } from './dailyChallenge'

/**
 * The Gauntlet — "same match, your team sheet". A mate's link carries a seed; the challenge it
 * builds is EXACTLY the one they played (same Blues, ground, twist, and seeded play stream), so the
 * only variable is who picked the better 19. Deliberately EPHEMERAL: no ledger, no streak — the
 * share card is the whole scoreboard, and every card carries the link so the chain keeps going.
 */
export function gauntletFromParam(g: string | null): DailyChallenge | null {
  if (!g) return null
  const seed = Number.parseInt(g, 10)
  if (!Number.isFinite(seed) || seed < 0) return null
  return challengeFromSeed(seed >>> 0, 'gauntlet')
}

/** The link that throws the same match at a mate. */
export function gauntletUrl(seed: number): string {
  return `${GAME_URL}?g=${seed >>> 0}`
}

/** QLD-POV square, same language as every other card. */
function square(winner: Side | 'DRAW'): string {
  if (winner === 'QLD') return '🟩'
  if (winner === 'NSW') return '🟥'
  return '🟨'
}

export function buildGauntletShareCard(
  challenge: DailyChallenge,
  finalScore: Score,
  winner: Side | 'DRAW',
): string {
  return [
    'MAROON · The Gauntlet',
    `⚡ ${challenge.twist.label} · vs ${challenge.opponent.name} at ${challenge.venue.groundShort}`,
    `${square(winner)} QLD ${finalScore.qld}–${finalScore.nsw}`,
    '⚔️ Same match, your team sheet:',
    gauntletUrl(challenge.seed),
  ].join('\n')
}
