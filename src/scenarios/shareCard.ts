import type { Score, Side } from '../engine'
import { GAME_URL } from '../gameUrl'
import type { ScenarioDef } from './types'

/** QLD-POV square, same language as every other card. */
function square(winner: Side | 'DRAW'): string {
  if (winner === 'QLD') return '🟩'
  if (winner === 'NSW') return '🟥'
  return '🟨'
}

export function buildScenarioShareCard(
  def: ScenarioDef,
  finalScore: Score,
  winner: Side | 'DRAW',
  passed: boolean,
  detail?: string,
): string {
  return [
    'MAROON · This Day in Origin',
    `🎯 ${def.title}`,
    `${square(winner)} QLD ${finalScore.qld}–${finalScore.nsw}`,
    passed ? `✅ ${def.winLabel}${detail ? ` — ${detail}` : ''}` : `❌ ${def.winLabel}`,
    GAME_URL,
  ].join('\n')
}
