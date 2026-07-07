import type { Rng } from '../engine'

/**
 * The off-season's authored voice — farewell lines for retiring Maroons and the era line the
 * report leads with. Seeded picks (the speeches.ts pattern), so the same off-season always reads
 * the same way. {name} / {age} / {pos} tokens.
 */
const FAREWELLS = [
  '{name} calls it a career at {age} — the body said what the heart wouldn’t.',
  'After everything he gave the jersey, {name} hangs the boots up at {age}.',
  '{name} retires at {age}. Somewhere in Queensland a kid just taped his number to a bedroom wall.',
  'No farewell tour, no fuss — {name} walks away at {age} the way he played: on his own terms.',
  '{name}, {age}, done. The {pos} rotation will feel his absence before round one.',
]

export function farewellLine(name: string, age: number, pos: string, rng: Rng): string {
  const line = FAREWELLS[Math.floor(rng() * FAREWELLS.length)]
  return line.replaceAll('{name}', name).replaceAll('{age}', String(age)).replaceAll('{pos}', pos)
}

/** "Year N of the dynasty · M shields" — the arc, in one line. */
export function eraLine(nextYear: number, startYear: number, shields: number, straight: number): string {
  const yearNo = nextYear - startYear + 1
  const shieldPart = shields === 0 ? 'the cabinet still bare' : `${shields} shield${shields === 1 ? '' : 's'}`
  const straightPart = straight >= 2 ? ` · ${straight} straight — the streak is alive` : ''
  return `Year ${yearNo} of the dynasty · ${shieldPart}${straightPart}`
}

/** Riser/fader notes for the movers list. */
const RISE_NOTES = ['took another step this summer', 'came back leaner and meaner', 'trained the house down']
const FADE_NOTES = ['the miles are showing', 'lost half a yard over the break', 'battled through a quiet summer']

export function moverNote(rising: boolean, rng: Rng): string {
  const pool = rising ? RISE_NOTES : FADE_NOTES
  return pool[Math.floor(rng() * pool.length)]
}
