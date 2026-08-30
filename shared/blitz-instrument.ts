/**
 * ASKING THE PLAYER SOMETHING, WITHOUT CHANGING WHAT WAS MEASURED.
 *
 * The whole design is one ordering, and ADR-001 §4 states it: the move is committed FIRST, the
 * decision timer freezes on that event, the clock stops, and only then may anything be asked. What
 * the instrument costs is measured separately and is never added to what the decision cost.
 *
 * `decisionMs` and `instrumentationLatencyMs` are two fields and there is no function anywhere that
 * returns their sum. A player who took four seconds to move and thirty to answer took FOUR SECONDS
 * to decide; a record that says thirty-four has destroyed the measurement and cannot be repaired
 * afterwards, because the two are no longer separable.
 *
 * WHAT THIS LAYER MAY NOT DO, and the reason it is a layer at all: `shared/blitz-game-core.ts`
 * knows nothing about confidence, and this module cannot reach into it. The think time it reports
 * is the one the core froze at the commit -- copied, never recomputed -- so no amount of work here
 * can move it.
 *
 * ONE MORE ORDERING, EASY TO MISS. The opponent's reply may be COMPUTED while a question is open --
 * the player's clock is already stopped, so nothing is stolen -- but it may not be SHOWN. A player
 * who can see the answer while stating how sure they were is not stating how sure they were.
 */
import type { BlitzDecision } from "./blitz-game-core.js";

/**
 * The sampling policy, and it is EXPERIMENTAL in the literal sense: nothing has yet shown that
 * asking at this rate leaves blitz behaviour unchanged.
 *
 * `ASK_RATE = 0.15` in `shared/confidence-asked.ts` was argued for with a run-length analysis over
 * simulated games -- on a loop with NO CLOCK. Whether it survives contact with a three-minute game
 * is a question, not a constant to copy across, and PR-10 of the plan is the experiment that asks
 * it. Until then this rate is a starting point that records itself, so whatever it produces can be
 * re-read afterwards knowing which regime produced it.
 */
export const BLITZ_SAMPLING_POLICY_VERSION = 1;
export const BLITZ_ASK_RATE = 0.15;

/**
 * The counterfactual probe is OFF in instrumented blitz, and this is a constant rather than an
 * omission so that turning it on is a visible edit.
 *
 * "What else did you consider?" is a second question after a move, in a game where the opponent is
 * waiting. Nothing has measured what it costs here. The plan's own rule: it stays off unless
 * evidence already in the repository shows it has no measurement reactivity, and there is none.
 */
export const BLITZ_COUNTERFACTUAL_ENABLED = false;

/** A decision plus what the instrument did about it. */
export interface InstrumentedDecision {
  /** Copied from the core, never recomputed. The commit froze it. */
  decision: BlitzDecision;
  /** Whether the sampler chose this decision. Recorded even when the answer never came. */
  wasAsked: boolean;
  /** The probability in force when the choice was made, so the regime is reconstructable. */
  samplingProbability: number;
  samplingPolicyVersion: number;
  /** 1..7 on the product's scale, or null when unasked or unanswered. */
  confidence: number | null;
  /**
   * What the instrument cost, from the question appearing to the answer arriving.
   *
   * NULL WHEN NOTHING WAS ASKED, and that is not the same as zero. A decision nobody questioned has
   * no latency; one answered instantly has a small one. Storing the first as the second would make
   * the mean of this column a fiction and would hide exactly the population it exists to describe.
   */
  instrumentationLatencyMs: number | null;
}

/** The instrument's state between a commit and an answer. */
export interface InstrumentSession {
  decisions: InstrumentedDecision[];
  /** Open question, if any. While this is set the opponent's reply may be computed but not shown. */
  open: { index: number; askedAtMs: number } | null;
}

export const newSession = (): InstrumentSession => ({ decisions: [], open: null });

/** True while a question is on screen. The only thing that gates showing the opponent's reply. */
export const awaitingAnswer = (session: InstrumentSession): boolean => session.open !== null;

/**
 * May the opponent's move be revealed?
 *
 * SEPARATE FROM "has it been computed". Computing it early is free -- the player's clock is stopped
 * -- and showing it early is not, because a player who can see what happened next is answering a
 * different question from the one the instrument meant to ask.
 */
export const mayRevealOpponentMove = (session: InstrumentSession): boolean => !awaitingAnswer(session);

/**
 * Record a committed decision, and decide whether to ask about it.
 *
 * TAKES THE DECISION THE CORE ALREADY FROZE. It does not take a clock, a position or a move -- there
 * is nothing here that could recompute a think time even by accident.
 */
export function recordCommitted(
  session: InstrumentSession,
  decision: BlitzDecision,
  nowMs: number,
  draw: () => number = Math.random,
): InstrumentSession {
  /* An open question is closed by the next commit rather than silently overwritten: the player
   * moved on without answering, which is a real outcome and is recorded as an unanswered ask. */
  const settled = awaitingAnswer(session) ? abandon(session) : session;
  const asked = draw() < BLITZ_ASK_RATE;
  const entry: InstrumentedDecision = {
    decision,
    wasAsked: asked,
    samplingProbability: BLITZ_ASK_RATE,
    samplingPolicyVersion: BLITZ_SAMPLING_POLICY_VERSION,
    confidence: null,
    instrumentationLatencyMs: null,
  };
  return {
    decisions: [...settled.decisions, entry],
    open: asked ? { index: settled.decisions.length, askedAtMs: nowMs } : null,
  };
}

/** The answer arrived. The latency is the only thing this adds, and it goes in its own field. */
export function answer(
  session: InstrumentSession,
  confidence: number,
  nowMs: number,
): InstrumentSession {
  if (!session.open) return session;
  const { index, askedAtMs } = session.open;
  return {
    open: null,
    decisions: session.decisions.map((entry, i) =>
      i === index
        ? { ...entry, confidence, instrumentationLatencyMs: Math.max(0, nowMs - askedAtMs) }
        : entry,
    ),
  };
}

/**
 * The question went unanswered -- the player moved on, or the game ended.
 *
 * The ASK is still recorded. A sampler that only left traces when somebody replied would produce a
 * denominator made of the people willing to answer, which is the selection bias the plan's
 * adversarial review names.
 */
export function abandon(session: InstrumentSession): InstrumentSession {
  if (!session.open) return session;
  return { open: null, decisions: session.decisions };
}
