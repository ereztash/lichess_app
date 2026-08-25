/**
 * The anchor set, and the two ways a fixed item bank can quietly stop being one.
 *
 * WHY IT EXISTS. A calibration gap computed over whatever positions a player happened to reach is
 * not comparable to anyone else's: it moves with the difficulty of the item bank as readily as
 * with the player's judgement, and the repo's own audit put roughly two thirds of the signal on
 * difficulty rather than self-knowledge. Statistical correction cannot repair that -- regressing
 * difficulty out removes the very between-person variance the number is meant to carry. Holding
 * the positions FIXED makes difficulty variance across players zero by construction.
 *
 * FAILURE ONE: THE BANK STOPS BEING REPRESENTATIVE. Gigerenzer, Hoffrage & Kleinbölting (1991) and
 * Juslin (1994) found substantial overconfidence on SELECTED items and near none on REPRESENTATIVE
 * ones -- same subjects, same scale, the difference being entirely how the items were chosen. A
 * bank curated for "instructive" positions would manufacture the finding it exists to measure, so
 * the properties asserted here are properties of the SAMPLING, not of any position.
 *
 * FAILURE TWO: THE POSITION ARRIVES WITH THE ANSWER. Each entry carries the moves that led to it
 * so the board can show the game as it was played, and the board renders every move it is given.
 * One ply too many and the move under decision is on screen beside the question.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Chess } from "chess.js";
import { OPENING_MAX_PLY } from "@shared/phase";
import { ANCHOR_POSITIONS, ANCHOR_SET_VERSION, isAnchorFen } from "@shared/anchor-set";
import { ANCHOR_MOVES } from "@shared/anchor-moves";

const root = resolve(__dirname, "../..");
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("every entry is a position that really occurred", () => {
  it("replays from the opening move to exactly the stored position", () => {
    /*
     * The strongest thing that can be said about a bank of FENs: they are not typed, they are
     * reachable. A transcription error anywhere in the move list lands here rather than on a
     * player's screen as a board that cannot be reasoned about.
     */
    const fenOf = new Map(ANCHOR_POSITIONS.map((p) => [p.id, p.fen]));
    for (const entry of ANCHOR_MOVES) {
      const board = new Chess();
      for (const san of entry.sans) {
        expect(() => board.move(san), `${entry.id}: illegal move ${san}`).not.toThrow();
      }
      expect(board.fen(), `${entry.id}: the moves do not lead to the stored position`).toBe(
        fenOf.get(entry.id),
      );
    }
  });

  it("hands over the game up to the decision and not one move further", () => {
    // `ply` is the half-move the board shows -- the last move PLAYED -- so it is one behind the
    // length of the list. Off by one here puts the answer on the board next to the question.
    for (const entry of ANCHOR_MOVES) {
      expect(entry.ply, entry.id).toBe(entry.sans.length - 1);
    }
  });

  it("has a legal move to make in every position", () => {
    // A position with one legal answer measures nothing, and a position with none is not a
    // decision at all.
    for (const position of ANCHOR_POSITIONS) {
      const board = new Chess(position.fen);
      expect(board.moves().length, `${position.id} has no choice to make`).toBeGreaterThan(1);
    }
  });
});

describe("the bank is sampled, not chosen", () => {
  it("is past the opening in every position", () => {
    /*
     * Inside OPENING_MAX_PLY accuracy approaches 100% for everyone, because book moves are book
     * moves. A bank there would measure agreement with theory, not calibration.
     */
    /*
     * Asserted on the MOVES ALREADY PLAYED, not on `ply`. `ply` is the board's "last move played"
     * and is one behind by construction, so checking it here was off by one and failed on a
     * position that is correctly past the window.
     */
    for (const entry of ANCHOR_MOVES) {
      expect(entry.sans.length, entry.id).toBeGreaterThan(OPENING_MAX_PLY);
    }
  });

  it("draws from many games rather than mining a few deeply", () => {
    // Several positions from one game are not independent items: they share an opening, an
    // opponent and a player. The stride through the stream is what keeps them spread.
    /*
     * ONE EACH, which this test is the reason for. A fixed stride alone took 60 positions from 45
     * games, so a quarter of the bank was pairs sharing an opening, an opponent and a player --
     * not independent items however the sampling rule is described. The generator now takes at
     * most one position per game.
     */
    const games = new Set(ANCHOR_POSITIONS.map((position) => position.id.split("-")[0]));
    expect(games.size).toBe(ANCHOR_POSITIONS.length);
  });

  it("holds no duplicates, by position or by name", () => {
    expect(new Set(ANCHOR_POSITIONS.map((p) => p.fen)).size).toBe(ANCHOR_POSITIONS.length);
    expect(new Set(ANCHOR_POSITIONS.map((p) => p.id)).size).toBe(ANCHOR_POSITIONS.length);
  });

  it("is big enough for a player's gap to differ from zero at all", () => {
    /*
     * NOT A ROUND NUMBER. At a rate near 0.7 the standard error of a proportion is
     * sqrt(p(1-p)/n): 60 judgments give about 5.9 points, which is enough to separate a real gap
     * from zero. Placing a player against a POPULATION needs roughly 200, and this bank does not
     * claim to do that.
     */
    expect(ANCHOR_POSITIONS.length).toBeGreaterThanOrEqual(60);
  });
});

describe("the bank never carries the engine's opinion", () => {
  it("ships no evaluation with any position", () => {
    /*
     * R3, and the one rule this file could most easily break. Engine evaluations were used to
     * EXCLUDE decided positions when the bank was built, and then discarded. A position arriving
     * at the client with its own centipawn score attached is engine output reaching the player
     * before a decision is recorded -- which is the thing GATE-COMMIT exists to prevent.
     */
    const source = readFileSync(resolve(root, "shared/anchor-set.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["cp", "eval", "score", "best", "accurate", "loss"]) {
      expect(source, `the bank ships ${forbidden}`).not.toMatch(new RegExp(`\\b${forbidden}\\b`, "i"));
    }
    for (const position of ANCHOR_POSITIONS) {
      expect(Object.keys(position).sort()).toEqual(["fen", "id"]);
    }
  });
});

describe("the two generated files are one bank", () => {
  it("holds the same positions, in the same order, in both", () => {
    /*
     * The split is a bundle decision, not a taxonomy: `isAnchorFen` is reached from code every
     * arrival loads, and the move lists are needed only when a position is actually served. The
     * cost of that split is that two files can drift, and this is the assertion that stops them.
     * They are generated together by one script; nothing else may edit either.
     */
    expect(ANCHOR_MOVES.map((entry) => entry.id)).toEqual(ANCHOR_POSITIONS.map((p) => p.id));
  });

  it("keeps the movetext out of the file that every arrival loads", () => {
    // MEASURED: carrying the move lists in the shared module took the entry bundle from 592kB to
    // 607kB -- 15kB paid by everyone, to answer a membership test that needs only the position.
    const source = readFileSync(resolve(root, "shared/anchor-set.ts"), "utf8");
    expect(source, "the move lists are back in the eagerly-loaded module").not.toMatch(/sans/);
    expect(source.length).toBeLessThan(12_000);
  });
});

describe("membership is a property of the position itself", () => {
  it("recognises a bank position and refuses one that is not in it", () => {
    for (const position of ANCHOR_POSITIONS) expect(isAnchorFen(position.fen)).toBe(true);
    expect(isAnchorFen(START), "the starting position is in the bank").toBe(false);
    expect(isAnchorFen("")).toBe(false);
  });

  it("is versioned, because changing the bank changes what the number means", () => {
    // A reading taken on one version is not comparable to a reading taken on another, and nothing
    // may silently pool them.
    expect(ANCHOR_SET_VERSION).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(ANCHOR_SET_VERSION)).toBe(true);
  });
});
