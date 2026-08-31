// @vitest-environment jsdom
/**
 * P1.10 AND P1.11: the product stops asking for configuration it was already given.
 *
 * THE PLAIN CASE IN THE SCHEDULING RULE. The inertial laws sort the work by whether it touches the
 * instrument -- *first remove friction with no measurement value* -- and a player who has played
 * six games at 3+0 being asked, a seventh time, whether they would like 3+0 is exactly that. The
 * answer measures nothing; the asking costs a decision.
 *
 * WHAT IT MAY NOT BECOME, AND THIS IS THE HALF THAT NEEDED CARE. `reveal_timing` is one of the
 * three axes of `StratumKey`: decisions under `per-decision` and under `end-of-game` are not one
 * population. A remembered value applied INVISIBLY would put a player in a regime they did not know
 * they were in -- the strata would still separate the rows, but the person would not know which
 * arm they were producing. So the rule is remember-and-show: `NewGameSetup` renders all three
 * controls pre-filled, and the blitz screen marks one of three buttons rather than removing two.
 *
 * AND WHAT IS NOT REPAIRED IS DISCARDED. Every read validates field by field. The store holds
 * whatever an older build of this app left in this browser, and a cast would put a `NaN` clock on
 * a board -- a repaired setting is one the player never chose.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  rememberGameSetup,
  rememberTimeControl,
  rememberedGameSetup,
  rememberedTimeControl,
} from "@/lib/remembered-setup";

const BLITZ_KEY = "decision-lab.setup.blitz";
const GAME_KEY = "decision-lab.setup.game";

beforeEach(() => localStorage.clear());

describe("nothing chosen yet is its own answer", () => {
  it("remembers nothing on a browser that has never played", () => {
    /*
     * NULL AND NOT A DEFAULT. "Nothing chosen" and "3+0 chosen" are different facts, and returning
     * the first entry here would put a weight on a control the player has never picked -- the same
     * argument `reveal-timing.ts` makes about a null timing not being evidence of a mode.
     */
    expect(rememberedTimeControl()).toBeNull();
    expect(rememberedGameSetup()).toBeNull();
  });

  it("keeps what was played and hands it back unchanged", () => {
    rememberTimeControl({ initialMs: 180_000, incrementMs: 2_000 });
    expect(rememberedTimeControl()).toEqual({ initialMs: 180_000, incrementMs: 2_000 });
    rememberGameSetup({ color: "b", depth: 8, revealTiming: "end-of-game" });
    expect(rememberedGameSetup()).toEqual({ color: "b", depth: 8, revealTiming: "end-of-game" });
  });
});

describe("a stored value that is not the shape is no value", () => {
  it.each([
    ["not json", "{{{"],
    ["a string", '"3+0"'],
    ["null", "null"],
    ["a missing half", '{"initialMs":180000}'],
    ["a fractional clock", '{"initialMs":180000.5,"incrementMs":0}'],
    ["a zero clock", '{"initialMs":0,"incrementMs":0}'],
    ["a negative increment", '{"initialMs":180000,"incrementMs":-1}'],
  ])("discards a time control stored as %s", (_name, raw) => {
    localStorage.setItem(BLITZ_KEY, raw);
    expect(rememberedTimeControl()).toBeNull();
  });

  it.each([
    ["a colour nobody plays", '{"color":"g","depth":4,"revealTiming":"per-decision"}'],
    ["a timing that is not one", '{"color":"w","depth":4,"revealTiming":"whenever"}'],
    ["a depth that is not a number", '{"color":"w","depth":"deep","revealTiming":"per-decision"}'],
    ["a missing field", '{"color":"w","depth":4}'],
  ])("discards a setup stored with %s", (_name, raw) => {
    localStorage.setItem(GAME_KEY, raw);
    expect(rememberedGameSetup()).toBeNull();
  });

  it("does not repair a half-valid value into a whole one", () => {
    /*
     * A REPAIRED SETTING IS ONE THE PLAYER NEVER CHOSE. Keeping the colour off a row whose timing
     * is nonsense would start a game under a regime nobody picked, which is worse than asking.
     */
    localStorage.setItem(GAME_KEY, '{"color":"b","depth":8,"revealTiming":"whenever"}');
    expect(rememberedGameSetup()).toBeNull();
  });
});

describe("it survives a store that will not take a write", () => {
  it("does not throw when localStorage refuses, because nothing measured depends on it", () => {
    /*
     * A PRIVATE WINDOW OR A FULL QUOTA. The cost of failing here is that the player is asked the
     * same question again -- which is the state before this file existed -- so it must not be the
     * throw that takes a screen down with it.
     */
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(() => rememberTimeControl({ initialMs: 300_000, incrementMs: 0 })).not.toThrow();
      expect(() =>
        rememberGameSetup({ color: "w", depth: 4, revealTiming: "per-decision" }),
      ).not.toThrow();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });
});
