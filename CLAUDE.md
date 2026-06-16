# Maroon

Single-player, browser-based, text-based State of Origin game. You pick Queensland's 17 from a squad pool, lock in, then watch Origin I play out as a **live, ticking text commentary feed you can't control** — and live with the result. Unapologetically Maroon. Personal project, runs locally.

## Stack

Vite + React 19 + TypeScript, **pnpm**, Vitest. Plain CSS with CSS custom properties for theming (`src/styles/theme.css`).

**No Next.js, no backend, no Supabase, no auth, no database** — this is a pure client-side app. Any persistence uses `localStorage`. **Do NOT pull in the DTT-standard stack** (Sentry / Resend / Whop / Upstash / Vercel) — this is a standalone personal game, not a DTT repo.

## Architecture invariant (load-bearing — do not break)

`src/engine/**` is **pure framework-agnostic TypeScript with zero React/DOM imports**. `simulateMatch(setup, seed)` computes the *entire* match synchronously as a seeded, deterministic stream of timestamped `MatchEvent`s. `src/ui/**` only **paces and renders** those events (the "live ticking" feel lives in `useMatchPlayback`, not the engine). The engine never imports from `ui`. This separation is enforced by the Node-environment Vitest tests and is what keeps the surface swappable (terminal / 8-bit later) without touching match logic.

The causal spine: selection → player attributes → channel matchups (LEFT/MIDDLE/RIGHT) → weighted event probabilities → commentary that **names the players you picked**. A weak link in a channel gets attacked more *and* loses contests more — so the result feels caused by selection, not random. `causalChain.test.ts` proves this statistically.

## Conventions

- `pnpm dev` (runs on **port 3001**), `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- Balance/tuning constants live in `TUNING` objects in `src/engine/ratings.ts` (and `simulate.ts`) — one place to twist the knobs.
- Real contemporary player names are intentional (personal single-player use only).

## Scope

**v1 (built):** Origin I — a single match, pure spectator. Bench forwards auto-rotate on fatigue, so all 17 picks matter.

**Deferred (clean seams left in the engine):** Origin II & III + best-of-three series + dead-rubber/series-stakes logic; any in-match player-controlled lever (interchange/tactical call); 8-bit sprites & sound; cross-game fatigue/injury carryover.
