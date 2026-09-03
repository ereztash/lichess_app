/**
 * The opponent.
 *
 * Two things are load-bearing here.
 *
 * R3 -- a search performed to choose the OPPONENT's move also contains the engine's opinion of
 * the reply the player is about to be asked for. Handing that score or that principal variation
 * to the UI would be the machine speaking before the decision. chooseOpponentMove exists so the
 * leak is impossible rather than merely avoided: it takes a full search result and returns a
 * move, so no caller is ever holding an evaluation it could render by mistake.
 *
 * "Identical output must never erase different causes" -- four different things can stop the
 * opponent moving, and each has to be distinguishable, or "the opponent did not move" would say
 * the same thing for a finished game and a crashed engine.
 */
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  chooseOpponentMove,
  OPPONENT_FAILURE_TEXT,
  OPPONENT_KIND,
  OPPONENT_VARIETY,
  pickAmongCandidates,
  searchWithVariety,
} from "../../client/src/lib/opponent";

const OPENING = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// Fool's mate, from White's side of it: 1.f3 e5 2.g4 Qh4#. White is to move and has no move.
const MATED = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
const PROMOTION = "8/P7/8/8/8/8/8/K6k w - - 0 1";

/** A search that answers with whatever the test wants, including fields that must not survive. */
const searchReturning = (line: Record<string, unknown>) => async () => line;

describe("chooseOpponentMove", () => {
  it("returns a move", async () => {
    const move = await chooseOpponentMove(OPENING, searchReturning({ bestMove: "e2e4" }));
    expect(move).toEqual({ ok: true, from: "e2", to: "e4" });
  });

  it("hands back NO evaluation, however much the search offers", async () => {
    // The search answers like the real engine does: score, depth, and the line it expects --
    // including the reply the player has not decided on yet.
    const move = await chooseOpponentMove(
      OPENING,
      searchReturning({
        bestMove: "e2e4",
        scoreCp: 240,
        mate: undefined,
        depth: 14,
        pv: ["e2e4", "e7e5", "g1f3"],
        fen: OPENING,
      }),
    );
    expect(move.ok).toBe(true);
    // Not "we did not read them" -- they are not there to read.
    expect(Object.keys(move).sort()).toEqual(["from", "ok", "to"]);
    expect(JSON.stringify(move)).not.toContain("240");
    expect(JSON.stringify(move)).not.toContain("e7e5");
  });

  it("carries a promotion piece rather than silently queening", async () => {
    const move = await chooseOpponentMove(PROMOTION, searchReturning({ bestMove: "a7a8n" }));
    expect(move).toEqual({ ok: true, from: "a7", to: "a8", promotion: "n" });
  });

  describe("each way of not moving is its own answer", () => {
    it("game-over: there is no move to make", async () => {
      const move = await chooseOpponentMove(MATED, searchReturning({ bestMove: "e2e4" }));
      expect(move).toEqual({ ok: false, reason: "game-over" });
    });

    it("no-move: the engine answered without one", async () => {
      const move = await chooseOpponentMove(OPENING, searchReturning({ depth: 4 }));
      expect(move).toEqual({ ok: false, reason: "no-move" });
    });

    it("illegal: the engine's move is not legal in the position it was asked about", async () => {
      const move = await chooseOpponentMove(OPENING, searchReturning({ bestMove: "e2e9" }));
      expect(move).toEqual({ ok: false, reason: "illegal" });
    });

    it("engine-failed: the search threw", async () => {
      const move = await chooseOpponentMove(OPENING, async () => {
        throw new Error("worker died");
      });
      expect(move).toEqual({ ok: false, reason: "engine-failed" });
    });

    it("says something different for every one of them", () => {
      const said = Object.values(OPPONENT_FAILURE_TEXT);
      expect(new Set(said).size).toBe(said.length);
    });
  });

  it("never plays an illegal move onto the board", async () => {
    // The engine returning a move for the wrong position is the realistic version of this: a
    // stale search answering after the position moved on.
    const staleAnswer = await chooseOpponentMove(OPENING, searchReturning({ bestMove: "e7e5" }));
    expect(staleAnswer).toEqual({ ok: false, reason: "illegal" });
  });

  it("leaves the caller's position untouched", async () => {
    const before = OPENING;
    await chooseOpponentMove(before, searchReturning({ bestMove: "e2e4" }));
    expect(before).toBe(OPENING);
  });
});

/*
 * THE OPPONENT VARIES. Owner-observed on the deployed build: every blitz game answered 1.e4 with
 * 1...d5, because a deterministic engine at a fixed depth is one line, not an opponent. The choice
 * is among the engine's own near-equals and nothing else, and the band is on the record.
 */
describe("an opponent that does not play the same game every time", () => {
  const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
  const candidates = [
    { move: "d7d5", scoreCp: -20 },
    { move: "e7e5", scoreCp: -25 },
    { move: "c7c5", scoreCp: -35 },
    { move: "g8f6", scoreCp: -110 },
  ];
  /** A deterministic sequence standing in for Math.random, so the test is not itself a lottery. */
  const sequence = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("plays more than one reply to 1.e4 across games", async () => {
    const seen = new Set<string>();
    const random = sequence([0.05, 0.5, 0.95, 0.3, 0.7]);
    for (let game = 0; game < 10; game++) {
      const move = await chooseOpponentMove(AFTER_E4, async () => ({ bestMove: "d7d5", candidates }), 4, random);
      if (move.ok) seen.add(`${move.from}${move.to}`);
    }
    expect(seen.size, `ten games, ${[...seen].join(",")}`).toBeGreaterThan(1);
  });

  it("never plays a candidate outside the band, however the dice fall", () => {
    for (const roll of [0, 0.1, 0.33, 0.5, 0.66, 0.9, 0.999]) {
      const move = pickAmongCandidates("d7d5", candidates, () => roll);
      expect(["d7d5", "e7e5", "c7c5"], `roll ${roll} chose ${move}`).toContain(move);
      expect(move).not.toBe("g8f6");
    }
  });

  it("plays the mate when there is one, and never a near-equal instead", () => {
    const withMate = [{ move: "d8h4", mate: 1 }, { move: "d7d5", scoreCp: 900 }];
    for (const roll of [0, 0.5, 0.99]) expect(pickAmongCandidates("d8h4", withMate, () => roll)).toBe("d8h4");
  });

  it("does not pick a line that walks into a mate as if it were within 30cp", () => {
    const trap = [{ move: "d7d5", scoreCp: 10 }, { move: "f7f6", mate: -2 }];
    for (const roll of [0, 0.5, 0.99]) expect(pickAmongCandidates("d7d5", trap, () => roll)).toBe("d7d5");
  });

  it("falls back to the engine's bestMove when it was handed no candidates", () => {
    expect(pickAmongCandidates("e7e5", undefined, () => 0.7)).toBe("e7e5");
    expect(pickAmongCandidates("e7e5", [], () => 0.7)).toBe("e7e5");
  });

  it("still hands back a move and no evaluation", async () => {
    const move = await chooseOpponentMove(AFTER_E4, async () => ({ bestMove: "d7d5", candidates }), 4, () => 0.9);
    expect(move.ok).toBe(true);
    expect(Object.keys(move).sort()).toEqual(["from", "ok", "to"]);
    expect(JSON.stringify(move)).not.toMatch(/-20|-25|-35|scoreCp/);
  });

  it("asks the engine for the stated number of lines and reads them into candidates", async () => {
    const asked: number[] = [];
    const search = searchWithVariety(async (_fen, _depth, count) => {
      asked.push(count);
      return [
        { bestMove: "d7d5", pv: ["d7d5", "e4d5"], scoreCp: -20 },
        { pv: ["e7e5", "g1f3"], scoreCp: -25 },
        { pv: [], scoreCp: -30 },
      ];
    });
    const answer = await search(AFTER_E4, 4);
    expect(asked).toEqual([OPPONENT_VARIETY.lines]);
    expect(answer.bestMove).toBe("d7d5");
    expect(answer.candidates?.map((c) => c.move)).toEqual(["d7d5", "e7e5"]);
  });

  it("records the band in the provenance kind, so varied and single-line games are two populations", () => {
    expect(OPPONENT_KIND).toBe("engine-varied-3x30cp");
    expect(OPPONENT_KIND).not.toBe("engine");
    expect(OPPONENT_KIND.length).toBeLessThanOrEqual(32); /* opponent_kind varchar(32) */
  });
});

// Guards the fixture above rather than the code: a malformed FEN would make every assertion in
// this file pass for the wrong reason.
describe("fixtures", () => {
  it("uses positions that mean what the tests assume", () => {
    expect(OPENING.split(" ")[1]).toBe("w");
    // If this ever stops being a finished game, the game-over case above proves nothing.
    expect(new Chess(MATED).isCheckmate()).toBe(true);
  });
});
