// @vitest-environment jsdom
/**
 * The panel the player was reading when they asked the question this was built for.
 *
 * It showed `h5 Qh4 Ng6 Bxe5 Nxh4 Bxc7 Rh6 Bg3` under a `D14` chip, beside a note saying
 * differences under 30 centipawns say nothing here, and beside a question asking what they would
 * have needed to know to choose between two moves. Three things were wrong at once: D14 is the
 * root's depth and was applied visually to all eight moves, the display cut at eight without
 * saying so, and nothing on the screen compared the recommended move to the alternative.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisPanel } from "../../client/src/components/AnalysisPanel";
import type { EngineLine, EngineStatus } from "../../client/src/lib/engine-line";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const READY: EngineStatus = { mode: "ready", detail: "מוכן" };

const line = (over: Partial<EngineLine> = {}): EngineLine => ({
  scoreCp: 30,
  depth: 14,
  pv: ["e2e4", "e7e5", "g1f3", "b8c6"],
  fen: FEN,
  ...over,
});

function panel(over: { analysis?: EngineLine | null; alternative?: EngineLine | null } = {}) {
  return render(
    <AnalysisPanel
      analysis={over.analysis === undefined ? line() : over.analysis}
      alternative={over.alternative}
      status={READY}
      fen={FEN}
      material={{ white: 39, black: 39 }}
      onAnalyze={() => {}}
    />,
  );
}

describe("the depth behind each move", () => {
  it("shows the remaining depth per move, not the root's on all of them", () => {
    const { container } = panel();
    const depths = [...container.querySelectorAll(".pv-depth")].map((n) => n.textContent);
    expect(depths).toEqual(["14", "13", "12", "11"]);
  });

  it("says out loud that the chip is the root's depth", () => {
    panel();
    expect(screen.getByText(/העומק בשורש בלבד/)).toBeTruthy();
  });

  it("drops the moves that outran the search, and says how many", () => {
    // A PV longer than its depth is ordinary -- extensions and the transposition table both hand
    // back moves the depth counter never paid for. They were rendered at full weight.
    const { container } = panel({
      analysis: line({ depth: 2, pv: ["e2e4", "e7e5", "g1f3", "b8c6"] }),
    });
    expect(container.querySelectorAll(".pv-depth")).toHaveLength(2);
    expect(screen.getByText(/חרגו מעומק החיפוש/)).toBeTruthy();
  });

  it("separates 'ran out of search' from 'ran out of room'", () => {
    /*
     * These were the same silent cut: sanPrincipalVariation sliced at 8 and nothing said so, so
     * a line that ENDED and a line that was trimmed to fit looked identical.
     */
    const long = Array.from({ length: 12 }, (_, i) => ["e2e4", "e7e5", "g1f3", "b8c6"][i % 4]);
    panel({ analysis: line({ depth: 20, pv: long }) });
    expect(screen.getByText(/לא הוצגו מחוסר מקום/)).toBeTruthy();
    expect(screen.queryByText(/חרגו מעומק החיפוש/)).toBeNull();
  });
});

describe("why this move and not the other", () => {
  it("calls a difference inside the noise a preference rather than a reason", () => {
    /*
     * The player's actual position: -0.44 at depth 14, with the panel already saying differences
     * under 30cp say nothing. A line and a number and no third state reads as "this is right".
     */
    panel({
      analysis: line({ scoreCp: -44, pv: ["h7h5", "d1h5"] }),
      alternative: line({ scoreCp: -56, pv: ["e5f5", "d1h5"] }),
    });
    const reading = screen.getByText(/העדפה, לא סיבה/);
    expect(reading.textContent).toContain("h7h5");
    expect(reading.textContent).toContain("e5f5");
    expect(reading.textContent).toContain("12");
  });

  it("calls a difference outside the noise a reason, with the size of it", () => {
    panel({
      analysis: line({ scoreCp: 40, pv: ["h7h5"] }),
      alternative: line({ scoreCp: -160, pv: ["e5f5"] }),
    });
    expect(screen.getByText(/זו סיבה/).textContent).toContain("200");
  });

  it("says it has nothing to compare when only one line was computed", () => {
    panel({ alternative: null });
    expect(screen.getByText(/אין למהלך הזה מול מה להישקל/)).toBeTruthy();
  });

  it("refuses a centipawn gap when a line is a forced mate", () => {
    panel({
      analysis: line({ scoreCp: 10000, mate: 3, pv: ["h7h5"] }),
      alternative: line({ scoreCp: 120, pv: ["e5f5"] }),
    });
    expect(screen.getByText(/אינו כמות של סנטיפונים/)).toBeTruthy();
  });

  it("ignores an alternative computed for a different position", () => {
    /*
     * The bug this prevents, and the reason the guard is structural rather than a convention:
     * Home has eight setAnalysis sites and one of them sets the alternative. A leftover runner-up
     * from the previous position would produce a confident, entirely fictional gap.
     */
    panel({
      analysis: line({ scoreCp: -44, pv: ["h7h5"] }),
      alternative: line({ scoreCp: -900, pv: ["e5f5"], fen: "8/8/8/8/8/8/8/K6k w - - 0 1" }),
    });
    expect(screen.queryByText(/856/)).toBeNull();
    expect(screen.getByText(/אין למהלך הזה מול מה להישקל/)).toBeTruthy();
  });
});

describe("nothing to say", () => {
  it("renders no reading at all before a position has been analysed", () => {
    const { container } = panel({ analysis: null });
    expect(container.querySelector(".pv-choice")).toBeNull();
    expect(container.querySelectorAll(".pv-depth")).toHaveLength(0);
  });
});
