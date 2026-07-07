import type { EarnedFeat, FeatsLedger } from './types'
import { EMPTY_FEATS_LEDGER, FEATS_SCHEMA_VERSION } from './types'

/** Trophy cabinet key — independent of the series/career/daily saves. A career wipe never melts
 *  the trophies. Bump the suffix on any breaking shape change. */
const FEATS_KEY = 'maroon.feats.v1'

/** Load the feats ledger, or an empty one on any parse/shape failure (defensive, like every save). */
export function loadFeats(): FeatsLedger {
  try {
    const raw = localStorage.getItem(FEATS_KEY)
    if (!raw) return EMPTY_FEATS_LEDGER
    const parsed: unknown = JSON.parse(raw)
    return isValidLedger(parsed) ? parsed : EMPTY_FEATS_LEDGER
  } catch {
    return EMPTY_FEATS_LEDGER
  }
}

export function saveFeats(ledger: FeatsLedger): void {
  try {
    localStorage.setItem(FEATS_KEY, JSON.stringify(ledger))
  } catch {
    // Storage full or unavailable — the cabinet stays in memory; no-op.
  }
}

function isEarned(v: unknown): v is EarnedFeat {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  if (typeof e.first !== 'string' || typeof e.count !== 'number' || e.count < 1) return false
  return e.detail === undefined || typeof e.detail === 'string'
}

function isValidLedger(v: unknown): v is FeatsLedger {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  if (l.schemaVersion !== FEATS_SCHEMA_VERSION) return false
  if (!l.earned || typeof l.earned !== 'object' || Array.isArray(l.earned)) return false
  // Unknown feat ids are kept (a retired feat stays earned — history hardens); values must be sane.
  return Object.values(l.earned as Record<string, unknown>).every(isEarned)
}
