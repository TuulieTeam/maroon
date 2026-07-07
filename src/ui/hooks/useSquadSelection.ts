import { useCallback, useMemo, useState } from 'react'
import type { Player, Position } from '../../data/types'
import {
  MATCHDAY_POSITIONS,
  POSITION_META,
  POSITION_ORDER,
  RESERVE_POSITIONS,
  STARTING_POSITIONS,
} from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import { buildAutoLineup } from '../../data/autoSelect'
import type { SelectedTeam } from '../../engine'

export type Lineup = Partial<Record<Position, string>>

/** Optional seed for the selection (e.g. the previous game's XVII when re-picking mid-series). */
export interface SquadSelectionInit {
  initialLineup?: Lineup
  initialKickerId?: string | null
  /** Players ruled OUT / SUSPENDED this game — blocked from the XVII and scrubbed from the pre-fill. */
  ruledOutIds?: ReadonlySet<string>
  /** Live form delta per player (id -> points, incl. any play-hurt penalty) — folded into auto-fill. */
  formDeltas?: ReadonlyMap<string, number>
  /** The selectable pool — a dynasty year passes its resolved roster; defaults to the base squad. */
  squad?: Player[]
}

const EMPTY_IDS: ReadonlySet<string> = new Set()
const EMPTY_DELTAS: ReadonlyMap<string, number> = new Map()

/** Keep only seeded picks that still resolve in the given pool and are NOT ruled out this game —
 *  a retired man's slot from last year's XVII simply reads as empty. */
function sanitizeLineup(squadIds: ReadonlySet<string>, initial?: Lineup, ruledOut: ReadonlySet<string> = EMPTY_IDS): Lineup {
  if (!initial) return {}
  const next: Lineup = {}
  for (const pos of POSITION_ORDER) {
    const id = initial[pos]
    if (id && squadIds.has(id) && !ruledOut.has(id)) next[pos] = id
  }
  return next
}

/** Keep a seeded kicker only if it resolves, is available, and sits on the (sanitized) matchday sheet. */
function sanitizeKicker(
  squadIds: ReadonlySet<string>,
  kickerId: string | null | undefined,
  initial?: Lineup,
  ruledOut: ReadonlySet<string> = EMPTY_IDS,
): string | null {
  if (!kickerId || !squadIds.has(kickerId) || ruledOut.has(kickerId)) return null
  const sane = sanitizeLineup(squadIds, initial, ruledOut)
  return MATCHDAY_POSITIONS.some((p) => sane[p] === kickerId) ? kickerId : null
}

export interface SelectionValidation {
  /** Matchday slots filled (out of 19). */
  filled: number
  matchdayFilled: boolean
  reservesFilled: boolean
  kickerChosen: boolean
  valid: boolean
  /** Soft warnings (out-of-position picks) — do not block lock-in. */
  warnings: string[]
}

function isNaturalFit(player: Player, position: Position): boolean {
  if (position.startsWith('INT') || position.startsWith('RES')) {
    return true
  }
  return player.naturalPositions.includes(position)
}

export function useSquadSelection(init?: SquadSelectionInit) {
  const ruledOut = init?.ruledOutIds ?? EMPTY_IDS
  const formDeltas = init?.formDeltas ?? EMPTY_DELTAS
  const squad = init?.squad ?? QLD_SQUAD
  const squadIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad])
  // Seed from a prior game's XVII when re-picking mid-series; stale/unknown/ruled-out ids drop to empty.
  const [lineup, setLineup] = useState<Lineup>(() => sanitizeLineup(squadIds, init?.initialLineup, ruledOut))
  const [kickerId, setKickerId] = useState<string | null>(() =>
    sanitizeKicker(squadIds, init?.initialKickerId, init?.initialLineup, ruledOut),
  )

  const playerById = useMemo(() => {
    const map = new Map<string, Player>()
    for (const p of squad) map.set(p.id, p)
    return map
  }, [squad])

  const usedIds = useMemo(() => new Set(Object.values(lineup)), [lineup])

  const assign = useCallback(
    (position: Position, playerId: string | null) => {
      // Ruled-out (injured/suspended) players can never be assigned — gating lives here, not just in the UI.
      if (playerId !== null && ruledOut.has(playerId)) return
      setLineup((prev) => {
        const next: Lineup = { ...prev }
        // Remove this player from any slot they already hold.
        for (const pos of POSITION_ORDER) {
          if (next[pos] === playerId) delete next[pos]
        }
        if (playerId === null) delete next[position]
        else next[position] = playerId
        return next
      })
    },
    [ruledOut],
  )

  const clear = useCallback(() => {
    setLineup({})
    setKickerId(null)
  }, [])

  const autoFill = useCallback(() => {
    // Skip the ruled-out men, and rank the rest by FORM-adjusted quality (hot rises, slumping/doubtful fall).
    const next = buildAutoLineup(
      squad.filter((p) => !ruledOut.has(p.id)),
      (id) => formDeltas.get(id) ?? 0,
    )
    setLineup(next)
    // Kicker must be one of the 19 on the team sheet (not a 20th/21st man).
    const kicker = MATCHDAY_POSITIONS.map((p) => next[p])
      .filter(Boolean)
      .map((id) => playerById.get(id as string)!)
      .sort((a, b) => b.goalKicking - a.goalKicking)[0]
    if (kicker) setKickerId(kicker.id)
  }, [playerById, ruledOut, formDeltas, squad])

  const validation = useMemo<SelectionValidation>(() => {
    const filled = MATCHDAY_POSITIONS.filter((p) => lineup[p]).length
    const matchdayFilled = filled === MATCHDAY_POSITIONS.length
    const reservesFilled = RESERVE_POSITIONS.every((p) => lineup[p])
    // The goal kicker must be one of the 19 on the team sheet.
    const kickerOnMatchday =
      kickerId != null && MATCHDAY_POSITIONS.some((p) => lineup[p] === kickerId)
    const warnings: string[] = []
    for (const pos of STARTING_POSITIONS) {
      const id = lineup[pos]
      if (!id) continue
      const player = playerById.get(id)
      if (player && !isNaturalFit(player, pos)) {
        warnings.push(`${player.name} is out of position at ${POSITION_META[pos].label}`)
      }
    }
    return {
      filled,
      matchdayFilled,
      reservesFilled,
      kickerChosen: kickerOnMatchday,
      valid: matchdayFilled && reservesFilled && kickerOnMatchday,
      warnings,
    }
  }, [lineup, kickerId, playerById])

  const buildTeam = useCallback((): SelectedTeam | null => {
    if (!validation.valid || !kickerId) return null
    const resolved = {} as Record<Position, Player>
    for (const pos of POSITION_ORDER) {
      const id = lineup[pos]
      if (!id) return null
      if (ruledOut.has(id)) return null // hard guard: a ruled-out man can never make the team sheet
      const player = playerById.get(id)
      if (!player) return null
      resolved[pos] = player
    }
    return { side: 'QLD', lineup: resolved, kickerId }
  }, [validation.valid, kickerId, lineup, playerById, ruledOut])

  return {
    lineup,
    kickerId,
    usedIds,
    playerById,
    assign,
    clear,
    autoFill,
    setKickerId,
    validation,
    buildTeam,
  }
}
