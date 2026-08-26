/**
 * Serving the shared set, and the two things that would quietly undo it.
 *
 * THE SET ONLY WORKS IF EVERYONE ANSWERS THE SAME POSITIONS. That sounds tautological and is not:
 * a serving order that varied by player, or one a player could reshuffle, would leave two records
 * covering different subsets of the bank -- and then the readings are back to being incomparable,
 * with the extra insult of looking comparable. So the order is the bank's own and the next
 * position is simply the first not yet answered.
 *
 * AND THE MOVE LISTS MUST STAY OUT OF THE ENTRY BUNDLE. Measured: carrying them in the shared
 * module took the entry bundle from 592kB to 607kB, paid by every arrival including the common
 * one that serves no position at all. The lazy import is load-bearing, not tidiness.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { nextAnchor } from "@/lib/anchor-run";

const root = resolve(__dirname, "../..");

describe("the set is answered in one order, the same for everyone", () => {
  it("serves the first position to a player who has answered none", async () => {
    const next = await nextAnchor([]);
    expect(next?.id).toBe(ANCHOR_POSITIONS[0].id);
    expect(next?.done).toBe(0);
    expect(next?.total).toBe(ANCHOR_POSITIONS.length);
  });

  it("skips what is answered and serves the next gap, not the next unanswered index", async () => {
    /*
     * The interesting case: a record that covers positions 0 and 2 but not 1. Serving "the one
     * after the highest answered" would hand over position 3 and leave a hole in the set the
     * player never gets back to.
     */
    const answered = [ANCHOR_POSITIONS[0].id, ANCHOR_POSITIONS[2].id];
    const next = await nextAnchor(answered);
    expect(next?.id).toBe(ANCHOR_POSITIONS[1].id);
    expect(next?.done).toBe(2);
  });

  it("gives the same player the same next position every time it is asked", async () => {
    // A player who could reshuffle until an easy position came up would be choosing their own
    // result, which is the same defect as the app choosing it for them.
    const answered = [ANCHOR_POSITIONS[0].id];
    const first = await nextAnchor(answered);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await nextAnchor(answered))?.id).toBe(first?.id);
    }
  });

  it("returns null when the set is complete, which is not the same as having none", async () => {
    const all = ANCHOR_POSITIONS.map((position) => position.id);
    expect(await nextAnchor(all)).toBeNull();
  });

  it("ignores an id that is not in the bank rather than counting it as progress", async () => {
    const next = await nextAnchor(["not-a-bank-position"]);
    expect(next?.id).toBe(ANCHOR_POSITIONS[0].id);
  });
});

describe("the position arrives as the game that produced it", () => {
  it("carries the moves and the ply that matches them", async () => {
    const next = (await nextAnchor([]))!;
    expect(next.sans.length).toBeGreaterThan(0);
    expect(next.ply, "the board would show a move the player was not asked about").toBe(
      next.sans.length - 1,
    );
  });
});

describe("the move lists stay out of the entry bundle", () => {
  it("loads them at the moment a position is served, not at import", () => {
    /*
     * Asserted against the source because it is a claim about WHEN a module is fetched, and no
     * behavioural test can see that: a static import would make every assertion above pass
     * identically while putting 13kB of movetext in front of every arrival.
     */
    const source = readFileSync(resolve(root, "client/src/lib/anchor-run.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source, "the movetext is imported statically").not.toMatch(
      /^import .*anchor-moves/m,
    );
    expect(source).toMatch(/await import\("@shared\/anchor-moves"\)/);
  });
});
