/**
 * A cost, in the unit the evaluation bar has always printed.
 *
 * THE PRODUCT SAID THE SAME QUANTITY IN TWO UNITS ON ONE SCREEN. The bar above the reveal reads
 * `+1.81`, which is pawns; the panel under it read `484 ס״פ`, which is hundredths of the same
 * thing. A reader who wants to know whether those two numbers are about the same position has to
 * do arithmetic the product could have done.
 *
 * AND "ס״פ" IS NOT A WORD ANYONE SAYS. It was rendered in eighteen places and defined in none of
 * them until a gloss was added under one of them; the owner had to ask what it meant. A gloss is
 * the repair you make when you have decided to keep the jargon. This is the other repair.
 *
 * SIGNED FORMATTING IS NOT THIS. `formatEvaluation` renders a POSITION -- side-relative, with a
 * sign, and `#` for a mate. This renders a DIFFERENCE: what a move cost against the best one,
 * which has no side and no sign. Two functions because they are two quantities, and the one time
 * they were one function the mate ceiling leaked into a cost.
 */

/** Hundredths of a pawn, as pawns, at the two decimals the bar already uses. */
export function costInPawns(cp: number): string {
  return (cp / 100).toFixed(2);
}

/** Named once, so a sentence and a test cannot disagree about the word. */
export const PAWN_UNIT = "רגלים";
