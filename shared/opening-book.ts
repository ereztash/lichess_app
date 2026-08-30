/**
 * Whether a position is one players arrive at prepared -- the membership test, without the book.
 *
 * The keys live in `opening-book-keys.ts` and are loaded on demand; this module is the part that
 * has to be cheap enough to sit anywhere. Splitting them is not tidiness: the entry chunk's budget
 * has about two kilobytes of headroom and the key set is roughly nine.
 *
 * WHY THE BOOK EXISTS AT ALL. The import diagnostic's accuracy rate counts nearly every move a
 * player made, which this repository's own ledger calls a known defect in a number currently on
 * screen: `phase-opening` is `ply <= 20`, mostly theory, so it measures recall rather than
 * decisions. Excluding positions with exactly one legal move removes a handful of moves a game and
 * leaves the bulk of the inflation untouched.
 *
 * WHAT THE BOOK CLAIMS, and it is narrower than the word suggests. Not that these positions are
 * easy, and nothing at all about the move the player chose -- a player who leaves theory in a book
 * position has made a decision rather than avoided one. It claims only that reaching the POSITION
 * is common enough that arriving prepared is the norm, which is what a denominator needs;
 * conditioning on the player's move would condition on the outcome.
 */
import { positionKey } from "./position-key.js";

/**
 * 32-bit FNV-1a over the four position-determining FEN fields.
 *
 * NOT A CRYPTOGRAPHIC HASH, deliberately. This is a membership test in a set of a few hundred, and
 * the obvious choice -- sha1 -- is not available synchronously in a browser, which would make every
 * caller async for no gain. The collision rate is measured at build time against every position the
 * reference corpus produced rather than argued from the birthday bound; see BOOK_PROVENANCE.
 *
 * Through `positionKey`, so a transposition into a book position is the same key and the halfmove
 * and fullmove counters -- a record of the game, not of the position -- are dropped.
 */
export function bookKey(fen: string): number {
  const key = positionKey(fen);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The shape a caller passes in, so nothing here has to reach for the key set itself. */
export type BookLookup = (fen: string) => boolean;

/** A lookup over a loaded key set. */
export function bookLookup(keys: ReadonlySet<number>): BookLookup {
  return (fen) => keys.has(bookKey(fen));
}

/**
 * The lookup used when no book has been loaded: nothing is book.
 *
 * Named rather than left as an inline arrow, because "no book available" and "this position is not
 * book" have to be the same answer for a caller and different ones for a reader. The counters the
 * import reports make the difference visible: a run with no book excludes zero positions and says
 * so, instead of quietly reporting a rate as though it had been corrected.
 */
export const NO_BOOK: BookLookup = () => false;
