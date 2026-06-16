import { useMemo, useState } from 'react'
import type { Player, Position } from '../../data/types'
import { POSITION_META } from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import { NSW_LINEUP } from '../../data/nswSquad'
import type { SelectedTeam } from '../../engine'
import type { SeriesState } from '../../series'
import { PlayerCard } from '../components/PlayerCard'
import { FieldLineup } from '../components/FieldLineup'
import { OppositionPanel } from '../components/OppositionPanel'
import { MatchupPanel } from '../components/MatchupPanel'
import { SeriesScoreboard } from '../components/SeriesScoreboard'
import { useSquadSelection } from '../hooks/useSquadSelection'
import './SelectionScreen.css'

interface SelectionScreenProps {
  onKickOff: (team: SelectedTeam) => void
  gameLabel: string
  seriesState: SeriesState
  /** The prior game's XVII (player ids), pre-filling the picker when re-picking mid-series. */
  initialLineup?: Partial<Record<Position, string>>
  initialKickerId?: string | null
}

export function SelectionScreen({
  onKickOff,
  gameLabel,
  seriesState,
  initialLineup,
  initialKickerId,
}: SelectionScreenProps) {
  const conditions = seriesState.playerConditions
  // Players ruled OUT / SUSPENDED this game — blocked from the XVII.
  const ruledOutIds = useMemo(
    () => new Set(Object.keys(conditions).filter((id) => conditions[id].injury.kind === 'out' || conditions[id].injury.kind === 'suspended')),
    [conditions],
  )
  const selection = useSquadSelection({ initialLineup, initialKickerId, ruledOutIds })
  const [activePosition, setActivePosition] = useState<Position | null>(null)

  // The unavailable QLD men, for the "team news" banner that explains an emptied pre-fill slot.
  const teamNews = useMemo(
    () =>
      QLD_SQUAD.filter((p) => {
        const k = conditions[p.id]?.injury.kind
        return k === 'out' || k === 'suspended' || k === 'doubtful'
      }).map((p) => ({ name: p.name, kind: conditions[p.id].injury.kind })),
    [conditions],
  )

  // Resolve the current selection's assigned slots to Players for the live matchup read.
  // Derived from `selection.lineup`, so it re-computes on every assignment.
  const you = useMemo<Partial<Record<Position, Player>>>(() => {
    const resolved: Partial<Record<Position, Player>> = {}
    for (const [pos, id] of Object.entries(selection.lineup)) {
      if (!id) continue
      const player = selection.playerById.get(id)
      if (player) resolved[pos as Position] = player
    }
    return resolved
  }, [selection.lineup, selection.playerById])

  const handlePoolClick = (playerId: string) => {
    if (activePosition) {
      selection.assign(activePosition, playerId)
      setActivePosition(null)
    }
  }

  const handleSlotClick = (position: Position) => {
    const current = selection.lineup[position]
    if (current) {
      selection.assign(position, null)
      setActivePosition(position)
    } else {
      setActivePosition((prev) => (prev === position ? null : position))
    }
  }

  const handleKickOff = () => {
    const team = selection.buildTeam()
    if (team) onKickOff(team)
  }

  return (
    <div className="app-shell">
      <header>
        <div className="app-title">MAROON</div>
        <div className="app-sub">{gameLabel} · Pick Queensland&apos;s 19 + 2 reserves, lock in, then watch it unfold.</div>
      </header>

      <div className="selection-layout">
        <section>
          <div className="pool-header">
            <h2>Your Squad ({QLD_SQUAD.length})</h2>
            <div className="pool-actions">
              <button className="btn-ghost" onClick={selection.autoFill}>
                Auto-fill
              </button>
              <button className="btn-ghost" onClick={selection.clear}>
                Clear
              </button>
            </div>
          </div>
          <div className="pool-active-hint">
            {activePosition
              ? `Choose a player for #${POSITION_META[activePosition].jersey} ${POSITION_META[activePosition].label}`
              : 'Tap a lineup slot, then pick a player. Tap the Kicker badge to set your goal kicker.'}
          </div>
          {teamNews.length > 0 && (
            <div className="team-news">
              <span className="team-news-label">Team news</span>
              {teamNews.map((t) => (
                <span key={t.name} className={`team-news-item news-${t.kind}`}>
                  {t.name} <em>{t.kind}</em>
                </span>
              ))}
            </div>
          )}
          <div className="pool-grid">
            {QLD_SQUAD.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                used={selection.usedIds.has(player.id)}
                condition={conditions[player.id]}
                onClick={
                  activePosition && !ruledOutIds.has(player.id) ? () => handlePoolClick(player.id) : undefined
                }
              />
            ))}
          </div>
        </section>

        <aside className="selection-side">
          <SeriesScoreboard state={seriesState} />
          <OppositionPanel />
          <MatchupPanel you={you} opp={NSW_LINEUP} />
          <FieldLineup
            lineup={selection.lineup}
            playerById={selection.playerById}
            activePosition={activePosition}
            kickerId={selection.kickerId}
            validation={selection.validation}
            onSelectSlot={handleSlotClick}
            onSetKicker={selection.setKickerId}
          />
        </aside>
      </div>

      <div className="kickoff-bar">
        <button className="btn-primary" disabled={!selection.validation.valid} onClick={handleKickOff}>
          LOCK IN 19 · KICK OFF
        </button>
      </div>
    </div>
  )
}
