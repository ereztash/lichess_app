/**
 * The first decision, and the one way it could quietly become dishonest.
 *
 * A new player cannot be shown a calibration gap. The gap needs a confidence stated BEFORE the
 * engine speaks, and no import, no rating and no finished game carries one -- which is exactly
 * what makes the record impossible to copy, and exactly why the first visit has nothing to show.
 * So the fastest honest route to "felt what this measures" is one decision, taken on a position
 * the player actually reached.
 *
 * THE FAILURE MODE THIS FILE EXISTS FOR: picking the position where they blundered. It would be
 * a far better demo -- the player says "certain", turns out to have dropped a piece, and the
 * point lands. It would also be staged. The app would have chosen a position BECAUSE the move
 * was bad and then presented the player's wrongness as a measurement, which is the product's
 * standing refusal ("do not make the product say more about the player than it measured") in its
 * purest form. Every assertion below is downstream of that.
 *
 * The other half is leakage. The board renders the whole move list, so a history handed over one
 * ply too long would put the answer on screen beside the question.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OPENING_MAX_PLY } from "@shared/phase";
import { buildHistory, DEFAULT_PGN } from "@/lib/game-data";
import {
  eligiblePositions,
  pickFirstDecision,
  sideOf,
  type PickableGame,
} from "@/lib/first-decision";

const root = resolve(__dirname, "../..");
const code = (path: string) =>
  readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** 47 plies, so there is a real choice to be deterministic about. */
const LONG_PGN = `[White "erez281"]
[Black "other"]

1. e4 e5 2. d4 exd4 3. c3 dxc3 4. Bc4 Bb4 5. Nxc3 Bxc3+ 6. bxc3 Ne7 7. Nf3 O-O
8. O-O c6 9. Bg5 Qe8 10. Bb3 Ng6 11. Bc2 Ne5 12. Nd4 d6 13. Nf5 Bxf5 14. exf5 Qd7
15. f4 Nc4 16. Qd3 d5 17. f6 g6 18. Bb3 Nd6 19. Qg3 Nf5 20. Qf3 d4 21. Bc2 Ne3
22. Qg3 Nxc2 23. Qh4 Ne3 24. g4 *`;

const game = (over: Partial<PickableGame> = {}): PickableGame => ({
  id: "abcd1234",
  white: "erez281",
  black: "other",
  pgn: LONG_PGN,
  ...over,
});

describe("the position is chosen without looking at how the move went", () => {
  it("consults no engine, no centipawn loss and no outcome", () => {
    /*
     * Asserted against the source because this is a claim about what the module is ALLOWED to
     * read, not about what it happened to return on one fixture. A picker that started scoring
     * candidates would pass every behavioural test below and still be staging the result.
     */
    const source = code("client/src/lib/first-decision.ts");
    for (const forbidden of [
      "cp_loss",
      "cpLoss",
      "analyze",
      "engine",
      "accurate",
      "evalScore",
      "centipawn",
      "blunder",
    ]) {
      expect(source, `the picker reads ${forbidden}`).not.toMatch(new RegExp(forbidden, "i"));
    }
  });

  it("does not rank, sort or score the candidates", () => {
    const source = code("client/src/lib/first-decision.ts");
    expect(source, "candidates are being ordered by something").not.toMatch(/\.sort\(/);
    expect(source, "a candidate is being scored").not.toMatch(/score|weight|rank|best|worst/i);
  });

  it("offers every eligible position, not a shortlist", () => {
    // The set the picker draws from must be the whole set. A picker that narrowed to three
    // "interesting" positions would be ranking without using the word.
    const history = buildHistory(LONG_PGN);
    const eligible = eligiblePositions(history, "w");
    const byHand = history.filter(
      (s) => s.color === "w" && s.ply > OPENING_MAX_PLY && s.ply < history.length - 1,
    );
    expect(eligible).toEqual(byHand);
    expect(eligible.length).toBeGreaterThan(6);
  });
});

describe("which positions can be asked about at all", () => {
  it("skips the opening, where the engine agrees with everyone", () => {
    /*
     * Not a stylistic preference. Inside OPENING_MAX_PLY accuracy approaches 100% for every
     * player because book moves are book moves -- the repo's own import diagnostic says so. A
     * demonstration there would show the player agreeing with the engine and demonstrate nothing
     * about calibration. This is a property of the POSITION, not of the player, which is what
     * keeps it on the right side of the line above.
     */
    const history = buildHistory(LONG_PGN);
    for (const position of eligiblePositions(history, "w")) {
      expect(position.ply).toBeGreaterThan(OPENING_MAX_PLY);
    }
  });

  it("only offers moves the player themselves had to make", () => {
    const history = buildHistory(LONG_PGN);
    expect(eligiblePositions(history, "b").every((p) => p.color === "b")).toBe(true);
    expect(eligiblePositions(history, "w").every((p) => p.color === "w")).toBe(true);
  });

  it("leaves out the last move, which is often forced", () => {
    /*
     * Asserted against the side that actually OWNS the last ply. The first version of this
     * checked Black while the game ended on a White move, so the colour filter was excluding
     * the ply anyway and the assertion could not fail -- a mutation that offered the last move
     * to everyone left it green.
     */
    const history = buildHistory(LONG_PGN);
    const last = history[history.length - 1];
    const plies = eligiblePositions(history, last.color).map((p) => p.ply);
    expect(plies, "the final move is on offer").not.toContain(last.ply);
    expect(plies.length, "the colour filter emptied the set instead").toBeGreaterThan(0);
  });

  it("reads the player's colour from the game, and refuses a game that is not theirs", () => {
    expect(sideOf(game(), "erez281")).toBe("w");
    expect(sideOf(game(), "OTHER")).toBe("b");
    expect(sideOf(game(), "someone-else")).toBeNull();
    expect(sideOf(game(), "   ")).toBeNull();
  });
});

describe("the same games always produce the same position", () => {
  it("does not deal a new hand on reload", () => {
    /*
     * A player who could reshuffle until the position looked easy would be choosing their own
     * result, which is the same defect as the app choosing it for them.
     */
    const first = pickFirstDecision([game()], "erez281");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(pickFirstDecision([game()], "erez281")).toEqual(first);
    }
  });

  it("gives different games different positions, so it is not just a fixed index", () => {
    const a = pickFirstDecision([game({ id: "aaaa1111" })], "erez281")!;
    const b = pickFirstDecision([game({ id: "zzzz9999" })], "erez281")!;
    // Both are valid picks from the same movetext; what matters is that the id actually drives it.
    expect(a.ply).not.toBe(b.ply);
  });
});

describe("the board is handed the question and not the answer", () => {
  it("trims the history to before the move under decision", () => {
    /*
     * `MoveTimeline` renders the whole history it is given. One ply too many and the move the
     * player is being asked to find is sitting on screen next to the question.
     */
    const decision = pickFirstDecision([game()], "erez281")!;
    expect(decision.sans).toHaveLength(decision.ply + 1);
    const full = buildHistory(LONG_PGN);
    expect(decision.sans).toEqual(full.slice(0, decision.ply + 1).map((s) => s.san));
    expect(decision.sans, "the played move is on the board already").not.toContain(
      decision.playedSan,
    );
  });

  it("carries what they actually played, as a fact from their own PGN", () => {
    const decision = pickFirstDecision([game()], "erez281")!;
    const full = buildHistory(LONG_PGN);
    expect(decision.playedSan).toBe(full[decision.ply + 1].san);
    expect(decision.orientation).toBe("w");
  });
});

describe("when there is no position to offer, that is the answer", () => {
  it("returns null rather than reaching into the opening for one", () => {
    // The demo game is 18 plies -- entirely inside the opening window.
    const short = game({ pgn: DEFAULT_PGN, white: "erez281", black: "other" });
    expect(pickFirstDecision([short], "erez281")).toBeNull();
  });

  it("returns null when none of the games belong to that account", () => {
    expect(pickFirstDecision([game()], "nobody")).toBeNull();
  });

  it("skips a PGN it cannot replay instead of failing the whole screen", () => {
    const broken = game({ id: "broken01", pgn: "this is not a pgn at all" });
    const decision = pickFirstDecision([broken, game({ id: "good0001" })], "erez281");
    expect(decision, "one bad export took the whole first run down").not.toBeNull();
    expect(decision!.gameId).toBe("good0001");
  });

  it("takes the first game that can supply one, in the order given", () => {
    const decision = pickFirstDecision(
      [game({ id: "short001", pgn: DEFAULT_PGN }), game({ id: "long0001" })],
      "erez281",
    )!;
    expect(decision.gameId).toBe("long0001");
  });
});
