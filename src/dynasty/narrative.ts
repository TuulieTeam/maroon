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
  'The maroon jersey gets folded one last time — {name} bows out at {age} with nothing left owing.',
  '{name} goes at {age}, and every {pos} who follows will be measured against him for a while yet.',
  'They say you know when it’s time. {name} knew, and at {age} he beat the whisper by a season.',
  'One last lap of the shed, one last song — {name} closes the book at {age}.',
  'Camp won’t sound the same without him. {name} retires at {age} with the respect of every man he played beside.',
  '{name} at {age}: gone from the team sheet, permanent in the folklore.',
  'The selectors never had to worry about the {pos} spot while {name} held it. At {age}, that watch ends.',
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

/**
 * The era line for a COMPLETED series' share card — the long arc on the brag. Counts the archived
 * years plus the series being shared. Null in year one with nothing archived (no arc to brag yet).
 */
export function eraCardLine(
  archivedYears: Array<{ seriesWinner: 'QLD' | 'NSW'; retained?: boolean }>,
  thisWinnerQld: boolean,
  yearNo: number,
  /** A drawn-series retain keeps the shield but does NOT extend the streak (the record-book rule). */
  thisRetained = false,
): string | null {
  if (archivedYears.length === 0) return null
  const shields = archivedYears.filter((y) => y.seriesWinner === 'QLD').length + (thisWinnerQld ? 1 : 0)
  // "Straight" counts OUTRIGHT wins only — retained ≠ won, same cruelty as shieldStreak.
  let straight = thisWinnerQld && !thisRetained ? 1 : 0
  if (straight > 0) {
    for (let i = archivedYears.length - 1; i >= 0; i--) {
      const y = archivedYears[i]
      if (y.seriesWinner !== 'QLD' || y.retained) break
      straight++
    }
  }
  const base = `🏆 Year ${yearNo} of the dynasty · ${shields} shield${shields === 1 ? '' : 's'}`
  return straight >= 3 ? `${base} · ${straight} straight` : base
}

/** Riser/fader notes for the movers list. */
const RISE_NOTES = [
  'took another step this summer',
  'came back leaner and meaner',
  'trained the house down',
  'added a yard nobody expected',
  'spent the break with a kicking coach and it shows',
  'club form has him knocking the door down',
]
const FADE_NOTES = [
  'the miles are showing',
  'lost half a yard over the break',
  'battled through a quiet summer',
  'carried a niggle through the off-season',
  'the young blokes are catching him at training',
  'form tapered late last season and hasn’t turned',
]

export function moverNote(rising: boolean, rng: Rng): string {
  const pool = rising ? RISE_NOTES : FADE_NOTES
  return pool[Math.floor(rng() * pool.length)]
}
