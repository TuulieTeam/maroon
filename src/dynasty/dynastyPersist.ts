import type { AttrDelta, DynastyState, YearArchive, YearOverlay } from './types'
import { DYNASTY_SCHEMA_VERSION } from './types'

/** The dynasty save — generated-world state + hardened history, never copies of authored base data.
 *  Bump the suffix on any breaking shape change. */
const DYNASTY_KEY = 'maroon.dynasty.v1'

/** Load the dynasty, or null (the caller then adopts the live series as year one of a fresh one).
 *  Defensive: any parse/shape failure discards — a corrupt world restarts; results archived in the
 *  career ledger under its own key are untouched either way. */
export function loadDynasty(): DynastyState | null {
  try {
    const raw = localStorage.getItem(DYNASTY_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValid(parsed)) return null
    // Older saves predate the rookie class (drop 3) and the NSW machinery (drop 8) — normalise in.
    return {
      ...parsed,
      overlay: {
        ...parsed.overlay,
        rookies: Array.isArray(parsed.overlay.rookies) ? parsed.overlay.rookies : [],
        nswReplacements:
          parsed.overlay.nswReplacements && typeof parsed.overlay.nswReplacements === 'object'
            ? parsed.overlay.nswReplacements
            : {},
      },
      nswCoach:
        parsed.nswCoach && typeof parsed.nswCoach === 'object' ? parsed.nswCoach : { index: 0, lostStreak: 0 },
    }
  } catch {
    return null
  }
}

export function saveDynasty(state: DynastyState): void {
  try {
    localStorage.setItem(DYNASTY_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — the dynasty stays in memory; no-op.
  }
}

function isDelta(v: unknown): v is AttrDelta {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  return ['attack', 'defence', 'speed', 'hands', 'composure', 'stamina'].every(
    (k) => typeof d[k] === 'number' && Number.isFinite(d[k] as number),
  )
}

/** A stored rookie must be a sane full Player with a birth year — anything less discards the save. */
function isStoredRookie(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.club !== 'string') return false
  if (!Array.isArray(p.naturalPositions) || p.naturalPositions.length === 0) return false
  if (typeof p.birthYear !== 'number' || typeof p.goalKicking !== 'number') return false
  const a = p.attrs as Record<string, unknown> | undefined
  if (!a) return false
  return ['attack', 'defence', 'speed', 'hands', 'composure'].every((k) => typeof a[k] === 'number')
}

function isOverlay(v: unknown): v is YearOverlay {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (!o.attrDeltas || typeof o.attrDeltas !== 'object' || Array.isArray(o.attrDeltas)) return false
  if (!Object.values(o.attrDeltas as Record<string, unknown>).every(isDelta)) return false
  if (!Array.isArray(o.retired) || !o.retired.every((id) => typeof id === 'string')) return false
  // Pre-rookie (drop-3) / pre-NSW (drop-8) overlays simply lack these — normalised in loadDynasty.
  if (o.rookies !== undefined && !(Array.isArray(o.rookies) && o.rookies.every(isStoredRookie))) return false
  if (o.nswReplacements !== undefined) {
    if (!o.nswReplacements || typeof o.nswReplacements !== 'object' || Array.isArray(o.nswReplacements)) return false
    if (!Object.values(o.nswReplacements as Record<string, unknown>).every(isStoredRookie)) return false
  }
  return true
}

function isArchive(v: unknown): v is YearArchive {
  if (!v || typeof v !== 'object') return false
  const y = v as Record<string, unknown>
  if (typeof y.year !== 'number' || typeof y.seriesRootSeed !== 'number') return false
  const score = y.seriesScore as Record<string, unknown> | undefined
  if (!score || typeof score.qld !== 'number' || typeof score.nsw !== 'number') return false
  if (y.seriesWinner !== 'QLD' && y.seriesWinner !== 'NSW') return false
  if (typeof y.retained !== 'boolean') return false
  return (
    Array.isArray(y.retirements) &&
    y.retirements.every((r) => {
      const x = r as Record<string, unknown>
      return x && typeof x.name === 'string' && typeof x.age === 'number'
    })
  )
}

function isValid(v: unknown): v is DynastyState {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  if (s.schemaVersion !== DYNASTY_SCHEMA_VERSION) return false
  if (typeof s.dynastySeed !== 'number' || typeof s.startYear !== 'number' || typeof s.currentYear !== 'number')
    return false
  if ((s.currentYear as number) < (s.startYear as number)) return false
  if (!isOverlay(s.overlay)) return false
  return Array.isArray(s.years) && s.years.every(isArchive)
}
