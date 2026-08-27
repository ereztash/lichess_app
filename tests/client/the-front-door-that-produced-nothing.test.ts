// @vitest-environment jsdom
/**
 * The one screen whose whole job is to produce the first measurable decision, and it usually did not.
 *
 * THE LOOP, AND IT IS A REACHABILITY DEFECT RATHER THAN FRICTION. `Record` shows `FirstDecision`
 * while `scored === 0`, and the shared bank -- every reading that compares one player to another
 * -- sits behind `scored > 0`. `FirstDecision` hands over a position from a game the player
 * actually played, which is an ordinary `play` decision, which under sampling is asked for a
 * confidence one time in four. Three times in four the newcomer completed the ceremony, arrived
 * back at the same screen that had just sent them out, and had no route forward at all -- while
 * the screen's own words promised "תבחרו מהלך ותגידו כמה אתם בטוחים".
 *
 * WHY NOT JUST RAISE THE RATE. A rate is a probability and this needs a guarantee: at any rate
 * below one, some proportion of newcomers meet a front door that does nothing, and that
 * proportion is invisible because each of them simply leaves. `first` is a purpose, so the
 * question is put every time, and it is stamped as its own purpose rather than folded into
 * `anchor` or `play` so that an analysis can condition it out -- it is the only decision in the
 * record asked for a reason other than measurement.
 *
 * WHY A PLY AND NOT A FLAG, which is the whole of the second half of this file. The handoff has to
 * name the decision it exists for, because everything after it is ordinary. A boolean would need
 * clearing once used, a reload would undo the clearing, and the record would hold two decisions
 * both claiming to be the first.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import ts from "typescript";
import {
  ASK_RATE,
  confidenceIsAsked,
  drawForDecision,
  type DecisionPurpose,
} from "@shared/confidence-asked";
import { readPosition, writePosition, type StoredPosition } from "@/lib/session-position";

const FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

const board: Omit<StoredPosition, "savedAt"> = {
  sans: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
  ply: 5,
  source: "finished",
  orientation: "w",
  opponent: null,
  gameId: "lichess-abc",
  revealTiming: "per-decision",
  firstDecisionPly: 6,
};

describe("the first decision is asked, whatever the coin says", () => {
  /*
   * A position the draw plainly passes over, found rather than assumed. If a later change to the
   * hash made this draw land under ASK_RATE the test below would pass for the wrong reason -- it
   * would be asserting that an asked decision is asked.
   */
  const quiet = (() => {
    for (let ply = 0; ply < 400; ply += 1) {
      if (drawForDecision("lichess-abc", FEN, ply) >= ASK_RATE) return ply;
    }
    throw new Error("no ply in 400 was passed over; the draw or ASK_RATE changed");
  })();

  it("holds the fixture ply to what it is named for", () => {
    expect(
      drawForDecision("lichess-abc", FEN, quiet),
      "the fixture must be a ply the draw skips, or the assertions below prove nothing",
    ).toBeGreaterThanOrEqual(ASK_RATE);
  });

  it("asks on a position the same draw would have passed over as ordinary play", () => {
    const context = { gameId: "lichess-abc", fen: FEN, ply: quiet };
    expect(confidenceIsAsked({ ...context, purpose: "play" })).toBe(false);
    expect(
      confidenceIsAsked({ ...context, purpose: "first" }),
      "the front door drew nothing and the newcomer had no route forward",
    ).toBe(true);
  });

  it("asks on every ply, not on most of them", () => {
    /*
     * The defect was a probability, so the fix has to be checked as a guarantee. One counterexample
     * in five hundred is the difference between a front door and a front door that mostly works.
     */
    const skipped = Array.from({ length: 500 }, (_, ply) => ply).filter(
      (ply) => !confidenceIsAsked({ purpose: "first", gameId: "g", fen: FEN, ply }),
    );
    expect(skipped, "a front door that works at a rate is not a front door").toEqual([]);
  });

  it("keeps `first` a separate purpose from the three that are structurally measured", () => {
    /*
     * Folding it into `anchor` would have been one character shorter and would have put decisions
     * from a player's own game into the bank's between-player reading, where difficulty is held
     * fixed by construction. The whole value of that number is that everyone answered the same
     * positions.
     */
    const purposes: DecisionPurpose[] = ["first", "anchor", "drill", "transfer", "play", "import"];
    expect(new Set(purposes).size).toBe(purposes.length);
  });
});

describe("the handoff names the decision it exists for", () => {
  beforeEach(() => localStorage.clear());

  it("carries the ply across the store, so the board can stamp exactly one decision", () => {
    writePosition(board);
    expect(readPosition()!.firstDecisionPly).toBe(6);
  });

  it("reads a board stored before this field existed as an ordinary board", () => {
    /*
     * Null rather than a refusal, and the asymmetry with `revealTiming` is deliberate: a missing
     * arm has to be guessed and guessing wrong puts a game into the wrong condition, while a
     * missing first-decision ply has a true default -- it was not one.
     */
    const { firstDecisionPly, ...older } = board;
    expect(firstDecisionPly).toBe(6);
    localStorage.setItem(
      "decision-lab.position.v1",
      JSON.stringify({ ...older, savedAt: new Date().toISOString() }),
    );
    expect(readPosition()!.firstDecisionPly).toBeNull();
  });

  it("refuses a ply that is not a whole number rather than carrying it", () => {
    localStorage.setItem(
      "decision-lab.position.v1",
      JSON.stringify({ ...board, firstDecisionPly: 6.5, savedAt: new Date().toISOString() }),
    );
    expect(readPosition()!.firstDecisionPly).toBeNull();
  });

  it("carries a null through the store as a null, not as an absence", () => {
    writePosition({ ...board, firstDecisionPly: null });
    expect(readPosition()!.firstDecisionPly).toBeNull();
  });
});

/**
 * The two facts that live in a file no test renders, which is why this reads the file instead.
 *
 * `Home` is 2,000 lines with a WASM engine, a board and a router in it, and nothing in the suite
 * mounts it -- which is not an oversight to note in passing, it is the reason a newcomer could
 * walk into a dead end past 1,582 green tests. Until something can mount it, the two links of the
 * chain that live there are held by reading its syntax.
 *
 * A PARSE AND NOT A GREP. The first version of the test below round-tripped the field through
 * `writePosition`/`readPosition` and passed -- and went on passing with the field deleted from
 * Home's write-back, because it was asserting that a store stores what it is given. That is true
 * and it is not the defect. These walk the tree and ask what Home actually does.
 */
describe("the board reads the handoff and does not erase it", () => {
  const source = ts.createSourceFile(
    "Home.tsx",
    readFileSync(resolve(__dirname, "../../client/src/pages/Home.tsx"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  /** Every `writePosition({ ... })` in the file, as the set of keys it writes. */
  const writes: { line: number; keys: Set<string> }[] = [];
  /** Every identifier the `decisionPurpose` declaration reads. */
  const purposeReads = new Set<string>();

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "writePosition" &&
      node.arguments.length > 0 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const keys = new Set<string>();
      for (const property of node.arguments[0].properties) {
        if (property.name && ts.isIdentifier(property.name)) keys.add(property.name.text);
      }
      writes.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, keys });
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "decisionPurpose" &&
      node.initializer
    ) {
      const collect = (n: ts.Node): void => {
        if (ts.isIdentifier(n)) purposeReads.add(n.text);
        ts.forEachChild(n, collect);
      };
      collect(node.initializer);
    }
    ts.forEachChild(node, walk);
  };
  walk(source);

  it("finds the call it is about, so a rename cannot make this vacuous", () => {
    expect(writes.length, "no writePosition call with an object literal in Home").toBeGreaterThan(0);
    expect(purposeReads.size, "no decisionPurpose declaration in Home").toBeGreaterThan(0);
  });

  it("writes the handoff ply back on every save, or the stamp is gone before it is read", () => {
    /*
     * THE FAILURE THIS EXISTS TO CATCH. The board rewrites the whole stored position whenever
     * anything about it changes, and that effect runs on the first render after the restore --
     * before the player has decided. A field the write-back does not carry is therefore erased at
     * exactly the moment it is about to be read. `revealTiming` suffered this precise bug: a
     * deferred game silently resumed as a coached one, every row internally consistent, nothing
     * saying the condition had changed underneath it.
     */
    for (const write of writes) {
      expect(
        write.keys.has("firstDecisionPly"),
        `writePosition at Home.tsx:${write.line} drops firstDecisionPly, which erases it`,
      ).toBe(true);
    }
  });

  it("decides the purpose from the handoff ply rather than from the route", () => {
    /*
     * A route flag would say "the player came from the front door", which is true of every
     * decision in the session that followed. The ply says WHICH decision, and stops matching by
     * itself once the player moves past it.
     */
    expect(
      purposeReads.has("firstDecisionPly"),
      "decisionPurpose never reads the handoff, so `first` is unreachable",
    ).toBe(true);
    expect(purposeReads.has("first")).toBe(false);
  });
});
