# Maroon — Roadmap & Backlog

Living plan for the game. Origin of this doc: a multi-agent assessment (2026-06-16) that mapped what's
actually shipped vs the README, then a run of focused features. Pick up any **Deferred** item below —
each has a why and a starting point.

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
