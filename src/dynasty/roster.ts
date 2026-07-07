import type { Player } from '../data/types'
import { ageOf } from './aging'
import type { AttrDelta, YearOverlay } from './types'

/**
 * Resolve a dynasty year's playable roster: base squad minus retirees, every attribute = base +
 * cumulative drift (clamped to a believable band), tags/notes re-read through the year's lens.
 * Pure and cheap — selection, auto-fill, conditions, storylines, and the engine all consume the
 * resolved `Player[]` unchanged, which is why the Dynasty needs zero engine changes.
 */
export const RESOLVE_CLAMP = { attrMin: 30, attrMax: 99, staminaMin: 40, staminaMax: 99 } as const

function clampAttr(x: number): number {
  return Math.max(RESOLVE_CLAMP.attrMin, Math.min(RESOLVE_CLAMP.attrMax, x))
}

function applyDelta(p: Player, d: AttrDelta | undefined): Player {
  if (!d) return p
  return {
    ...p,
    attrs: {
      attack: clampAttr(p.attrs.attack + d.attack),
      defence: clampAttr(p.attrs.defence + d.defence),
      speed: clampAttr(p.attrs.speed + d.speed),
      hands: clampAttr(p.attrs.hands + d.hands),
      composure: clampAttr(p.attrs.composure + d.composure),
    },
    ...(p.stamina !== undefined
      ? {
          stamina: Math.max(
            RESOLVE_CLAMP.staminaMin,
            Math.min(RESOLVE_CLAMP.staminaMax, p.stamina + d.stamina),
          ),
        }
      : {}),
  }
}

/**
 * The year's QLD roster. For the dynasty's FIRST year the overlay is empty and `year === startYear`,
 * so the resolved roster is byte-identical to the base squad — statuses, form notes and all. From
 * year two the 2026-season facts no longer apply: statuses clear (a new season, everyone reports
 * fit) and the form note becomes the dynasty's own line.
 */
export function resolveRoster(base: Player[], overlay: YearOverlay, year: number, startYear: number): Player[] {
  const retired = new Set(overlay.retired)
  return base
    .filter((p) => !retired.has(p.id))
    .map((p) => {
      const drifted = applyDelta(p, overlay.attrDeltas[p.id])
      if (year === startYear) return drifted
      const age = ageOf(p, year)
      return {
        ...drifted,
        // A 30+ man reads as the veteran he now is; younger men keep their authored identity.
        tag: age >= 30 ? 'veteran' : p.tag,
        status: 'available',
        formNote: `Age ${age} in ${year} — season ${year - startYear + 1} of your dynasty.`,
      }
    })
}
