/**
 * TWO CLOCK READINGS BECOME A STORED DURATION HERE, AND NOWHERE ELSE.
 *
 * WHAT WENT WRONG, BECAUSE THIS FILE ONLY EXISTS BECAUSE OF IT. `performance.now()` returns a
 * DOUBLE. A think time computed as `now - turnStartedAt` is therefore something like
 * `3947.6999999999998`, and `storedBlitzRecordSchema` requires `thinkMs` to be `z.number().int()`.
 * Every blitz game played in a real browser was refused by the schema on its way to the record, and
 * the screen -- which held its own copy of what it had just assembled -- carried on showing a
 * post-game reading for a game that had not been stored. The sentence it showed said
 * "המשחק עצמו נשמר". Both halves of that were false.
 *
 * WHY NO TEST SAW IT. Every jsdom test in this repository mocks `performance.now()` to return whole
 * milliseconds, because a test that wants to say "the player thought for four seconds" writes
 * `4000`. So the instrument was only ever fed values a browser does not produce, and the one
 * property that separated the fixtures from reality was the one the schema checked.
 *
 * WHY IT IS ROUNDED AT THE SOURCE RATHER THAN AT THE STORE. Rounding on the way into the record
 * would leave the screen showing one think time and the record holding another, which is the exact
 * split this product is built to not have. Rounding here means the value the game state carries IS
 * the value that gets stored, so the two agree by construction rather than by review.
 *
 * WHY ROUND AND NOT FLOOR. A floor biases every duration downward by half a millisecond on average.
 * That is far below anything the product can act on, but it is a bias rather than noise, and a bias
 * applied to every observation in a calibration study is not the kind of thing to introduce on
 * purpose.
 *
 * WHAT IS NOT ROUNDED. A clock that is still running -- `remainingMs()` on the side to move -- is a
 * continuous reading and not a measurement, so it stays a double. Nothing stores it.
 */

/**
 * The whole number of milliseconds between two readings of the same monotonic clock.
 *
 * `fromMs` and `toMs` must come from ONE clock -- `performance.now()` throughout this product.
 * Mixing a `performance.now()` with a `Date.now()` produces a number with no meaning, and no
 * function here can detect that.
 *
 * THE FLOOR AT ZERO IS A GUARD AND NOT A POLICY. `performance.now()` is monotonic within a
 * document, so `toMs < fromMs` cannot happen; if it ever does, a negative duration is not a
 * measurement anybody could interpret, and every caller here has a field that forbids one.
 */
export function durationMs(fromMs: number, toMs: number): number {
  return Math.max(0, Math.round(toMs - fromMs));
}
