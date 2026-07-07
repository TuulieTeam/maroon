import { BLUES_VARIANTS } from '../data/bluesVariants'
import type { BluesTeamSheet } from '../data/bluesVariants'
import type { EdgeThreat, Player } from '../data/types'
import type { Rng } from '../engine'
import { AGING_TUNING } from './aging'
import type { YearOverlay } from './types'

/**
 * The other side of the world ages too. NSW identity is CANONICAL BY NAME: Payne Haas appears in
 * more than one Blues sheet under different ids, and he must age, decline, and retire ONCE —
 * everywhere. So NSW drift/retirement is keyed by `nswKey(name)` (stable world facts, independent
 * of which sheet or dynasty you're in), and when a Blue retires, a generated replacement of the
 * SAME positional shape at ~92–98% of his quality fills his slot in every sheet he occupied — the
 * Big Blue Wall is still a wall in 2033, just with new bricks. Replacements are stored verbatim in
 * the overlay (the rookies rule) and can themselves age, retire, and be replaced (chains resolve).
 */

/** Canonical identity key for a Blue: the name, case/punctuation-insensitive. Prefixed so NSW keys
 *  can never collide with QLD player ids inside the shared attrDeltas map. */
export function nswKey(name: string): string {
  return `nsw:${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
}

/** FNV-1a — a stable per-name hash so birth years vary WITHIN a tag band, not with the dynasty. */
function nameHash(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Age bands by tag at the 2026 base year — hashed spread inside the band, per the plan. */
const NSW_AGE_BANDS: Record<string, [number, number]> = {
  rookie: [19, 21],
  bolter: [21, 24],
  workhorse: [25, 28],
  veteran: [28, 32],
}

/** A Blue's birth year: carried on the object (generated replacements), else name-hashed into his
 *  tag band. Same name → same age in every sheet, every dynasty. */
export function nswBirthYear(p: Player): number {
  if (p.birthYear) return p.birthYear
  const [lo, hi] = NSW_AGE_BANDS[p.tag ?? 'workhorse'] ?? [25, 28]
  const age = lo + (nameHash(p.name) % (hi - lo + 1))
  return AGING_TUNING.fallbackBaseYear - age
}

/** One instance of every distinct Blue across the three sheets (first sheet's copy wins), keyed
 *  canonically — the aging pass iterates THIS, so a two-sheet man rolls once. */
export function allNswIdentities(overlay: YearOverlay): Map<string, Player> {
  const byKey = new Map<string, Player>()
  for (const sheet of BLUES_VARIANTS) {
    for (const p of Object.values(sheet.lineup)) {
      const key = nswKey(p.name)
      if (!byKey.has(key)) byKey.set(key, p)
    }
  }
  // Generated replacements are identities too — they age and retire like anyone.
  for (const [, r] of Object.entries(overlay.nswReplacements)) {
    byKey.set(nswKey(r.name), r)
  }
  return byKey
}

/** Follow a retirement chain: the key's replacement, then ITS replacement if it also retired… */
export function resolveReplacement(key: string, overlay: YearOverlay): Player | null {
  const retired = new Set(overlay.retired)
  let cur = overlay.nswReplacements[key] ?? null
  let hops = 0
  while (cur && retired.has(nswKey(cur.name)) && hops < 10) {
    cur = overlay.nswReplacements[nswKey(cur.name)] ?? null
    hops++
  }
  return cur
}

const REPLACEMENT_FIRST = ['Kade', 'Braxton', 'Jett', 'Harlan', 'Cruz', 'Dane', 'Marley', 'Talen', 'Jude', 'Rocco', 'Ashton', 'Miller']
const REPLACEMENT_SURNAMES = ['Wetherill', 'Croker-Lane', 'Falemaka', 'Danvers', 'Sorrell', 'Tuivasa-Ray', 'Bexley', 'Farrant', 'Mattock', 'Osgood', 'Pemberton', 'Vakalahi']
const NSW_CLUBS = ['Panthers', 'Roosters', 'Eels', 'Bulldogs', 'Raiders', 'Sea Eagles', 'Knights', 'Wests Tigers']

export const NSW_REPLACEMENT_QUALITY = { min: 0.92, max: 0.98 } as const

/**
 * A generated Blue modelled on the departed man — same positions, same attr SHAPE, at 92–98% of his
 * quality (seeded), debuting at 21–24. Fixed 4 rng draws. The variant keeps its identity; the
 * equal-strength property holds (balance guard in the tests).
 */
export function generateBluesReplacement(rng: Rng, departed: Player, forYear: number, n: number): Player {
  const first = REPLACEMENT_FIRST[Math.floor(rng() * REPLACEMENT_FIRST.length)] // 1
  const surname = REPLACEMENT_SURNAMES[Math.floor(rng() * REPLACEMENT_SURNAMES.length)] // 2
  const quality =
    NSW_REPLACEMENT_QUALITY.min + rng() * (NSW_REPLACEMENT_QUALITY.max - NSW_REPLACEMENT_QUALITY.min) // 3
  const age = 21 + Math.floor(rng() * 4) // 4
  const scale = (x: number) => Math.max(35, Math.min(95, Math.round(x * quality)))
  return {
    id: `dyn-b-${forYear}-${n}`,
    name: `${first} ${surname}`,
    club: NSW_CLUBS[nameHash(`${first} ${surname}`) % NSW_CLUBS.length],
    naturalPositions: [...departed.naturalPositions],
    attrs: {
      attack: scale(departed.attrs.attack),
      defence: scale(departed.attrs.defence),
      speed: scale(departed.attrs.speed),
      hands: scale(departed.attrs.hands),
      composure: scale(departed.attrs.composure),
    },
    goalKicking: Math.round(departed.goalKicking * quality),
    ...(departed.stamina !== undefined ? { stamina: Math.max(50, Math.round(departed.stamina * quality)) } : {}),
    tag: 'bolter',
    birthYear: forYear - age,
  }
}

function clampAttr(x: number): number {
  return Math.max(30, Math.min(99, x))
}

/**
 * Resolve a Blues sheet for a dynasty year: retirees replaced (chains followed), canonical-keyed
 * drift applied, the scouting profile's danger-man names kept honest. Year one with an empty
 * overlay returns the sheet unchanged.
 */
export function resolveBluesSheet(sheet: BluesTeamSheet, overlay: YearOverlay): BluesTeamSheet {
  const retired = new Set(overlay.retired)
  const nameSwaps = new Map<string, string>()
  const lineup = { ...sheet.lineup }
  let changed = false

  for (const [pos, p] of Object.entries(sheet.lineup) as Array<[keyof typeof sheet.lineup, Player]>) {
    const key = nswKey(p.name)
    let man = p
    if (retired.has(key)) {
      const replacement = resolveReplacement(key, overlay)
      if (replacement) {
        nameSwaps.set(p.name, replacement.name)
        man = replacement
        changed = true
      }
    }
    const d = overlay.attrDeltas[nswKey(man.name)]
    if (d) {
      man = {
        ...man,
        attrs: {
          attack: clampAttr(man.attrs.attack + d.attack),
          defence: clampAttr(man.attrs.defence + d.defence),
          speed: clampAttr(man.attrs.speed + d.speed),
          hands: clampAttr(man.attrs.hands + d.hands),
          composure: clampAttr(man.attrs.composure + d.composure),
        },
        ...(man.stamina !== undefined ? { stamina: Math.max(40, Math.min(99, man.stamina + d.stamina)) } : {}),
      }
      changed = true
    }
    if (man !== p) lineup[pos] = man
  }
  if (!changed) return sheet

  // The kicker may have retired — hand the tee to his replacement (same slot, so same id lookup).
  const kicker = Object.values(sheet.lineup).find((p) => p.id === sheet.kickerId)
  const kickerId =
    kicker && retired.has(nswKey(kicker.name)) ? (resolveReplacement(nswKey(kicker.name), overlay)?.id ?? sheet.kickerId) : sheet.kickerId

  // Scouting threats name danger men — swap retired names for their replacements.
  const edgeThreats: EdgeThreat[] = sheet.edgeThreats.map((t) => ({
    ...t,
    dangerMen: t.dangerMen.map((name) => nameSwaps.get(name) ?? name),
  }))

  return { ...sheet, lineup, kickerId, edgeThreats }
}
