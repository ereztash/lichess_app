// @vitest-environment jsdom
/**
 * The product records every move you put on the board, and never said so.
 *
 * `candidate_moves_considered` is the only reason this app can ever write the one sentence no
 * other chess tool can -- "the engine's move was already on your board" -- and `CommitmentScreen`
 * received the array as a prop and rendered nothing. A product that records something and does
 * not say so is the defect; disclosing it is the fix.
 *
 * THE WHOLE DIFFICULTY IS THAT THE FIX MUST NOT BECOME A PROMPT. If the panel encourages putting
 * more moves down, the array stops being a record of what happened and becomes an artifact of the
 * interface -- the same contamination that got pre-filled read chips refused, and it would poison
 * the denominator of the very measurement (`oneThingMix`) built to find out whether the finding
 * fires. So most of this file asserts the ABSENCE of things: no count, no target, no praise.
 */
import { calibrationScore } from "@shared/calibration-score";
import { splitHalfStability } from "@shared/stability";
import { metacognitiveSensitivity } from "@shared/sensitivity";
import { effortFollowsDoubt } from "@shared/control";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { RecordDashboard } from "@/components/RecordDashboard";
import { MIN_BUCKET_N } from "@shared/detector";
import type { RecordReading } from "@shared/record-dashboard";
import { readCounterfactuals } from "@shared/counterfactual-reading";
import { readVariables } from "@shared/bucket-variable";
import { crossVariables } from "@shared/crossing";

const POSITION = {
  gameId: "g",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  ply: 7,
  clockMsRemaining: null,
  // Anchor: the purpose where the confidence question IS put. The `play` case has its own file.
  purpose: "anchor" as const,
};

const panel = (candidates: string[], chosen: string | null = "g1f3") =>
  render(
    <CommitmentScreen
      position={POSITION}
      chosenMove={chosen}
      candidatesConsidered={candidates}
      onCommit={vi.fn()}
      pending={false}
    />,
  );

describe("the panel says what the board is recording", () => {
  it("names the moves that are on the record", () => {
    panel(["g1f3", "e2e4"]);
    const box = document.querySelector(".commitment-candidates")!;
    expect(box, "the panel still records candidate moves and never says so").not.toBeNull();
    expect(box.textContent).toContain("g1f3");
    expect(box.textContent).toContain("e2e4");
  });

  it("states the asymmetry in the direction the record actually runs", () => {
    /*
     * The array holds board interaction, not thought. A move in it WAS in front of the player; a
     * move absent from it may still have been considered and never touched. Every sentence the
     * product derives from this array is phrased in that one direction, and the disclosure has to
     * be too -- otherwise a player reads an absent move as proof they did not see it.
     */
    panel(["g1f3", "e2e4"]);
    const note = document.querySelector(".candidates-note")!.textContent ?? "";
    expect(note).toMatch(/ששקלתם בראש/);
    expect(note).toMatch(/אינו נרשם/);
    // The one-way clause: it can show a move was there, never that it was not.
    expect(note).toMatch(/אף פעם לא שהוא לא היה/);
  });

  it("renders from the FIRST move, so two is not a threshold", () => {
    /*
     * Appearing at two would make two a threshold, and a threshold that appears on reaching it is
     * a reward. The disclosure is constant from the moment there is anything to disclose.
     */
    panel(["g1f3"]);
    expect(document.querySelector(".commitment-candidates")).not.toBeNull();
  });

  it("says nothing at all before a move is on the board", () => {
    // Nothing is recorded yet, so there is nothing to disclose. Section 4.5: an empty list and a
    // list with one move are different states.
    panel([], null);
    expect(document.querySelector(".commitment-candidates")).toBeNull();
  });
});

describe("what the disclosure must never become", () => {
  it("shows no count of the moves", () => {
    /*
     * A number next to a list is a score, and a score invites raising it. The moves are shown; how
     * many there are is left to the eye, which cannot be optimised against.
     */
    const { container } = panel(["g1f3", "e2e4", "d2d4"]);
    const box = container.querySelector(".commitment-candidates")!;
    const digits = (box.textContent ?? "").replace(/[a-h][1-8]/g, "").match(/\d/g) ?? [];
    expect(digits, "the disclosure is counting the moves at the player").toHaveLength(0);
  });

  it("never tells the player to put more moves down", () => {
    // The line between disclosing what is recorded and instructing the player to produce more of
    // it is the entire design of this block. Imperatives are the failure.
    const { container } = panel(["g1f3"]);
    const text = container.querySelector(".commitment-candidates")!.textContent ?? "";
    expect(text).not.toMatch(/הוסיפו|נסו עוד|כדאי לשקול|מומלץ|שקלו עוד|ככל שתניחו/);
  });

  it("does not praise, grade or celebrate the list", () => {
    const { container } = panel(["g1f3", "e2e4", "d2d4", "c2c4"]);
    const text = container.querySelector(".commitment-candidates")!.textContent ?? "";
    expect(text).not.toMatch(/יפה|מצוין|כל הכבוד|טוב מאוד|מעולה/);
  });

  it("reads identically whether there is one move or four", () => {
    /*
     * The load-bearing one. If the wording shifts with the count -- warmer at four, terser at one
     * -- the panel is grading the player's board behaviour, which is exactly the inducement this
     * whole design refuses. Only the list of moves may differ.
     */
    const one = panel(["g1f3"]).container.querySelector(".candidates-note")!.textContent;
    const four = panel(["g1f3", "e2e4", "d2d4", "c2c4"]).container.querySelector(".candidates-note")!
      .textContent;
    expect(four, "the wording changes with how many moves were put down").toBe(one);
  });

  it("adds no required field: the commitment gate is untouched", () => {
    // `draftProblems` demands move, known, unknown and confidence. Candidates are disclosed, never
    // demanded -- a required candidate list would be the product dictating how to think.
    panel([], null);
    const blocked = document.querySelector(".commitment-summary")?.textContent ?? "";
    expect(blocked).not.toMatch(/מהלכים שהנחתם|מועמד/);
  });
});

const emptyMix = {
  n: 0,
  counts: { "chose-past-it": 0, "confident-and-wrong": 0, outplayed: 0, "trusted-it-too-little": 0 },
  silent: 0,
  eligible: 0,
};

/*
 * NO `as RecordReading` HERE ANY MORE, and the cast it replaces had been hiding two things.
 *
 * It hid a missing field: when the reading gained the Murphy decomposition this fixture kept
 * compiling and the component crashed at render instead, with a TypeError several frames deep
 * rather than an error on the line that was wrong.
 *
 * And it hid a shape that was never right: `overall` was written as `{stated, observed, gap, n}`
 * when `CalibrationSummary` has `meanConfidence` and `accuracyRate`. The cast silenced that from
 * the day it was written, so the component under test was being handed a summary whose two main
 * figures were `undefined`.
 */
const reading = (over: Partial<RecordReading> = {}): RecordReading => ({
  overall: { n: 40, meanConfidence: 0.6, accuracyRate: 0.5, gap: 0.1, gapVariance: 0.2 },
  awaitingReveal: 0,
  withoutConfidence: 0,
  /* This fixture is a free-play record: nothing of its player's is read under another heading. */
  readElsewhere: 0,
  counterfactual: readCounterfactuals([]),
  profile: { variables: readVariables([]), crossing: crossVariables([]) },
  calibration: calibrationScore([]),
  anchor: calibrationScore([]),
  anchorAnswered: [],
  stability: splitHalfStability([]),
  sensitivity: metacognitiveSensitivity([]),
  // No band beside an unreadable number: the literature's median is a persuasive thing to
  // misread as your own result.
  sensitivityReference: null,
  control: effortFollowsDoubt([]),
  buckets: [],
  confidence: [],
  scored: 40,
  mix: emptyMix,
  /* Same population: this fixture has no bank, drill, transfer or imported decisions. */
  mixAll: emptyMix,
  ...over,
});

describe("the mix is rendered, not computed and dropped", () => {
  it("reaches the screen once there are enough revealed decisions", () => {
    /*
     * The instrument exists to answer whether `chose-past-it` fires often enough to carry the
     * product. It was assembled in `recordReading`, carried on `RecordReading.mix`, and for one
     * commit the dashboard destructured every field except that one -- computed end to end and
     * rendered nowhere. This asserts it arrives.
     */
    render(
      <RecordDashboard
        reading={reading({
          mix: {
            ...emptyMix,
            n: MIN_BUCKET_N,
            counts: { ...emptyMix.counts, "chose-past-it": 6, outplayed: 14 },
            silent: 10,
            eligible: 20,
          },
        })}
      />,
    );
    const block = document.querySelector(".mix-block")!;
    expect(block, "the mix is computed and never rendered").not.toBeNull();
    expect(block.textContent).toMatch(/על הלוח שלכם/);
    // The ceiling travels with it, or the first row reads as an estimate rather than a floor.
    expect(document.querySelector(".mix-note")!.textContent).toContain("20");
  });

  it("refuses to report shares below the floor, and says how far it is", () => {
    // MIN_BUCKET_N reused rather than invented: a fresh threshold here would be the unjustified
    // number this product spends its whole time refusing.
    render(<RecordDashboard reading={reading({ mix: { ...emptyMix, n: 9 } })} />);
    const block = document.querySelector(".mix-block")!;
    expect(block.textContent).toContain(String(MIN_BUCKET_N));
    expect(block.textContent).toMatch(/9/);
    expect(document.querySelector(".mix-note"), "shares reported under the floor").toBeNull();
  });
});
