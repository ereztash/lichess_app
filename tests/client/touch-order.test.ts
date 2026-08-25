/**
 * The order moves were put on the board, which the record used to throw away.
 *
 * `handleBoardMove` appends each distinct move in the order it was touched, and the chosen move
 * is in there at its own position -- choosing is touching. The write then did
 * `new Set([chosenMove, ...touched])`, and `Set` keeps the FIRST occurrence, so the chosen move
 * was forced to index 0 and its real position was lost.
 *
 * WHAT THAT ERASED. Whether the engine's move was touched FIRST and then abandoned, or touched
 * LAST and rejected. Those are opposite events: one is "you had it and talked yourself out of
 * it", the other is "you weighed it and decided against it". The product asserts the second
 * reading in as many words, and could not tell which it was looking at.
 *
 * It costs the player nothing to fix -- no new field, no new interaction, same array type.
 */
import { describe, expect, it } from "vitest";
import { keepTouchOrder } from "@/lib/decision-session";

describe("the order survives the write", () => {
  it("keeps a move touched FIRST at the front, even when another was played", () => {
    /*
     * The case the old code could not represent. e2e4 went down first and was abandoned; g1f3
     * was played. Prepending the chosen move made this indistinguishable from the opposite.
     */
    expect(keepTouchOrder(["e2e4", "g1f3"], "g1f3")).toEqual(["e2e4", "g1f3"]);
  });

  it("keeps a move touched LAST at the back", () => {
    // The other event, which must not render as the first one.
    expect(keepTouchOrder(["g1f3", "e2e4"], "g1f3")).toEqual(["g1f3", "e2e4"]);
  });

  it("distinguishes the two, which is the whole point", () => {
    const abandonedFirst = keepTouchOrder(["e2e4", "g1f3"], "g1f3");
    const rejectedLast = keepTouchOrder(["g1f3", "e2e4"], "g1f3");
    expect(
      abandonedFirst,
      "the two opposite events still write the same array",
    ).not.toEqual(rejectedLast);
    expect(abandonedFirst.indexOf("e2e4")).toBeLessThan(rejectedLast.indexOf("e2e4"));
  });

  it("does not duplicate the chosen move when it is already there", () => {
    expect(keepTouchOrder(["e2e4", "g1f3"], "g1f3")).toHaveLength(2);
  });
});

describe("the guarantee the old code was buying", () => {
  it("includes the chosen move when it is somehow absent from the touch list", () => {
    // The atom's `decision` must appear in its own candidate list, or the one branch that reads
    // this field is looking at an incoherent record.
    expect(keepTouchOrder(["e2e4"], "g1f3")).toEqual(["e2e4", "g1f3"]);
  });

  it("never drops the chosen move to truncation", () => {
    /*
     * The regression the naive fix introduces. Appending instead of prepending puts the chosen
     * move last; a player who touched nine distinct moves would have it sliced off, leaving an
     * atom whose decision is not among its own candidates. It takes the last slot instead.
     */
    const nine = ["a2a3", "b2b3", "c2c3", "d2d3", "e2e3", "f2f3", "g2g3", "h2h3", "g1f3"];
    const kept = keepTouchOrder(nine, "g1f3");
    expect(kept).toHaveLength(8);
    expect(kept, "the move actually played was truncated out of its own candidate list").toContain("g1f3");
  });

  it("caps at eight, which is what the atom accepts", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `m${i}m${i}`);
    expect(keepTouchOrder(twelve, "m0m0")).toHaveLength(8);
  });
});
