import { useCallback, useRef, useState } from 'react'
import { NSW_KICKER_ID, NSW_LINEUP } from './data/nswSquad'
import type { Position } from './data/types'
import { originLabel, simulateMatch } from './engine'
import type { MatchResult, MatchSetup, PlayerOfMatch, SelectedTeam } from './engine'
import { conditionFormDelta, gameSeed, pickSeriesMvp, reinjuryMult } from './series'
import { useSeries } from './series/useSeries'
import { SelectionScreen } from './ui/screens/SelectionScreen'
import { PreGameScreen } from './ui/screens/PreGameScreen'
import { LiveMatchScreen } from './ui/screens/LiveMatchScreen'
import { ResultScreen } from './ui/screens/ResultScreen'
import { SeriesHubScreen } from './ui/screens/SeriesHubScreen'
import { STAKES_SHORT } from './ui/seriesStakes'

type Phase = 'select' | 'pregame' | 'live' | 'result' | 'hub'

function nswTeam(): SelectedTeam {
  return { side: 'NSW', lineup: { ...NSW_LINEUP }, kickerId: NSW_KICKER_ID }
}

function lineupIds(team: SelectedTeam): Record<Position, string> {
  const map = {} as Record<Position, string>
  for (const pos of Object.keys(team.lineup) as Position[]) {
    map[pos] = team.lineup[pos].id
  }
  return map
}

export default function App() {
  const rootSeedFactory = useCallback(() => Date.now(), [])
  const { state, currentContext, careerSummary, recordResult, skipDeadRubber, newSeries } =
    useSeries(rootSeedFactory)

  // Resume mid-series straight to the hub; a fresh series opens on selecting your Origin I side.
  const [phase, setPhase] = useState<Phase>(() =>
    state.games.length === 0 && state.status === 'in-progress' ? 'select' : 'hub',
  )
  const [lockedTeam, setLockedTeam] = useState<SelectedTeam | null>(null)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [playingGame, setPlayingGame] = useState<1 | 2 | 3>(state.currentGame)
  const [potms, setPotms] = useState<PlayerOfMatch[]>([])
  // Pre-match addresses already shown this series — fed back so a Gus speech never repeats.
  const [usedSpeechTitles, setUsedSpeechTitles] = useState<string[]>([])
  // Guards against folding the same game into the series twice (e.g. the auto-advance + the button).
  const recordedGameRef = useRef<number | null>(null)

  // Lock in the picked XVII and simulate this game — series context drives venue/stakes commentary.
  const handleKickOff = useCallback(
    (team: SelectedTeam) => {
      const game = state.currentGame
      // Convert each player's persisted condition into the engine's form + re-injury maps.
      const form: Record<string, number> = {}
      const reinjury: Record<string, number> = {}
      for (const [id, cond] of Object.entries(state.playerConditions)) {
        const delta = conditionFormDelta(cond)
        if (delta !== 0) form[id] = delta
        const mult = reinjuryMult(cond)
        if (mult !== 1) reinjury[id] = mult
      }
      const setup: MatchSetup = {
        qld: team,
        nsw: nswTeam(),
        series: { ...currentContext, usedSpeechTitles },
        form,
        reinjury,
      }
      setLockedTeam(team)
      setPlayingGame(game)
      recordedGameRef.current = null
      setResult(simulateMatch(setup, gameSeed(state.rootSeed, game)))
      setPhase('pregame')
    },
    [state.currentGame, state.rootSeed, state.playerConditions, currentContext, usedSpeechTitles],
  )

  // Fold the finished game into the series exactly once, then show the result.
  const handleMatchComplete = useCallback(() => {
    if (result && lockedTeam && recordedGameRef.current !== playingGame) {
      recordedGameRef.current = playingGame
      recordResult({
        qldLineup: lineupIds(lockedTeam),
        qldKickerId: lockedTeam.kickerId,
        finalScore: result.finalScore,
        winner: result.winner,
        events: result.events,
        stats: result.stats,
      })
      setPotms((prev) => [...prev, result.playerOfMatch])
      setUsedSpeechTitles((prev) => [...prev, result.broadcast.preMatchSpeech.title])
    }
    setPhase('result')
  }, [result, lockedTeam, playingGame, recordResult])

  const handleNewSeries = useCallback(() => {
    // Capture this series' MVP (in-memory POTMs) so it lands in the career ledger before the wipe.
    const seriesMvp = state.status === 'complete' && potms.length > 0 ? pickSeriesMvp(potms) : null
    newSeries(seriesMvp)
    setLockedTeam(null)
    setResult(null)
    setPotms([])
    setUsedSpeechTitles([])
    recordedGameRef.current = null
    setPhase('select')
  }, [newSeries, state.status, potms])

  // The prior game's XVII pre-fills the next selection (survives a reload via the saved series).
  const prior = state.games.at(-1)

  if (phase === 'select') {
    return (
      <SelectionScreen
        gameLabel={originLabel(state.currentGame)}
        venueName={currentContext.venue.stadium}
        stakesLabel={STAKES_SHORT[currentContext.stakes]}
        seriesState={state}
        initialLineup={prior?.qldLineup}
        initialKickerId={prior?.qldKickerId}
        onKickOff={handleKickOff}
      />
    )
  }

  if (phase === 'pregame' && result) {
    return (
      <PreGameScreen
        result={result}
        gameLabel={originLabel(playingGame)}
        venueName={currentContext.venue.stadium}
        stakesLabel={STAKES_SHORT[currentContext.stakes]}
        onKickOff={() => setPhase('live')}
      />
    )
  }

  if (phase === 'live' && result && lockedTeam) {
    return (
      <LiveMatchScreen
        key={playingGame}
        result={result}
        gameLabel={originLabel(playingGame)}
        venueName={currentContext.venue.stadium}
        stakesLabel={STAKES_SHORT[currentContext.stakes]}
        startingLineups={{ QLD: lockedTeam.lineup, NSW: nswTeam().lineup }}
        onComplete={handleMatchComplete}
      />
    )
  }

  if (phase === 'result' && result) {
    return (
      <ResultScreen
        result={result}
        gameLabel={originLabel(playingGame)}
        seriesState={state}
        onContinue={() => setPhase('hub')}
      />
    )
  }

  return (
    <SeriesHubScreen
      state={state}
      currentContext={currentContext}
      careerSummary={careerSummary}
      seriesMvp={state.status === 'complete' && potms.length > 0 ? pickSeriesMvp(potms) : null}
      onPick={() => setPhase('select')}
      onSkipDeadRubber={skipDeadRubber}
      onNewSeries={handleNewSeries}
    />
  )
}
