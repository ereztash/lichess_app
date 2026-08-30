/**
 * INV-1 and INV-2: the question comes after the move, and what it costs is never added to what the
 * decision cost.
 *
 * THE FAILURE THIS GUARDS IS UNREPAIRABLE. A `think_ms` that quietly includes the time somebody
 * spent answering a questionnaire cannot be fixed afterwards -- the contamination is in the
 * observation, the two durations are no longer separable, and every analysis downstream inherits
 * it. So the assertions are equalities, and the central one is that an answer taking THIRTY SECONDS
 * leaves the think time byte-identical to an answer taking one millisecond.
 */
import { describe, expect, it } from "vitest";
import { commit, newGame, start, type BlitzState } from "@shared/blitz-game-core";
import {
  abandon,
  answer,
  awaitingAnswer,
  BLITZ_ASK_RATE,
  BLITZ_COUNTERFACTUAL_ENABLED,
  BLITZ_SAMPLING_POLICY_VERSION,
  mayRevealOpponentMove,
  newSession,
  recordCommitted,
  type InstrumentSession,
} from "@shared/blitz-instrument";

const THREE_ZERO = { initialMs: 180_000, incrementMs: 0 };
const always = () => 0; // draw() < 0.15 -> always asked
const never = () => 0.99; // never asked

/** Commit e4 after exactly four seconds, and hand the frozen decision to the instrument. */
function committed(draw: () => number) {
  const g: BlitzState = start(newGame(THREE_ZERO), 1_000);
  const result = commit(g, { from: "e2", to: "e4" }, 5_000);
  if (result.state.phase !== "running") throw new Error("unreachable");
  const decision = result.state.decisions[0];
  return { decision, session: recordCommitted(newSession(), decision, 5_000, draw) };
}

describe("a question that does not change the answer", () => {
  it("freezes the think time at the commit, whatever the answer costs afterwards", () => {
    /*
     * The assertion the whole layer exists for. Two identical decisions; one answered after a
     * millisecond, one after thirty seconds. The think times must be the same number.
     */
    const fast = answer(committed(always).session, 5, 5_001);
    const slow = answer(committed(always).session, 5, 35_000);

    expect(fast.decisions[0].decision.thinkMs).toBe(4_000);
    expect(slow.decisions[0].decision.thinkMs).toBe(4_000);
    expect(slow.decisions[0].decision.thinkMs).toBe(fast.decisions[0].decision.thinkMs);

    // And the cost of the instrument is visible, in its own field, not folded into the other.
    expect(fast.decisions[0].instrumentationLatencyMs).toBe(1);
    expect(slow.decisions[0].instrumentationLatencyMs).toBe(30_000);
  });

  it("gives the same think time whether or not anybody was asked at all", () => {
    expect(committed(always).decision.thinkMs).toBe(committed(never).decision.thinkMs);
  });

  it("keeps a missing latency as null rather than zero", () => {
    /*
     * A decision nobody questioned has no latency. One answered instantly has a small one. Storing
     * the first as the second makes the mean of this column a fiction and hides the very population
     * the field exists to describe.
     */
    const unasked = committed(never).session.decisions[0];
    expect(unasked.wasAsked).toBe(false);
    expect(unasked.instrumentationLatencyMs).toBeNull();
    expect(unasked.confidence).toBeNull();

    const instant = answer(committed(always).session, 4, 5_000).decisions[0];
    expect(instant.instrumentationLatencyMs).toBe(0);
    expect(instant.instrumentationLatencyMs).not.toBeNull();
  });

  it("records the sampling regime on every decision, asked or not", () => {
    /*
     * The rate is a constant today, so it is recoverable from the source at this commit -- and it
     * stops being the moment it becomes conditional on the time control, which blitz will want.
     * Recording it now is what makes the transition legible instead of retroactive.
     */
    for (const draw of [always, never]) {
      const entry = committed(draw).session.decisions[0];
      expect(entry.samplingProbability).toBe(BLITZ_ASK_RATE);
      expect(entry.samplingPolicyVersion).toBe(BLITZ_SAMPLING_POLICY_VERSION);
    }
  });

  it("does not let the opponent's reply be shown while a question is open", () => {
    /*
     * The reply may be COMPUTED meanwhile -- the player's clock is stopped, so nothing is stolen --
     * but a player who can see what happened next is answering a different question from the one
     * the instrument meant to ask.
     */
    const open = committed(always).session;
    expect(awaitingAnswer(open)).toBe(true);
    expect(mayRevealOpponentMove(open)).toBe(false);

    const closed = answer(open, 6, 6_000);
    expect(mayRevealOpponentMove(closed)).toBe(true);
  });

  it("never gates the reply when nothing was asked", () => {
    // The control for the test above: an unsampled decision must not stall the game.
    expect(mayRevealOpponentMove(committed(never).session)).toBe(true);
  });

  it("keeps the ASK when the answer never came, so the denominator is not self-selected", () => {
    /*
     * A sampler that only left traces when somebody replied would produce a denominator made of
     * the people willing to answer -- the selection bias the plan's adversarial review names. The
     * ask is recorded; the confidence stays null.
     */
    const abandoned = abandon(committed(always).session);
    expect(abandoned.decisions).toHaveLength(1);
    expect(abandoned.decisions[0].wasAsked).toBe(true);
    expect(abandoned.decisions[0].confidence).toBeNull();
    expect(abandoned.decisions[0].instrumentationLatencyMs).toBeNull();
    expect(awaitingAnswer(abandoned)).toBe(false);
  });

  it("settles an unanswered question when the player just moves again", () => {
    const first = committed(always).session;
    const g = start(newGame(THREE_ZERO), 0);
    const after = commit(g, { from: "e2", to: "e4" }, 2_000).state;
    if (after.phase !== "running") throw new Error("unreachable");
    const next: InstrumentSession = recordCommitted(first, after.decisions[0], 9_000, never);
    expect(next.decisions).toHaveLength(2);
    expect(next.decisions[0].wasAsked).toBe(true); // still recorded
    expect(next.decisions[0].confidence).toBeNull(); // and still unanswered
    expect(awaitingAnswer(next)).toBe(false);
  });

  it("holds the counterfactual probe off, as a constant rather than an omission", () => {
    /*
     * "What else did you consider?" is a second question after a move, in a game where the opponent
     * is waiting, and nothing has measured what it costs here. Turning it on should be a visible
     * edit to a named constant, not the absence of a call somebody adds without noticing.
     */
    expect(BLITZ_COUNTERFACTUAL_ENABLED).toBe(false);
  });

  it("offers no way at all to add the two durations together", () => {
    /*
     * The structural claim. The failure is a `total` or a `+` somewhere convenient, so the check is
     * that the module exports nothing that sums them and never writes the sum itself.
     */
    const text = require("node:fs").readFileSync(
      new URL("../../shared/blitz-instrument.ts", import.meta.url),
      "utf8",
    ) as string;
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/thinkMs\s*\+/);
    expect(code).not.toMatch(/\+\s*[\w.]*thinkMs/);
    expect(code).not.toMatch(/totalMs|elapsedTotal/);
  });
});
