/**
 * The scale, and the control that chose it.
 *
 * A confidence scale looks like a presentation detail and is not one. It is the instrument's
 * resolution: a player can only ever say one of these things, so whatever the levels cannot
 * express is an error the record attributes to the player. THE POINT OF THIS FILE is that the
 * size of that error is measurable, was measured, and cannot be changed without the number moving
 * here.
 *
 * THE CONTROL, from Erev, Wallsten & Budescu (1994) and Merkle (2009): run a PERFECTLY CALIBRATED
 * player through the instrument and read what the instrument says about them. That player knows
 * its own probability `p` of being accurate in each position exactly -- zero self-knowledge error,
 * which is the whole quantity this product sells -- and its only constraint is having to answer on
 * these levels. Anything the gap prints for it is manufactured by the scale.
 *
 * It is an integral rather than a simulation, and that matters: with no RNG there is no seed to
 * get lucky on, and `E[gap] = E[stated(p)] - E[p]` exactly, because a perfectly calibrated player
 * is accurate with probability p by definition. So `quantisationOffset` below IS the zero point.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CONFIDENCE_CHOICES,
  CONFIDENCE_LABELS,
  CONFIDENCE_LEVELS,
  EVEN_ODDS_LEVEL,
  LEGACY_CONFIDENCE_LEVELS,
  normaliseConfidence,
} from "@shared/confidence";
import { MemoryRecordStore } from "../../server/record";
import { RecordError, commitDecision, type CommitEvent } from "@shared/record-service";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const gridOf = (levels: number) =>
  Array.from({ length: levels }, (_, index) => normaliseConfidence(index + 1, levels));

/* ---- the control ------------------------------------------------------------------------- */

/** log-gamma, so a tightly concentrated difficulty distribution does not overflow the pdf. */
function lgamma(x: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i += 1) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const betaPdf = (p: number, a: number, b: number) =>
  Math.exp((a - 1) * Math.log(p) + (b - 1) * Math.log(1 - p) - (lgamma(a) + lgamma(b) - lgamma(a + b)));

/**
 * What the gap reads for a perfectly calibrated player, on `grid`, facing positions whose
 * difficulty is Beta(mean, concentration). Simpson's rule; the denominator normalises away both
 * the h/3 factor and any truncation in the pdf's tails.
 */
function quantisationOffset(grid: readonly number[], mean: number, concentration: number): number {
  const a = mean * concentration;
  const b = (1 - mean) * concentration;
  const nearest = (p: number) => grid.reduce((x, l) => (Math.abs(l - p) < Math.abs(x - p) ? l : x));
  const N = 20000;
  let num = 0;
  let den = 0;
  for (let i = 0; i <= N; i += 1) {
    const p = Math.min(Math.max(i / N, 1e-12), 1 - 1e-12);
    const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    const f = betaPdf(p, a, b);
    if (!Number.isFinite(f)) continue;
    num += w * f * (nearest(p) - p);
    den += w * f;
  }
  return num / den;
}

/** The worst the gap reads for a perfect player, across plausible difficulty streams. */
function worstReading(grid: readonly number[]): number {
  let worst = 0;
  for (const concentration of [6, 14, 48]) {
    for (const mean of [0.35, 0.45, 0.5, 0.55, 0.65, 0.75, 0.85]) {
      const offset = quantisationOffset(grid, mean, concentration);
      if (Math.abs(offset) > Math.abs(worst)) worst = offset;
    }
  }
  return Math.abs(worst);
}

const linear = (n: number) => Array.from({ length: n }, (_, i) => i / (n - 1));

describe("the scale reads a perfectly calibrated player as calibrated", () => {
  it("prints less than half a point of gap for a player with no error to print", () => {
    /*
     * The number that chose the scale. Everything a real player is told rides on this being small:
     * a headline gap of a few points is meaningless if the instrument manufactures a few points
     * before the player says anything.
     */
    expect(worstReading(gridOf(CONFIDENCE_LEVELS))).toBeLessThan(0.005);
  });

  it("is a real improvement on the five-level scale it replaced, not a rounding of it", () => {
    /*
     * MEASURED: five levels running 0..1 read a perfect player at up to 1.50pp; this reads 0.35pp.
     * Asserted as a ratio rather than two constants so the claim is "materially better" rather
     * than "happens to differ" -- a scale change that improved this by 1% would fail here.
     */
    const now = worstReading(gridOf(CONFIDENCE_LEVELS));
    const before = worstReading(gridOf(LEGACY_CONFIDENCE_LEVELS));
    expect(before).toBeGreaterThan(0.01);
    expect(now * 3).toBeLessThan(before);
  });

  it("owes most of that to the level count and the rest to the inset, in that order", () => {
    /*
     * THE FINDING THAT DECIDED THE GRID, kept executable because it is counter-intuitive and
     * someone will try the obvious repair. The literature's complaint is about the ENDPOINTS --
     * a stated 0 or 1 makes a logarithmic score infinite and leaves a Cox slope undefined -- so
     * the obvious fix is to pull the ends in. Done alone, at five levels, IT IS WORSE.
     *
     * Both effects are real and this holds their order: seven-with-ends already beats five, and
     * insetting seven beats that again.
     */
    const insetFive = [0.1, 0.3, 0.5, 0.7, 0.9];
    expect(worstReading(insetFive)).toBeGreaterThan(worstReading(gridOf(LEGACY_CONFIDENCE_LEVELS)));

    const endedSeven = linear(CONFIDENCE_LEVELS);
    expect(worstReading(endedSeven)).toBeLessThan(worstReading(gridOf(LEGACY_CONFIDENCE_LEVELS)));
    expect(worstReading(gridOf(CONFIDENCE_LEVELS))).toBeLessThan(worstReading(endedSeven));
  });

  it("buys nothing worth having from a ninth level", () => {
    // Cox (1980) put the usable band at 7 plus or minus 2, from a different direction entirely.
    // Nine is not wrong -- it is just not better, and every extra button costs a player a choice.
    const nine = Array.from({ length: 9 }, (_, i) => 0.05 + (i * 0.9) / 8);
    expect(worstReading(nine)).toBeGreaterThan(worstReading(gridOf(CONFIDENCE_LEVELS)) * 0.8);
  });
});

describe("no level asserts certainty", () => {
  it("never reaches 0 or 1, at either end", () => {
    /*
     * Not a hedge. A stated 0 or 1 gives a logarithmic score of infinity and leaves a Cox
     * calibration slope undefined, so NO proper scoring rule can be computed over a record that
     * contains one -- a single such decision poisons the whole reading, permanently.
     */
    const grid = gridOf(CONFIDENCE_LEVELS);
    expect(Math.min(...grid)).toBeGreaterThan(0);
    expect(Math.max(...grid)).toBeLessThan(1);
  });

  it("is evenly spaced and strictly increasing, so a step means the same thing everywhere", () => {
    const grid = gridOf(CONFIDENCE_LEVELS);
    const steps = grid.slice(1).map((value, index) => value - grid[index]);
    for (const step of steps) {
      expect(step).toBeGreaterThan(0);
      expect(step).toBeCloseTo(steps[0], 12);
    }
  });

  it("puts a level exactly on even odds, because a player who has none needs to say so", () => {
    expect(gridOf(CONFIDENCE_LEVELS)).toContain(0.5);
    // And names it, so a fixture planting "no read" does not have to work out which button it is.
    expect(normaliseConfidence(EVEN_ODDS_LEVEL, CONFIDENCE_LEVELS)).toBe(0.5);
  });
});

describe("a stored level is meaningless without the scale it was stated on", () => {
  it("reads the five-level scale exactly as it was stated, and does not restate it", () => {
    /*
     * The record may not rewrite what a player said. A stored 4 from the five-level scale asserted
     * 0.75; on today's grid 4 asserts 0.50. Re-reading those rows on the new grid would move a
     * player's own statement by 25 points without their touching anything.
     */
    expect(gridOf(LEGACY_CONFIDENCE_LEVELS)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(normaliseConfidence(4, LEGACY_CONFIDENCE_LEVELS)).toBe(0.75);
    expect(normaliseConfidence(4, CONFIDENCE_LEVELS)).toBe(0.5);
  });

  it("takes the scale as a required argument rather than assuming one", () => {
    /*
     * Asserted against the source, because a default is invisible at the call site and this is
     * exactly where a silent default would do its damage: a fresh seven-level decision that forgot
     * to pass its scale would be read on the five-level grid and be wrong by up to 25 points, with
     * nothing on screen to show it.
     */
    const source = read("shared/confidence.ts").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(source, "the scale has a default and can be omitted").not.toMatch(
      /export function normaliseConfidence\([^)]*levels[^)]*=/,
    );
  });

  it("refuses a scale it cannot read rather than picking the nearest one", () => {
    expect(() => normaliseConfidence(3, 6)).toThrow(RangeError);
    expect(() => normaliseConfidence(0, CONFIDENCE_LEVELS)).toThrow(RangeError);
    expect(() => normaliseConfidence(CONFIDENCE_LEVELS + 1, CONFIDENCE_LEVELS)).toThrow(RangeError);
    // The case that isolates the LEVEL guard from the SCALE guard: a level that is valid on the
    // current scale but not on the one it claims to have been stated on.
    expect(() => normaliseConfidence(7, LEGACY_CONFIDENCE_LEVELS)).toThrow(RangeError);
  });
});

describe("the words move with the numbers", () => {
  it("gives every level exactly one word, all different", () => {
    /*
     * A ladder whose neighbours are synonyms is a shorter scale with extra buttons, and it would
     * pass every numeric test in this file while a player picks between two words that mean the
     * same thing.
     */
    expect(CONFIDENCE_LABELS).toHaveLength(CONFIDENCE_LEVELS);
    expect(new Set(CONFIDENCE_LABELS).size).toBe(CONFIDENCE_LEVELS);
    for (const label of CONFIDENCE_LABELS) expect(label.trim()).not.toBe("");
  });

  it("offers exactly the levels the scale has, numbered from one", () => {
    expect(CONFIDENCE_CHOICES).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(CONFIDENCE_CHOICES).toHaveLength(CONFIDENCE_LEVELS);
  });

  it("keeps the words a player already learned, at their new positions", () => {
    // Continuity is the reason these five survived the change; the two additions sit either side
    // of the middle, where the old scale had nothing between "leaning" and "likely".
    for (const word of ["ניחוש", "נוטה", "סביר", "בטוח", "ודאי"]) {
      expect(CONFIDENCE_LABELS, `the scale dropped ${word}`).toContain(word);
    }
    expect(CONFIDENCE_LABELS.indexOf("בטוח")).toBe(5);
  });
});

describe("nothing outside the scale module counts the levels", () => {
  it("does not hard-code the column count in the stylesheet", () => {
    /*
     * The count used to live in two places -- the module and `repeat(5, 1fr)` -- so a scale that
     * changed in one rendered wrong in the other with nothing failing. The row now reads the count
     * off its own children.
     */
    // Comments stripped first: the rule explains itself by naming `repeat(5, 1fr)`, and a test
    // that reads the explanation instead of the declaration would fail on its own documentation.
    const css = read("client/src/index.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const row = css.slice(css.indexOf(".confidence-row {"));
    expect(row.slice(0, row.indexOf("}")), "the row still counts its columns by hand").not.toMatch(
      /repeat\(\s*\d+\s*,/,
    );
  });

  it("builds the buttons from the scale rather than a literal list", () => {
    const screen = read("client/src/components/CommitmentScreen.tsx");
    expect(screen).toMatch(/CONFIDENCE_CHOICES\.map/);
    expect(screen, "the picker has its own copy of the levels").not.toMatch(/\[1, 2, 3, 4, 5/);
  });

  it("sends the scale with every commit instead of letting the server guess", () => {
    const session = read("client/src/lib/decision-session.ts");
    expect(session).toMatch(/confidence_scale: CONFIDENCE_LEVELS/);
  });
});

describe("an incoming decision must say which scale it was stated on", () => {
  it("refuses one that does not, rather than assuming the old scale", () => {
    /*
     * THE ASYMMETRY WITH STORED ROWS IS THE POINT. A row already in the record that has no scale
     * was written before the field existed, so its age settles it -- that is a fact, and
     * `scoreDecisions` resolves it to five once, in one place.
     *
     * An arriving commit has no age to appeal to. It is a live client that did not say, and
     * reading its `4` as 0.75 or 0.50 would be a coin toss over what a person actually claimed.
     * Silently guessing would land in the record permanently and be invisible afterwards.
     */
    const store = new MemoryRecordStore();
    const event = {
      decision_id: "11111111-1111-4111-8111-111111111111",
      entry_state: {
        game_id: "g",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ply: 0,
        phase: "opening",
        clock_ms_remaining: null,
      },
      known: "k",
      unknown: "u",
      decision: "e2e4",
      bounded_action: { seconds_taken: 5, confidence: 3, candidate_moves_considered: ["e2e4"] },
      probe: null,
      reveal_timing: null,
      result: null,
      feedback: null,
    } satisfies CommitEvent;

    return expect(commitDecision(store, event)).rejects.toThrow(RecordError);
  });

  it("accepts the same decision once it does", async () => {
    // The other half: without this, a guard that rejected EVERYTHING would pass the test above.
    const store = new MemoryRecordStore();
    const id = "22222222-2222-4222-8222-222222222222";
    await commitDecision(store, {
      decision_id: id,
      entry_state: {
        game_id: "g",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ply: 0,
        phase: "opening",
        clock_ms_remaining: null,
      },
      known: "k",
      unknown: "u",
      decision: "e2e4",
      bounded_action: {
        seconds_taken: 5,
        confidence: 3,
        confidence_scale: CONFIDENCE_LEVELS,
        candidate_moves_considered: ["e2e4"],
      },
      probe: null,
      reveal_timing: null,
      result: null,
      feedback: null,
    } satisfies CommitEvent);
    const atom = await store.getAtom(id);
    expect(atom?.bounded_action.confidence_scale).toBe(CONFIDENCE_LEVELS);
  });
});
