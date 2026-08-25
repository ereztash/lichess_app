// @vitest-environment jsdom
/**
 * Engine output that is not a centipawn quantity, read as centipawns.
 *
 * Two shapes of it reached the live reveal, and both fed `accurate` -- the flag every bucket
 * rate, every confidence row and the calibration gap itself are computed from.
 *
 *   1. A FORCED MATE. UCI reports `score mate N`, and the parser stores `N * 10000` in
 *      `scoreCp`. That is an ordering, not a magnitude, and it makes a mate in nine score HIGHER
 *      than a mate in eight -- so every step toward mate looked like a 10000-centipawn blunder,
 *      and every step deeper into being mated looked free.
 *   2. NO EVALUATION AT ALL. A terminal position has no legal reply and therefore no principal
 *      variation, so `analyze` resolves with `emptyLine` -- `scoreCp: 0` -- rather than
 *      rejecting. Read as an evaluation, that charges the player their entire advantage for
 *      ending the game.
 *
 * Both errors are directional, and they point the same way. The first lands on moves stated at
 * high confidence and marks them wrong; the second lands on the best move of a won game. Both
 * inflate the measured gap between stated confidence and realised accuracy, and both concentrate
 * where mates happen, which is a phase the detector has a bucket for.
 *
 * WHAT THE FIX IS NOT. It is not a conversion. There is no centipawn value of "mate in nine";
 * MATE_SCORE is a stated ceiling, the mate distance is discarded, and the reveal says so in
 * words rather than leaving a reader to infer it from a suspiciously round number.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealPanel } from "@/components/RevealPanel";
import {
  MATE_SCORE,
  comparableCp,
  emptyLine,
  hasEvaluation,
  parseAnyInfo,
  type EngineLine,
} from "@/lib/engine-line";
import { toWhitePerspective } from "@/lib/batch-analysis";
import { cpLossFromSearches, cpLossOfFinalMove } from "@/lib/decision-session";
import { ACCURATE_CP_LOSS } from "@shared/detector";
import { MATE_SCORE as SHARED_MATE_SCORE, inferenceLimits, type RevealInputs } from "@shared/reveal";

const WHITE_TO_MOVE = "8/8/8/8/8/8/4K3/4k3 w - - 0 1";
const BLACK_TO_MOVE = "8/8/8/8/8/8/4K3/4k3 b - - 0 1";

/** Built by the SHIPPED parser from a real UCI line, not hand-assembled. */
const line = (score: string, fen = WHITE_TO_MOVE): EngineLine =>
  parseAnyInfo(`info depth 14 score ${score} multipv 1 pv e2e4 e7e5`, fen)!;

const accurate = (cpLoss: number) => cpLoss <= ACCURATE_CP_LOSS;

describe("a mate score is an ordering, not a magnitude", () => {
  it("is worth the same clamp at every distance", () => {
    /*
     * The whole defect in one assertion. Before this, `comparableCp` did not exist and callers
     * read `scoreCp`, which the parser fills with distance * 10000 -- so mate in 9 and mate in 2
     * differed by seventy thousand "centipawns" while describing the same fact: this is won.
     */
    expect(comparableCp(line("mate 9"))).toBe(MATE_SCORE);
    expect(comparableCp(line("mate 2"))).toBe(MATE_SCORE);
    expect(comparableCp(line("mate 1"))).toBe(MATE_SCORE);
    expect(comparableCp(line("mate -9"))).toBe(-MATE_SCORE);
    expect(comparableCp(line("mate -1"))).toBe(-MATE_SCORE);
  });

  it("treats `mate 0` as the side to move having been mated, not as dead level", () => {
    /*
     * `Math.sign(0)` is 0, and the previous clamp in batch-analysis was exactly that -- so a
     * position where the side to move is ALREADY checkmated evaluated to 0.00, in the direction
     * that flatters whoever just got mated. UCI emits `mate 0` for it.
     */
    expect(comparableCp(line("mate 0"))).toBe(-MATE_SCORE);
    expect(comparableCp(line("mate 0"))).not.toBe(0);
  });

  it("leaves an ordinary centipawn score exactly alone", () => {
    expect(comparableCp(line("cp 40"))).toBe(40);
    expect(comparableCp(line("cp -1250"))).toBe(-1250);
    expect(comparableCp(line("cp 0"))).toBe(0);
  });
});

describe("the mate cases that were scored backwards", () => {
  it("does not charge the player for playing the fastest mate", () => {
    /*
     * Delivering mate in 9: the player is to move and the engine says `mate 9`. They play the
     * best move, so the opponent now faces `mate -8`. Measured against the shipped code before
     * this fix: cp_loss 10000, classified inaccurate -- on a move that forces mate.
     */
    const loss = cpLossFromSearches(line("mate 9"), line("mate -8", BLACK_TO_MOVE));
    expect(loss, "playing the engine's own mating move was charged for it").toBe(0);
    expect(accurate(loss)).toBe(true);
  });

  it("does not charge for a mate at any distance, near or far", () => {
    expect(cpLossFromSearches(line("mate 2"), line("mate -1", BLACK_TO_MOVE))).toBe(0);
    expect(cpLossFromSearches(line("mate 30"), line("mate -29", BLACK_TO_MOVE))).toBe(0);
  });

  it("still charges the full clamp for throwing a forced mate away", () => {
    // Mate in 9 available; the player instead reaches a merely winning +11.01 position. That is
    // a real loss and has to stay one: the clamp must not flatten mate into "winning".
    const loss = cpLossFromSearches(line("mate 9"), line("cp -1101", BLACK_TO_MOVE));
    expect(loss).toBe(MATE_SCORE - 1101);
    expect(accurate(loss)).toBe(false);
  });

  it("still charges for walking into a mate from a quiet position", () => {
    const loss = cpLossFromSearches(line("cp 40"), line("mate 5", BLACK_TO_MOVE));
    expect(loss).toBe(40 + MATE_SCORE);
    expect(accurate(loss)).toBe(false);
  });

  it("stops crediting the player for accelerating their own mate", () => {
    /*
     * The mirror of the first case and the more dangerous one, because it produces a false
     * SUCCESS. Being mated in 4, the player picks a move that lets it land immediately. Before
     * this fix: -40000 against -10000 clamps to a loss of zero, so the record scored it ACCURATE
     * -- a decision typically stated at low confidence, marked right.
     *
     * Under the clamp it is zero for a different and defensible reason: mated by force is mated
     * by force, and no legal move was better. The number is the same and the basis is not, which
     * is why the reveal names the clamp rather than printing a bare 0.
     */
    const loss = cpLossFromSearches(line("mate -4"), line("mate 1", BLACK_TO_MOVE));
    expect(loss).toBe(0);
  });

  it("leaves every ordinary centipawn comparison untouched", () => {
    // The regression that would matter most: this path carries every non-mate decision.
    expect(cpLossFromSearches(line("cp 40"), line("cp -40", BLACK_TO_MOVE))).toBe(0);
    expect(cpLossFromSearches(line("cp 40"), line("cp 60", BLACK_TO_MOVE))).toBe(100);
    expect(cpLossFromSearches(line("cp -150"), line("cp 400", BLACK_TO_MOVE))).toBe(250);
  });
});

describe("the two engine paths no longer disagree about the same move", () => {
  it("scores a delivered mate the same way live and on import", () => {
    /*
     * THE FINDING THAT MADE THIS ONE CHANGE RATHER THAN TWO. The import scan clamped mate to a
     * fixed ±10000 and the live reveal multiplied the distance by 10000, so the identical engine
     * output on the identical move came out ACCURATE on one screen and a 10000-centipawn blunder
     * on the other. Two conventions in one product is not a convention.
     */
    const before = line("mate 9", WHITE_TO_MOVE);
    const after = line("mate -8", BLACK_TO_MOVE);

    const live = cpLossFromSearches(before, after);
    // The import path is White-relative and differences it consecutively; ply 1 is White's move.
    const scan = Math.max(
      0,
      toWhitePerspective(before, WHITE_TO_MOVE) - toWhitePerspective(after, BLACK_TO_MOVE),
    );

    expect(scan, "the two engine paths score the same move differently").toBe(live);
    expect(accurate(live)).toBe(accurate(scan));
  });

  it("reads one constant, so the two cannot drift apart again", () => {
    expect(MATE_SCORE).toBe(SHARED_MATE_SCORE);
  });
});

describe("no evaluation is not an evaluation of zero", () => {
  it("tells the sentinel apart from a real dead-level score", () => {
    /*
     * `emptyLine` carries `scoreCp: 0`, which is indistinguishable from a genuine 0.00 by
     * arithmetic alone. `pv` is the witness: the parser refuses any line without a principal
     * variation, so a non-empty pv cannot come from anywhere but a real evaluation.
     */
    expect(hasEvaluation(emptyLine(WHITE_TO_MOVE))).toBe(false);
    expect(hasEvaluation(line("cp 0"))).toBe(true);
    expect(emptyLine(WHITE_TO_MOVE).scoreCp, "the sentinel and 0.00 share a number").toBe(
      line("cp 0").scoreCp,
    );
  });

  it("charges nothing for the move that ended the game in checkmate", () => {
    /*
     * Delivering mate from a won position used to cost the player their whole advantage: the
     * position after the mating move has no legal reply, so `analyze` resolved with `emptyLine`,
     * and +5.00 against a fabricated 0.00 is a 500-centipawn blunder on the best move of the
     * game. Nothing outscores mate, so the loss is zero -- from the rules, not from the engine.
     */
    expect(cpLossOfFinalMove(line("cp 500"), "checkmate")).toBe(0);
    expect(cpLossOfFinalMove(line("mate 1"), "checkmate")).toBe(0);
    expect(cpLossOfFinalMove(line("cp -900"), "checkmate")).toBe(0);
  });

  it("charges the winning player for a move that ended the game in a draw", () => {
    // Stalemate, repetition, fifty moves, insufficient material: the position really is 0.00, so
    // this is the ordinary comparison against a genuine zero rather than a fabricated one.
    expect(cpLossOfFinalMove(line("cp 500"), "draw")).toBe(500);
    expect(cpLossOfFinalMove(line("mate 3"), "draw")).toBe(MATE_SCORE);
  });

  it("charges nothing to a player who was losing and drew", () => {
    // Never negative, same rule as everywhere else: a player who was worse and reached a draw did
    // not find a move better than the engine's, they found the engine's.
    expect(cpLossOfFinalMove(line("cp -300"), "draw")).toBe(0);
  });
});

describe("the reveal says which distance the number threw away", () => {
  const inputs = (over: Partial<RevealInputs> = {}): RevealInputs => ({
    depth: 20,
    cpLoss: 0,
    chosenMove: "e2e4",
    bestMove: "e2e4",
    chosenWasBest: true,
    confidence: 4,
    statedUnknown: "לא ברור",
    decisionsOnRecord: 12,
    candidatesConsidered: ["e2e4"],
    ...over,
  });

  it("names the ceiling and the discarded distance, before any number", () => {
    /*
     * Section 4.4: a value carries its source. "0 ס״פ" on a mating move means "nothing was
     * better than this" and NOT "this move changed nothing", and the two read identically. The
     * limits list is where the reveal is allowed to say so -- step 1, ahead of the numbers.
     */
    const limits = inferenceLimits(inputs({ clampedMate: true }));
    const said = limits.join(" ");
    expect(said, "the clamp is applied and never disclosed").toMatch(/מט כפוי/);
    expect(said).toContain(String(MATE_SCORE));
    expect(said, "the discarded quantity is not named").toMatch(/המרחק למט/);
  });

  it("says nothing of the kind when the score really was centipawns", () => {
    // Section 4.5 in the other direction: a sentence that fires on every reveal carries no
    // information, and one that claims a clamp that was not applied is simply false.
    expect(inferenceLimits(inputs()).join(" ")).not.toMatch(/מט כפוי/);
    expect(inferenceLimits(inputs({ clampedMate: false })).join(" ")).not.toMatch(/מט כפוי/);
  });

  it("keeps the limits list ahead of everything, clamp or no clamp", () => {
    // The list is never empty (one decision is one decision), and the clamp sentence is an
    // addition to it rather than a replacement for it.
    expect(inferenceLimits(inputs({ clampedMate: true })).length).toBeGreaterThan(1);
  });
});

describe("the rendered cost distinguishes a measurement from a ceiling", () => {
  const INPUTS: RevealInputs = {
    depth: 20,
    cpLoss: 0,
    chosenMove: "e2e4",
    bestMove: "e2e4",
    chosenWasBest: true,
    confidence: 5,
    statedUnknown: "לא ברור",
    decisionsOnRecord: 40,
    candidatesConsidered: ["e2e4"],
  };
  const panel = (over: Partial<RevealInputs> = {}) =>
    render(
      <RevealPanel
        inputs={{ ...INPUTS, ...over }}
        analysis={null}
        fen={WHITE_TO_MOVE}
        statedKnown="המלך חשוף"
      />,
    );

  it("marks the number as measured against the mate ceiling", () => {
    /*
     * Section 4.5, at the place the two states are least distinguishable. A clamped zero means
     * "nothing was better than this"; an unclamped zero means "this move changed nothing". Same
     * digit, opposite readings, and the unit is the only thing on screen that can separate them.
     */
    const { container } = panel({ clampedMate: true });
    const cost = [...container.querySelectorAll(".reveal-metric")].find((el) =>
      el.textContent?.includes("עלות ההחלטה"),
    )!;
    expect(cost.textContent, "a clamped cost renders as a plain measurement").toMatch(/תקרת מט/);
  });

  it("says nothing about a ceiling when the score was centipawns", () => {
    const { container } = panel({ cpLoss: 180 });
    const cost = [...container.querySelectorAll(".reveal-metric")].find((el) =>
      el.textContent?.includes("עלות ההחלטה"),
    )!;
    expect(cost.textContent).toContain("180");
    expect(cost.textContent).not.toMatch(/תקרת מט/);
  });
});

describe("the live reveal path asks the rules before it asks the engine", () => {
  /*
   * Asserted against the source, the same way `import-reading-kept.test.tsx` pins ImportGames'
   * injected slot. `Home.tsx` mounts the whole application -- the board, the engine bridge, tRPC,
   * the record -- so there is no proportionate way to drive one branch of its reveal through a
   * render. What can be pinned cheaply is that the three guards are still wired in, because each
   * one silently degrades to the old fabricated number if it is dropped.
   */
  const source = () =>
    import("node:fs/promises").then((fs) => fs.readFile("client/src/pages/Home.tsx", "utf8"));

  it("skips the second search when the move ended the game", async () => {
    const src = await source();
    expect(src, "a terminal position is handed to the engine again").toMatch(
      /isCheckmate\(\)\s*\?\s*"checkmate"\s*:\s*after\.isGameOver\(\)\s*\?\s*"draw"\s*:\s*null/,
    );
    expect(src).toMatch(/cpLossOfFinalMove\(best, ended\)/);
  });

  it("refuses to build a reveal on a search that returned nothing", async () => {
    const src = await source();
    expect(src, "an empty search is read as an evaluation of zero again").toMatch(
      /if \(!hasEvaluation\(best\) \|\| \(chosen !== null && !hasEvaluation\(chosen\)\)\)/,
    );
  });

  it("carries the clamp to the screen and stores the clamped eval, not the mate distance", async () => {
    const src = await source();
    expect(src).toMatch(/clampedMate: best\.mate !== undefined \|\| chosen\?\.mate !== undefined/);
    expect(src, "the record keeps the mate distance as if it were centipawns").toMatch(
      /engine_eval_cp: comparableCp\(best\)/,
    );
    expect(src).not.toMatch(/engine_eval_cp: best\.scoreCp/);
  });
});
