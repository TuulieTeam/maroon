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

## Deferred backlog

Paused 2026-06-16 — no committed dates. Roughly highest-leverage first.

1. **Difficulty dial** (Casual / Origin / Hard) — a scalar on NSW effective-attrs applied at the
   existing kickoff form-delta boundary in `App.tsx`; reuses the home-edge/form machinery, minimal
   engine change. "Won the shield on Hard" feeds the share card. Re-check `calibration.test.ts` for the
   scaled side.
2. **NSW opponent variety** — an NSW pool + selection/rotation, or 2-3 pre-authored alternate Blues
   lineups. NSW is already a plain `SelectedTeam`, so no engine change — data + selection UI. Deepest
   replayability unlock.
3. **Break up `simulate.ts`** (~1,350 LOC) — extract the bench-rotation/runtime subsystem and the
   HIA/foul-play drama bookkeeping into pure modules. Safe now that the integration test guards the
   contract.
4. **Theme-token + spacing/type-scale sweep → alternate skin** — add `--space-*`/`--text-*` tokens,
   replace the ~40 raw `rgba()` literals, then a `data-theme` terminal/8-bit skin to cash in the
   swappable-surface promise.
5. **Editable-squad / JSON import layer** + a data-consistency test (status/form/injury tables agree).
   `persist.ts` stores IDs only, so an attribute overlay drops in without save migrations.
6. **Polish** — expand the 3 "pressure" Gus speeches (`speeches.ts`); replace the stock-Vite
   `README.md`; optionally flip analyst color lines to surnames (`renderColorLine`) to match the callers.

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
