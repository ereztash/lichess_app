// @vitest-environment jsdom
/**
 * The screen that reads a player's past games, and the sentence it refuses to write.
 *
 * The failure this guards is not a crash. It is a screen that looks like a diagnosis: six rows of
 * percentages with a confident sentence underneath naming the player's weakness. Every number on
 * it can be correct and the screen can still be dishonest, in three separate ways:
 *
 *   1. by dropping the calibration column, so an accuracy table reads as a calibration report;
 *   2. by omitting the buckets it could not measure, so a partial reading looks complete;
 *   3. by naming the lowest of six numbers as a weakness when the six are within their own
 *      sampling error.
 *
 * The third is the one that needed a new rule rather than a new sentence, and most of this file
 * is about it.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportDiagnosticPanel } from "../../client/src/components/ImportDiagnostic";
import { BUCKETINGS, MIN_BUCKET_N } from "../../shared/detector";
import type { ImportDiagnostic, ImportedBucketReading } from "../../shared/import-diagnostic";

/** A reading assembled directly, so what the screen is given is exactly what the test means. */
function reading(
  rows: Array<Partial<ImportedBucketReading>>,
  over: Partial<ImportDiagnostic> = {},
): ImportDiagnostic {
  const buckets = rows.map((r, i): ImportedBucketReading => ({
    key: BUCKETINGS[i]?.key ?? `b${i}`,
    scope: BUCKETINGS[i]?.scope ?? `bucket ${i}`,
    n: 60,
    accurateRate: 0.6,
    measurable: true,
    unmeasurableReason: null,
    ...r,
  }));
  return {
    buckets,
    scored: buckets.reduce((sum, b) => sum + b.n, 0),
    forced: 0,
    missingClockData: false,
    timeBucketSpeed: null,
    excludedForSpeed: 0,
    speedMix: [],
    ...over,
  };
}

/** Six rows whose rates sit within a couple of points of each other. */
const FLAT = reading([
  { accurateRate: 0.62 }, { accurateRate: 0.61 }, { accurateRate: 0.63 },
  { accurateRate: 0.62 }, { accurateRate: 0.61 }, { accurateRate: 0.62 },
]);

/** One bucket genuinely far below the rest, read over enough decisions to say so. */
const SEPARATED = reading([
  { accurateRate: 0.3, n: 150 }, { accurateRate: 0.78, n: 150 }, { accurateRate: 0.8, n: 150 },
  { accurateRate: 0.79, n: 150 }, { accurateRate: 0.81, n: 150 }, { accurateRate: 0.77, n: 150 },
]);

describe("the column that stays empty", () => {
  it("says the gap is unmeasured for EVERY row, measurable rows included", () => {
    /*
     * The fact this protects, unchanged: a gap missing only from the thin rows would read as
     * "not yet", and a reader must not conclude that the rows carrying an accuracy carry a gap
     * too. Nobody was asked for a confidence in a game already played, so no gap exists to be
     * computed from this data at all -- for any row.
     *
     * What changed is where it is said. It used to be five words repeated into every `li`; it is
     * now one sentence above the table that names the scope out loud.
     */
    render(<ImportDiagnosticPanel diagnostic={SEPARATED} />);
    const note = document.querySelector(".bucket-absent-note");
    expect(note, "the panel no longer states that the gap column is empty at all").not.toBeNull();
    expect(note!.textContent).toMatch(/פער כיול/);
    // "in every row" has to be explicit, because it is no longer demonstrated by repetition.
    expect(note!.textContent).toMatch(/באף שורה/);
    // And it has to reach the rows that DO carry a number, which are the ones at risk of
    // being read as a finished diagnosis.
    expect(note!.textContent).toMatch(/שיש בהן דיוק/);
  });

  it("does not repeat that constant into the rows", () => {
    /*
     * The defect this replaced. `.bucket-absent` rendered inside every `li` at
     * `grid-column: 1 / -1`, so each bucket took two visual rows and the second was identical
     * across all of them -- nine repetitions on the reading that prompted the change. A value
     * that is the same on every row is not data.
     */
    const { container } = render(<ImportDiagnosticPanel diagnostic={SEPARATED} />);
    expect(
      container.querySelectorAll(".bucket-list li .bucket-absent"),
      "the constant is being rendered per row again",
    ).toHaveLength(0);
    // Stated once for the table, not once per bucket.
    expect(container.querySelectorAll(".bucket-absent-note")).toHaveLength(1);
  });

  it("says why the column is empty, and that importing more will not fill it", () => {
    render(<ImportDiagnosticPanel diagnostic={SEPARATED} />);
    const caveat = screen.getByText(/דיוק מהלכים מול המנוע/);
    expect(caveat.textContent).toMatch(/לפני/);
    expect(caveat.textContent).toMatch(/עד שתרשמו החלטות/);
  });
});

describe("every bucket is shown, including the ones it could not read", () => {
  it("renders all six rows when half of them are unmeasurable", () => {
    // A screen that omits what it could not measure looks like a screen that measured everything.
    const half = reading([
      {}, {}, {},
      { measurable: false, accurateRate: null, n: 4, unmeasurableReason: "too-few" },
      { measurable: false, accurateRate: null, n: 0, unmeasurableReason: "no-clock-data" },
      { measurable: false, accurateRate: null, n: 0, unmeasurableReason: "no-clock-data" },
    ]);
    const { container } = render(<ImportDiagnosticPanel diagnostic={half} />);
    // One row per reading it was handed -- the panel omits nothing it was given.
    expect(container.querySelectorAll(".bucket-list li")).toHaveLength(half.buckets.length);
  });

  it("distinguishes a wait from a source that can never supply the field", () => {
    const half = reading([
      { measurable: false, accurateRate: null, n: 4, unmeasurableReason: "too-few" },
      { measurable: false, accurateRate: null, n: 0, unmeasurableReason: "no-clock-data" },
    ]);
    render(<ImportDiagnosticPanel diagnostic={half} />);
    // The wait names the number still needed; the other names the reason and the real fix.
    expect(screen.getByText(new RegExp(`4 החלטות מהסוג הזה, נדרשות ${MIN_BUCKET_N}`))).toBeTruthy();
    const noClock = screen.getByText(/אין נתוני שעון/);
    expect(noClock.textContent).toMatch(/לא יעזור/);
  });
});

describe("the observation, and when there is none", () => {
  it("names the weakest bucket, and the one it beat, both with their n", () => {
    // Scoped to the sentence: the scope also appears in its own row, and an unscoped query would
    // pass on the row alone -- that is, on a screen whose sentence named nothing.
    const { container } = render(<ImportDiagnosticPanel diagnostic={SEPARATED} />);
    const sentence = container.querySelector(".import-observation")!;
    expect(sentence.textContent).toMatch(/הדיוק הנמוך ביותר שנמדד/);
    expect(sentence.querySelector("strong")?.textContent).toBe(BUCKETINGS[0].scope);
    // Both figures, both denominators: the comparison is the claim, so neither half may go bare.
    expect(sentence.querySelectorAll("[data-provenance]")).toHaveLength(2);
    expect(sentence.textContent).toMatch(/n=150/);
  });

  it("names no weakest bucket when the rates are within their own noise", () => {
    /*
     * The load-bearing assertion of the file. FLAT has a minimum -- six measurements always do --
     * and a screen built to fill its slot would print it. This one prints why it will not.
     */
    render(<ImportDiagnosticPanel diagnostic={FLAT} />);
    expect(screen.queryByText(/הדיוק הנמוך ביותר שנמדד/)).toBeNull();
    expect(screen.getByText(/לא נבדל מהשאר/)).toBeTruthy();
  });

  it("separates 'nothing to say' from 'not enough to say it'", () => {
    // Section 4.5: these are different states and must not render the same.
    const thin = reading([{ measurable: false, accurateRate: null, n: 7, unmeasurableReason: "too-few" }]);
    render(<ImportDiagnosticPanel diagnostic={thin} />);
    expect(screen.getByText(new RegExp(`אף סוג לא הגיע ל-${MIN_BUCKET_N}`))).toBeTruthy();
    expect(screen.queryByText(/לא נבדל מהשאר/)).toBeNull();
  });

  it("says nothing was read at all when nothing was", () => {
    render(
      <ImportDiagnosticPanel
        diagnostic={{
          buckets: [],
          scored: 0,
          forced: 0,
          missingClockData: true,
          timeBucketSpeed: null,
          excludedForSpeed: 0,
          speedMix: [],
        }}
      />,
    );
    expect(screen.getByText(/לא נקראה אף החלטה/)).toBeTruthy();
  });

  it("will not call a single readable bucket the worst one", () => {
    const lone = reading([
      { accurateRate: 0.4, n: 90 },
      { measurable: false, accurateRate: null, n: 3, unmeasurableReason: "too-few" },
    ]);
    render(<ImportDiagnosticPanel diagnostic={lone} />);
    expect(screen.getByText(/אין לו למה להשוות/)).toBeTruthy();
  });
});

describe("the forced moves that were dropped", () => {
  it("says how many, out of how many", () => {
    render(<ImportDiagnosticPanel diagnostic={reading([{}], { scored: 812, forced: 47 })} />);
    const note = screen.getByText(/\u05de\u05d4\u05dc\u05da \u05d7\u05d5\u05e7\u05d9 \u05d0\u05d7\u05d3 \u05d1\u05dc\u05d1\u05d3/);
    expect(note.textContent).toContain("47");
    expect(note.textContent).toContain("812");
  });

  it("refuses to imply the rate is now clean", () => {
    /*
     * The half that keeps this honest. Excluding single-legal-move positions removes a handful
     * of moves a game; opening book and recaptures that have a legal alternative are the bulk of
     * the inflation and are still counted. Saying only the first half reads as "fixed".
     */
    render(<ImportDiagnosticPanel diagnostic={reading([{}], { scored: 812, forced: 47 })} />);
    const note = screen.getByText(/\u05de\u05d4\u05dc\u05da \u05d7\u05d5\u05e7\u05d9 \u05d0\u05d7\u05d3 \u05d1\u05dc\u05d1\u05d3/);
    expect(note.textContent, "does not disclaim the book moves it leaves in").toMatch(
      /\u05de\u05d4\u05dc\u05db\u05d9 \u05e1\u05e4\u05e8/,
    );
  });

  it("says nothing when no position was forced", () => {
    const { container } = render(
      <ImportDiagnosticPanel diagnostic={reading([{}], { scored: 812, forced: 0 })} />,
    );
    expect(container.textContent).not.toMatch(/\u05de\u05d4\u05dc\u05da \u05d7\u05d5\u05e7\u05d9 \u05d0\u05d7\u05d3 \u05d1\u05dc\u05d1\u05d3/);
  });
});

describe("the clock buckets were narrowed, and it says so", () => {
  it("names the class it read and the count it left out", () => {
    /*
     * Narrowing without saying so is the quiet failure: the n drops and the reader takes it for
     * "not enough games yet" rather than "this bucket only counted your blitz".
     */
    render(
      <ImportDiagnosticPanel
        diagnostic={reading([{}], { timeBucketSpeed: "blitz", excludedForSpeed: 34 })}
      />,
    );
    const note = screen.getByText(/\u05d4\u05e1\u05d5\u05d2\u05d9\u05dd \u05e9\u05e0\u05d5\u05d2\u05e2\u05d9\u05dd \u05dc\u05d6\u05de\u05df \u05e0\u05e7\u05e8\u05d0\u05d5 \u05e8\u05e7 \u05e2\u05dc \u05de\u05e9\u05d7\u05e7\u05d9/);
    expect(note.textContent).toContain("blitz");
    expect(note.textContent).toContain("34");
  });

  it("says nothing when nothing was left out", () => {
    const { container } = render(
      <ImportDiagnosticPanel
        diagnostic={reading([{}], { timeBucketSpeed: "blitz", excludedForSpeed: 0 })}
      />,
    );
    expect(container.textContent).not.toMatch(/\u05d4\u05e1\u05d5\u05d2\u05d9\u05dd \u05e9\u05e0\u05d5\u05d2\u05e2\u05d9\u05dd \u05dc\u05d6\u05de\u05df \u05e0\u05e7\u05e8\u05d0\u05d5 \u05e8\u05e7/);
  });
});

describe("what this screen must never grow", () => {
  it("renders no target, no baseline and no verdict on the player", async () => {
    /*
     * Asserted against the source, because the failure is a future addition rather than today's
     * output. These are the three shapes that turn a reading into a scorecard, and the brief this
     * screen was built under names them as things not to build.
     */
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/ImportDiagnostic.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["יעד", "בסיס", "ציון כולל", "רמה", "דירוג"]) {
      expect(source, `the diagnostic screen reaches for "${forbidden}"`).not.toContain(forbidden);
    }
  });
});
