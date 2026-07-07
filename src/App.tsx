import { useCallback, useMemo, useRef, useState } from 'react'
import type { BluesTeamSheet } from './data/bluesVariants'
import type { Position } from './data/types'
import { originLabel, simulateMatch } from './engine'
import type { IconicMoment, MatchResult, MatchSetup, PlayerOfMatch, SelectedTeam } from './engine'
import { buildPressConference, deriveStorylines, postGameBackPage, preGameBackPage, pressureBand } from './coach'
import type { BackPage, BoardOutcome, PressExchange, Storyline } from './coach'
import { useCoach } from './coach/useCoach'
import { dailyKey, gauntletFromParam, recordDaily, summariseDaily } from './daily'
import type { DailyChallenge } from './daily'
import { useDaily } from './daily/useDaily'
import { dynastySeriesSeed, eraCardLine } from './dynasty'
import type { OffseasonReport } from './dynasty'
import { useDynasty } from './dynasty/useDynasty'
import type { FeatMint, NearMiss } from './feats'
import { useFeats } from './feats/useFeats'
import { buildScenarioSetup, scenarioChallenge } from './scenarios'
import type { ScenarioDef } from './scenarios'
import { useScenarios } from './scenarios/useScenarios'
import {
  applyGameResult,
  concludeSeries,
  conditionFormDelta,
  decidingGame,
  gameSeed,
  loadCareer,
  nswDifficultyDelta,
  pickSeriesMvp,
  reinjuryMult,
  returningNemesis,
} from './series'
import type { GameNo, SeriesState } from './series'
import { useSeries } from './series/useSeries'
import { SelectionScreen } from './ui/screens/SelectionScreen'
import { PreGameScreen } from './ui/screens/PreGameScreen'
import { LiveMatchScreen } from './ui/screens/LiveMatchScreen'
import { ResultScreen } from './ui/screens/ResultScreen'
import { SeriesHubScreen } from './ui/screens/SeriesHubScreen'
import { DailySelectionScreen } from './ui/screens/DailySelectionScreen'
import { DailyResultScreen } from './ui/screens/DailyResultScreen'
import { OffseasonScreen } from './ui/screens/OffseasonScreen'
import { GauntletResultScreen } from './ui/screens/GauntletResultScreen'
import { ScenarioResultScreen } from './ui/screens/ScenarioResultScreen'
import { STAKES_SHORT } from './ui/seriesStakes'

type Phase =
  | 'select'
  | 'pregame'
  | 'live'
  | 'result'
  | 'hub'
  | 'offseason'
  | 'daily-select'
  | 'daily-pregame'
  | 'daily-live'
  | 'daily-result'
  | 'gauntlet-select'
  | 'gauntlet-pregame'
  | 'gauntlet-live'
  | 'gauntlet-result'
  | 'scenario-select'
  | 'scenario-pregame'
  | 'scenario-live'
  | 'scenario-result'

function nswTeamFrom(blues: BluesTeamSheet): SelectedTeam {
  return {
    side: 'NSW',
    lineup: { ...blues.lineup },
    kickerId: blues.kickerId,
    edgeThreats: blues.edgeThreats,
  }
}

function lineupIds(team: SelectedTeam): Record<Position, string> {
  const map = {} as Record<Position, string>
  for (const pos of Object.keys(team.lineup) as Position[]) {
    map[pos] = team.lineup[pos].id
  }
  return map
}

export default function App() {
  // The dynasty owns the calendar: it adopts the live series as year one on first run, resolves the
  // current year's roster, and hands the series layer its deterministic per-year seeds.
  const dynasty = useDynasty()
  const rootSeedFactory = useCallback(
    () => dynastySeriesSeed(dynasty.state.dynastySeed, dynasty.state.startYear, dynasty.state.currentYear),
    [dynasty.state.dynastySeed, dynasty.state.startYear, dynasty.state.currentYear],
  )
  const nswFor = useCallback(
    (opponentId: string) => Object.values(dynasty.blues(opponentId).lineup),
    [dynasty],
  )
  const { state, currentContext, careerSummary, recordResult, skipDeadRubber, setDifficulty, newSeries } =
    useSeries(rootSeedFactory, dynasty.roster, nswFor)

  // A mate's ?g= link jumps straight into the Gauntlet (browsing costs nothing — it's ephemeral).
  // Otherwise: resume mid-series straight to the hub; a fresh series opens on the Origin I picker.
  const [gauntlet] = useState<DailyChallenge | null>(() =>
    gauntletFromParam(new URLSearchParams(window.location.search).get('g')),
  )
  const [phase, setPhase] = useState<Phase>(() =>
    gauntlet ? 'gauntlet-select' : state.games.length === 0 && state.status === 'in-progress' ? 'select' : 'hub',
  )
  const [gauntletResult, setGauntletResult] = useState<MatchResult | null>(null)
  const [gauntletTeam, setGauntletTeam] = useState<SelectedTeam | null>(null)

  // Leaving the Gauntlet drops the ?g= param so a reload lands on the player's own game.
  const exitGauntlet = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname)
    setGauntletResult(null)
    setGauntletTeam(null)
    setPhase(state.games.length === 0 && state.status === 'in-progress' ? 'select' : 'hub')
  }, [state.games.length, state.status])

  // Lock in a Gauntlet side — the same boundary composition as the Daily, nothing persisted.
  const handleGauntletKickOff = useCallback(
    (team: SelectedTeam) => {
      if (!gauntlet) return
      const { twist, opponent, venue, seed } = gauntlet
      const form: Record<string, number> = {}
      if (twist.nswFormDelta) for (const p of Object.values(opponent.lineup)) form[p.id] = twist.nswFormDelta
      if (twist.qldFormDelta) for (const p of Object.values(team.lineup)) form[p.id] = twist.qldFormDelta
      const setup: MatchSetup = {
        qld: team,
        nsw: { side: 'NSW', lineup: { ...opponent.lineup }, kickerId: opponent.kickerId, edgeThreats: opponent.edgeThreats },
        series: { gameNumber: 1, seriesScore: { qld: 0, nsw: 0 }, venue, stakes: 'OPENER' },
        form,
      }
      setGauntletTeam(team)
      setGauntletResult(simulateMatch(setup, seed))
      setPhase('gauntlet-pregame')
    },
    [gauntlet],
  )
  // ---- This Day in Origin — authored, pinned, retryable scenarios. Nothing drawn, everything
  // authored; retries replay the IDENTICAL match, so the only variable is the picked 19. ----
  const scenarios = useScenarios()
  const [activeScenario, setActiveScenario] = useState<ScenarioDef | null>(null)
  const [scenarioResult, setScenarioResult] = useState<MatchResult | null>(null)
  const [scenarioTeam, setScenarioTeam] = useState<SelectedTeam | null>(null)
  const [scenarioOutcome, setScenarioOutcome] = useState<{ passed: boolean; detail?: string } | null>(null)
  // Guards against folding the same completed run into the ledger twice (mirror of recordedGameRef);
  // reset at every kickoff so a retry records again.
  const recordedScenarioRef = useRef(false)

  const openScenario = useCallback((def: ScenarioDef) => {
    setActiveScenario(def)
    setScenarioResult(null)
    setScenarioTeam(null)
    setScenarioOutcome(null)
    setPhase('scenario-select')
  }, [])

  const exitScenario = useCallback(() => {
    setActiveScenario(null)
    setScenarioResult(null)
    setScenarioTeam(null)
    setScenarioOutcome(null)
    setPhase(state.games.length === 0 && state.status === 'in-progress' ? 'select' : 'hub')
  }, [state.games.length, state.status])

  const [lockedTeam, setLockedTeam] = useState<SelectedTeam | null>(null)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [playingGame, setPlayingGame] = useState<1 | 2 | 3>(state.currentGame)
  const [potms, setPotms] = useState<PlayerOfMatch[]>([])
  // Each game's crowned play, kept in memory like the POTMs — the shield-deciding game's moment is
  // the ONE the career archives when the season closes.
  const [moments, setMoments] = useState<Array<{ gameNumber: GameNo; moment: IconicMoment }>>([])
  // Pre-match addresses already shown this series — fed back so a Gus speech never repeats.
  const [usedSpeechTitles, setUsedSpeechTitles] = useState<string[]>([])
  // Guards against folding the same game into the series twice (e.g. the auto-advance + the button).
  const recordedGameRef = useRef<number | null>(null)

  // ---- The Daily Origin — a one-shot, date-seeded match alongside the series. ----
  // The key is read per render, so a session left open overnight rolls to the new day's challenge.
  const todayKey = dailyKey(new Date())
  const daily = useDaily(todayKey)
  const [dailyResult, setDailyResult] = useState<MatchResult | null>(null)
  const [dailyTeam, setDailyTeam] = useState<SelectedTeam | null>(null)
  // Guards against folding the same daily into the ledger twice (mirror of recordedGameRef).
  const recordedDailyRef = useRef<string | null>(null)

  // ---- Feats — judged at the App boundary the moment each result exists. ----
  const feats = useFeats(todayKey)
  // What THIS run has just earned: shown as toasts on the result screen and, for first earns,
  // bragged on the share card. Cleared at the next kickoff; a reload clears it too (the cabinet
  // remembers forever; the toast is a moment).
  const [recentMints, setRecentMints] = useState<FeatMint[]>([])
  // This run's "so close" lines — shown under the toasts, best-ever fold lives in the feats ledger.
  const [recentNearMisses, setRecentNearMisses] = useState<NearMiss[]>([])

  // ---- The Back Page — the media reacts to the coach's calls (series games only; the Daily is
  // arcade, the papers don't cover it). Derived at lock-in, settled at full time. ----
  const coach = useCoach()
  const [stories, setStories] = useState<Storyline[]>([])
  const [prePage, setPrePage] = useState<BackPage | null>(null)
  const [postPage, setPostPage] = useState<BackPage | null>(null)
  const [presser, setPresser] = useState<PressExchange[]>([])

  // The men the media put under fire this series (recalls, kept faith, blooded rookies, gambles) —
  // Faith Rewarded pays off when one of them takes the Player of the Series medal.
  const [underFireIds, setUnderFireIds] = useState<string[]>([])

  // Judge the series feats against a COMPLETED state. The reducers are pure, so callers compute the
  // post-fold state themselves — no effect, no double-judgement (one-shot feats no-op anyway).
  // The coach-chase feats read the siege AS IT STOOD (pressureNow, before the result cools it).
  const judgeCompletedSeries = useCallback(
    (completed: SeriesState, mvpId: string | null) => {
      if (completed.status !== 'complete' || !completed.seriesWinner) return
      const { mints, misses } = feats.judge(
        {
          kind: 'series',
          completed,
          career: loadCareer(),
          coachPressure: coach.pressureNow(),
          mvpId,
          underFireIds,
          nswNames: Object.values(dynasty.blues(completed.opponentId).lineup).map((p) => p.name),
        },
        todayKey,
      )
      if (mints.length > 0) setRecentMints((prev) => [...prev, ...mints])
      if (misses.length > 0) setRecentNearMisses((prev) => [...prev, ...misses])
      coach.seriesHeat(completed)
    },
    [feats, todayKey, coach, underFireIds, dynasty],
  )

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
      const nsw = nswTeamFrom(dynasty.blues(state.opponentId))
      // Difficulty dial: a uniform effective-attr nudge to the drawn Blues side, folded into the form
      // map (pure arithmetic, no rng — never perturbs the seeded play stream). Origin = 0 = unchanged.
      const diffDelta = nswDifficultyDelta(state.difficulty)
      if (diffDelta !== 0) {
        for (const p of Object.values(nsw.lineup)) form[p.id] = (form[p.id] ?? 0) + diffDelta
      }
      const setup: MatchSetup = {
        qld: team,
        nsw,
        series: { ...currentContext, usedSpeechTitles },
        form,
        reinjury,
      }
      setLockedTeam(team)
      setPlayingGame(game)
      recordedGameRef.current = null
      setRecentMints([])
      setRecentNearMisses([])
      // The papers react to the team sheet the moment it drops — the boldest call gets the splash.
      const seed = gameSeed(state.rootSeed, game)
      const derived = deriveStorylines({
        team,
        squad: dynasty.roster,
        conditions: state.playerConditions,
        priorLineup: state.games.at(-1)?.qldLineup,
      })
      setStories(derived)
      const boldKinds = new Set(['recalled-outcast', 'kept-faith', 'blooded-rookie', 'gamble-doubtful'])
      setUnderFireIds((prev) => [
        ...new Set([...prev, ...derived.filter((s) => boldKinds.has(s.kind)).map((s) => s.playerId)]),
      ])
      setPrePage(preGameBackPage(derived[0], seed, coach.coach))
      setPostPage(null)
      setPresser([])
      setResult(simulateMatch(setup, seed))
      setPhase('pregame')
    },
    [
      state.currentGame,
      state.rootSeed,
      state.opponentId,
      state.difficulty,
      state.playerConditions,
      state.games,
      currentContext,
      usedSpeechTitles,
      dynasty,
      coach,
    ],
  )

  // Fold the finished game into the series exactly once, then show the result.
  const handleMatchComplete = useCallback(() => {
    if (result && lockedTeam && recordedGameRef.current !== playingGame) {
      recordedGameRef.current = playingGame
      const played = {
        qldLineup: lineupIds(lockedTeam),
        qldKickerId: lockedTeam.kickerId,
        finalScore: result.finalScore,
        winner: result.winner,
        events: result.events,
        stats: result.stats,
        iconicMoment: result.iconicMoment,
      }
      recordResult(played)
      setPotms((prev) => [...prev, result.playerOfMatch])
      if (result.iconicMoment) {
        const moment = result.iconicMoment
        setMoments((prev) => [...prev, { gameNumber: playingGame, moment }])
      }
      setUsedSpeechTitles((prev) => [...prev, result.broadcast.preMatchSpeech.title])
      // Judge the single-match feats while the stats + the locked 19 are in hand, then — because
      // applyGameResult is pure — fold the game locally to see if this one ended the series.
      const { mints, misses } = feats.judge(
        { kind: 'match', result, team: lockedTeam, difficulty: state.difficulty ?? 'origin' },
        todayKey,
      )
      if (mints.length > 0) setRecentMints((prev) => [...prev, ...mints])
      if (misses.length > 0) setRecentNearMisses((prev) => [...prev, ...misses])
      // The morning-after verdict: the paper's position, settled by the result — and the hot seat
      // moves with it. Series heat (if this game ended it) lands inside judgeCompletedSeries.
      if (prePage) {
        const won = result.winner === 'QLD'
        const seed = gameSeed(state.rootSeed, playingGame)
        setPostPage(postGameBackPage(stories[0], prePage.stance, result, seed, coach.coach))
        setPresser(buildPressConference(result, pressureBand(coach.state.pressure), stories[0], seed, coach.coach))
        coach.gameHeat(prePage.stance, won)
      }
      const mvpCandidate = pickSeriesMvp([...potms, result.playerOfMatch])
      judgeCompletedSeries(applyGameResult(state, played), mvpCandidate.id)
    }
    setPhase('result')
  }, [result, lockedTeam, playingGame, recordResult, feats, state, todayKey, judgeCompletedSeries, prePage, stories, coach, potms])

  // Lock in the daily XVII and simulate — the twist composes at this boundary exactly like the
  // difficulty dial (uniform form-map deltas + a venue), so the engine never learns "daily".
  const handleDailyKickOff = useCallback(
    (team: SelectedTeam) => {
      const { twist, opponent, venue, seed } = daily.challenge
      const form: Record<string, number> = {}
      if (twist.nswFormDelta) for (const p of Object.values(opponent.lineup)) form[p.id] = twist.nswFormDelta
      if (twist.qldFormDelta) for (const p of Object.values(team.lineup)) form[p.id] = twist.qldFormDelta
      const setup: MatchSetup = {
        qld: team,
        nsw: {
          side: 'NSW',
          lineup: { ...opponent.lineup },
          kickerId: opponent.kickerId,
          edgeThreats: opponent.edgeThreats,
        },
        series: { gameNumber: 1, seriesScore: { qld: 0, nsw: 0 }, venue, stakes: 'OPENER' },
        form,
      }
      setDailyTeam(team)
      recordedDailyRef.current = null
      setRecentMints([])
      setRecentNearMisses([])
      setDailyResult(simulateMatch(setup, seed))
      setPhase('daily-pregame')
    },
    [daily.challenge],
  )

  // Fold the finished daily into the ledger exactly once — this is the moment the attempt is spent.
  const handleDailyComplete = useCallback(() => {
    if (dailyResult && recordedDailyRef.current !== daily.challenge.dateKey) {
      recordedDailyRef.current = daily.challenge.dateKey
      const record = {
        dateKey: daily.challenge.dateKey,
        twistId: daily.challenge.twist.id,
        opponentId: daily.challenge.opponent.id,
        venueId: daily.challenge.venue.id,
        finalScore: dailyResult.finalScore,
        winner: dailyResult.winner,
      }
      daily.record(record)
      // Judge the daily feats against the ledger AS IT WILL BE once the record lands (the hook's
      // state update is async, so fold it locally for the judgement).
      const nextLedger = recordDaily(daily.ledger, record)
      const { mints, misses } = feats.judge(
        { kind: 'daily', record, summary: summariseDaily(nextLedger, todayKey), ledger: nextLedger },
        record.dateKey,
      )
      if (mints.length > 0) setRecentMints((prev) => [...prev, ...mints])
      if (misses.length > 0) setRecentNearMisses((prev) => [...prev, ...misses])
    }
    setPhase('daily-result')
  }, [dailyResult, daily, feats, todayKey])

  // Lock in a scenario side — the shared builder guarantees the played match IS the tested match.
  const handleScenarioKickOff = useCallback(
    (team: SelectedTeam) => {
      if (!activeScenario) return
      setScenarioTeam(team)
      setScenarioOutcome(null)
      recordedScenarioRef.current = false
      setRecentMints([])
      setRecentNearMisses([])
      setScenarioResult(simulateMatch(buildScenarioSetup(activeScenario, team), activeScenario.seed))
      setPhase('scenario-pregame')
    },
    [activeScenario],
  )

  // Judge the win condition and fold the completed run into the conquest ledger exactly once.
  const handleScenarioComplete = useCallback(() => {
    if (activeScenario && scenarioResult && scenarioTeam && !recordedScenarioRef.current) {
      recordedScenarioRef.current = true
      const verdict = activeScenario.winCondition(scenarioResult, scenarioTeam)
      const passed = verdict !== false
      const detail = typeof verdict === 'string' ? verdict : undefined
      setScenarioOutcome({ passed, detail })
      // Judge the scenario feats against the ledger AS IT WILL BE once the run lands (the hook's
      // ref makes the fold synchronous — the handleDailyComplete pattern).
      const nextLedger = scenarios.record(activeScenario.id, passed, todayKey, detail)
      const { mints, misses } = feats.judge(
        { kind: 'scenario', scenarioId: activeScenario.id, passed, ledger: nextLedger },
        todayKey,
      )
      if (mints.length > 0) setRecentMints((prev) => [...prev, ...mints])
      if (misses.length > 0) setRecentNearMisses((prev) => [...prev, ...misses])
    }
    setPhase('scenario-result')
  }, [activeScenario, scenarioResult, scenarioTeam, scenarios, feats, todayKey])

  // "Run it back" — the same pinned match, a different 19. The learnable-puzzle loop.
  const handleScenarioRetry = useCallback(() => {
    setScenarioResult(null)
    setScenarioTeam(null)
    setScenarioOutcome(null)
    setPhase('scenario-select')
  }, [])

  // Skipping the dead rubber concludes the series — judge the concluded state it will become.
  const handleSkipDeadRubber = useCallback(() => {
    judgeCompletedSeries(concludeSeries(state), potms.length > 0 ? pickSeriesMvp(potms).id : null)
    skipDeadRubber()
  }, [state, skipDeadRubber, judgeCompletedSeries, potms])

  // ---- The off-season: the completed year hardens into the dynasty, then the next campaign opens. ----
  const [offseasonReport, setOffseasonReport] = useState<OffseasonReport | null>(null)
  const [boardOutcome, setBoardOutcome] = useState<BoardOutcome | null>(null)

  const handleRunOffseason = useCallback(() => {
    const report = dynasty.runOffseasonFor(state)
    if (report) {
      // The board meets once the season is in the books — it may end the coaching era right here.
      setBoardOutcome(coach.review(state, report.endedYear))
      setOffseasonReport(report)
      setPhase('offseason')
    }
  }, [dynasty, state, coach])

  const handleBeginYear = useCallback(() => {
    // Archive the finished series (labelled with the year it WAS) and open the new year's campaign
    // with the freshly-aged roster, everyone starting level, on the year's deterministic seed.
    const seriesMvp = state.status === 'complete' && potms.length > 0 ? pickSeriesMvp(potms) : null
    // The career remembers ONE play per series: the shield-deciding game's crowned moment.
    const decider = decidingGame(state.games)
    const remembered = decider !== null ? moments.find((m) => m.gameNumber === decider) : undefined
    newSeries(seriesMvp, {
      rootSeed: dynasty.nextSeriesSeed(),
      roster: dynasty.roster,
      neutralStart: true,
      year: offseasonReport?.endedYear,
      iconicMoment: remembered
        ? {
            playerId: remembered.moment.playerId,
            playerName: remembered.moment.playerName,
            side: remembered.moment.side,
            gameNumber: remembered.gameNumber,
            minute: remembered.moment.minute,
            kind: remembered.moment.kind,
            line: remembered.moment.line,
          }
        : undefined,
    })
    setOffseasonReport(null)
    setBoardOutcome(null)
    setLockedTeam(null)
    setResult(null)
    setPotms([])
    setMoments([])
    setUnderFireIds([])
    setUsedSpeechTitles([])
    recordedGameRef.current = null
    setPhase('select')
  }, [newSeries, state.status, state.games, potms, moments, dynasty, offseasonReport])

  // The prior game's XVII pre-fills the next selection (survives a reload via the saved series).
  const prior = state.games.at(-1)

  // The grudge callback: the most recent archived nemesis returning in this series' drawn Blues
  // sheet. Recomputed when the opponent (new series) or the career (a fresh archive) changes.
  const grudgeLine = useMemo(() => {
    void careerSummary // re-read the ledger when a series is archived
    return returningNemesis(loadCareer(), Object.values(dynasty.blues(state.opponentId).lineup))?.line ?? null
  }, [state.opponentId, careerSummary, dynasty])

  if (phase === 'offseason' && offseasonReport) {
    return <OffseasonScreen report={offseasonReport} board={boardOutcome} onContinue={handleBeginYear} />
  }

  if (phase === 'gauntlet-select' && gauntlet) {
    return (
      <DailySelectionScreen
        challenge={gauntlet}
        summary={daily.summary}
        mode="gauntlet"
        onKickOff={handleGauntletKickOff}
        onBack={exitGauntlet}
      />
    )
  }

  if (phase === 'gauntlet-pregame' && gauntlet && gauntletResult) {
    return (
      <PreGameScreen
        result={gauntletResult}
        gameLabel="The Gauntlet"
        venueName={gauntlet.venue.stadium}
        stakesLabel={`⚡ ${gauntlet.twist.label} · same match as your mate`}
        onKickOff={() => setPhase('gauntlet-live')}
      />
    )
  }

  if (phase === 'gauntlet-live' && gauntlet && gauntletResult && gauntletTeam) {
    return (
      <LiveMatchScreen
        key={`gauntlet-${gauntlet.seed}`}
        result={gauntletResult}
        gameLabel="The Gauntlet"
        venueName={gauntlet.venue.stadium}
        stakesLabel={`⚡ ${gauntlet.twist.label}`}
        startingLineups={{ QLD: gauntletTeam.lineup, NSW: gauntlet.opponent.lineup }}
        onComplete={() => setPhase('gauntlet-result')}
      />
    )
  }

  if (phase === 'gauntlet-result' && gauntlet && gauntletResult) {
    return <GauntletResultScreen result={gauntletResult} challenge={gauntlet} onContinue={exitGauntlet} />
  }

  if (phase === 'scenario-select' && activeScenario) {
    return (
      <DailySelectionScreen
        challenge={scenarioChallenge(activeScenario)}
        summary={daily.summary}
        mode="scenario"
        winLine={activeScenario.winLabel}
        onKickOff={handleScenarioKickOff}
        onBack={exitScenario}
      />
    )
  }

  if (phase === 'scenario-pregame' && activeScenario && scenarioResult) {
    return (
      <PreGameScreen
        result={scenarioResult}
        gameLabel="This Day in Origin"
        venueName={scenarioChallenge(activeScenario).venue.stadium}
        stakesLabel={`🎯 ${activeScenario.winLabel}`}
        onKickOff={() => setPhase('scenario-live')}
      />
    )
  }

  if (phase === 'scenario-live' && activeScenario && scenarioResult && scenarioTeam) {
    return (
      <LiveMatchScreen
        key={`scenario-${activeScenario.id}-${scenarios.ledger.entries[activeScenario.id]?.attempts ?? 0}`}
        result={scenarioResult}
        gameLabel="This Day in Origin"
        venueName={scenarioChallenge(activeScenario).venue.stadium}
        stakesLabel={`🎯 ${activeScenario.winLabel}`}
        startingLineups={{ QLD: scenarioTeam.lineup, NSW: scenarioChallenge(activeScenario).opponent.lineup }}
        onComplete={handleScenarioComplete}
      />
    )
  }

  if (phase === 'scenario-result' && activeScenario && scenarioResult && scenarioOutcome) {
    return (
      <ScenarioResultScreen
        result={scenarioResult}
        def={activeScenario}
        passed={scenarioOutcome.passed}
        detail={scenarioOutcome.detail}
        attempts={scenarios.ledger.entries[activeScenario.id]?.attempts ?? 1}
        featMints={recentMints}
        nearMisses={recentNearMisses}
        onRunBack={handleScenarioRetry}
        onContinue={exitScenario}
      />
    )
  }

  if (phase === 'daily-select') {
    return (
      <DailySelectionScreen
        challenge={daily.challenge}
        summary={daily.summary}
        onKickOff={handleDailyKickOff}
        onBack={() => setPhase('hub')}
      />
    )
  }

  if (phase === 'daily-pregame' && dailyResult) {
    return (
      <PreGameScreen
        result={dailyResult}
        gameLabel="The Daily Origin"
        venueName={daily.challenge.venue.stadium}
        stakesLabel={`⚡ ${daily.challenge.twist.label} · one attempt`}
        onKickOff={() => setPhase('daily-live')}
      />
    )
  }

  if (phase === 'daily-live' && dailyResult && dailyTeam) {
    return (
      <LiveMatchScreen
        key={daily.challenge.dateKey}
        result={dailyResult}
        gameLabel="The Daily Origin"
        venueName={daily.challenge.venue.stadium}
        stakesLabel={`⚡ ${daily.challenge.twist.label}`}
        startingLineups={{ QLD: dailyTeam.lineup, NSW: daily.challenge.opponent.lineup }}
        onComplete={handleDailyComplete}
      />
    )
  }

  if (phase === 'daily-result' && dailyResult && daily.todayRecord) {
    return (
      <DailyResultScreen
        result={dailyResult}
        record={daily.todayRecord}
        summary={daily.summary}
        featMints={recentMints}
        nearMisses={recentNearMisses}
        onContinue={() => setPhase('hub')}
      />
    )
  }

  if (phase === 'select') {
    return (
      <SelectionScreen
        gameLabel={originLabel(state.currentGame)}
        venueName={currentContext.venue.stadium}
        stakesLabel={STAKES_SHORT[currentContext.stakes]}
        seriesState={state}
        difficulty={state.difficulty ?? 'origin'}
        onSetDifficulty={setDifficulty}
        initialLineup={prior?.qldLineup}
        initialKickerId={prior?.qldKickerId}
        onKickOff={handleKickOff}
        onPlayDaily={daily.todayRecord ? undefined : () => setPhase('daily-select')}
        squad={dynasty.roster}
        grudgeLine={grudgeLine}
        opponent={dynasty.blues(state.opponentId)}
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
        backPage={prePage}
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
        startingLineups={{ QLD: lockedTeam.lineup, NSW: dynasty.blues(state.opponentId).lineup }}
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
        featMints={recentMints}
        nearMisses={recentNearMisses}
        backPage={postPage}
        pressConference={presser}
        coachSurname={coach.coach.surname}
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
      onSkipDeadRubber={handleSkipDeadRubber}
      onRunOffseason={handleRunOffseason}
      dynasty={dynasty.state}
      roster={dynasty.roster}
      daily={daily}
      onPlayDaily={() => setPhase('daily-select')}
      featsLedger={feats.ledger}
      scenarioLedger={scenarios.ledger}
      onPlayScenario={openScenario}
      newFeatNames={recentMints.filter((m) => m.isFirst).map((m) => m.def.name)}
      coachPressure={coach.state.pressure}
      coachName={coach.coach.name}
      coachEras={coach.state.eras}
      currentEraShields={coach.state.eraShields}
      grudgeLine={grudgeLine}
      eraLine={
        state.status === 'complete'
          ? eraCardLine(dynasty.state.years, state.seriesWinner === 'QLD', dynasty.state.currentYear - dynasty.state.startYear + 1)
          : null
      }
    />
  )
}
