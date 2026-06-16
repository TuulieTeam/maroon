/**
 * `deriveWrap` lives in the engine (engine/series.ts) because the post-game booth computes the wrap
 * inside `simulateMatch`, where only the engine has the winner — and the engine must not import from
 * this UI-side module. Re-exported here so the rest of `src/series` and the UI keep one import home.
 */
export { deriveWrap } from '../engine'
