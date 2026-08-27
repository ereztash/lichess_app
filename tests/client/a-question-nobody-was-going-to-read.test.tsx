// @vitest-environment jsdom
/**
 * The confidence question, asked where something reads the answer and nowhere else.
 *
 * It was on every decision, so a game against the app was forty of them. Reported twice as the
 * reason a game does not get finished -- and it is not a UX complaint, it is a measurement problem
 * wearing one: AN INSTRUMENT TOO EXPENSIVE TO USE PRODUCES NO READINGS, and a calibration gap over
 * decisions nobody stayed to record is not a smaller finding, it is no finding.
 *
 * The rule is in `shared/confidence-asked.ts` and it is the only one: asked on the shared bank, on
 * drills and on transfer checks -- the three places a measurement reads it -- and absent
 * everywhere else. This file holds the three things that make that safe rather than merely lighter:
 *
 *   1. ABSENT, NOT OPTIONAL. Whoever would skip an optional question skips it because of how they
 *      feel about the position, which makes the confidence data a sample the player curated on the
 *      very variable being measured. That is the one bias this product exists to avoid, and it
 *      would have been introduced to save a tap.
 *   2. NULL IS NEVER DEFAULTED. Not to zero, not to the middle of the scale, not to "unsure". One
 *      guard in `scoreDecisions` excludes them, and every measurement in the product reads its
 *      decisions through that function.
 *   3. THE EXCLUSION IS COUNTED. A record of 200 decisions of which 40 carry a confidence is a
 *      different thing from a record of 40, and only one of those is honest about what happened.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import {
  buildCommitEvent,
  emptyDraft,
  draftProblems,
  isCommittable,
  type PositionUnderDecision,
} from "@/lib/decision-session";
import { confidenceIsMeasured, type DecisionPurpose } from "@shared/confidence-asked";
import { scoreDecisions } from "@shared/scoring";
import { summarise } from "@shared/detector";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import type { DecisionAtom } from "@shared/decision-atom";
import { openStep } from "../fixtures/commitment-steps";
import { beginVisit, clearProgress, progress } from "@/lib/progress-record";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
const at = (purpose: DecisionPurpose): PositionUnderDecision => ({
  gameId: "g",
  fen: FEN,
  ply: 7,
  clockMsRemaining: null,
  purpose,
});

const screenAt = (purpose: DecisionPurpose) =>
  render(
    <CommitmentScreen
      position={at(purpose)}
      chosenMove="g8f6"
      candidatesConsidered={[]}
      onCommit={vi.fn()}
      pending={false}
    />,
  );

const answered = () => ({
  ...emptyDraft(),
  chosenMove: "g8f6",
  knownTags: ["המרכז פתוח"],
  unknownTags: ["לא יודע איך הוא יענה"],
});

describe("the question is on the screen only where a measurement reads it", () => {
  it("is absent in an ordinary game, and absent is not disabled", () => {
    /*
     * A greyed-out step still costs a glance and an explanation, and an optional one is answered
     * by whoever feels like answering. On an ordinary decision it simply is not part of the screen.
     */
    const { container } = screenAt("play");
    const heads = [...container.querySelectorAll(".step-head")];
    expect(heads).toHaveLength(3);
    expect(container.textContent, "the question was rendered after all").not.toContain(
      "כמה אתם בטוחים",
    );
    expect(
      container.querySelector(".commitment-confidence"),
      "the picker is on the page, merely hidden or disabled",
    ).toBeNull();
  });

  it("leaves the step out of the list the screen navigates by, not only out of the markup", () => {
    /*
     * TWO GATES, AND A POSITIVE CONTROL FOUND THAT ONLY ONE WAS UNDER TEST. The block is rendered
     * behind `asksConfidence` and the accordion walks `stepsFor(purpose)`; removing the filter
     * from the second left every assertion above still passing, because they all look at markup.
     *
     * The list is not decoration: `nextIncomplete` walks it to decide which step to open after an
     * answer, and the trial log records which of its steps were done. A list holding a step the
     * screen never renders means an accordion trying to open nothing and a log reporting a step
     * as permanently unanswered. The log is the readable consumer, so it is what is asserted.
     */
    clearProgress();
    beginVisit(new Date("2026-08-27T12:00:00.000Z"));
    const { unmount } = screenAt("play");
    openStep("known");
    fireEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    openStep("unknown");
    fireEvent.click(screen.getByRole("button", { name: "לא יודע איך הוא יענה" }));
    unmount();

    const [attempt] = progress().flatMap((visit) => visit.attempts);
    expect(attempt.done, "the screen still navigates by a step it does not render").toEqual([
      "chosenMove",
      "known",
      "unknown",
    ]);
    /*
     * `open` is deliberately NOT asserted null. The two multi-select steps do not auto-advance --
     * only the move does, because choosing a move is one act and cannot be added to -- so sitting
     * on `unknown` after answering it is the screen working, not a step it failed to leave.
     */
    expect(attempt.open).toBe("unknown");
  });

  it("is there, and required, on a position from the shared bank", () => {
    screenAt("anchor");
    expect(openStep("confidence")).toBeTruthy();
    expect(screen.getByRole("button", { name: /ביטחון 4/ })).toBeTruthy();
  });

  it("is there on a drill and on a transfer check, because both grade a calibration gap", () => {
    for (const purpose of ["drill", "transfer"] as const) {
      const { container, unmount } = screenAt(purpose);
      expect(
        container.textContent,
        `${purpose} decisions are graded on the gap and were not asked`,
      ).toContain("כמה אתם בטוחים");
      unmount();
    }
  });
});

describe("a decision is complete without an answer nobody wanted", () => {
  it("is recordable in an ordinary game with no confidence stated", () => {
    expect(isCommittable(answered(), "play")).toBe(true);
    expect(draftProblems(answered(), "play").map((problem) => problem.field)).toEqual([]);
  });

  it("is still refused on the bank until the question is answered", () => {
    expect(isCommittable(answered(), "anchor")).toBe(false);
    expect(draftProblems(answered(), "anchor")[0].field).toBe("confidence");
  });

  it("writes null rather than a number nobody said", () => {
    const event = buildCommitEvent(
      "11111111-1111-4111-8111-111111111111",
      at("play"),
      // A level left over in the draft must not be written where nothing asked for one.
      { ...answered(), confidence: 6 },
      12,
      "per-decision",
      () => 0.1,
    );
    expect(
      event.bounded_action.confidence,
      "a confidence was recorded on a decision that never asked for one",
    ).toBeNull();
  });
});

describe("nothing downstream reads a null as a number", () => {
  const atom = (confidence: number | null, accurate: boolean): DecisionAtom => ({
    entry_state: { game_id: "g", fen: FEN, ply: 7, phase: "middlegame", clock_ms_remaining: null },
    known: "k",
    unknown: "u",
    known_parts: null,
    unknown_parts: null,
    decision: "g8f6",
    bounded_action: {
      seconds_taken: 20,
      confidence,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: [],
    },
    probe: null,
    reveal_timing: null,
    result: {
      engine_eval_cp: 0,
      engine_best_move: "g8f6",
      engine_depth: 18,
      engine_source: "local_sf18",
      // Accurate at 0 loss, plainly inaccurate at 300.
      cp_loss: accurate ? 0 : 300,
    },
    feedback: null,
  });

  it("leaves an unmeasured decision out of the scored record and says how many", () => {
    const atoms = [atom(7, false), atom(null, true), atom(null, true)];
    const summary = scoreDecisions(atoms, ["a", "b", "c"]);
    expect(summary.scored).toHaveLength(1);
    expect(summary.total).toBe(3);
    expect(
      summary.withoutConfidence,
      "the exclusion was silent, so a record of 3 reads as a record of 1",
    ).toBe(2);
    // NOT a wait: `awaitingReveal` becomes scoreable when the engine speaks; this never will.
    expect(summary.awaitingReveal).toBe(0);
  });

  it("gives the same gap it would give without the unmeasured decisions at all", () => {
    /*
     * THE ASSERTION THAT MATTERS. A null read as 0 -- or as the middle of the scale, or as "not
     * confident" -- would move the calibration gap without anything on any screen saying so, and
     * the number would be wrong in the direction of whatever the default happened to be. The two
     * records below differ only by decisions nobody asked, so the gap must not move at all.
     */
    const measured = [atom(7, false), atom(6, true)];
    const padded = [...measured, atom(null, true), atom(null, false), atom(null, true)];
    const gapOf = (atoms: DecisionAtom[]) =>
      summarise(scoreDecisions(atoms, atoms.map((_, i) => `d-${i}`)).scored).gap;
    expect(gapOf(padded)).toBeCloseTo(gapOf(measured), 10);
  });
});

describe("the rule itself", () => {
  it("names the three purposes a measurement reads, and only those", () => {
    expect(confidenceIsMeasured("anchor")).toBe(true);
    expect(confidenceIsMeasured("drill")).toBe(true);
    expect(confidenceIsMeasured("transfer")).toBe(true);
    expect(confidenceIsMeasured("play")).toBe(false);
    expect(confidenceIsMeasured("import")).toBe(false);
  });
});
