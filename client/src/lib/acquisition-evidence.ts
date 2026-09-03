/**
 * What the acquisition trial is allowed to observe, and what each observation is allowed to mean.
 *
 * WHAT THIS IS FOR. The product measures the player. `progress-record.ts` measures where a visit
 * got stuck. Neither of them can answer the question the next trial exists to ask, which is not
 * about chess at all:
 *
 *   acquisition promise -> expectation -> first action -> unique payoff -> continuation
 *
 * Eight to thirty people will arrive from a message with a link in it. For each of them we need
 * to be able to reconstruct which promise brought them, whether they reached a real position,
 * whether they committed, whether a reveal was shown, WHICH branch it was, whether they started
 * another decision, what they said they got that ordinary analysis would not have given them, and
 * whether they came back. Today none of that is recoverable, so every outcome of that trial --
 * including the interesting failures -- would be indistinguishable from every other.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE. An event records WHAT HAPPENED. It never records the
 * conclusion we hope to draw from it. There is no `user_understood_value`, no
 * `activation_succeeded`, no `unique_value_delivered`: those are analyses, they are done later,
 * by a person, against a denominator they have to state. Storing one would make the trial
 * unfalsifiable in the most direct way possible -- by writing the answer into the data.
 *
 * WHY THERE IS NO ANALYTICS SDK BEHIND THIS. See docs/ACQUISITION_EVIDENCE.md for the decision on
 * each candidate. In short: the vocabulary below is eleven enums and two counters, the whole
 * trial is thirty people, and the product makes a specific promise about what leaves the browser.
 * A vendor would own the semantics of "activation" and "retention" for a product whose entire
 * claim is that it defines its own measurements.
 *
 * WHY IT IS NOT UNDER `shared/`. `shared/` is where the measurements live, and the wall between
 * the trial log and the measurements is enforced by an import-graph assertion in
 * `tests/client/a-record-of-the-trial-not-of-the-player.test.tsx`. Acquisition evidence sits on
 * the trial side of that wall for exactly the reason the progress log does: an interface that
 * reacted to it would be inside the thing it is measuring.
 */
import type { OneThingKind } from "@shared/reveal";
import type { ClientFailureCode, ClientSurface, FailureClass } from "@shared/failure-class";
import type { DecisionPurpose } from "@shared/confidence-asked";
import type { NextActionKind, ShadowSurface } from "@shared/next-action";
import type { PrimaryAction } from "@shared/primary-action";

/**
 * The acquisition angles the trial can tell apart.
 *
 * HYPOTHESES, NOT VARIANTS OF A WINNER. Nothing randomises between them, nothing scores them, and
 * no screen changes because of one. They are a tag on the session so that at n=30 a person can
 * lay out `angle x reveal kind x what they said x whether they continued` and look for mechanism
 * fit. At that n there is no significance test worth running and the code contains none.
 *
 * The contract each one commits to -- problem, promise, required action, possible payoff, and the
 * promise it may NOT make -- is in docs/ACQUISITION_EVIDENCE.md. The prohibited half is the part
 * that matters for validity: an angle that promises a reveal BRANCH ("we will show you the move
 * you saw and rejected") brings every arrival an expectation the instrument cannot guarantee, and
 * then nobody's continuation means anything.
 */
export const ACQUISITION_ANGLES = [
  /** Selection: the stronger move may already have been on your board when you chose another. */
  "selection",
  /** Confidence: you may be most certain exactly where you are most often wrong. */
  "confidence",
  /** Process: an engine can say which move was better without saying what happened in your head. */
  "process",
] as const;
export type AcquisitionAngle = (typeof ACQUISITION_ANGLES)[number];

/** Where the link was: a message, a post, a comment thread. Never inferred from a referrer. */
export const ACQUISITION_SOURCES = ["dm", "post", "group", "ad", "direct"] as const;
export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

/**
 * The value every one of these takes when the link did not carry it.
 *
 * NOT A DEFAULT ANGLE, and this is the single most load-bearing line in the file. Filling an
 * absent angle with the one we expect to win -- or with anything at all -- would make the whole
 * comparison circular: every organic arrival would be counted as evidence for whichever angle the
 * code happened to name. Unknown is a state the analysis has to carry, and its denominator is its
 * own.
 */
export const UNKNOWN = "unknown" as const;
export type Unknown = typeof UNKNOWN;

export interface AcquisitionContext {
  angle: AcquisitionAngle | Unknown;
  source: AcquisitionSource | Unknown;
  /**
   * A free label for one message, so two posts on the same angle can be told apart later.
   *
   * Bounded and character-restricted below, because it is the one field an outside party writes
   * and it ends up in a log a participant is asked to paste into a message.
   */
  variant: string | Unknown;
}

const VARIANT_MAX = 24;
const VARIANT_ALLOWED = /^[a-z0-9_-]+$/i;

/**
 * Read the acquisition context off a URL, refusing anything not in the vocabulary.
 *
 * ANYTHING UNRECOGNISED BECOMES `unknown`, rather than being kept as a string. A trial that
 * accepted arbitrary values would end up with `angle=Selection`, `angle=sel`, `angle=A` and
 * `angle=selection` as four different cells, and the person doing the analysis would have to
 * guess which were the same. Refusing at the boundary is also what keeps a crafted link from
 * writing whatever it likes into a log the participant will paste somewhere.
 */
export function readAcquisitionContext(search: string): AcquisitionContext {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { angle: UNKNOWN, source: UNKNOWN, variant: UNKNOWN };
  }
  const angle = ACQUISITION_ANGLES.find((known) => known === params.get("angle"));
  const source = ACQUISITION_SOURCES.find((known) => known === params.get("src"));
  const raw = params.get("v") ?? "";
  const variant = raw.length > 0 && raw.length <= VARIANT_MAX && VARIANT_ALLOWED.test(raw) ? raw : UNKNOWN;
  return { angle: angle ?? UNKNOWN, source: source ?? UNKNOWN, variant };
}

/**
 * Which branch of the reveal was put in front of the player.
 *
 * `silence` IS A VALUE HERE and it is the most important one. `theOneThing` returns null when the
 * measurement supports no sentence, which is a correct outcome and, on an accurate decision
 * inside engine noise, the ONLY possible one. If silence were absent from the ledger rather than
 * counted, the reveal-yield reading would be computed over the decisions that happened to produce
 * a sentence -- a denominator selected on the outcome -- and the product would look like it says
 * something differentiated far more often than it does.
 *
 * IT IS NEVER RE-DERIVED. The emitter is handed the branch the panel actually rendered, from the
 * same `theOneThing` call that rendered it. A second implementation of the branch conditions here
 * would be a second answer to "what did this player see", and the two would drift the first time
 * a threshold moved.
 */
export type RevealKind = OneThingKind | "silence";

/**
 * The events. Eleven observable facts, and nothing that is a judgement about a person.
 *
 * Each one is defined in docs/ACQUISITION_EVIDENCE.md with its trigger, its properties, the
 * denominator it may legitimately enter, and the inference it does not support. The union below
 * is the enforcement: a property that is not in the type cannot be written, so the FEN, the move,
 * the confidence value, the typed read and the username are not omissions anybody has to
 * remember -- they are unrepresentable.
 */
export type TrialEvent =
  /**
   * A session entered the product. Fires once per page load, before anything else.
   *
   * NOT "a campaign converted". It says a browser opened the app carrying these tags, or carrying
   * none. It is the denominator of the first-value funnel and of nothing else.
   */
  | { name: "acquisition_entry"; at: string; context: AcquisitionContext; returning: boolean }
  /**
   * A later session by the same browser, after an earlier one in this ledger.
   *
   * SESSION BOUNDARY, STATED: one page load is one session. Two tabs are two sessions and this
   * cannot tell them apart; a browser cleared between visits looks like a first visit and this
   * cannot tell that either. Both limits are real and neither is worked around -- there is no
   * fingerprinting here and there will not be.
   *
   * `hoursSincePrevious` is a duration between two events, not an interpretation of one. Nothing
   * here calls a long gap "lapsed" or a short one "engaged".
   */
  | { name: "return_session_started"; at: string; hoursSincePrevious: number }
  /**
   * A position became actionable: it is on the board, it is the player's move, and the commitment
   * screen is reachable from it.
   *
   * NOT "the page loaded", which is the version of this event that would make the funnel
   * meaningless -- every arrival would clear the second stage and the stage would measure nothing.
   */
  | { name: "first_position_presented"; at: string; purpose: DecisionPurpose | null }
  /** The decision crossed the commit boundary and was written. */
  | {
      name: "decision_committed";
      at: string;
      /** Opaque id, the same one the record carries. No board state, no move, no text. */
      decisionId: string;
      /** Which decision of this session it was. 1-based. */
      ordinal: number;
      purpose: DecisionPurpose | null;
      /** Whether the protocol put the confidence question on this decision. Not the answer. */
      confidenceAsked: boolean;
    }
  /**
   * The reveal panel became visible to the player.
   *
   * DISTINCT FROM "the engine finished", deliberately. The analysis completing is a fact about a
   * worker; this is a fact about a screen, and between the two sit a failure branch, a deferred
   * arm, and a player who navigated away. Only one of them is a funnel stage.
   */
  | { name: "reveal_presented"; at: string; decisionId: string }
  /** Which branch was presented, taken from the panel's own `theOneThing` result. */
  | { name: "reveal_kind_presented"; at: string; decisionId: string; kind: RevealKind }
  /**
   * After a reveal, the player put a move on the board for another decision.
   *
   * A DELIBERATE ACT, not a route. Being on `/play` is not continuation; neither is the board
   * re-rendering. Placing a move is something a person did after having seen what the product
   * had to say, which is the behaviour the question "was that worth another one" is about.
   */
  | { name: "next_decision_started"; at: string; afterReveals: number }
  /**
   * The value-reconstruction question was displayed. The denominator for the answer rate.
   */
  | { name: "value_reconstruction_prompted"; at: string; afterReveals: number }
  /**
   * The player submitted an answer, or dismissed the question without one.
   *
   * DISMISSAL IS NOT A NEGATIVE ANSWER. It is recorded as `dismissed` and it may not be coded as
   * "no value articulated" -- that is a coding of a TEXT, and there is no text. Folding the two
   * would turn every interruption, every closed tab and every person who does not like typing
   * into evidence about the product.
   */
  | {
      name: "value_reconstruction_submitted";
      at: string;
      outcome: "answered" | "dismissed";
      /**
       * Exactly what they typed, unedited, or null on dismissal.
       *
       * THE ONE FREE-TEXT FIELD IN THE LEDGER, AND IT IS HERE ON PURPOSE. Behaviour cannot say
       * what someone understood. "The engine showed me the best move" and "the move was already
       * among the ones I put on the board and I still chose another" are the same click and
       * opposite results, and the first one is a finding rather than a failure to get one.
       *
       * NOT CLASSIFIED HERE. No sentiment, no scoring, no model. A coding scheme is applied later,
       * offline, against a preregistered set of categories, and it is stored apart from this
       * string so that nobody can mistake a coder's label for something the player said.
       */
      answer: string | null;
    }
  /**
   * WHAT `deriveNextAction` WOULD HAVE PROPOSED, BESIDE WHAT THE SCREEN ACTUALLY OFFERED.
   *
   * SHADOW MODE, AND IT CHANGES NOTHING ON SCREEN. `shared/next-action.ts` claims to know what a
   * player should do next; the honest thing to do with such a claim is to watch it disagree with
   * the screens for a while before handing it any of them. This event is that watching, and it is
   * the only thing standing between the derivation and ownership of the front door.
   *
   * IT RECORDS `agrees` RATHER THAN LEAVING IT DERIVABLE, for the same reason a cp-loss carries the
   * build that produced it: the mapping between a proposal and a screen's own vocabulary lives in
   * the shadow code of ONE build, and a later reader comparing the two strings would be applying a
   * mapping that may since have changed.
   *
   * `blind` IS THE FIELD THAT MAKES A DISAGREEMENT READABLE. The derivation takes inputs a given
   * surface may not have -- the front door cannot see a half-finished drill, because that lives in
   * another screen's component state -- and a disagreement caused by a missing input is not the
   * same finding as one caused by the screen being wrong. Naming the gaps is what keeps the two
   * apart, and the list is a fact about the SURFACE rather than about the player.
   */
  | {
      name: "next_action_shadow";
      at: string;
      /** Which screen the comparison was made on. */
      surface: ShadowSurface;
      /** The derivation's answer, as its own kind. */
      proposed: NextActionKind;
      /**
       * The act the screen's primary control names, or `null` where it offers none.
       *
       * `PrimaryAction` AND NOT A STRING, and the difference is the whole comparison. The first
       * version of this field held `"play"` -- a word in no vocabulary -- recorded as a constant,
       * so the front door was logged as offering a control even on `nothing-scored`, the one state
       * P1.5 made it deliberately offer nothing on. Every disagreement there was an artefact of
       * this field. `null` is now a real value and means the screen is quiet.
       */
      offered: PrimaryAction | null;
      agrees: boolean;
      /** Inputs this surface could not supply, so a disagreement can be read correctly. */
      blind: string[];
    }
  /**
   * SOMETHING THE PRODUCT NAMED AS BROKEN WAS SHOWN TO THE PLAYER.
   *
   * The one event in this ledger that is about the software rather than the funnel, and it is here
   * because the funnel cannot be read without it: a visit that stopped after `worker-refused` and a
   * visit that stopped because the player lost interest were the same rows until now.
   *
   * A CODE FROM A CLOSED LIST, AND NOTHING OF THE ERROR. Not the message, not the stack, not what
   * was on the board. `shared/failure-class.ts` is the list; `client/src/lib/error-sink.ts` is the
   * only writer and the only thing that also sends the same five fields to the same origin, which
   * docs/OBSERVABILITY.md states as the one exception to "never transmitted" -- because none of
   * the five is about the player.
   */
  | {
      name: "failure_observed";
      at: string;
      code: ClientFailureCode;
      failureClass: FailureClass;
      surface: ClientSurface;
    };

export type TrialEventName = TrialEvent["name"];

/**
 * Events that may only be emitted after the decision they are about was committed.
 *
 * R3 -- nothing evaluative reaches the player before they commit -- is the product's oldest rule,
 * and the value-reconstruction question is the first thing in a long time with the standing to
 * break it. Asking "what did you get here that ordinary analysis would not have given you?"
 * before a commit would put the idea of a differentiated finding into the player's head while
 * they were still deciding, which contaminates the decision AND the answer.
 */
export const POST_COMMIT_ONLY: readonly TrialEventName[] = [
  "decision_committed",
  "reveal_presented",
  "reveal_kind_presented",
  "next_decision_started",
  "value_reconstruction_prompted",
  "value_reconstruction_submitted",
];

/**
 * Property names no event may ever carry, checked at the boundary rather than trusted.
 *
 * The union above already makes these unrepresentable in TypeScript. This is the runtime half,
 * and it exists because the ledger is serialised to JSON and pasted into a message by a
 * participant: the cost of one of these leaking is not a bad row, it is a person's username or
 * their game sitting in a chat log.
 */
const PROHIBITED_KEYS = [
  "username",
  "user",
  "account",
  "email",
  "fen",
  "pgn",
  "move",
  "moves",
  "san",
  "uci",
  "confidence",
  "known",
  "unknown",
  "text",
  "read",
];

/** A FEN, roughly: eight ranks of piece letters and digits separated by slashes. */
const LOOKS_LIKE_A_FEN = /(?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+/;

/**
 * Everything an event may not contain, as one predicate.
 *
 * Returns the reason rather than a boolean, because a guard that fails silently teaches nobody
 * anything -- the caller throws with the field named.
 */
export function prohibitedContent(event: TrialEvent): string | null {
  for (const [key, value] of Object.entries(event)) {
    if (PROHIBITED_KEYS.includes(key.toLowerCase())) return `event carries a prohibited field: ${key}`;
    if (typeof value !== "string") continue;
    /*
     * The answer is the one field that holds a person's sentence, and a player is entirely likely
     * to write "e4" or a whole variation in it. That is their answer and it is kept verbatim. The
     * scan is for every OTHER string field, where a chess position could only have arrived by a
     * caller reaching past the type.
     */
    if (event.name === "value_reconstruction_submitted" && key === "answer") continue;
    if (LOOKS_LIKE_A_FEN.test(value)) return `event carries a board position in ${key}`;
  }
  return null;
}

/** The longest answer kept. Past this a textarea is being used as a notepad, not an answer. */
export const ANSWER_MAX = 1000;

/**
 * Whether placing a move on the board counts as having started another decision.
 *
 * A FUNCTION RATHER THAN A CONDITION INSIDE AN EFFECT, because "continuation" is the single most
 * contestable definition in the trial and it should be readable and testable in one place. Three
 * things have to be true and each excludes a way of getting this wrong:
 *
 *   `movePlaced`        the player did something. Being on the board's route is not continuation,
 *                       and neither is a re-render -- both are true of somebody who read the
 *                       reveal and stopped.
 *   `revealsPresented`  they had seen what the product had to say. A move placed before any
 *                       reveal is the FIRST decision, and counting it would make every arrival
 *                       who reached a board look like a continuation.
 *   `alreadyRecorded`   once per session. What the trial needs is whether they went on at all;
 *                       how many times is already in the ledger under `decision_committed`.
 */
export function continuationStarted(input: {
  movePlaced: boolean;
  revealsPresented: number;
  alreadyRecorded: boolean;
}): boolean {
  return input.movePlaced && input.revealsPresented > 0 && !input.alreadyRecorded;
}

/** How many reveals must have been presented before the value question is put. */
export const ASK_AFTER_REVEALS = 2;

/**
 * Whether to put the value-reconstruction question.
 *
 * THE TRADEOFF THIS ENCODES, because either choice costs something. After the FIRST reveal gives
 * the closest attribution and interrupts the player at exactly the moment the trial is measuring
 * whether they continue -- `next_decision_started` would then be measuring the question. Later
 * gives a richer basis and buys selection bias, because whoever left after one reveal never
 * answers.
 *
 * The second reveal is where the first cost is gone and the second is still small: continuation
 * after reveal one has already been recorded by then, so the number that matters most is taken
 * clean, and a player who reached a second reveal has seen enough to have an answer.
 *
 * ONCE PER BROWSER, not once per session. A question re-asked on every visit is a nag, and the
 * second answer would be contaminated by the first anyway.
 */
export function shouldAskValueQuestion(input: {
  revealsPresented: number;
  everPrompted: boolean;
}): boolean {
  return input.revealsPresented >= ASK_AFTER_REVEALS && !input.everPrompted;
}
