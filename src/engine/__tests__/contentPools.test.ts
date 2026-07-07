import { describe, expect, it } from 'vitest'
import { COLOR_LINES } from '../colorCommentary'
import type { ColorMoment } from '../colorCommentary'
import { farewellLine, moverNote } from '../../dynasty/narrative'

/**
 * Content-pool guards for the deepening sweep: floors so a future trim is a deliberate act, and a
 * no-duplicate check so copy-paste authoring errors can't silently thin a pool.
 */

const COLOR_FLOORS: Record<ColorMoment, number> = {
  try: 25,
  break: 20,
  middle: 18,
  discipline: 18,
  swing: 18,
  late: 16,
}

describe('color pools', () => {
  it('every moment holds its post-sweep floor', () => {
    for (const [moment, floor] of Object.entries(COLOR_FLOORS) as Array<[ColorMoment, number]>) {
      const total = Object.values(COLOR_LINES[moment]).reduce((n, lines) => n + (lines?.length ?? 0), 0)
      expect(total, `${moment} pool size`).toBeGreaterThanOrEqual(floor)
    }
  })

  it('no duplicate lines within any persona cell', () => {
    for (const [moment, personas] of Object.entries(COLOR_LINES)) {
      for (const [persona, lines] of Object.entries(personas)) {
        expect(new Set(lines).size, `${moment}/${persona}`).toBe(lines!.length)
      }
    }
  })
})

describe('off-season narrative pools', () => {
  it('farewells and mover notes hit their post-sweep variety', () => {
    const farewells = new Set<string>()
    const rises = new Set<string>()
    const fades = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const rng = () => i / 500
      farewells.add(farewellLine('Test Man', 34, 'HB', rng))
      rises.add(moverNote(true, rng))
      fades.add(moverNote(false, rng))
    }
    expect(farewells.size).toBeGreaterThanOrEqual(12)
    expect(rises.size).toBeGreaterThanOrEqual(6)
    expect(fades.size).toBeGreaterThanOrEqual(6)
  })
})
