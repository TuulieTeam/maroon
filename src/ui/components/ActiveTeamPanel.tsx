import { useMemo } from 'react'
import type { Player, Position } from '../../data/types'
import { BENCH_POSITIONS, INTERCHANGE_CAP, POSITION_META, STARTING_POSITIONS } from '../../data/positions'
import type { MatchEvent, Side } from '../../engine'
import './ActiveTeamPanel.css'

interface ActiveTeamPanelProps {
  revealed: MatchEvent[]
  startingLineups: Record<Side, Record<Position, Player>>
}

interface OnFieldEntry {
  slot: Position
  player: Player
}

interface SideState {
  onField: OnFieldEntry[]
  benchRemaining: Player[]
  hiaPending: Player[]
  ruledOut: Player[]
  inBin: Player[]
  subsLog: Array<{ on: string; off: string; reason: string; minute: number }>
  unlocked: boolean
  /** Tactical interchanges used (the capped ones — HIA/injury subs are free and excluded). */
  tacticalInterchanges: number
}

/** Friendlier sub-reason labels — make clear which changes are FREE (outside the 8-interchange cap). */
function reasonLabel(reason: string): string {
  if (reason === 'hia') return 'HIA — free sub'
  if (reason === 'foul-injury') return 'injury — free sub'
  return reason
}

/** Events that carry an actual on/off roster change (both playerOff + playerOn present). */
const SWAP_TYPES = new Set(['INTERCHANGE', 'HEAD_KNOCK', 'INJURY_REPLACEMENT'])

function deriveSide(
  side: Side,
  starting: Record<Position, Player>,
  revealed: MatchEvent[],
): SideState {
  // Slot -> current player on field (starts as the named 13).
  const onField = new Map<Position, Player>()
  const slotOfId = new Map<string, Position>()
  for (const pos of STARTING_POSITIONS) {
    onField.set(pos, starting[pos])
    slotOfId.set(starting[pos].id, pos)
  }

  const benchIds = new Set(BENCH_POSITIONS.map((p) => starting[p]?.id).filter(Boolean) as string[])
  const benchPlayers = new Map<string, Player>()
  for (const p of BENCH_POSITIONS) if (starting[p]) benchPlayers.set(starting[p].id, starting[p])

  const onFieldBenchUsed = new Set<string>()
  const hiaPending = new Map<string, Player>()
  const ruledOut = new Map<string, Player>()
  const inBin = new Map<string, Player>()
  const subsLog: SideState['subsLog'] = []
  let unlocked = false
  let tacticalInterchanges = 0

  for (const e of revealed) {
    if (e.side !== side) {
      // Foul play can injure the OTHER side's player; their INJURY_REPLACEMENT is emitted on
      // the victim's side, so only same-side events matter here.
      continue
    }

    if (e.type === 'RESERVE_ACTIVATED') unlocked = true
    // Only tactical INTERCHANGE events count toward the 8 cap; HIA/injury swaps are free.
    if (e.type === 'INTERCHANGE') tacticalInterchanges += 1

    if (SWAP_TYPES.has(e.type) && e.playerOff && e.playerOn) {
      const offId = e.playerOff.id
      const onPlayer = e.playerOn
      const slot = slotOfId.get(offId)
      if (slot) {
        onField.set(slot, onPlayer)
        slotOfId.delete(offId)
        slotOfId.set(onPlayer.id, slot)
      }
      if (benchIds.has(onPlayer.id)) onFieldBenchUsed.add(onPlayer.id)
      subsLog.push({
        on: onPlayer.name,
        off: e.playerOff.name,
        reason: e.reason ?? 'fatigue',
        minute: e.minute,
      })
    }

    if (e.type === 'HEAD_KNOCK' && e.playerOff) hiaPending.set(e.playerOff.id, e.playerOff)
    if (e.type === 'HIA_PASS' && e.attacker) hiaPending.delete(e.attacker.id)
    if (e.type === 'HIA_FAIL' && e.attacker) {
      hiaPending.delete(e.attacker.id)
      ruledOut.set(e.attacker.id, e.attacker)
    }
    if (e.type === 'SIN_BIN' && e.defender) inBin.set(e.defender.id, e.defender)
    if (e.type === 'SIN_BIN_RETURN' && e.defender) inBin.delete(e.defender.id)
    if (e.type === 'SEND_OFF' && e.defender) {
      inBin.delete(e.defender.id)
      ruledOut.set(e.defender.id, e.defender)
    }
  }

  const benchRemaining: Player[] = []
  for (const [id, p] of benchPlayers) {
    if (onFieldBenchUsed.has(id)) continue
    if (ruledOut.has(id)) continue
    benchRemaining.push(p)
  }

  const onFieldEntries: OnFieldEntry[] = STARTING_POSITIONS.map((slot) => ({
    slot,
    player: onField.get(slot)!,
  }))

  return {
    onField: onFieldEntries,
    benchRemaining,
    hiaPending: [...hiaPending.values()],
    ruledOut: [...ruledOut.values()],
    inBin: [...inBin.values()],
    subsLog,
    unlocked,
    tacticalInterchanges,
  }
}

function TeamBlock({ side, state, prominent }: { side: Side; state: SideState; prominent: boolean }) {
  const label = side === 'QLD' ? 'Queensland' : 'New South Wales'
  return (
    <div className={`active-team ${side.toLowerCase()} ${prominent ? 'prominent' : 'compact'}`}>
      <div className="active-team-head">
        <span className="active-team-name">{label}</span>
        {state.unlocked && <span className="badge unlock">extra bench unlocked</span>}
      </div>

      <ul className="onfield-list">
        {state.onField.map((e) => {
          const binned = state.inBin.some((p) => p.id === e.player.id)
          return (
            <li key={e.slot} className={binned ? 'binned' : ''}>
              <span className="jersey">{POSITION_META[e.slot].jersey}</span>
              <span className="pname">{e.player.name}</span>
              {binned && <span className="badge bin">sin bin</span>}
            </li>
          )
        })}
      </ul>

      <div className="active-team-foot">
        <span className="bench-count">Bench left: {state.benchRemaining.length}</span>
        <span className="bench-count">Interchanges: {state.tacticalInterchanges}/{INTERCHANGE_CAP}</span>
        {state.hiaPending.map((p) => (
          <span key={p.id} className="badge hia">{p.name} — HIA</span>
        ))}
        {state.ruledOut.map((p) => (
          <span key={p.id} className="badge out">{p.name} — out</span>
        ))}
      </div>

      {state.subsLog.length > 0 && (
        <div className="subs-log">
          {state.subsLog.slice(-4).map((s, i) => (
            <div key={i} className="subs-log-row">
              <span className="m">{s.minute}&apos;</span> {s.on} on for {s.off}
              {s.reason !== 'fatigue' && <span className="reason"> ({reasonLabel(s.reason)})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ActiveTeamPanel({ revealed, startingLineups }: ActiveTeamPanelProps) {
  const qld = useMemo(() => deriveSide('QLD', startingLineups.QLD, revealed), [revealed, startingLineups])
  const nsw = useMemo(() => deriveSide('NSW', startingLineups.NSW, revealed), [revealed, startingLineups])

  return (
    <div className="active-team-panel">
      <h3>On the park</h3>
      <TeamBlock side="QLD" state={qld} prominent />
      <TeamBlock side="NSW" state={nsw} prominent={false} />
    </div>
  )
}
