import type { GameNo } from './types'

/**
 * Golden-ratio constant — the same one the broadcast salt uses (src/engine/broadcast.ts). Spreading
 * one shareable `rootSeed` into three per-game seeds keeps a whole series reproducible from a single
 * number.
 */
const GOLDEN = 0x9e3779b9

/**
 * Deterministic per-game seed. Game 1 === `rootSeed` so a one-game series is byte-identical to the
 * legacy single-match behaviour; games 2 and 3 are decorrelated by a golden-ratio mix. Always a uint32
 * (matching `makeRng`, which does `seed >>> 0`).
 */
export function gameSeed(rootSeed: number, game: GameNo): number {
  if (game === 1) return rootSeed >>> 0
  return (rootSeed ^ Math.imul(GOLDEN, game)) >>> 0
}

export function seriesSeeds(rootSeed: number): [number, number, number] {
  return [gameSeed(rootSeed, 1), gameSeed(rootSeed, 2), gameSeed(rootSeed, 3)]
}

/**
 * Seed for the between-games CLUB ROUND that advances player form/injuries before game `game`.
 * Decorrelated from `gameSeed` (offset the game index by 0x20) so a player's form swing never lines
 * up with the match it precedes — yet still fully reproducible from `rootSeed` alone.
 */
export function conditionSeed(rootSeed: number, game: number): number {
  return (rootSeed ^ Math.imul(GOLDEN, game + 0x20)) >>> 0
}
