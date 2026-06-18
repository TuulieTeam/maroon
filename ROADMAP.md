# Maroon — Roadmap & Backlog

Living plan for the game. Origin of this doc: a multi-agent assessment (2026-06-16) that mapped what's
actually shipped vs the README, then a run of focused features. Pick up any **Deferred** (near-term
hygiene + features) or **Vision** (the elite, keep-the-magic-alive bets) item below — each has a why and
a starting point.

## Shipped

The best-of-three **series** system is the product's spine (despite CLAUDE.md still listing parts of it
as "deferred"): `src/series/**` — seeded form/injury carryover, club-round conditioning, stakes/wrap
logic, three venues, validated `localStorage`. The engine purity invariant holds (`src/engine/**` has
zero React/DOM imports; `simulateMatch(setup, seed)` is a pure deterministic function).

Recent feature work:

- **Home-ground edge** — a per-side effective-attr nudge folded into the form map, scaled by each
  venue's `homeAdvantage` (Suncorp fortress → MCG near-neutral). `TUNING.homeEdge` in `ratings.ts`,
  `homeEdgeBySide()`, applied in `simulate.ts buildFormMap`. Pure, no rng.
- **Series integration test** — `src/series/__tests__/seriesIntegration.test.ts` round-trips real
  `simulateMatch` → `applyGameResult` → `advanceConditions` → next game, + determinism. Pins the
  engine↔series carryover contract.
- **Shareable result card** — Wordle-style copy-to-clipboard block on the hub (`series/shareCard.ts`,
  `ui/components/ShareCard.tsx`).
- **Career ledger** — completed series archived under a 2nd key `maroon.career.v1`
  (`series/career.ts` + `careerPersist.ts`); hub shows all-time shields / series / games W-L + a
  series-MVP hall of fame (`ui/components/CareerLedger.tsx`). IDs + score tally only, never attributes.
- **Scoped UX + a11y pass** — selection screen floats natural-fit players to the top of the pool when a
  slot is active (+ scroll-to-pool); full keyboard operability + global `:focus-visible`; a global
  `prefers-reduced-motion` guard; squad-count copy reconciled to "19 + 2 reserves".
- **Named callers + TV cadence** — play-by-play uses surnames; two callers wired via `callerFor()`
  (lead Thommo = the moments, co Petero = the grind), shown on speaker-change in the feed.
- **Deepened analyst color** — `colorCommentary.ts` pools doubled to 4-6 in-voice lines per
  persona/moment.
- **NSW opponent variety** — three zone-varied Blues sides (`src/data/bluesVariants.ts`): the canonical
  right-edge side, a left-edge side (Latrell/Martin run at your right), and a middle-bashing forward
  pack. One is drawn deterministically per series from `rootSeed` (`bluesForSeed`), fixed across all
  three games, revealed in the scouting report — the player never picks the opponent. Each side ships
  its own `edgeThreats`; the booth pre-game now reads the drawn side's threat zone + playmaker
  (opponent-aware `derivePreGameFacts` + `{yourEdge}`/`{threatPhrase}`/`{theirHalf}` tokens, no
  hardcoded "left edge"). Persisted via `SeriesState.opponentId` (schema v2→v3, validated). Built to
  equal strength / different shape — balance guard in `bluesVariants.test.ts` keeps avg margins within
  ~one converted try. The engine was already opponent-agnostic, so `simulate.ts` is untouched.
- **Difficulty dial** (Casual / Origin / Hard) — `src/series/difficulty.ts`: a uniform NSW effective-attr
  nudge (`DIFFICULTY_TUNING` ±6, Origin = 0) folded into the form map at the `App.tsx` kickoff boundary,
  so the engine never learns "difficulty" and Origin stays byte-identical. Chosen on the game-1 selection
  screen (segmented keycap control), locked once game 1 is played, persisted as optional
  `SeriesState.difficulty` (no schema bump — a pre-dial save reads as Origin). Composes additively with
  form, the home edge, and the drawn Blues side. Recorded on the share card ("⚙️ Difficulty: Hard").
  Behavioural guard in `difficulty.test.ts` proves it bites monotonically through the engine.

## Deferred backlog

Paused 2026-06-16 — no committed dates. Roughly highest-leverage first.

1. **Break up `simulate.ts`** (~1,350 LOC) — extract the bench-rotation/runtime subsystem and the
   HIA/foul-play drama bookkeeping into pure modules. Safe now that the integration test guards the
   contract.
2. **Theme-token + spacing/type-scale sweep → alternate skin** — add `--space-*`/`--text-*` tokens,
   replace the ~40 raw `rgba()` literals, then a `data-theme` terminal/8-bit skin to cash in the
   swappable-surface promise.
3. **Editable-squad / JSON import layer** + a data-consistency test (status/form/injury tables agree).
   `persist.ts` stores IDs only, so an attribute overlay drops in without save migrations. (Would also
   make new Blues sides + difficulty curves authorable without a redeploy.)
4. **Polish** — expand the 3 "pressure" Gus speeches (`speeches.ts`); replace the stock-Vite
   `README.md`; optionally flip analyst color lines to surnames (`renderColorLine`) to match the callers;
   surface the beaten Blues side + difficulty on the career ledger ("beat the Big Blue Wall on Hard").

## Vision — making it elite (keeping the magic alive year-round)

Added 2026-06-18. The game is an elite *single series*; these are the bets that make it one you can't put
down between real Origin campaigns. The gap is two things: **cadence** (a reason to come back tomorrow)
and **the long arc** (a reason a run matters beyond its own shield). These are product bets, not the
hygiene in the backlog above. Recommended sequence: ship the **Daily** first (small, reuses what's
built), then commit to the **Dynasty** as the flagship, with the **chase layer** threaded through both.

1. **The Dynasty (north star).** Don't "start a new series" — start the *next year*. Players age, peak,
   decline, and retire; bolters debut; past results harden into history. You chase your own era — the
   8-in-a-row is Queensland's holy grail. Turns "I won a shield" into "I'm four years in, Munster just
   retired, rebuild the spine around a 21-year-old." The deepest retention well; the biggest build.
   *Fit:* the engine is squad-agnostic and `persist.ts` stores IDs + tallies only, so a per-year
   age/attribute overlay drops in without save migrations — the **editable-squad seam (deferred #3)
   evolved into progression**. New state: a multi-season ledger (years, rosters, retirements, your
   record), generated rookies, and aging curves on the data layer — never frozen into the live save.
2. **The Daily Origin (off-season ritual + the fast win).** Wordle for Origin: the date seeds the Blues
   side + venue + an optional twist ("depleted spine", "win from 0–1"); one attempt; a shareable score
   and a **streak**. *Fit:* reuses the deterministic engine (seed = date) + `bluesForSeed` + the existing
   `shareCard.ts` almost wholesale — tiny build, high cadence, keeps Origin alive 365 days a year. New
   state: a daily-result/streak `localStorage` key, a date→seed helper, and a one-shot match (or
   mini-series) mode alongside the main series.
3. **The chase layer (texture — threads through both).** What makes a run worth *retelling*:
   - *Feats* — 3–0 on Hard, win a decider away at Accor, win with no recognised halfback, hold NSW
     try-less. Derived from results + difficulty + opponent into a persisted badge set; self-imposed
     reasons to replay differently.
   - *The iconic moment* — the booth crowns a match's defining play and the career *remembers* it ("the
     Cobbo try that won the '26 decider"). An engine/broadcast pick + a career field. Cashes in the
     "iconic moment / cauldron / legacy weight" essence gaps noted in the 2026-06-18 design chat.
   - *A nemesis* — a Blues danger man who owns you across a series and that you're gunning to shut down
     next time. Track NSW per-player damage across games.
4. **Scenarios — "This Day in Origin" (lighter content vein).** Hand-authored historical / what-if
   challenges with constraints + a win condition ("Wally's Maroons", "the '95 rookies", "down 0–1, win
   twice"). Plays to the authored-flavour strength and finally cashes in Origin's *history* as content.
   *Fit:* a scenario is just a pinned setup (seed + roster constraints + goal) the engine already runs.

## Invariants to protect

- **Engine purity** — `src/engine/**` stays free of React/DOM/`localStorage`. New levers go in `TUNING`
  + effective-attr math or at the `App.tsx` kickoff boundary, never by crossing the boundary.
- **Determinism** — any new stochastic lever must be pure arithmetic or draw a *fixed* rng count, or it
  desyncs replays and breaks `simulate.test.ts`.
- **Calibration drift** — adding strength scalars shifts distributions; re-check `calibration.test.ts`
  and re-derive `conditions.ts` baselines rather than assuming the bands hold.
- **Saves store IDs + immutable tallies only** — never freeze squad attributes into `localStorage`.
- **Data staleness** — 2026 squads/form/injuries are hand-kept across `src/data/*`; add the
  consistency test (item 5) before heavy roster edits.
