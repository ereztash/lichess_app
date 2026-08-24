/**
 * How far a line is backed, and where the reason for a move actually lives.
 *
 * The screen this was built for showed eight PV moves in one flat list under a `D14` chip, on the
 * same panel that says differences under 30 centipawns say nothing. The player reading it asked
 * the right question -- why is it right to play the move the engine names, and where does the
 * line stop meaning something -- and nothing on the screen could answer either.
 */
import { describe, expect, it } from "vitest";
import { pvBacking, rootChoice, type RootLine } from "../../client/src/lib/pv-support";
import { ENGINE_NOISE_CP } from "../../client/src/lib/reveal";

/** The line from the panel the player was looking at. */
const REAL_PV = ["h5", "Qh4", "Ng6", "Bxe5", "Nxh4", "Bxc7", "Rh6", "Bg3"];

describe("what the depth actually covers", () => {
  it("gives each move the depth left below it, not the root's", () => {
    // The whole misreading in one assertion: D14 is the ROOT's depth. The eighth move of the
    // line had seven plies under it, and the panel printed both in the same typeface.
    const { backed } = pvBacking(REAL_PV, 14);
    expect(backed[0].remainingDepth).toBe(14);
    expect(backed[7].remainingDepth).toBe(7);
  });

  it("keeps the whole line when the depth covers it", () => {
    // Honest about its own bite: at D14 an eight-move PV is entirely inside the search, so the
    // cut does nothing here and the fall-off is carried by the per-ply number instead.
    const { backed, dropped } = pvBacking(REAL_PV, 14);
    expect(backed).toHaveLength(REAL_PV.length);
    expect(dropped).toBe(0);
  });

  it("drops the moves that outran the search", () => {
    /*
     * Not hypothetical: extensions and the transposition table both hand back PV moves the depth
     * counter never paid for, so a PV longer than its depth is ordinary. Those moves have
     * nothing behind them and were rendered at full weight.
     */
    const long = [...REAL_PV, "a4", "a5", "b4", "b5"];
    const { backed, dropped } = pvBacking(long, 8);
    expect(backed).toHaveLength(8);
    expect(dropped).toBe(4);
    expect(backed.at(-1)!.remainingDepth).toBe(1);
  });

  it("uses a cut that needs no invented threshold", () => {
    // remainingDepth <= 0 is the point where the line outran the search. Any other cutoff would
    // be a quality bar nobody in this repository has measured.
    const { backed } = pvBacking(["a", "b", "c"], 1);
    expect(backed).toHaveLength(1);
  });

  it("says nothing at all about an empty line", () => {
    expect(pvBacking([], 14)).toEqual({ backed: [], dropped: 0, rootDepth: 14 });
  });
});

const line = (move: string, scoreCp: number, mate?: number): RootLine => ({ move, scoreCp, mate });

describe("what the engine's choice is worth", () => {
  it("calls a difference inside evaluation noise a preference, not a reason", () => {
    /*
     * The load-bearing case, and the player's actual position: -0.44 at depth 14 with the panel
     * already saying differences under 30cp say nothing. A screen with a line and a number and
     * no third state gets read as "this move is right". It is not; the engine broke a tie.
     */
    const choice = rootChoice([line("h7h5", -44), line("e5f5", -56)]);
    expect(choice!.kind).toBe("preference");
    expect(choice).toMatchObject({ gapCp: 12 });
  });

  it("calls a difference outside the noise a reason, and says how big", () => {
    const choice = rootChoice([line("h7h5", 40), line("e5f5", -160)]);
    expect(choice!.kind).toBe("reason");
    expect(choice).toMatchObject({ gapCp: 200 });
  });

  it("splits the two exactly at the threshold the rest of the app uses", () => {
    // Reusing ENGINE_NOISE_CP rather than picking a second number: two thresholds for "inside
    // noise" in one product is how a panel ends up contradicting the sentence beside it.
    expect(rootChoice([line("a", 0), line("b", -ENGINE_NOISE_CP)])!.kind).toBe("preference");
    expect(rootChoice([line("a", 0), line("b", -ENGINE_NOISE_CP - 1)])!.kind).toBe("reason");
  });

  it("refuses to give a centipawn gap when either line is a forced mate", () => {
    // parseInfo encodes mate as ±10000, so subtracting would produce a confident five-figure
    // "gap" that is not a quantity of anything.
    expect(rootChoice([line("a", 10000, 3), line("b", 120)])!.kind).toBe("mate");
    expect(rootChoice([line("a", 120), line("b", -10000, -2)])!.kind).toBe("mate");
  });

  it("says there is nothing to compare when only one line came back", () => {
    expect(rootChoice([line("a", 40)])!.kind).toBe("alone");
  });

  it("returns null on no lines at all rather than inventing a best", () => {
    expect(rootChoice([])).toBeNull();
  });

  it("never reports the engine's own choice as the worse one", () => {
    // A negative gap would be a parsing bug wearing the costume of a finding.
    const choice = rootChoice([line("a", -10), line("b", 50)]);
    expect(choice).toMatchObject({ gapCp: 0 });
    expect(choice!.kind).toBe("preference");
  });
});
