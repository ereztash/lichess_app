/**
 * The ordering §7.1 freezes, tested by trying to break it.
 *
 * Every test here attempts a sequence a careless implementation would allow, and requires it to
 * throw. A state machine whose only tests walk the happy path proves that the happy path works and
 * says nothing about the thing it exists for.
 */
import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_BEFORE_COMMIT,
  ProtocolViolation,
  advance,
  beginTrial,
  mayRevealEngineOutput,
  preCommitLeaks,
} from "../../../research/tcrf/protocol";

const run = (probe: "probed" | "not_probed") => beginTrial(probe, 0);

describe("the probed arm walks POSITION -> TIMER -> COMMIT -> PROBE -> REVEAL", () => {
  it("freezes think time at the commit and never again", () => {
    let state = run("probed");
    state = advance(state, { kind: "start_timer", at_ms: 1000 });
    state = advance(state, { kind: "commit", at_ms: 5200, move: "e5d7" });
    expect(state.think_ms).toBe(4200);
    state = advance(state, { kind: "open_probe", at_ms: 5300 });
    state = advance(state, { kind: "close_probe", at_ms: 41000 });
    /*
     * THE WHOLE POINT, IN ONE ASSERTION. Thirty-five seconds of answering did not touch the four
     * seconds of deciding, and the two numbers live in different fields with nothing summing them.
     */
    expect(state.think_ms).toBe(4200);
    expect(state.instrumentation_latency_ms).toBe(35700);
    state = advance(state, { kind: "reveal", at_ms: 41100 });
    expect(mayRevealEngineOutput(state)).toBe(true);
  });

  it("sends the unprobed arm straight from commit to reveal-eligible", () => {
    let state = run("not_probed");
    state = advance(state, { kind: "start_timer", at_ms: 0 });
    state = advance(state, { kind: "commit", at_ms: 3000, move: "d1d8" });
    expect(state.stage).toBe("probed");
    expect(state.instrumentation_latency_ms).toBeNull();
    expect(() => advance(state, { kind: "reveal", at_ms: 3100 })).not.toThrow();
  });
});

describe("the orderings the preregistration forbids are not reachable", () => {
  it("refuses a probe before the commit", () => {
    let state = run("probed");
    state = advance(state, { kind: "start_timer", at_ms: 0 });
    expect(() => advance(state, { kind: "open_probe", at_ms: 500 })).toThrow(ProtocolViolation);
  });

  it("refuses a reveal before the commit", () => {
    let state = run("probed");
    state = advance(state, { kind: "start_timer", at_ms: 0 });
    expect(() => advance(state, { kind: "reveal", at_ms: 500 })).toThrow(ProtocolViolation);
  });

  it("refuses a reveal while a probe is still open", () => {
    let state = run("probed");
    state = advance(state, { kind: "start_timer", at_ms: 0 });
    state = advance(state, { kind: "commit", at_ms: 2000, move: "e5d7" });
    state = advance(state, { kind: "open_probe", at_ms: 2100 });
    expect(() => advance(state, { kind: "reveal", at_ms: 2200 })).toThrow(ProtocolViolation);
    expect(mayRevealEngineOutput(state)).toBe(false);
  });

  it("refuses a second commit", () => {
    let state = run("probed");
    state = advance(state, { kind: "start_timer", at_ms: 0 });
    state = advance(state, { kind: "commit", at_ms: 2000, move: "e5d7" });
    expect(() => advance(state, { kind: "commit", at_ms: 2500, move: "e5c6" })).toThrow(
      ProtocolViolation,
    );
  });

  it("refuses a commit before the timer started", () => {
    const state = run("probed");
    expect(() => advance(state, { kind: "commit", at_ms: 10, move: "e5d7" })).toThrow(
      ProtocolViolation,
    );
  });
});

describe("a timeout is an outcome, not a maximal decision", () => {
  it("leaves think time null rather than writing the budget into it", () => {
    let state = run("probed");
    state = advance(state, { kind: "start_timer", at_ms: 0 });
    state = advance(state, { kind: "timeout", at_ms: 12000 });
    expect(state.timed_out).toBe(true);
    expect(state.think_ms).toBeNull();
    expect(state.move).toBeNull();
  });

  it("does not open a probe about a decision that was never made", () => {
    let state = run("probed");
    state = advance(state, { kind: "start_timer", at_ms: 0 });
    state = advance(state, { kind: "timeout", at_ms: 12000 });
    expect(() => advance(state, { kind: "open_probe", at_ms: 12100 })).toThrow(ProtocolViolation);
    // and reveal is still due, because the trial is over
    expect(() => advance(state, { kind: "reveal", at_ms: 12200 })).not.toThrow();
  });
});

describe("nothing the engine knows reaches the screen before the commit", () => {
  it("names every forbidden key in a payload that carries them, however deeply nested", () => {
    const payload = {
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      board: { hint: { best_move: "e2e4" }, meta: [{ topology_condition: "present" }] },
    };
    expect(preCommitLeaks(payload)).toEqual(["best_move", "topology_condition"]);
  });

  it("passes a payload that carries only the position", () => {
    expect(preCommitLeaks({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", budget_ms: 12000 })).toEqual([]);
  });

  it("forbids the manipulation's own labels, not only the engine's output", () => {
    for (const key of ["target_relation", "target_affordance", "topology_condition"]) {
      expect(FORBIDDEN_BEFORE_COMMIT).toContain(key);
    }
  });
});
