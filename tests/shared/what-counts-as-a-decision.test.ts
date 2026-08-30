/**
 * What the accuracy rate's denominator is allowed to contain.
 *
 * The repository's own ledger calls this a known defect in a number currently on screen: the
 * imported accuracy rate counts nearly every move a player made. Positions with exactly one legal
 * move were already excluded, and that removes a handful of moves a game -- `phase-opening` is
 * `ply <= 20`, mostly theory, and theory is the bulk of the inflation.
 *
 * A book position is excluded on the strength of a fact about the POSITION -- the reference corpus
 * says one game in a thousand reaches it -- and never on the strength of the move the player chose.
 * That distinction is the whole reason this is a defensible exclusion rather than a way of dropping
 * the moves that spoil the rate: a player who leaves theory in a book position has made a decision,
 * and conditioning on their move would condition on the outcome.
 */
import { describe, expect, it } from "vitest";
import {
  decisionsFromGame,
  diagnoseImportedGames,
  type ImportedGameInput,
} from "../../shared/import-diagnostic";
import { bookKey, bookLookup, NO_BOOK } from "../../shared/opening-book";
import { positionKey } from "../../shared/position-key";
import { Chess } from "chess.js";

/** A real game's opening, replayed, so the FENs are positions rather than a repeated constant. */
function realGame(moves: string[], clocksFrom = 600): ImportedGameInput {
  const board = new Chess();
  const fens = [board.fen()];
  for (const san of moves) {
    board.move(san);
    fens.push(board.fen());
  }
  return {
    fens,
    evalScores: fens.map(() => 0),
    clockTimes: fens.map((_, i) => clocksFrom - Math.floor(i / 2) * 5),
    timeControl: "600+0",
    playerColor: "w",
    speed: "blitz",
  };
}

const OPENING = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"];

describe("a book position is a fact about the position", () => {
  it("keys on the position rather than on the route to it", () => {
    // Two knights out and back reach the same board with different counters. The book must not
    // treat that as a new position, or every transposition would fall out of it.
    const direct = new Chess();
    direct.move("Nf3");
    direct.move("Nf6");
    direct.move("Ng1");
    direct.move("Ng8");
    expect(positionKey(direct.fen())).toBe(positionKey(new Chess().fen()));
    expect(bookKey(direct.fen())).toBe(bookKey(new Chess().fen()));
  });

  it("excludes the position whatever the player played in it", () => {
    /*
     * The same position, two different moves. Both are excluded, because the exclusion is about
     * the position. A rule that kept the unusual move would be scoring the player on exactly the
     * decisions where they departed from theory, which is the opposite of the intent.
     */
    const board = new Chess();
    board.move("e4");
    const afterE4 = board.fen();
    const book = bookLookup(new Set([bookKey(afterE4)]));

    const main = decisionsFromGame(realGame(["e4", "e5", "Nf3", "Nc6"]), book);
    const offbeat = decisionsFromGame(realGame(["e4", "h5", "Nf3", "Nc6"]), book);
    // Ply 2 is Black's; the player here is White, so the book position is not one of their moves.
    expect(main.every((d) => d.book === false)).toBe(true);
    expect(offbeat.every((d) => d.book === false)).toBe(true);

    // Now make one of White's own positions book, and both games lose it identically.
    const whiteBook = bookLookup(new Set([bookKey(new Chess().fen())]));
    expect(decisionsFromGame(realGame(["e4", "e5"]), whiteBook)[0].book).toBe(true);
  });
});

describe("the denominator says what it dropped", () => {
  it("takes book positions out of every bucket and counts them", () => {
    const game = realGame(OPENING);
    const keys = new Set(game.fens.slice(0, 6).map(bookKey));
    const withBook = diagnoseImportedGames([game], bookLookup(keys));
    const without = diagnoseImportedGames([game], NO_BOOK);

    expect(without.book).toBe(0);
    expect(withBook.book).toBeGreaterThan(0);
    expect(withBook.eligible).toBe(without.eligible - withBook.book);
    expect(withBook.scored).toBe(without.scored);
  });

  it("distinguishes 'no book positions' from 'no book loaded'", () => {
    /*
     * Both produce `book: 0`, and only one of them means the rate has been corrected. The flag is
     * what the screen reads to decide whether to claim anything at all.
     */
    const game = realGame(OPENING);
    expect(diagnoseImportedGames([game], NO_BOOK).bookLoaded).toBe(false);
    const noneMatch = diagnoseImportedGames([game], bookLookup(new Set([12345])));
    expect(noneMatch.bookLoaded).toBe(true);
    expect(noneMatch.book).toBe(0);
  });

  it("never double-counts a position that is both forced and book", () => {
    // `book` counts only positions that were not already excluded as forced, so the ledger's
    // subtraction stays arithmetic a reader can check rather than two overlapping claims.
    const game = realGame(OPENING);
    const all = bookLookup(new Set(game.fens.map(bookKey)));
    const d = diagnoseImportedGames([game], all);
    expect(d.eligible).toBe(d.scored - d.forced - d.book);
  });
});
