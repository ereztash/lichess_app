/**
 * `countForReveal`, AT THE FIXTURE LEVEL, WHERE THE BROWSER WALK CANNOT GO CHEAPLY.
 *
 * `a-count-the-record-does-not-hold.layout.test.ts` drives the real thing and is the evidence that
 * matters: four decisions through the front door, the printed count compared against the record in
 * `localStorage` at every reveal. It takes fifty seconds and it cannot reach the branch that
 * matters most here -- a read that FAILS -- without breaking the store on purpose.
 *
 * This file holds the rule itself. Three states, and they are three different claims:
 *
 *   the read succeeded  -> the number the record holds, and nothing added to it
 *   the read failed     -> the last count that DID read, plus the decision we know was written
 *   never read at all   -> one, because the decision being revealed is on the record
 *
 * THE MIDDLE ONE IS THE WHOLE REASON THE FALLBACK IS NOT `0`. A reveal that said "0 decisions" to a
 * player who has just committed one would be a screen calling its own record empty, which is the
 * failure `RecordDashboard` already carries a branch for.
 */
import { describe, expect, it } from "vitest";
import { countForReveal, type CountView } from "@/lib/record-api";

/*
 * `forReveal` is the view's own binding to the function under test, so a fixture that supplied one
 * would be asserting against itself. It is filled in from `countForReveal` here, which is also the
 * cheapest available check that the binding on `useDecisionCount` cannot drift from the rule.
 */
const view = (over: Partial<Omit<CountView, "forReveal">>): CountView => {
  const built: CountView = {
    data: undefined,
    refetch: () => {},
    countNow: async () => null,
    forReveal: () => countForReveal(built),
    ...over,
  };
  return built;
};

describe("the count a reveal may claim", () => {
  it("is the number the record holds, with nothing added to it", async () => {
    /* The cache is deliberately behind, which is the state the old `+ 1` was compensating for. */
    const count = view({ data: { decisions: 2 }, countNow: async () => 3 });
    expect(await countForReveal(count)).toBe(3);
  });

  it("does not add one to a count that already includes the decision being revealed", async () => {
    /* The cache agrees with the read. The old rule printed 4 here; there are three decisions. */
    const count = view({ data: { decisions: 3 }, countNow: async () => 3 });
    expect(await countForReveal(count)).toBe(3);
  });

  it("says one at the first reveal, from a record that has never been read", async () => {
    expect(await countForReveal(view({ countNow: async () => 1 }))).toBe(1);
  });

  it("falls back to the last count that read, plus the decision it knows was written", async () => {
    /* The read failed. `data` is the count from before this decision, so `+ 1` is this decision. */
    const count = view({ data: { decisions: 6 }, countNow: async () => null });
    expect(await countForReveal(count)).toBe(7);
  });

  it("says one rather than zero when nothing has ever read and the read fails", async () => {
    expect(await countForReveal(view({ countNow: async () => null }))).toBe(1);
  });

  it("POSITIVE CONTROL: a record of zero really can be reported as zero when the read says so", async () => {
    /*
     * Without this the repair is indistinguishable from a rule that can never say zero. Nothing on
     * the reveal path reaches this -- a reveal implies a committed decision -- and a reading that
     * could not represent an empty record would be a rule about the caller, not about the count.
     */
    expect(await countForReveal(view({ data: { decisions: 4 }, countNow: async () => 0 }))).toBe(0);
  });

  it("POSITIVE CONTROL: the fallback is reached only on a failed read, never on a successful one", async () => {
    /*
     * `data` is set to a value that would be obvious in the output if the fallback fired: 99 + 1.
     * A rule that consulted `data` at all on the success path would show it here.
     */
    const count = view({ data: { decisions: 99 }, countNow: async () => 5 });
    expect(await countForReveal(count)).toBe(5);
  });
});
