/**
 * The same board is the same position, whatever the counters say.
 *
 * This is the bug a review reproduced: knights out and back produce four different FEN strings
 * for one board, so the transfer test's "positions you have not decided before" check let the
 * same board in three times. Nothing about the test would have looked wrong.
 */
import { describe, expect, it } from "vitest";
import { positionKey, samePosition } from "../../shared/position-key";

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
