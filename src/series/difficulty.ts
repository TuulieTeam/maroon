/**
 * The difficulty dial. A uniform signed effective-attr nudge applied to the NSW side at the kickoff
 * form-map boundary (App.tsx) — NOT in the engine, which stays unaware of "difficulty" and simply reads
 * the resulting per-player form deltas. So this composes additively with form, the home-ground edge, and
 * whichever Blues side was drawn, and (being pure arithmetic on the form map) never perturbs the seeded
 * play stream. `origin` is 0, so an Origin-difficulty series is byte-identical to the dial-free game.
 *
 * Magnitude: TUNED AGAINST realBalance.test.ts — the win curve is steep (~7pp per uniform point), so
 * hard's +4 is ~a third of the win rate at Suncorp (target ~35%) and casual's -6 is a comfortable night
 * (~85%+). The monotonic guard in difficulty.test.ts re-checks the dial still bites in the right
 * direction; the real-squad bands in realBalance.test.ts pin what each setting FEELS like.
 */
export type Difficulty = 'casual' | 'origin' | 'hard'

export const DIFFICULTIES: Difficulty[] = ['casual', 'origin', 'hard']

/** Signed effective-attr delta applied to every NSW player. Negative = a weaker Blues (easier). */
export const DIFFICULTY_TUNING: Record<Difficulty, number> = {
  casual: -6,
  origin: 0,
  hard: 3,
}

export const DIFFICULTY_META: Record<Difficulty, { label: string; blurb: string }> = {
  casual: { label: 'Casual', blurb: 'The Blues come off second-best — a softer night to bank a series.' },
  origin: { label: 'Origin', blurb: 'The real thing — the Blues at full tilt.' },
  hard: { label: 'Hard', blurb: 'The Blues lift a gear — only a sharp selection holds them out.' },
}

/** The NSW effective-attr nudge for a difficulty (0 for Origin / undefined → no change). */
export function nswDifficultyDelta(d: Difficulty | undefined): number {
  return d ? DIFFICULTY_TUNING[d] : 0
}
