/**
 * The deployed game's canonical URL — the last line of every share card, because a brag nobody can
 * click is a dead end. Lives in its own module so the pure share-card builders (series + daily) can
 * both import it without either depending on the other.
 */
export const GAME_URL = 'https://tuulieteam.github.io/maroon/'
