/**
 * The trajectory metrics, and the one rule that decides whether any of them mean anything.
 *
 * THE RULE: a move chosen at a small budget is judged by the DEEP REFERENCE, never by the budget
 * that chose it. A shallow search that both picks a move and grades it will always report that its
 * own move is excellent -- that is what "picked it" means -- and a metric built on that would say
 * every position is fully solved at fifty nodes. The first test drives exactly that case: shallow
 * values that flatter the shallow choice, deep values that contradict them.
 *
 * These are unit tests on pure functions. They cannot and do not establish that the metrics measure
 * anything about chess or about people; Gate 1 of the preregistration failed, and nothing here
 * changes that. They establish that the arithmetic is the arithmetic that was preregistered.
 */
import { describe, expect, it } from "vitest";
import {
  candidateGap,
  convergenceNodes,
  lastSwitchNodes,
  moveInstability,
  remainingComputationValue,
  searchTrajectory,
  type BudgetObservation,
  type DeepReference,
} from "../../research/blitz/search-trajectory.js";

const observation = (
  nodes: number,
  chosenMove: string | null,
  shallowValue: number | null,
  deepValueOfChosenMove: number | null,
): BudgetObservation => ({
  nodes,
  chosenMove,
  shallowValue,
  deepValueOfChosenMove,
  topMoves: chosenMove ? [{ move: chosenMove, shallowValue: shallowValue ?? 0 }] : [],
});

const reference: DeepReference = {
  nodes: 400_000,
  bestMove: "d2d4",
  bestValue: 0.62,
  ranked: [
    { move: "d2d4", value: 0.62 },
    { move: "e2e4", value: 0.55 },
    { move: "g1f3", value: 0.51 },
  ],
};

describe("the engine does not grade its own homework", () => {
  it("measures remaining value against the reference, not against the budget that chose the move", () => {
    // Every shallow budget is certain its own move is worth 0.9. The reference disagrees.
    const observations = [
      observation(50, "a2a3", 0.9, 0.4),
      observation(1_000, "e2e4", 0.9, 0.55),
      observation(20_000, "d2d4", 0.9, 0.62),
    ];
    const trajectory = searchTrajectory(reference, observations);

    expect(trajectory.remainingComputationValue).toBeCloseTo(0, 10);
    expect(trajectory.remainingComputationValueEarly).toBeCloseTo(0.62 - 0.55, 10);
    // The area reads the deep values: 0.22, 0.07, 0 -- not the flat 0.9 the budgets reported.
    expect(trajectory.remainingComputationValueArea).toBeCloseTo((0.22 + 0.07 + 0) / 3, 10);
    expect(trajectory.valueGainFirstToLast).toBeCloseTo(0.62 - 0.4, 10);
  });

  it("floors remaining value at zero rather than crediting a shallow search with a discovery", () => {
    expect(remainingComputationValue(0.5, 0.58)).toBe(0);
    expect(remainingComputationValue(null, 0.4)).toBeNull();
    expect(remainingComputationValue(0.5, null)).toBeNull();
  });
});

describe("how the chosen move moved", () => {
  const observations = [
    observation(50, "a2a3", 0.4, 0.4),
    observation(100, "e2e4", 0.5, 0.55),
    observation(200, "e2e4", 0.5, 0.55),
    observation(500, "a2a3", 0.4, 0.4),
    observation(1_000, "d2d4", 0.6, 0.62),
    observation(2_000, "d2d4", 0.6, 0.62),
  ];

  it("counts every change between adjacent budgets", () => {
    expect(moveInstability(observations)).toBe(3);
  });

  it("converges at the first budget after the last change, not at the largest budget", () => {
    expect(convergenceNodes(observations)).toBe(1_000);
    expect(lastSwitchNodes(observations)).toBe(1_000);
  });

  it("reports a settled search as converging at its first budget", () => {
    const settled = [observation(50, "d2d4", 0.6, 0.62), observation(20_000, "d2d4", 0.6, 0.62)];
    expect(convergenceNodes(settled)).toBe(50);
    expect(lastSwitchNodes(settled)).toBeNull();
    expect(moveInstability(settled)).toBe(0);
  });

  it("says null rather than a number when there was nothing to converge on", () => {
    const blank = [observation(50, null, null, null)];
    expect(convergenceNodes(blank)).toBeNull();
    expect(searchTrajectory(reference, blank).remainingComputationValue).toBeNull();
    expect(searchTrajectory(reference, blank).observedBudgets).toBe(0);
  });

  it("orders by budget, so a caller that hands them over shuffled gets the same answer", () => {
    const shuffled = [observations[4], observations[0], observations[3], observations[1], observations[2], observations[5]];
    expect(convergenceNodes(shuffled)).toBe(1_000);
    expect(moveInstability(shuffled)).toBe(3);
  });
});

describe("the candidate gap is a baseline feature and behaves like one", () => {
  it("is the deep distance between the best move and the next", () => {
    expect(candidateGap(reference)).toBeCloseTo(0.07, 10);
  });

  it("is null when the reference offered no alternative to compare against", () => {
    expect(candidateGap({ ...reference, ranked: reference.ranked.slice(0, 1) })).toBeNull();
  });
});
