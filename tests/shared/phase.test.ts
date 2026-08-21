import { describe, expect, it } from "vitest";
import { classifyPhase, nonPawnMaterial } from "../../shared/phase";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BARE_ROOKS = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";

describe("phase classification", () => {
  it("counts non-pawn material, ignoring kings and pawns", () => {
    // Per side: 2 knights + 2 bishops + 2 rooks + queen = 3+3+3+3+5+5+9 = 31, doubled = 62
    expect(nonPawnMaterial(START)).toBe(62);
    expect(nonPawnMaterial(BARE_ROOKS)).toBe(5);
  });

  it("calls the opening by ply while material is full", () => {
    expect(classifyPhase(START, 0)).toBe("opening");
    expect(classifyPhase(START, 20)).toBe("opening");
  });

  it("crosses to middlegame past the ply ceiling", () => {
    expect(classifyPhase(START, 21)).toBe("middlegame");
  });

  it("lets material override ply -- a stripped board is an endgame on move 1", () => {
    expect(classifyPhase(BARE_ROOKS, 2)).toBe("endgame");
  });
});
