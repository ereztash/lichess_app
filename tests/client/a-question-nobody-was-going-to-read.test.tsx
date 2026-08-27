// @vitest-environment jsdom
/**
 * The confidence question, asked where a measurement is structural and drawn for everywhere else.
 *
 * It was on every decision, so a game against the app was forty of them. Reported twice as the
 * reason a game does not get finished -- and it is not a UX complaint, it is a measurement problem
 * wearing one: AN INSTRUMENT TOO EXPENSIVE TO USE PRODUCES NO READINGS, and a calibration gap over
 * decisions nobody stayed to record is not a smaller finding, it is no finding.
 *
 * The rule is in `shared/confidence-asked.ts`: always on the shared bank, on drills and on
 * transfer checks -- where the measurement is structural -- and on a random subset of everything
 * else. This file holds the three things that make that safe rather than merely lighter:
 *
 *   1. DRAWN BY A COIN, NEVER BY THE PLAYER. Whoever would skip an optional question skips it
 *      because of how they feel about the position, which makes the confidence data a sample the
 *      player curated on the very variable being measured. That is the one bias this product
 *      exists to avoid, and it would have been introduced to save a tap. A draw has no opinion
 *      about the position, which is the whole reason it is a draw and not a checkbox.
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
import {
  ASK_RATE,
  confidenceIsAsked,
  drawForDecision,
  type DecisionPurpose,
} from "@shared/confidence-asked";
import { scoreDecisions } from "@shared/scoring";
import { summarise } from "@shared/detector";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import type { DecisionAtom } from "@shared/decision-atom";
import { openStep } from "../fixtures/commitment-steps";
import { beginVisit, clearProgress, progress } from "@/lib/progress-record";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";

/*
 * Two plies of the same game, one the draw selected and one it did not.
 *
 * Read off the shipped function rather than typed in from a run, so they cannot silently stop
 * being the cases they are named for: the assertions below check them first.
 */
const DRAWN_PLY = 6;
const QUIET_PLY = 7;

const at = (purpose: DecisionPurpose, ply = QUIET_PLY): PositionUnderDecision => ({
  gameId: "g",
  fen: FEN,
  ply,
  clockMsRemaining: null,
  purpose,
});

const screenAt = (purpose: DecisionPurpose, ply = QUIET_PLY) =>
  render(
    <CommitmentScreen
      position={at(purpose, ply)}
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
  it("holds the two fixture plies to what they are named for", () => {
    // Everything below depends on these two being on opposite sides of the draw.
    expect(drawForDecision("g", FEN, DRAWN_PLY)).toBeLessThan(ASK_RATE);
    expect(drawForDecision("g", FEN, QUIET_PLY)).toBeGreaterThanOrEqual(ASK_RATE);
  });

  it("is absent on an ordinary decision the draw passed over, and absent is not disabled", () => {
    /*
     * A greyed-out step still costs a glance and an explanation, and an optional one is answered
     * by whoever feels like answering. On a decision the draw passed over it is not on the screen.
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

  it("is there on an ordinary decision the draw selected", () => {
    // The same game, the same position, a different ply -- and the coin came up the other way.
    const { container } = screenAt("play", DRAWN_PLY);
    expect(container.textContent, "the draw selected this decision and nothing asked").toContain(
      "כמה אתם בטוחים",
    );
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
  it("is recordable in an ordinary game the draw passed over", () => {
    expect(isCommittable(answered(), at("play"))).toBe(true);
    expect(draftProblems(answered(), at("play")).map((problem) => problem.field)).toEqual([]);
  });

  it("is refused on a decision the draw selected, and on the bank", () => {
    for (const position of [at("play", DRAWN_PLY), at("anchor")]) {
      expect(isCommittable(answered(), position)).toBe(false);
      expect(draftProblems(answered(), position)[0].field).toBe("confidence");
    }
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
  it("always asks where the measurement is structural", () => {
    // A drill's verdict IS a calibration gap; sampling there produces drills that cannot be graded.
    for (const purpose of ["anchor", "drill", "transfer"] as const)
      for (const ply of [DRAWN_PLY, QUIET_PLY])
        expect(confidenceIsAsked({ purpose, gameId: "g", fen: FEN, ply })).toBe(true);
  });

  it("draws the same answer every time it is asked about one decision", () => {
    /*
     * NOT `Math.random()` AT RENDER TIME. React re-renders on every keystroke in the free-text box
     * beside it, and a question that flickers in and out while somebody is answering the field
     * above is worse than one always asked.
     */
    const context = { purpose: "play" as const, gameId: "g", fen: FEN, ply: DRAWN_PLY };
    const answers = Array.from({ length: 50 }, () => confidenceIsAsked(context));
    expect(new Set(answers).size, "the draw was re-rolled").toBe(1);
  });

  it("spreads across a game instead of clustering, which was measured and was not free", () => {
    /*
     * THE FIRST HASH PASSED THE RATE AND FAILED THE PLAYER. FNV-1a alone, with the ply appended
     * last, gave 0.2472 over twenty thousand keys -- and within one game it was all or nothing,
     * because FNV's avalanche is weak on the bytes it eats last and the comparison reads the high
     * bits. Measured over 500 games of 60 plies: a worst run of FIFTY-NINE consecutive asks, and
     * games that asked nothing at all. A correct average over a ruinous distribution.
     *
     * These bounds are what the finalising mix bought, and they were RE-MEASURED when ASK_RATE
     * was lowered to 0.15. A spread validated at one rate is not validated at another, and the
     * assertion most at risk is "no game goes unasked" -- its margin is exactly what a falling
     * rate eats into. At 0.15 over the same 500 x 60: rate 0.1525, longest run FIVE, no silent
     * game; still none at 5,000 games. A run of five is what an honest coin gives over thirty
     * thousand draws at this rate; fifty-nine is not.
     */
    let asked = 0;
    let longestRun = 0;
    let gamesWithNoAsk = 0;
    const GAMES = 500;
    const PLIES = 60;
    for (let game = 0; game < GAMES; game += 1) {
      let run = 0;
      let inGame = 0;
      for (let ply = 1; ply <= PLIES; ply += 1) {
        const ask = confidenceIsAsked({
          purpose: "play",
          gameId: `live-${game}`,
          fen: FEN,
          ply,
        });
        run = ask ? run + 1 : 0;
        longestRun = Math.max(longestRun, run);
        if (ask) {
          asked += 1;
          inGame += 1;
        }
      }
      if (inGame === 0) gamesWithNoAsk += 1;
    }
    /*
     * THE DISTRIBUTION FIRST, THE RATE SECOND, and the order is not cosmetic: `expect` throws on
     * the first failure, and with the rate checked first a positive control on the broken hash
     * reddened on the average and never reached these two -- which are the ones carrying the
     * finding. An assertion shadowed by a tighter one above it is an assertion that is not run.
     */
    expect(longestRun, "the question clusters into a run a player would call constant").toBeLessThan(
      10,
    );
    expect(gamesWithNoAsk, "whole games go by without the question being put once").toBe(0);
    const rate = asked / (GAMES * PLIES);
    expect(rate, `asked ${rate.toFixed(4)} of decisions, wanted ${ASK_RATE}`).toBeCloseTo(
      ASK_RATE,
      2,
    );
  });
});
