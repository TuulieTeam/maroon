import type { Player, Position } from '../../data/types'
import { BENCH_POSITIONS, POSITION_META, RESERVE_POSITIONS, STARTING_POSITIONS } from '../../data/positions'
import type { Lineup, SelectionValidation } from '../hooks/useSquadSelection'
import './FieldLineup.css'

interface FieldLineupProps {
  lineup: Lineup
  playerById: Map<string, Player>
  activePosition: Position | null
  kickerId: string | null
  validation: SelectionValidation
  onSelectSlot: (position: Position) => void
  onSetKicker: (playerId: string) => void
}

function Slot({
  position,
  lineup,
  playerById,
  activePosition,
  kickerId,
  isWarn,
  onSelectSlot,
  onSetKicker,
}: {
  position: Position
  lineup: Lineup
  playerById: Map<string, Player>
  activePosition: Position | null
  kickerId: string | null
  isWarn: boolean
  onSelectSlot: (p: Position) => void
  onSetKicker: (id: string) => void
}) {
  const meta = POSITION_META[position]
  const id = lineup[position]
  const player = id ? playerById.get(id) : undefined
  const classes = ['lineup-slot']
  if (!player) classes.push('empty')
  if (activePosition === position) classes.push('active')
  if (player && isWarn) classes.push('warn')

  return (
    <div className={classes.join(' ')}>
      <span className="slot-jersey" aria-hidden="true">{meta.jersey}</span>
      <button
        type="button"
        className="slot-main"
        onClick={() => onSelectSlot(position)}
        aria-pressed={activePosition === position}
        aria-label={
          player
            ? `${meta.label}, number ${meta.jersey}, ${player.name}. Tap to change.`
            : `${meta.label}, number ${meta.jersey}, empty. Tap to assign.`
        }
      >
        <div className="slot-pos">{meta.label}</div>
        {player ? (
          <div className="slot-player">{player.name}</div>
        ) : (
          <div className="slot-empty-text">tap to assign</div>
        )}
      </button>
      {player && (
        <button
          type="button"
          className={`slot-kicker ${kickerId === player.id ? 'is-kicker' : ''}`}
          onClick={() => onSetKicker(player.id)}
          aria-pressed={kickerId === player.id}
          aria-label={kickerId === player.id ? `${player.name} is your goal kicker` : `Set ${player.name} as goal kicker`}
        >
          {kickerId === player.id ? '★ Kicker' : 'Kicker'}
        </button>
      )}
    </div>
  )
}

export function FieldLineup({
  lineup,
  playerById,
  activePosition,
  kickerId,
  validation,
  onSelectSlot,
  onSetKicker,
}: FieldLineupProps) {
  const isWarnSlot = (position: Position): boolean => {
    const id = lineup[position]
    if (!id) return false
    const player = playerById.get(id)
    if (!player) return false
    return validation.warnings.some((w) => w.startsWith(player.name))
  }

  return (
    <div className="field-lineup">
      <h3>Your Queensland 19 (+ 2 reserves)</h3>
      <div className="lineup-slots">
        <div className="lineup-section-label">Starting XIII</div>
        {STARTING_POSITIONS.map((pos) => (
          <Slot
            key={pos}
            position={pos}
            lineup={lineup}
            playerById={playerById}
            activePosition={activePosition}
            kickerId={kickerId}
            isWarn={isWarnSlot(pos)}
            onSelectSlot={onSelectSlot}
            onSetKicker={onSetKicker}
          />
        ))}
        <div className="lineup-section-label">Interchange (6 — only 4 usable in normal play)</div>
        {BENCH_POSITIONS.map((pos) => (
          <Slot
            key={pos}
            position={pos}
            lineup={lineup}
            playerById={playerById}
            activePosition={activePosition}
            kickerId={kickerId}
            isWarn={isWarnSlot(pos)}
            onSelectSlot={onSelectSlot}
            onSetKicker={onSetKicker}
          />
        ))}
        <div className="lineup-section-label">Reserves (20th &amp; 21st)</div>
        <div className="reserve-note">Camp cover — plays only if a starter is injured before kick-off.</div>
        {RESERVE_POSITIONS.map((pos) => (
          <Slot
            key={pos}
            position={pos}
            lineup={lineup}
            playerById={playerById}
            activePosition={activePosition}
            kickerId={kickerId}
            isWarn={isWarnSlot(pos)}
            onSelectSlot={onSelectSlot}
            onSetKicker={onSetKicker}
          />
        ))}
      </div>

      <div className="validation-line">
        {validation.filled}/19 picked{validation.reservesFilled ? ' · reserves named' : ' · name 2 reserves'}
        {!validation.kickerChosen && validation.matchdayFilled && ' · choose a goal kicker'}
        {validation.valid && ' · ready to kick off'}
      </div>
      {validation.warnings.length > 0 && (
        <div className="validation-warnings">
          {validation.warnings.map((w) => (
            <span key={w}>⚠ {w}</span>
          ))}
        </div>
      )}
    </div>
  )
}
