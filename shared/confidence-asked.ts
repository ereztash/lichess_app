/**
 * When the product asks how sure you are, and when asking would be a toll.
 *
 * The confidence question was on every decision, so a game against the app was forty of them.
 * Reported, twice, as the reason a game does not get finished -- and it is not a UX complaint, it
 * is a measurement problem wearing one: an instrument that is too expensive to use produces no
 * readings, and a calibration gap over decisions nobody stayed to record is not a smaller finding
 * than one over a full record, it is no finding at all.
 *
 * THE RULE HAS TWO CLAUSES AND NO THIRD. The question is ALWAYS put where a measurement is
 * structural -- the shared bank, a drill, a transfer check -- and on a RANDOM SUBSET of everything
 * else. A decision the draw passed over is still recorded in full -- move, what you could read,
 * what you could not -- and simply carries no stated confidence, which is a fact about the
 * protocol rather than a hole in the data. What there is nowhere is a third clause letting the
 * PLAYER decide; see the paragraph below, which is the reason the whole file exists.
 *
 * WHY NOT "OPTIONAL EVERYWHERE", which is the obvious way to make it lighter. Whoever skips it
 * skips it BECAUSE OF HOW THEY FEEL ABOUT THE POSITION -- unsure, bored, in a hurry, embarrassed.
 * That makes the confidence data a sample the player curated on exactly the variable being
 * measured, and the calibration gap over a self-selected sample is not a noisier reading of the
 * same thing, it is a reading of something else. It is the one bias this whole product is built to
 * avoid, and it would have been introduced to save a tap.
 *
 * WHY NOT "THE SHARED BANK AND NOWHERE ELSE", which is what this file said for exactly one
 * commit and which was the first attempt at making it lighter. It was light and it was too narrow:
 * it took every free-play decision out of the six buckets the detector is allowed to look at, so
 * "under 45 seconds", "over two minutes" and "under a minute on the clock" could only ever fill
 * from a bank of positions played without a clock at all. The lighter rule quietly deleted three
 * of the six readings. Sampling keeps most decisions at three taps AND keeps those buckets fed.
 *
 * WHAT THIS COSTS, STATED, and it is a real cost rather than a free lunch. Against asking on
 * everything, the wait for a first claim grows by 1/ASK_RATE -- at one in seven, nearly seven
 * times as many decisions for the same n. That is precisely why the rate below is a number that
 * has to be MEASURED, and why lowering it is not free even when it buys something better.
 */

/**
 * Why this position is in front of the player, which is what decides whether anyone will read a
 * confidence stated on it.
 *
 * A union rather than a boolean the caller works out, because the rule then lives in one place and
 * a surface added later has to name itself rather than quietly default. `play` and `import` both
 * mean "nothing measures this" and are kept apart anyway: they are different decisions and a
 * count that pools them could not say which loop a player abandoned.
 *
 * A RUNTIME TUPLE AND NOT A BARE TYPE, because the purpose is now a recorded field. A TypeScript
 * union is erased, and the three places that have to police this vocabulary at runtime -- the
 * atom's schema, the wire schema and the MySQL enum -- can only read a list that survives to
 * runtime. The type is derived from the list rather than written twice, so a purpose added here
 * reaches the column and the boundary without anyone having to remember to widen them.
 */
export const DECISION_PURPOSES = [
  /**
   * The one position the front door hands over, from a game the player actually played.
   *
   * ITS WHOLE JOB IS TO PRODUCE THE FIRST SCOREABLE DECISION, and under sampling it did not.
   * `Record` shows `FirstDecision` while `scored === 0` and the shared bank sits behind
   * `scored > 0`, so a drawn-over first decision left the newcomer on the same screen that had
   * just sent them out -- three times in four -- with the screen's own words promising "תגידו כמה
   * אתם בטוחים". A front door whose success rate is one in four is not a front door.
   *
   * IT IS ALSO THE ONE DECISION ALLOWED TO ARRIVE WITHOUT THE TWO READ FIELDS, which is the
   * second reason this value had to become storable. The exemption is a rule ABOUT a purpose, so
   * a record that did not carry the purpose could not enforce it -- see `decisionAtomSchema`.
   */
  "first",
  /** A position from the shared bank. The only reading comparable between players lives here. */
  "anchor",
  /** A drill position. The verdict IS a calibration gap against the record's baseline. */
  "drill",
  /** The forward check on a rule the player wrote. Graded the same way. */
  "transfer",
  /** An ordinary decision in a game being played. */
  "play",
  /** A position from a game already finished, reached through the import. */
  "import",
] as const;

export type DecisionPurpose = (typeof DECISION_PURPOSES)[number];

/**
 * What the screen knows about why this position is on it. Booleans plus the source, nothing else.
 *
 * Deliberately NOT the whole of Home's state: the caller answers four yes/no questions it already
 * has answers to, and this owns the ordering. Passing the component's state in would let the rule
 * grow a dependency on something only that screen has, and there is a second caller coming for
 * every purpose that gets its own surface.
 */
export interface PurposeInputs {
  /** A transfer check is running: the forward test on a rule the player wrote. */
  inLearningTransfer: boolean;
  /** A drill is running. */
  inDrill: boolean;
  /** The position is in the shared bank -- recognised by the POSITION, not by the route. */
  isAnchor: boolean;
  /** This is the ply the handoff named as the game's first decision. */
  isFirstDecision: boolean;
  /** Whether the game is being played right now, or is one already over. */
  isLiveGame: boolean;
}

/**
 * Why this position is in front of the player, in one place.
 *
 * EXTRACTED FROM `Home` WHEN THE PURPOSE BECAME A STORED FACT, and the extraction is the point
 * rather than tidiness. As a render-time value it was a five-branch conditional in the middle of a
 * two-thousand-line component, checkable only by reading it; as a column it is an assertion the
 * record will carry for as long as the record exists, and an assertion nothing can test is one
 * nobody can trust.
 *
 * THE ORDER IS THE RULE. A drill position that also sits in the bank is a drill -- what is being
 * measured is the drill -- and the front door's handoff is a `first` decision even though it is
 * served from a game already played. Each branch above the next is the more specific claim, so
 * reordering them silently reclassifies decisions rather than failing anywhere.
 */
export function decisionPurposeFor(inputs: PurposeInputs): DecisionPurpose {
  if (inputs.inLearningTransfer) return "transfer";
  if (inputs.inDrill) return "drill";
  if (inputs.isAnchor) return "anchor";
  if (inputs.isFirstDecision) return "first";
  /*
   * A GAME ALREADY OVER IS NOT AN ORDINARY MOVE. Both fall through to the sampled branch of the
   * ask rule, so nothing about the interface depends on the difference -- which is exactly why the
   * distinction went unnoticed while the value was discarded at write. Stored, it is a claim about
   * which loop produced the decision, and the comment on `DECISION_PURPOSES` says why the two are
   * kept apart: a count that pools them cannot say which loop a player abandoned.
   */
  return inputs.isLiveGame ? "play" : "import";
}

/**
 * The purposes where the question is ALWAYS put, because the measurement is structural.
 *
 * A drill's verdict IS a calibration gap against the record's baseline, and a transfer check is
 * graded the same way -- sampling there would produce drills that cannot be graded, which is a
 * worse failure than a tap. The bank is where the only between-player reading lives, and it is a
 * fixed, bounded set: the whole point of it is that everyone answers the same positions.
 *
 * `first` is here for a different reason and it is a REACHABILITY one: everything else in the
 * product is gated behind having one scored decision, so a first decision that draws no question
 * leaves the newcomer with no route forward at all. It is one decision per game -- the front
 * door's handoff, and the opening decision of a game against the engine.
 *
 * A CORRECTION THIS COMMENT ONCE CARRIED, AND THE STATE THAT DISCHARGED IT. The comment first
 * claimed `first` was "stamped as its own purpose so an analysis can condition it out"; it was
 * not stamped anywhere, and the correction said so and said what it would take -- a column, a
 * migration and both stores. That has now been done: `purpose` is an atom field, a nullable
 * column, and a value both stores write and read back. The history is kept rather than deleted
 * because the defect was the interesting part -- a sentence in this file, about this file,
 * describing a record that did not exist.
 *
 * WHAT THE STAMP BOUGHT, precisely, so the next reader does not overclaim it either. The server
 * can now ask "was this decision allowed to arrive without the two read fields?" and refuse when
 * the answer is no, which it could not do while the exemption was a rule about a fact nobody
 * stored. An analysis can separate first decisions from the rest, and live decisions from ones
 * taken over a game already played.
 *
 * WHAT IT DID NOT BUY. The purpose is the ONE atom field the server cannot re-derive: the phase
 * comes back from the FEN and the legal-move count from the position, but why a position was in
 * front of a player is a fact about the client's loop and nothing on the wire proves it. It is a
 * claim by the client, exactly as `reveal_timing` is, and every reading of it inherits that.
 */
const ALWAYS: readonly DecisionPurpose[] = ["first", "anchor", "drill", "transfer"];

/**
 * How often the question is put on an ordinary decision.
 *
 * ONE IN SEVEN, AND IT WAS LOWERED DELIBERATELY TO PAY FOR SOMETHING ELSE. The burden a player
 * will absorb is finite, and this product has two questions competing for it: this one, and the
 * counterfactual probe -- "if you hadn't played that, what would you have played instead?" -- in
 * `shared/counterfactual.ts`. The probe went from one in five to about one in three in the same
 * change. That is a judgement about which instrument is worth interrupting for, and it is the
 * owner's to make; it is recorded here because a constant that moved for a reason should say what
 * the reason was.
 *
 * WHAT THAT COSTS, ARITHMETICALLY, because it is easy to read this as a swap and it is not one.
 * Over a forty-move game the two draws together used to produce 10 + 8 = 18 extra questions; they
 * now produce 6 + 14 = 20. The share of decisions carrying at least one extra step rises from
 * 1 - (0.75 x 0.80) = 40% to 1 - (0.85 x 0.65) = 45%. The burden went UP slightly and moved to
 * the question that measures what nothing else here can.
 *
 * STILL NOT THE MEASURED NUMBER, and that has not changed. The curve that would settle it trades
 * the burden against how long a player waits for a first claim, and it can be produced on the
 * shuffle harness in docs/MEASUREMENTS.md by thinning the label set -- no field data needed. What
 * HAS been measured is that the draw still behaves at this rate, which is a different claim and a
 * necessary one: see `drawForDecision`, whose finalising mix was validated at 0.25 and re-measured
 * here.
 */
export const ASK_RATE = 0.15;

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
 *
 * RE-MEASURED WHEN ASK_RATE DROPPED, because a spread validated at one rate is not validated at
 * another -- and the assertion most at risk is the one that no whole game passes unasked, whose
 * margin shrinks as the rate falls. Over the same 500 games x 60 plies: rate 0.1525, longest run
 * FIVE, no game without a question. Held at 5,000 games too (0.1508, longest run 7, still none).
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
