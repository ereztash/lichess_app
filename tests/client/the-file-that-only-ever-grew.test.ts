/**
 * `Home.tsx` against a written-down ceiling, because the honest fix is not available yet.
 *
 * WHAT THE EXTERNAL REVIEW SAID, and it was right: 108 kB in one component is a maintainability
 * risk. `docs/ACTION_PLAN.md` scheduled it as C1, "a mechanical extraction with the existing tests
 * as the invariant -- not a redesign".
 *
 * THERE IS NO MECHANICAL EXTRACTION. That was checked rather than assumed, and the numbers say so:
 *
 *     one component            `Home()`, lines 180 to 2,358
 *     useState calls           55, all in one 200-line block
 *     declarations closing over them   45
 *     useMemo blocks that are pure computation   3, totalling 20 lines
 *
 * Twenty lines out of 2,358 is the whole of what can move without changing behaviour. Everything
 * else closes over one of fifty-five pieces of state in a single scope, so every real split is a
 * REDESIGN -- custom hooks (which changes where hooks are called), context, or threading fifteen
 * props into each panel. The plan is sceptical of exactly that: a large diff across the
 * most-tested surface in the repository, with no falsifiable claim attached.
 *
 * SO THIS IS THE OTHER THING THAT CAN BE DONE HONESTLY. Not a fix -- a ratchet, in the same shape
 * as `scripts/check_bundle_budget.ts` and for the same reason stated there: growth past a line
 * should be a decision somebody makes on purpose, in a diff, rather than a drift nobody notices.
 * The file got to 2,358 lines because every single change to it was small.
 *
 * THESE NUMBERS ONLY EVER GO DOWN. A bundle ceiling can be raised with a measurement, because
 * shipping more code can be worth it. This one cannot: there is no version of "this component
 * needs a fifty-sixth piece of state" that is better than putting it somewhere else. Raising
 * either ceiling means the refactor got further away, so the ceiling is the wrong thing to change.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../client/src/pages/Home.tsx"),
  "utf8",
);

/** Measured at 2,358. The headroom is small on purpose: the next hundred should be visible. */
const LINE_CEILING = 2400;

/**
 * Measured at 55, then 53, now 47, and this is the number that actually makes the file hard to
 * work in.
 *
 * Line count is a symptom; fifty-odd pieces of state in one scope is the cause. It is also the
 * number that decides whether an extraction is mechanical, which is why it is pinned separately
 * rather than trusted to correlate with length.
 *
 * IT CAME DOWN BECAUSE AN EXTRACTION PAID FOR IT. `useNewGameSetup` took two pieces of state out of
 * this component, and for a while the ceiling stayed at 55 -- which handed back, as headroom, the
 * exact thing the refactor had just bought. A ratchet that does not tighten after a win is a
 * ceiling, and this one is documented as a ratchet: `MASTER_PRODUCT_DEBT.md` R-13 says it may only
 * go down, and the register is held to this constant.
 *
 * 53 -> 47: `useDrillRun`. A drill's six pieces of state and its four transitions went out as one
 * thing, which is what makes it a mechanical extraction rather than the redesign this file's header
 * says is unavailable -- they are set together on every transition, read together by
 * `DrillRunner`, and there is no state of the board in which one of them is meaningful without the
 * rest. What stayed is everything the drill BORROWS: the board's position, the engine, the
 * commitment draft. The hook asks for two named acts over that state rather than six setters, so
 * the page still decides what clearing a position means.
 *
 * IT WAS FORCED BY THE LINE CEILING, WHICH IS THE RATCHET WORKING. Learning-commitment continuity
 * added a restore path and a terminal state for an abandoned drill; the line count went over 2,400
 * and the rule above says the number is the wrong thing to change. So something moved out, and the
 * state ceiling tightens behind it rather than keeping six slots of headroom the extraction paid
 * for.
 */
const STATE_CEILING = 47;

describe("the file that only ever grew", () => {
  it("is not longer than it was when this was written", () => {
    const lines = source.split("\n").length;
    expect(
      lines,
      `Home.tsx is now ${lines} lines. Do not raise this ceiling -- move something out.`,
    ).toBeLessThanOrEqual(LINE_CEILING);
  });

  it("does not hold more state in one component than it already did", () => {
    const states = source.match(/useState[<(]/g)?.length ?? 0;
    expect(
      states,
      `Home() now holds ${states} pieces of state. A fifty-sixth belongs in another component or a hook.`,
    ).toBeLessThanOrEqual(STATE_CEILING);
  });

  it("still has something to measure, so the ceilings cannot pass vacuously", () => {
    /*
     * A regex that stops matching, or a path that stops resolving, would make both assertions
     * above pass on an empty string. This is the floor that says the subject is still there.
     */
    expect(source.length).toBeGreaterThan(50_000);
    expect(source).toContain("export default function Home()");
    expect(source.match(/useState[<(]/g)?.length ?? 0).toBeGreaterThan(40);
  });
});
