import type { Player } from '../../data/types'
import type { PlayerCondition } from '../../series'
import { formBand, formRatingToDelta } from '../../series'
import './PlayerCard.css'

const INJURY_LABEL: Record<string, string> = { out: 'OUT', doubtful: 'DOUBTFUL', suspended: 'SUSPENDED' }

const ATTR_DEFS: Array<{ key: keyof Player['attrs']; label: string; color: string }> = [
  { key: 'attack', label: 'Attack', color: 'var(--bar-attack)' },
  { key: 'defence', label: 'Defence', color: 'var(--bar-defence)' },
  { key: 'speed', label: 'Speed', color: 'var(--bar-speed)' },
  { key: 'hands', label: 'Hands', color: 'var(--bar-hands)' },
  { key: 'composure', label: 'Composure', color: 'var(--bar-composure)' },
]

interface PlayerCardProps {
  player: Player
  used?: boolean
  active?: boolean
  /** Live form + injury for this game. When present it drives the form badge + dynamic injury status. */
  condition?: PlayerCondition
  onClick?: () => void
}

export function PlayerCard({ player, used, active, condition, onClick }: PlayerCardProps) {
  const injuryKind = condition?.injury.kind ?? 'fit'
  const ruledOut = injuryKind === 'out' || injuryKind === 'suspended'

  const classes = ['player-card']
  if (onClick) classes.push('selectable')
  if (used) classes.push('used')
  if (active) classes.push('active')
  if (ruledOut) classes.push('ruled-out')

  const band = condition ? formBand(condition.form) : null
  const delta = condition ? Math.round(formRatingToDelta(condition.form)) : 0
  const deltaStr = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : ''

  return (
    <div className={classes.join(' ')} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="player-card-head">
        <div>
          <div className="player-card-name">{player.name}</div>
          <div className="player-card-meta">
            {player.club} · GK {player.goalKicking}
          </div>
        </div>
        <div className="player-card-chips">
          {band && (
            <span className={`player-card-form form-${band}`}>
              {band}
              {deltaStr && <span className="form-delta"> {deltaStr}</span>}
            </span>
          )}
          {condition && injuryKind !== 'fit' && (
            <span className={`player-card-injury injury-${injuryKind}`}>{INJURY_LABEL[injuryKind]}</span>
          )}
          {!condition && player.status && player.status !== 'available' && (
            <span className={`player-card-status status-${player.status}`}>{player.status}</span>
          )}
          {player.tag && <span className={`player-card-tag tag-${player.tag}`}>{player.tag}</span>}
        </div>
      </div>

      {player.formNote && <div className="player-card-note">{player.formNote}</div>}

      <div>
        {ATTR_DEFS.map((def) => {
          const value = player.attrs[def.key]
          return (
            <div className="attr-row" key={def.key}>
              <span className="attr-label">{def.label}</span>
              <span className="attr-track">
                <span className="attr-fill" style={{ width: `${value}%`, background: def.color }} />
              </span>
              <span className="attr-value">{value}</span>
            </div>
          )
        })}
      </div>

      {/*
        Fitness is an ENGINE rating (aerobic stamina — modulates fatigue accrual), not a combat
        attribute, so it sits in its own slim track beneath the 5 combat bars, tinted with the
        speed colour to read as distinct from attack/defence/etc.
      */}
      <div className="player-card-fitness">
        <span className="attr-label">Fitness</span>
        <span className="attr-track">
          <span
            className="attr-fill"
            style={{ width: `${player.stamina ?? 75}%`, background: 'var(--bar-speed)' }}
          />
        </span>
        <span className="attr-value">{player.stamina ?? 75}</span>
      </div>

      <div className="player-card-positions">
        {player.naturalPositions.map((p) => (
          <span className="pos-chip" key={p}>
            {p}
          </span>
        ))}
      </div>
    </div>
  )
}
