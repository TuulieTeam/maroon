import { useEffect, useMemo, useRef, useState } from 'react'
import type { Player, Position } from '../../data/types'
import { POSITION_META } from '../../data/positions'
import { QLD_SQUAD } from '../../data/qldSquad'
import type { SelectedTeam } from '../../engine'
import type { DailyChallenge, DailySummary } from '../../daily'
import { formatDateKey } from '../../daily'
import { PlayerCard } from '../components/PlayerCard'
import { FieldLineup } from '../components/FieldLineup'
import { OppositionPanel } from '../components/OppositionPanel'
import { MatchupPanel } from '../components/MatchupPanel'
import { Wordmark } from '../components/Wordmark'
import { useSquadSelection } from '../hooks/useSquadSelection'
import './SelectionScreen.css'
import './DailyScreens.css'

interface DailySelectionScreenProps {
  challenge: DailyChallenge
  summary: DailySummary
  onKickOff: (team: SelectedTeam) => void
  /** Leave without playing — browsing the challenge never burns the day's one attempt. */
  onBack: () => void
  /** The Gauntlet and the scenario library reuse this whole picker — same challenge machinery,
   *  a mate-thrown seed or an author-pinned one. */
  mode?: 'daily' | 'gauntlet' | 'scenario'
  /** A scenario's win condition, framed on the challenge card ("🎯 Win and hold NSW under 12"). */
  winLine?: string
}

/**
 * Team selection for the Daily Origin. Same picker as the series, different stance: the full pool is
 * fit (the Daily is a what-if — Coates and Dearden are yours for once) EXCEPT the men today's twist
 * takes away, and the one-shot stakes are framed up top. Kicking off is the moment the day's single
 * attempt is committed; backing out from here costs nothing.
 */
export function DailySelectionScreen({ challenge, summary, onKickOff, onBack, mode = 'daily', winLine }: DailySelectionScreenProps) {
  const { twist, opponent, venue } = challenge
  const isGauntlet = mode === 'gauntlet'
  const isScenario = mode === 'scenario'

  // The twist's unavailable men — the daily equivalent of the series' injury table.
  const ruledOutIds = useMemo(() => new Set(twist.ruledOut?.(QLD_SQUAD) ?? []), [twist])
  const ruledOutNames = useMemo(
    () => QLD_SQUAD.filter((p) => ruledOutIds.has(p.id)).map((p) => p.name),
    [ruledOutIds],
  )

  const selection = useSquadSelection({ ruledOutIds })
  const [activePosition, setActivePosition] = useState<Position | null>(null)

  const activeIsStarting =
    activePosition != null && !activePosition.startsWith('INT') && !activePosition.startsWith('RES')
  const poolRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (activeIsStarting) poolRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [activePosition, activeIsStarting])

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
        <Wordmark
          hero
          sub={
            isGauntlet
              ? `The Gauntlet · a mate threw this exact match at you — pick a better 19 than they did.`
              : isScenario
                ? `This Day in Origin · a pinned match, retryable — same game every time. Beat the condition.`
                : `The Daily Origin · ${formatDateKey(challenge.dateKey)} · one match, one attempt — pick it right.`
          }
        />
      </header>

      <div className="daily-challenge-card">
        <div className="daily-challenge-head">
          <span className="daily-challenge-twist">⚡ {twist.label}</span>
          <span className="daily-challenge-where">
            vs {opponent.name} · {venue.stadium}
          </span>
        </div>
        <p className="daily-challenge-blurb">{twist.blurb}</p>
        {ruledOutNames.length > 0 && (
          <div className="team-news">
            <span className="team-news-label">Unavailable today</span>
            {ruledOutNames.map((name) => (
              <span key={name} className="team-news-item news-out">
                {name} <em>out</em>
              </span>
            ))}
          </div>
        )}
        {winLine && (
          <p className="daily-challenge-stakes">
            🎯 <strong>{winLine}</strong>
          </p>
        )}
        {mode === 'daily' && summary.streak > 0 && (
          <p className="daily-challenge-stakes">
            🔥 Your <strong>{summary.streak}-day streak</strong> is on the line.
          </p>
        )}
      </div>

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
          <div className="pool-grid">
            {orderedPool.map((player) => {
              const isRuledOut = ruledOutIds.has(player.id)
              const isUsed = selection.usedIds.has(player.id)
              const isFit = activeIsStarting && activePosition != null && player.naturalPositions.includes(activePosition)
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  used={isUsed || isRuledOut}
                  fits={isFit && !isRuledOut}
                  faded={(activeIsStarting && !isFit && !isUsed) || isRuledOut}
                  onClick={activePosition && !isRuledOut ? () => handlePoolClick(player.id) : undefined}
                />
              )
            })}
          </div>
        </section>

        <aside className="selection-side">
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
        <button className="btn-ghost" onClick={onBack}>
          Back to the hub
        </button>
        <button className="btn-primary" disabled={!selection.validation.valid} onClick={handleKickOff}>
          {selection.validation.valid
            ? isGauntlet
              ? 'LOCK IN · ANSWER THE GAUNTLET'
              : isScenario
                ? 'LOCK IN · RUN THE SCENARIO'
                : 'LOCK IN · PLAY THE DAILY'
            : 'NAME YOUR 19 + 2 RESERVES'}
        </button>
      </div>
    </div>
  )
}
