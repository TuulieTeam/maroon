/** Golden-ratio constant — the same mixer the series/broadcast seeds use. */
const GOLDEN = 0x9e3779b9

/**
 * The series seed for a dynasty year. The START year's series IS the dynasty seed, so adopting an
 * in-flight standalone series as year one of a new dynasty is byte-identical — the same trick as
 * gameSeed(rootSeed, 1) === rootSeed.
 */
export function dynastySeriesSeed(dynastySeed: number, startYear: number, year: number): number {
  if (year === startYear) return dynastySeed >>> 0
  return (dynastySeed ^ Math.imul(GOLDEN, year - startYear)) >>> 0
}

/**
 * The off-season seed for the transition OUT of `year`. Offset far from the series/condition seed
 * spaces (0x40) so an aging roll can never line up with a match or club-round stream.
 */
export function offseasonSeed(dynastySeed: number, year: number): number {
  return (dynastySeed ^ Math.imul(GOLDEN, (year & 0xffff) + 0x40)) >>> 0
}
