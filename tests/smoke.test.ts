import { describe, expect, it } from "vitest";
import { buildHistory, uciToSquares } from "@/lib/game-data";

describe("test harness", () => {
  it("resolves the @ alias and runs chess.js", () => {
    const history = buildHistory("1. e4 e5 2. Nf3 *");
    expect(history).toHaveLength(3);
    expect(history[0].san).toBe("e4");
  });

  it("parses uci squares", () => {
    expect(uciToSquares("d2d4")).toEqual({ from: "d2", to: "d4" });
    expect(uciToSquares("(none)")).toBeUndefined();
  });
});
