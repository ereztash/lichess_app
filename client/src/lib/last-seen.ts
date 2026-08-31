/**
 * WHEN THIS BROWSER LAST SAW A READING. Product memory, and deliberately NOT the trial log.
 *
 * THE GUARD THAT SENT THIS HERE. `tests/client/a-record-of-the-trial-not-of-the-player.test.ts`
 * asserts over the import graph that nothing reads `progress-record`, and it fired on the first
 * version of the resume screen, which called `previousVisitStartedAt()` to answer "what changed
 * since last time". The guard was right. Its rule is that the interface may not REACT to the trial
 * log, and a screen whose sentence changes with a value out of that log is reacting to it.
 *
 * SO WHY IS THIS NOT THE SAME THING WITH A NEW NAME. That question deserves an answer rather than a
 * rename, because routing around a guard is exactly what a new file with a similar shape looks
 * like. Three differences, and the third is the one that matters:
 *
 *   1. IT HOLDS ONE TIMESTAMP AND NOTHING ELSE. No attempts, no funnel stages, no counts, no
 *      acquisition context. There is nothing here to derive anything about a person from.
 *   2. IT IS WRITTEN BY THE SCREEN THAT READS IT and by nothing else, so it cannot become an input
 *      to anything that was not built to have it.
 *   3. NOTHING IT RETURNS REACHES A MEASUREMENT. It moves one navigational sentence -- "four new
 *      games since you last looked". It selects no position, grades no decision, changes no
 *      reveal, and cannot alter a calibration gap, a claim, a drill or a bucket. The trial log's
 *      rule exists because a build that adapted its MEASUREMENT to its own telemetry would produce
 *      results nobody could interpret; a courtesy line about how many rows arrived is not that.
 *
 * AND THE BOUNDARY IS ENFORCED RATHER THAN PROMISED. `shared/` may not import this -- it is under
 * `client/lib` and `shared` may not reach into the client at all -- and the same test file that
 * fired on the trial log now also asserts that this module is imported by exactly one screen.
 *
 * IT IS ALLOWED TO BE ABSENT, AND ABSENT IS NOT ZERO. A first arrival, a cleared browser and a
 * second device all return null, and the resume screen renders no "what changed" line at all rather
 * than reporting that nothing changed -- which is a different statement and one it cannot support.
 */
const KEY = "decision-lab.last-seen.v1";

/**
 * When a reading was last shown in this browser, or null.
 *
 * RETURNS NULL ON ANYTHING IT CANNOT READ, including a value that is not a parseable timestamp. A
 * corrupt entry compared against a game's date would answer for an instant nobody chose, and the
 * sentence built from it -- a burst of new games that did not arrive -- is the one a player would
 * act on.
 */
export function lastSeenReading(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return null;
    return Number.isFinite(Date.parse(raw)) ? raw : null;
  } catch {
    /* Private mode, or storage disabled. No memory is a state this product already handles. */
    return null;
  }
}

/** Record that a reading has been shown. Best effort: a browser that refuses simply has no memory. */
export function rememberReadingSeen(at: string = new Date().toISOString()): void {
  try {
    window.localStorage.setItem(KEY, at);
  } catch {
    /* Nothing to do and nothing to report: the next visit gets no "what changed" line. */
  }
}
