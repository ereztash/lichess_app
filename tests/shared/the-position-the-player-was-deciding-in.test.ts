/**
 * A decision's phase is a fact about the position the player was LOOKING AT.
 *
 * `classifyPhase` reads material off a FEN, and a move changes material. So which FEN you hand
 * it decides the answer, and three surfaces were handing it two different ones:
 *
 *   - `decision-session.ts` classifies `position.fen` -- the position under decision, BEFORE the
 *     move. That is the record, and the detector's three phase buckets read the record.
 *   - `import-diagnostic.ts` classified `game.fens[ply]` -- the position AFTER the move -- two
 *     lines above its own comment saying "the position as the player found it is the one BEFORE
 *     their move", and beside `forced` and `accurate` which both use the before-position.
 *   - `eval-analysis.ts` classified `fens[m.ply]`, likewise after.
 *
 * The two readings diverge on exactly one kind of move: the capture that takes the board across
 * ENDGAME_MATERIAL_THRESHOLD. That is not noise. It is one-directional -- always from middlegame
 * INTO endgame -- so it systematically moves the last decisions of a middlegame into the endgame
 * bucket, and only for players who traded down. A biased misfile of the bucket a claim is scoped
 * by is worse than a random one, because it survives averaging.
 *
 * Worse than either: a record built by importing and a record built by playing filed the same
 * decision differently, and three of the six buckets the detector may look at are phase buckets.
 */
import { describe, expect, it } from "vitest";
import { decisionsFromGame, type ImportedGameInput } from "../../shared/import-diagnostic";
import { analyzeEval } from "../../shared/eval-analysis";
import { classifyPhase, nonPawnMaterial, ENDGAME_MATERIAL_THRESHOLD } from "../../shared/phase";

/** White Ke1 Qh1, Black Ke8 Rh2. Non-pawn material 14, one point above the endgame line. */
const BEFORE = "4k3/8/8/8/8/8/7r/4K2Q w - - 0 13";
/** The same position after Qxh2. Material 9 -- the capture crossed the line. */
const AFTER = "4k3/8/8/8/8/8/7Q/4K3 b - - 0 13";

/** Full starting material, so every earlier ply is unambiguously not an endgame. */
const HEAVY = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** The decisive ply. Odd, so White's; past OPENING_MAX_PLY, so opening is out of the running. */
const PLY = 25;

/**
 * A game whose last White move is that capture.
 *
 * Index i is the position AFTER ply i, which is the indexing both call sites are given. So
 * `fens[PLY - 1]` is what the player saw and `fens[PLY]` is what they produced.
 */
function gameEndingInTheTrade(): ImportedGameInput {
  const fens = Array.from({ length: PLY + 1 }, (_, i) =>
    i < PLY - 1 ? HEAVY : i === PLY - 1 ? BEFORE : AFTER,
  );
  // Flat until the capture, which is scored as a large loss so it is separable in the report.
  const evalScores = Array.from({ length: PLY + 1 }, (_, i) => (i === PLY ? -800 : 0));
  return { fens, evalScores, clockTimes: [], playerColor: "w" };
}

describe("the position the player was deciding in", () => {
  it("is the one whose material decides the phase, not the one the move produced", () => {
    // The fixture only means anything if the two positions really do classify differently.
    expect(nonPawnMaterial(BEFORE)).toBeGreaterThan(ENDGAME_MATERIAL_THRESHOLD);
    expect(nonPawnMaterial(AFTER)).toBeLessThanOrEqual(ENDGAME_MATERIAL_THRESHOLD);
    expect(classifyPhase(BEFORE, PLY)).toBe("middlegame");
    expect(classifyPhase(AFTER, PLY)).toBe("endgame");
  });

  it("is what the import files the decision under", () => {
    const decision = decisionsFromGame(gameEndingInTheTrade()).find((d) => d.ply === PLY);
    expect(decision, `no decision produced at ply ${PLY}`).toBeDefined();
    expect(
      decision!.phase,
      "the import filed the decision by the position the move produced",
    ).toBe("middlegame");
  });

  it("is what the record would have filed the same decision under", () => {
    /*
     * decision-session.ts computes `classifyPhase(position.fen, position.ply)` where `position`
     * is the one under decision. This is that call, on this position. The import must agree with
     * it or the same decision lands in different buckets depending on how it entered the record.
     */
    const asPlayed = classifyPhase(BEFORE, PLY);
    const asImported = decisionsFromGame(gameEndingInTheTrade()).find((d) => d.ply === PLY)?.phase;
    expect(asImported, "playing and importing disagree about one decision's phase").toBe(asPlayed);
  });

  it("is what the game report groups the move's accuracy under", () => {
    /*
     * Every other White move here is scored at zero loss, so middlegame reads exactly 100 while
     * the bad move sits in the endgame group. Counting it where it belongs is what pulls the
     * middlegame mean below 100.
     */
    const { phaseAccuracy } = analyzeEval([...gameEndingInTheTrade().evalScores], "w", PLY, [
      ...gameEndingInTheTrade().fens,
    ]);
    expect(phaseAccuracy, "the report produced no phase grouping").not.toBeNull();
    expect(
      phaseAccuracy!.middlegame,
      "the report grouped the move by the position it produced",
    ).toBeLessThan(100);
  });
});
