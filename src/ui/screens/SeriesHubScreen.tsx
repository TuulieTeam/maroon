import { originLabel } from '../../engine'
import type { PlayerOfMatch, SeriesContext } from '../../engine'
import { bluesById } from '../../data/bluesVariants'
import { buildShareCard } from '../../series'
import type { CareerSummary, SeriesState } from '../../series'
import type { UseDaily } from '../../daily/useDaily'
import type { FeatsLedger } from '../../feats'
import { SeriesScoreboard } from '../components/SeriesScoreboard'
import { ClubFormReport } from '../components/ClubFormReport'
import { ShareCard } from '../components/ShareCard'
import { CareerLedger } from '../components/CareerLedger'
import { DailyPanel } from '../components/DailyPanel'
import { FeatCabinet } from '../components/FeatCabinet'
import { STAKES_SHORT } from '../seriesStakes'
import './SeriesHubScreen.css'

interface SeriesHubScreenProps {
  state: SeriesState
  currentContext: SeriesContext
  /** All-time career totals across finished series. */
  careerSummary: CareerSummary
  /** The series MVP, available only when the series is complete and the POTMs were seen this session. */
  seriesMvp: PlayerOfMatch | null
  /** Pick the side for the next game (or the dead rubber). */
  onPick: () => void
  /** Close out a clinched series without playing the dead rubber. */
  onSkipDeadRubber: () => void
  /** Wipe the series and start fresh. */
  onNewSeries: () => void
  /** The Daily Origin — today's challenge, today's result (if played), and the streak read. */
  daily: UseDaily
  onPlayDaily: () => void
  /** The trophy cabinet. */
  featsLedger: FeatsLedger
  /** Feats FIRST-earned by the just-finished series — bragged on the share card. */
  newFeatNames: string[]
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
  careerSummary,
  seriesMvp,
  onPick,
  onSkipDeadRubber,
  onNewSeries,
  daily,
  onPlayDaily,
  featsLedger,
  newFeatNames,
}: SeriesHubScreenProps) {
  const complete = state.status === 'complete'
  const deadRubberPending = !complete && state.seriesWinner != null
  const nextLabel = originLabel(currentContext.gameNumber)
  const opponent = bluesById(state.opponentId)

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
        <p className="hub-kicker">{complete ? 'Series Complete' : 'State of Origin Series'}</p>
        <h1
          className={`hub-title ${complete ? 'is-final' : ''} ${complete && state.seriesWinner === 'QLD' ? 'win' : complete && state.seriesWinner === 'NSW' ? 'loss' : ''}`}
        >
          {complete ? shieldHeadline(state) : 'THE SERIES'}
        </h1>
      </header>

      <SeriesScoreboard state={state} upcoming={upcoming} />

      {!complete && (
        <p className="hub-opponent">
          This series, you face <strong>{opponent.name}</strong> — {opponent.blurb}
        </p>
      )}

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
          <ShareCard text={buildShareCard(state, seriesMvp, newFeatNames)} />
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

      <DailyPanel
        challenge={daily.challenge}
        todayRecord={daily.todayRecord}
        summary={daily.summary}
        onPlay={onPlayDaily}
      />

      <FeatCabinet ledger={featsLedger} />

      <CareerLedger summary={careerSummary} />
    </div>
  )
}
