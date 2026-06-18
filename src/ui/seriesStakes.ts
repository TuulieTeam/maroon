import type { SeriesStakes } from '../engine'

/**
 * Short chip copy for a game's series stakes — shared so every screen that frames an upcoming game
 * (Selection, PreGame, Live, the Hub) labels it identically. The Hub used to own this map privately;
 * it now lives here so the tension reads the same everywhere it surfaces.
 */
export const STAKES_SHORT: Record<SeriesStakes, string> = {
  OPENER: 'Series opener',
  G2_OPEN_AFTER_DRAW: 'Level series',
  G2_CAN_CLINCH: 'Win to clinch the shield',
  G2_MUST_WIN: 'Must win to survive',
  G3_DECIDER: 'The decider — winner takes all',
  G3_DECIDER_AFTER_DRAW: 'Winner takes the shield',
  G3_DEAD_RUBBER_QLD_UP: 'Dead rubber — a sweep on offer',
  G3_DEAD_RUBBER_QLD_DOWN: 'Dead rubber — pride on the line',
}
