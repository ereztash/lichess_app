/**
 * One definition of "phase", not two.
 *
 * `shared/phase.ts` classifies from the position: non-pawn material <= 13 is an endgame, ply <= 20
 * is an opening, everything else is a middlegame. That is the rule the record uses
 * (decision-session.ts), the rule the detector's phase buckets are built on, and the rule
 * docs/MEASUREMENTS.md documents.
 *
 * `shared/eval-analysis.ts` carried a second one: `ply / total` ratio bands. Both were exported
 * from shared/, both were called the phase, and they disagree. It was latent only because nothing
 * rendered `phaseAccuracy` -- which is exactly the kind of thing that stops being latent the
 * moment a screen starts showing phase-bucketed accuracy.
 *
 * The ratio rule also could not be repaired in place. It divides by the game's total length, so
 * the SAME move changes phase depending on how the game later ended. A move's phase should be a
 * fact about that move.
 */
import { describe, expect, it } from "vitest";
import { analyzeEval } from "../../shared/eval-analysis";
import { classifyPhase } from "../../shared/phase";

/** Full material: opening/middlegame by either rule. */
const FULL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** Kings and pawns only -- 0 non-pawn material, so an endgame by the position. */
const BARE = "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1";

const TOTAL_PLIES = 80;
/** The game simplifies at ply 30 and stays simplified. */
const SIMPLIFIES_AT = 30;

/** The rule that used to live in eval-analysis.ts, kept here only to show it disagrees. */
const ratioRule = (ply: number, total: number): "opening" | "middlegame" | "endgame" => {
  const ratio = ply / total;
  if (ratio < 0.25 || ply <= 20) return "opening";
  if (ratio < 0.7) return "middlegame";
  return "endgame";
};

const fens = Array.from({ length: TOTAL_PLIES + 1 }, (_, ply) =>
  ply < SIMPLIFIES_AT ? FULL : BARE,
);

describe("the two rules really did disagree", () => {
  it("splits on a long game that simplifies early", () => {
    // Ply 40: the board holds two kings and sixteen pawns, and the game is only half over.
    expect(classifyPhase(fens[40], 40)).toBe("endgame");
    expect(ratioRule(40, TOTAL_PLIES)).toBe("middlegame");
  });

  it("disagrees across a whole band of the game, not at one boundary", () => {
    const disagreements = Array.from({ length: TOTAL_PLIES + 1 }, (_, ply) => ply).filter(
      (ply) => classifyPhase(fens[ply], ply) !== ratioRule(ply, TOTAL_PLIES),
    );
    // Every ply from the simplification to the ratio rule's own endgame boundary.
    expect(disagreements.length).toBeGreaterThan(20);
  });
});

describe("eval-analysis now follows the record's rule", () => {
  // Alternating scores so both colours have moves with a spread of accuracies.
  const scores = Array.from({ length: TOTAL_PLIES + 1 }, (_, i) => (i % 2 ? 40 : 10));

  it("reports the simplified band as endgame, where the ratio rule said middlegame", () => {
    const analysis = analyzeEval(scores, "w", TOTAL_PLIES, fens);
    expect(analysis.phaseAccuracy).not.toBeNull();
    /*
     * Under the ratio rule the endgame group started at ply 56, so it held 12 of White's moves.
     * Under the position rule it starts at 30 and holds 25. If the two agreed, this assertion
     * could not tell them apart -- which is the point of constructing the divergence.
     */
    const endgameMoves = analysis.playerMoveEvals.filter(
      (m) => classifyPhase(fens[m.ply], m.ply) === "endgame",
    );
    const ratioEndgameMoves = analysis.playerMoveEvals.filter(
      (m) => ratioRule(m.ply, TOTAL_PLIES) === "endgame",
    );
    expect(endgameMoves.length).toBeGreaterThan(ratioEndgameMoves.length);
  });

  it("reports no phase reading at all when it was given no positions", () => {
    // Null, not zeroes. A zero is a measurement; this is an absence, and the two must not render
    // the same. The old code returned {opening: 0, middlegame: 0, endgame: 0} here.
    const analysis = analyzeEval(scores, "w", TOTAL_PLIES);
    expect(analysis.phaseAccuracy).toBeNull();
  });

  it("produces no prose insight at all", async () => {
    /*
     * There used to be an `insights` array here naming a "weakest phase" and an overall accuracy
     * as bare percentages, with no n and no threshold. Nothing ever rendered it, and widening
     * GATE-DENOM over shared/ surfaced six such sentences at once. It is gone, not exempted.
     */
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(process.cwd(), "shared/eval-analysis.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source, "an insights array is back in eval-analysis.ts").not.toMatch(/insights/);
  });
});

describe("only one phase rule is exported from shared/", () => {
  it("leaves no second definition in eval-analysis.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(process.cwd(), "shared/eval-analysis.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // The shape of the rule that was removed: a ratio of ply to game length.
    expect(source, "a ply/total phase rule is back in eval-analysis.ts").not.toMatch(
      /ply\s*\/\s*total/,
    );
    expect(source, "eval-analysis does not use the shared rule").toMatch(/classifyPhase/);
  });
});
