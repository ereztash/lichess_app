/**
 * When the product asks how sure you are, and when asking would be a toll.
 *
 * The confidence question was on every decision, so a game against the app was forty of them.
 * Reported, twice, as the reason a game does not get finished -- and it is not a UX complaint, it
 * is a measurement problem wearing one: an instrument that is too expensive to use produces no
 * readings, and a calibration gap over decisions nobody stayed to record is not a smaller finding
 * than one over a full record, it is no finding at all.
 *
 * THE RULE, AND IT IS THE ONLY ONE: the question is asked exactly where a measurement reads the
 * answer. Nowhere else. Every other decision is recorded in full -- move, what you could read,
 * what you could not -- and simply carries no stated confidence, which is a fact about the
 * protocol rather than a hole in the data.
 *
 * WHY NOT "OPTIONAL EVERYWHERE", which is the obvious way to make it lighter. Whoever skips it
 * skips it BECAUSE OF HOW THEY FEEL ABOUT THE POSITION -- unsure, bored, in a hurry, embarrassed.
 * That makes the confidence data a sample the player curated on exactly the variable being
 * measured, and the calibration gap over a self-selected sample is not a noisier reading of the
 * same thing, it is a reading of something else. It is the one bias this whole product is built to
 * avoid, and it would have been introduced to save a tap.
 *
 * WHY NOT RANDOM SAMPLING, which is unbiased and was the other candidate. It works, but it makes
 * the wait longer in proportion to the sampling rate, and the wait is already 60-90 decisions. The
 * shared bank is better than random on both counts: it is a FIXED set of positions, so the wait is
 * a bounded and visible task rather than an open-ended one, and the readings that need comparing
 * between players -- the anchor calibration score, the split-half stability check -- are computed
 * over that bank and nothing else anyway.
 *
 * WHAT THIS COSTS, STATED: a decision in a player's own game no longer contributes to the
 * calibration gap. The six buckets narrow to the bank plus the drills. That is a real loss of n
 * and it is the price of the instrument being used at all.
 */

/**
 * Why this position is in front of the player, which is what decides whether anyone will read a
 * confidence stated on it.
 *
 * A union rather than a boolean the caller works out, because the rule then lives in one place and
 * a surface added later has to name itself rather than quietly default. `play` and `import` both
 * mean "nothing measures this" and are kept apart anyway: they are different decisions and a
 * count that pools them could not say which loop a player abandoned.
 */
export type DecisionPurpose =
  /** A position from the shared bank. The only reading comparable between players lives here. */
  | "anchor"
  /** A drill position. The verdict IS a calibration gap against the record's baseline. */
  | "drill"
  /** The forward check on a rule the player wrote. Graded the same way. */
  | "transfer"
  /** An ordinary decision in a game being played. */
  | "play"
  /** A position from a game already finished, reached through the import. */
  | "import";

/**
 * The purposes where the question is ALWAYS put, because the measurement is structural.
 *
 * A drill's verdict IS a calibration gap against the record's baseline, and a transfer check is
 * graded the same way -- sampling there would produce drills that cannot be graded, which is a
 * worse failure than a tap. The bank is where the only between-player reading lives, and it is a
 * fixed, bounded set: the whole point of it is that everyone answers the same positions.
 */
const ALWAYS: readonly DecisionPurpose[] = ["anchor", "drill", "transfer"];

/**
 * How often the question is put on an ordinary decision.
 *
 * ONE IN FOUR IS A PLACEHOLDER AND IS MARKED AS ONE. The right number is a measurement, not a
 * preference: it trades the burden against how long a player waits for a first claim, and that
 * curve can be produced today on the shuffle harness in docs/MEASUREMENTS.md by thinning the label
 * set -- no field data needed. Until that has been run, this constant is a guess and the only
 * honest thing to do is say so where it is defined.
 */
export const ASK_RATE = 0.25;

/**
 * A stable draw for one position, so the question does not appear and vanish between renders.
 *
 * NOT `Math.random()` AT RENDER TIME. React re-renders on every keystroke in the free-text box, and
 * a question that flickers in and out while the player is answering the field above it is worse
 * than one always asked. This is a pure function of the decision's identity, so the same position
 * in the same game always gets the same answer, and it costs no state.
 *
 * THE KEY INCLUDES THE GAME, not just the position. Hashing the FEN alone would give a player who
 * repeats an opening the identical asked/not-asked pattern every game -- the sample would cluster
 * on their repertoire rather than spread across it. With the game id in the key, the same position
 * met in two games draws independently.
 *
 * FNV-1a WITH A FINALISER, and the finaliser is not optional -- it was measured.
 *
 * The first version was FNV-1a alone with the ply appended last, and its marginal rate was right:
 * 0.2472 over twenty thousand keys, against a target of 0.25. WITHIN ONE GAME IT WAS RUINOUS.
 * FNV's avalanche is weak on the last bytes it eats, so keys sharing a long prefix landed close
 * together and the comparison below reads the high bits, which had barely moved. Measured over
 * 500 games of 60 plies: one game asked on the first nine plies consecutively, another asked on
 * none of forty, and the worst run was FIFTY-NINE CONSECUTIVE ASKS. A player would meet either an
 * unbroken interrogation or nothing at all -- exactly the burden sampling exists to remove, with a
 * correct-looking average on top of it.
 *
 * The murmur3 finalising mix below spreads the low bits back over the whole word before the high
 * bits are read. It is not a cryptographic choice and does not need to be: nothing here is a
 * secret, and what is wanted is a cheap, reproducible spread over [0, 1) that does not care which
 * part of the key changed.
 */
export function drawForDecision(gameId: string, fen: string, ply: number): number {
  const key = `${gameId}|${fen}|${ply}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

/** Where a decision is, for the purpose of deciding whether to ask. */
export interface DecisionContext {
  purpose: DecisionPurpose;
  gameId: string;
  fen: string;
  ply: number;
}

/**
 * Whether this decision's confidence is asked for.
 *
 * SAMPLED RATHER THAN NEVER, on an ordinary decision. The earlier rule asked on the bank and
 * nowhere else, which was light but cost every free-play decision out of the six buckets the
 * detector reads. A random subset keeps most decisions to three taps and still feeds those buckets,
 * and it is RANDOM rather than optional for the reason at the top of this file: an optional
 * question is answered by whoever feels like answering, and that curates the data on the very
 * variable being measured. A coin does not.
 */
export function confidenceIsAsked(context: DecisionContext): boolean {
  if (ALWAYS.includes(context.purpose)) return true;
  return drawForDecision(context.gameId, context.fen, context.ply) < ASK_RATE;
}

/*
 * `confidenceIsMeasured(purpose)` USED TO LIVE HERE AND IS DELIBERATELY GONE.
 *
 * Under the previous rule -- asked on the bank and nowhere else -- it answered a real question:
 * whether anything reads a confidence stated on this kind of decision. Under sampling the answer
 * is "yes" for every purpose, since a drawn play decision feeds the same six buckets as any other.
 * A predicate that returns true for every input is not a rule, it is a line that reads like one,
 * and this file has already been through that once today: two enforcement points for one rule left
 * a positive control green because the dead one was hiding the live one. `confidenceIsAsked` is
 * the only question there is now, and it is the only function that answers it.
 */
