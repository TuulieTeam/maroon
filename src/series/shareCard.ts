import type { PlayerOfMatch } from '../engine'
import { GAME_URL } from '../gameUrl'
import { DIFFICULTY_META } from './difficulty'
import type { SeriesGameRecord, SeriesState } from './types'
import { VENUES } from './venues'

/** QLD-POV result square for one game: green win, red loss, yellow draw. */
function square(g: SeriesGameRecord): string {
  if (g.winner === 'QLD') return '🟩'
  if (g.winner === 'NSW') return '🟥'
  return '🟨'
}

/** The shield headline from QLD's point of view, e.g. "Queensland win the shield 2–1". */
function headline(state: SeriesState): string {
  const { qld, nsw } = state.seriesScore
  const hi = Math.max(qld, nsw)
  const lo = Math.min(qld, nsw)
  if (qld === nsw) return `Queensland retain the shield ${qld}–${nsw}`
  if (state.seriesWinner === 'QLD') return `Queensland win the shield ${hi}–${lo}`
  return `New South Wales win the shield ${hi}–${lo}`
}

/**
 * A Wordle-style, copy-pasteable summary of a COMPLETED series — pure (no DOM), so it's unit-testable
 * and the engine/UI split holds. One game per square, QLD–NSW scores, the ground, and the series MVP if
 * it was seen this session. Precondition: the series is complete (3 games played).
 */
export function buildShareCard(
  state: SeriesState,
  mvp: PlayerOfMatch | null,
  /** Feats FIRST-earned during this series — cards brag about this run, never the back catalog. */
  newFeatNames: string[] = [],
): string {
  const lines = ['MAROON · State of Origin 2026', headline(state)]
  const games = state.games
    .map((g) => `${square(g)} ${VENUES[g.venueId].groundShort} ${g.finalScore.qld}–${g.finalScore.nsw}`)
    .join('\n')
  if (games) lines.push(games)
  if (mvp) lines.push(`👑 Player of the Series: ${mvp.name} (${mvp.side})`)
  // Surface a non-default difficulty for the brag ("won on Hard"); Origin is the baseline, so omit it.
  if (state.difficulty && state.difficulty !== 'origin') {
    lines.push(`⚙️ Difficulty: ${DIFFICULTY_META[state.difficulty].label}`)
  }
  if (newFeatNames.length > 0) lines.push(`🏅 First: ${newFeatNames.join(' · ')}`)
  lines.push(GAME_URL)
  return lines.join('\n')
}
