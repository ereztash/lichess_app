// @vitest-environment jsdom
/**
 * The question that comes before all the others, computed since the dashboard existed and never
 * rendered.
 *
 * `readRecord` has returned `stability: splitHalfStability(anchored)` on every reading, and no
 * component read the field. The screen showed a calibration gap, its three-way split, a
 * discrimination area with a literature band beside it, and an effort correlation -- five answers
 * about the player -- while withholding the one that says whether any of them held still. A
 * number that does not repeat between two halves of the same record is noise, and noise renders
 * identically to a finding.
 *
 * WHAT THIS FILE PROTECTS. Not the arithmetic -- `shared/stability.ts` owns that and is tested
 * there. Two decisions the module made in prose, which only a screen can break:
 *
 *   1. NO THRESHOLD. `Stability` ships no pass mark on purpose, and its comment says why: a
 *      verdict would invite the reading that a passing record has a settled number about the
 *      person. A dashboard is exactly where a "stable ✓" gets added later by someone being
 *      helpful.
 *   2. NOT TEST-RETEST. Both halves come from one record, so this cannot separate a trait from a
 *      mood or a warm-up. The caveat is the reason the block is allowed on screen, so its absence
 *      is a defect and not a wording preference.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import type { ScoredDecision } from "@shared/detector";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { MIN_STABILITY_HALF } from "@shared/stability";
import { readRecord } from "@shared/record-dashboard";
import { RecordDashboard } from "@/components/RecordDashboard";

vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

/* Anchor FENs, because `splitHalfStability` is handed `anchored` alone. A free-play fixture would
   leave the block unreadable in every case and every assertion would pass for the wrong reason. */
const anchors = ANCHOR_POSITIONS.map((entry) => entry.fen);
const p = (level: number) => normaliseConfidence(level, CONFIDENCE_LEVELS);

/**
 * `n` anchor decisions, with the stated confidence chosen per half.
 *
 * The split is by ALTERNATING INDEX, so index parity is the half: `even` builds one and `odd` the
 * other. Accuracy alternates within each half so neither is flat, which is what lets a standard
 * error be computed at all.
 */
function record(n: number, even: (i: number) => number, odd: (i: number) => number) {
  return Array.from({ length: n }, (_, i): ScoredDecision => {
    const level = i % 2 === 0 ? even(i) : odd(i);
    return {
      decision_id: `d-${i}`,
      fen: anchors[i % anchors.length],
      accurate: i % 4 < 2,
      confidence: p(level),
      secondsTaken: 20 + (i % 5) * 7,
      phase: "middlegame",
      clockMsRemaining: null,
    };
  });
}

const ENOUGH = MIN_STABILITY_HALF * 2 + 10;
/** Both halves say the same thing: the same confidence pattern on both sides of the split. */
const SAID_IT_TWICE = () => record(ENOUGH, (i) => 4 + (i % 3), (i) => 4 + (i % 3));
/** One half near-certain throughout, the other at even odds. Same accuracy, different gap. */
const SAID_TWO_THINGS = () => record(ENOUGH, (i) => 7 - (i % 2), (i) => 3 + (i % 2));
/** Not enough to split: below the point where the check could fail. */
const TOO_SHORT = () => record(MIN_STABILITY_HALF, (i) => 4 + (i % 3), (i) => 4 + (i % 3));

const screen = (decisions: ScoredDecision[]) =>
  render(<RecordDashboard reading={readRecord(decisions)} />).container;

/** The block, found by its own heading rather than by position on the page. */
function stabilityBlock(container: HTMLElement): HTMLElement {
  const titles = [...container.querySelectorAll(".dash-title")];
  const heading = titles.find((t) => /אותו הדבר פעמיים/.test(t.textContent ?? ""));
  expect(heading, "the stability block is not on the screen at all").toBeTruthy();
  const nodes: Element[] = [];
  for (let node = heading!.nextElementSibling; node; node = node.nextElementSibling) {
    if (node.classList.contains("dash-title")) break;
    nodes.push(node);
  }
  const wrapper = document.createElement("div");
  for (const node of nodes) wrapper.appendChild(node.cloneNode(true));
  return wrapper;
}

describe("whether the record said the same thing twice", () => {
  it("prints both halves and how far apart they came out", () => {
    const block = stabilityBlock(screen(SAID_IT_TWICE()));
    const rows = [...block.querySelectorAll(".split-row")];
    expect(rows.length, "the two halves and their distance are not three rows").toBe(3);
    expect(block.textContent).toMatch(/הפער במחצית האחת/);
    expect(block.textContent).toMatch(/הפער במחצית השנייה/);
    expect(block.textContent, "the distance is not stated in standard errors").toMatch(
      /שגיאות תקן/,
    );
    // Each half carries its OWN n, because an odd record splits off by one.
    const { n } = readRecord(SAID_IT_TWICE()).stability;
    expect(block.textContent).toMatch(new RegExp(`n=${n[0]}`));
    expect(block.textContent).toMatch(new RegExp(`n=${n[1]}`));
  });

  it("says, on the screen, that this is not a measurement separated in time", () => {
    const block = stabilityBlock(screen(SAID_IT_TWICE()));
    expect(
      block.textContent,
      "the screen let a within-record split be read as test-retest reliability",
    ).toMatch(/אינה מדידת יציבות לאורך זמן/);
    expect(block.textContent, "the screen stopped saying what a large distance means").toMatch(
      /רעש/,
    );
  });

  it("grades nothing, on a record that repeated itself and on one that did not", () => {
    /*
     * THE ASSERTION THE MODULE ASKED FOR IN PROSE AND COULD NOT ENFORCE. `Stability` withholds a
     * threshold deliberately; a screen is where one gets added back as a helpful word. Both a
     * steady record and a swinging one must come out ungraded.
     */
    for (const [name, decisions] of [
      ["steady", SAID_IT_TWICE()],
      ["swinging", SAID_TWO_THINGS()],
    ] as const) {
      /*
       * The VALUE cells, not the prose. The note beside them is allowed to use the word "יציבות"
       * -- it is there to say this is not a measure of it -- and an assertion over the whole
       * block's text would have been satisfied by that sentence rather than by the design. A
       * grade would arrive as a cell, so the cells are what is checked: every one of them holds a
       * figure or the unit of a figure, and none holds a word about the player.
       */
      const cells = [...stabilityBlock(screen(decisions)).querySelectorAll(".split-row dd")].map(
        (cell) => (cell.textContent ?? "").trim(),
      );
      expect(cells.length, `the ${name} record rendered no value cells`).toBeGreaterThan(0);
      for (const cell of cells)
        expect(cell, `the ${name} record's cell "${cell}" is not a figure`).toMatch(
          /^([+-]?\d+%n=\d+|\d+\.\d\d|שגיאות תקן)$/,
        );
    }
  });

  it("separates a record that repeated itself from one that did not", () => {
    const spread = (decisions: ScoredDecision[]) =>
      readRecord(decisions).stability.spread ?? Number.NaN;
    // The fixture is only worth rendering if the two records genuinely differ underneath.
    expect(spread(SAID_TWO_THINGS())).toBeGreaterThan(spread(SAID_IT_TWICE()));
    for (const decisions of [SAID_IT_TWICE(), SAID_TWO_THINGS()]) {
      const rows = stabilityBlock(screen(decisions)).querySelectorAll(".split-row");
      expect(rows.length, "an unstable record was refused the block a stable one gets").toBe(3);
    }
  });

  it("tells a short record how many decisions the split needs, and shows no distance", () => {
    const block = stabilityBlock(screen(TOO_SHORT()));
    expect(block.querySelectorAll(".split-row").length, "a spread was printed anyway").toBe(0);
    expect(block.textContent).toMatch(new RegExp(String(MIN_STABILITY_HALF * 2)));
    expect(
      block.textContent,
      "the screen stopped saying why a small split cannot mean anything",
    ).toMatch(/לא יכולה להיכשל/);
  });
});
