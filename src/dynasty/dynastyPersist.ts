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
    return isValid(parsed) ? parsed : null
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

function isOverlay(v: unknown): v is YearOverlay {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (!o.attrDeltas || typeof o.attrDeltas !== 'object' || Array.isArray(o.attrDeltas)) return false
  if (!Object.values(o.attrDeltas as Record<string, unknown>).every(isDelta)) return false
  return Array.isArray(o.retired) && o.retired.every((id) => typeof id === 'string')
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
