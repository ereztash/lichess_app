/**
 * The same board is the same position, whatever the counters say.
 *
 * This is the bug a review reproduced: knights out and back produce four different FEN strings
 * for one board, so the transfer test's "positions you have not decided before" check let the
 * same board in three times. Nothing about the test would have looked wrong.
 */
import { describe, expect, it } from "vitest";
import { plyFromFen, positionKey, samePosition } from "../../shared/position-key";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("two FENs are the same position when the board and its legal moves are", () => {
  it("ignores the halfmove clock and the fullmove number", () => {
    /*
     * THE REPRODUCTION. Nf3 Nf6 Ng1 Ng8 returns to the start with the counters advanced, and the
     * whole-string comparison this replaces called the result a position nobody had seen.
     */
    expect(samePosition(START, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 3")).toBe(true);
    expect(new Set([START, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 8 5"].map(positionKey)).size).toBe(1);
  });

  it("keeps two boards apart when the side to move differs", () => {
    const black = START.replace(" w ", " b ");
    expect(samePosition(START, black)).toBe(false);
  });

  it("keeps two boards apart when castling rights differ", () => {
    // Same pieces, different legal moves. Merging these would call a decision the player has not
    // faced one they have.
    const noCastling = START.replace("KQkq", "-");
    expect(samePosition(START, noCastling)).toBe(false);
  });

  it("keeps two boards apart when the en-passant square differs", () => {
    /*
     * The field it would be tempting to drop, and the reason not to: en passant is a move that
     * exists in one of these positions and not the other, so the choice a player faces is
     * genuinely different.
     */
    const ep = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2";
    const noEp = ep.replace(" c6 ", " - ");
    expect(samePosition(ep, noEp)).toBe(false);
  });

  it("tolerates extra whitespace without merging anything it should not", () => {
    expect(samePosition(`  ${START}  `, START)).toBe(true);
  });

  it("keys a malformed FEN as itself rather than matching a valid one", () => {
    // A caller holding a broken FEN has a problem this cannot fix and must not hide. Two
    // identical broken ones still match; a broken one never quietly becomes a real position.
    expect(samePosition("nonsense", "nonsense")).toBe(true);
    expect(samePosition("nonsense", START)).toBe(false);
  });
});

describe("the ply a FEN sits at", () => {
  /*
   * The two fields `positionKey` deliberately drops are a record of the GAME, which is exactly
   * what makes them the right source when the question IS about the game. `beginLearningTransfer`
   * needs a ply to keep the opening out of a transfer test, and its candidates are only strings.
   */
  it("counts both half-moves of a full move", () => {
    /*
     * THE HALF THAT WENT UNTESTED. A positive control dropped the side-to-move term entirely and
     * nothing failed -- so the boundary case is pinned directly: `OPENING_MAX_PLY` is 20, which is
     * move 11 for White (ply 20, still opening) and move 11 for Black (ply 21, not).
     */
    expect(plyFromFen("8/8/8/8/8/8/8/8 w - - 0 1")).toBe(0);
    expect(plyFromFen("8/8/8/8/8/8/8/8 b - - 0 1")).toBe(1);
    expect(plyFromFen("8/8/8/8/8/8/8/8 w - - 0 11")).toBe(20);
    expect(plyFromFen("8/8/8/8/8/8/8/8 b - - 0 11")).toBe(21);
  });

  it("reads a missing or malformed fullmove number as the start", () => {
    // Zero classifies as opening, which is the conservative direction for every caller here:
    // the opening is what they exclude, so an unreadable FEN is excluded rather than admitted.
    expect(plyFromFen("8/8/8/8/8/8/8/8 w - -")).toBe(0);
    expect(plyFromFen("nonsense")).toBe(0);
    expect(plyFromFen("8/8/8/8/8/8/8/8 w - - 0 0")).toBe(0);
  });
});
