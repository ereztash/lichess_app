/**
 * When two FENs are the same position.
 *
 * WHY THIS EXISTS. A FEN carries six fields, and the last two -- the halfmove clock and the
 * fullmove number -- are a record of the GAME, not of the POSITION. Two knights out and back
 * produce the identical board, side to move, castling rights and en-passant square, with
 * different counters, so a full-string comparison calls them different positions.
 *
 * That is not a cosmetic difference. The transfer test's entire claim rests on the positions
 * being ones the player has NOT decided before: a rule that "transferred" to a board they had
 * already seen and been told the answer for is measuring recall of that answer. Comparing whole
 * FENs let the same board enter a preregistered test three times, and the test would have looked
 * completely normal from the outside.
 *
 * FOUR FIELDS, NOT THREE OR FIVE. Board, side to move, castling rights and the en-passant square
 * are exactly what determines the legal moves available, which is what makes a position a
 * decision. Dropping the en-passant square would merge two boards that offer different moves;
 * keeping the counters splits one board that offers the same ones.
 */

/**
 * The four position-determining fields of a FEN, normalised for comparison.
 *
 * Not validated: this is a comparison key, and a caller holding a malformed FEN has a problem
 * this function cannot fix and must not hide. A short string keys as itself, so two identical
 * malformed FENs still match each other and a malformed one never silently matches a valid one.
 */
export function positionKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(" ");
}

/** Whether two FENs describe the same position, whatever route the game took to reach it. */
export function samePosition(a: string, b: string): boolean {
  return positionKey(a) === positionKey(b);
}
