import { useEffect, useMemo, useRef, useState } from 'react'
import type { Player, Position } from '../../data/types'
import { POSITION_META } from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import { bluesById } from '../../data/bluesVariants'
import type { SelectedTeam } from '../../engine'
import { conditionFormDelta, DIFFICULTIES, DIFFICULTY_META } from '../../series'
import type { Difficulty, SeriesState } from '../../series'
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
  /** Stadium + stakes for the game about to be picked — framed on the scoreboard so selection carries the series tension. */
  venueName: string
  stakesLabel: string
  seriesState: SeriesState
  /** The chosen challenge level (defaults to Origin). Editable only at series start (game 1). */
  difficulty: Difficulty
  onSetDifficulty: (difficulty: Difficulty) => void
  /** The prior game's XVII (player ids), pre-filling the picker when re-picking mid-series. */
  initialLineup?: Partial<Record<Position, string>>
  initialKickerId?: string | null
  /** When today's Daily Origin is still unplayed, the teaser row that jumps to it (a fresh save
   *  starts HERE, not on the hub — without this the Daily would be undiscoverable until game 1). */
  onPlayDaily?: () => void
}

export function SelectionScreen({
  onKickOff,
  gameLabel,
  venueName,
  stakesLabel,
  seriesState,
  difficulty,
  onSetDifficulty,
  initialLineup,
  initialKickerId,
  onPlayDaily,
}: SelectionScreenProps) {
  const conditions = seriesState.playerConditions
  // The Blues side drawn for this series — fixed across all three games, revealed in the scouting report.
  const opponent = bluesById(seriesState.opponentId)
  // The difficulty dial is a series-start choice — adjustable only until game 1 kicks off.
  const canSetDifficulty = seriesState.games.length === 0
  // Players ruled OUT / SUSPENDED this game — blocked from the XVII.
  const ruledOutIds = useMemo(
    () => new Set(Object.keys(conditions).filter((id) => conditions[id].injury.kind === 'out' || conditions[id].injury.kind === 'suspended')),
    [conditions],
  )
  // Live form deltas (incl. any play-hurt penalty) so auto-fill picks a form-aware side.
  const formDeltas = useMemo(
    () => new Map(Object.entries(conditions).map(([id, c]) => [id, conditionFormDelta(c)])),
    [conditions],
  )
  const selection = useSquadSelection({ initialLineup, initialKickerId, ruledOutIds, formDeltas })
  const [activePosition, setActivePosition] = useState<Position | null>(null)

  // A starting slot (XIII) has natural-fit specialists; INT/RES slots take anyone, so no fit-sorting.
  const activeIsStarting =
    activePosition != null && !activePosition.startsWith('INT') && !activePosition.startsWith('RES')
  const poolRef = useRef<HTMLDivElement>(null)

  // When a specialist slot is being filled, float its natural fits to the top of the pool so the eye
  // doesn't have to scan the whole 32-man list across the column gap; INT/RES keep the squad order.
  const { orderedPool, fitCount } = useMemo(() => {
    if (!activeIsStarting || !activePosition) return { orderedPool: QLD_SQUAD, fitCount: 0 }
    const fits: Player[] = []
    const rest: Player[] = []
    for (const p of QLD_SQUAD) {
      if (p.naturalPositions.includes(activePosition)) fits.push(p)
      else rest.push(p)
    }
    return { orderedPool: [...fits, ...rest], fitCount: fits.length }
  }, [activeIsStarting, activePosition])

  // Bring the pool back into view when a slot opens (it sits above the lineup on a narrow, stacked
  // layout). Instant scroll, so it respects prefers-reduced-motion.
  useEffect(() => {
    if (activeIsStarting) poolRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [activePosition, activeIsStarting])

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

      {onPlayDaily && (
        <div className="daily-teaser">
          <span>⚡ Today&apos;s Daily Origin is live — one match, one attempt.</span>
          <button className="btn-ghost" onClick={onPlayDaily}>
            Play the Daily
          </button>
        </div>
      )}

      {canSetDifficulty && (
        <div className="difficulty-dial" role="group" aria-label="Difficulty">
          <span className="difficulty-label">Difficulty</span>
          <div className="difficulty-options">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                className={`difficulty-option ${difficulty === d ? 'active' : ''}`}
                aria-pressed={difficulty === d}
                title={DIFFICULTY_META[d].blurb}
                onClick={() => onSetDifficulty(d)}
              >
                {DIFFICULTY_META[d].label}
              </button>
            ))}
          </div>
          <p className="difficulty-blurb">{DIFFICULTY_META[difficulty].blurb}</p>
        </div>
      )}

      <div className="selection-layout">
        <section ref={poolRef}>
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
              ? `Choose a player for #${POSITION_META[activePosition].jersey} ${POSITION_META[activePosition].label}` +
                (activeIsStarting ? ` — ${fitCount} natural ${fitCount === 1 ? 'fit' : 'fits'} up top` : '')
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
            {orderedPool.map((player) => {
              const isRuledOut = ruledOutIds.has(player.id)
              const isUsed = selection.usedIds.has(player.id)
              const isFit = activeIsStarting && activePosition != null && player.naturalPositions.includes(activePosition)
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  used={isUsed}
                  fits={isFit}
                  faded={activeIsStarting && !isFit && !isUsed && !isRuledOut}
                  condition={conditions[player.id]}
                  onClick={activePosition && !isRuledOut ? () => handlePoolClick(player.id) : undefined}
                />
              )
            })}
          </div>
        </section>

        <aside className="selection-side">
          <SeriesScoreboard
            state={seriesState}
            upcoming={{ gameLabel, venueName, stakesLabel }}
          />
          <FieldLineup
            lineup={selection.lineup}
            playerById={selection.playerById}
            activePosition={activePosition}
            kickerId={selection.kickerId}
            validation={selection.validation}
            onSelectSlot={handleSlotClick}
            onSetKicker={selection.setKickerId}
          />
          <OppositionPanel
            opponentName={opponent.name}
            blurb={opponent.blurb}
            threats={opponent.edgeThreats}
          />
          <MatchupPanel you={you} opp={opponent.lineup} />
        </aside>
      </div>

      <div className="kickoff-bar">
        <button className="btn-primary" disabled={!selection.validation.valid} onClick={handleKickOff}>
          {selection.validation.valid ? 'LOCK IN · KICK OFF' : 'NAME YOUR 19 + 2 RESERVES'}
        </button>
      </div>
    </div>
  )
}
