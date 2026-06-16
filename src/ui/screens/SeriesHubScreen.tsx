import { originLabel } from '../../engine'
import type { PlayerOfMatch, SeriesContext, SeriesStakes } from '../../engine'
import type { SeriesState } from '../../series'
import { SeriesScoreboard } from '../components/SeriesScoreboard'
import { ClubFormReport } from '../components/ClubFormReport'
import './SeriesHubScreen.css'

interface SeriesHubScreenProps {
  state: SeriesState
  currentContext: SeriesContext
  /** The series MVP, available only when the series is complete and the POTMs were seen this session. */
  seriesMvp: PlayerOfMatch | null
  /** Pick the side for the next game (or the dead rubber). */
  onPick: () => void
  /** Close out a clinched series without playing the dead rubber. */
  onSkipDeadRubber: () => void
  /** Wipe the series and start fresh. */
  onNewSeries: () => void
}

/** Short chip copy for the upcoming game's stakes. */
const STAKES_SHORT: Record<SeriesStakes, string> = {
  OPENER: 'Series opener',
  G2_OPEN_AFTER_DRAW: 'Level series',
  G2_CAN_CLINCH: 'Win to clinch the shield',
  G2_MUST_WIN: 'Must win to survive',
  G3_DECIDER: 'The decider — winner takes all',
  G3_DECIDER_AFTER_DRAW: 'Winner takes the shield',
  G3_DEAD_RUBBER_QLD_UP: 'Dead rubber — a sweep on offer',
  G3_DEAD_RUBBER_QLD_DOWN: 'Dead rubber — pride on the line',
}

function shieldHeadline(state: SeriesState): string {
  const { seriesScore: s, seriesWinner } = state
  if (!seriesWinner) return 'SERIES COMPLETE'
  if (s.qld === s.nsw) return 'QUEENSLAND RETAIN THE SHIELD'
  return seriesWinner === 'QLD' ? 'QUEENSLAND WIN THE SHIELD' : 'NEW SOUTH WALES WIN THE SHIELD'
}

export function SeriesHubScreen({
  state,
  currentContext,
  seriesMvp,
  onPick,
  onSkipDeadRubber,
  onNewSeries,
}: SeriesHubScreenProps) {
  const complete = state.status === 'complete'
  const deadRubberPending = !complete && state.seriesWinner != null
  const nextLabel = originLabel(currentContext.gameNumber)

  const upcoming = complete
    ? undefined
    : {
        gameLabel: nextLabel,
        venueName: currentContext.venue.stadium,
        stakesLabel: STAKES_SHORT[currentContext.stakes],
      }

  return (
    <div className="app-shell hub-screen">
      <header className="hub-header">
        <div className="hub-kicker">{complete ? 'Series Complete' : 'State of Origin Series'}</div>
        <div className={`hub-title ${complete && state.seriesWinner === 'QLD' ? 'win' : complete && state.seriesWinner === 'NSW' ? 'loss' : ''}`}>
          {complete ? shieldHeadline(state) : 'THE SERIES'}
        </div>
      </header>

      <SeriesScoreboard state={state} upcoming={upcoming} />

      {!complete && <ClubFormReport state={state} />}

      {complete ? (
        <>
          {seriesMvp && (
            <div className={`hub-mvp ${seriesMvp.side.toLowerCase()}`}>
              <div className="hub-mvp-label">Player of the Series</div>
              <div className="hub-mvp-name">{seriesMvp.name}</div>
              <div className="hub-mvp-side">{seriesMvp.side === 'QLD' ? 'Queensland' : 'New South Wales'}</div>
            </div>
          )}
          <div className="hub-actions">
            <button className="btn-primary" onClick={onNewSeries}>
              Start a new series
            </button>
          </div>
        </>
      ) : deadRubberPending ? (
        <div className="hub-actions">
          <button className="btn-primary" onClick={onPick}>
            Play the dead rubber · {nextLabel}
          </button>
          <button className="btn-ghost" onClick={onSkipDeadRubber}>
            Skip to the series wrap
          </button>
        </div>
      ) : (
        <div className="hub-actions">
          <button className="btn-primary" onClick={onPick}>
            Pick your side for {nextLabel}
          </button>
        </div>
      )}
    </div>
  )
}
