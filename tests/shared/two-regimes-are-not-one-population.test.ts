/**
 * The wall the policy module was written for and did not have.
 *
 * `evidence-policy.ts` opens by saying its whole reason for existing is that "there was no filter",
 * and it built a very good one -- for PURPOSE. Purpose is a property of a row: a drill decision is
 * inadmissible on its own, one at a time, and a per-row table is exactly the right shape for it.
 *
 * PROTOCOL AND REVEAL TIMING ARE NOT PROPERTIES OF A ROW. They describe an incompatibility BETWEEN
 * rows. No single decision is "pooled"; a set is. So asking the table row by row always answered
 * yes -- every `play` decision is individually fine -- and forty of them from two different regimes
 * went into one search with nothing objecting. `reveal-timing.ts` had already written down that the
 * two "are not poolable, and every decision records which was in force". The recording happened.
 * The wall did not exist.
 *
 * THE TEST THE PLAN ASKED FOR IS THE FIRST TWO BELOW: two atoms identical in every field but one,
 * proven not to land in the same population. The rest guard the ways that could be true and useless
 * -- a split that also splits things that ARE comparable, or one that quietly drops what it split.
 */
import { describe, expect, it } from "vitest";
import {
  discoverySearchPopulation,
  EVIDENCE_POLICY_VERSION,
  forDiscovery,
  stratumId,
} from "@shared/evidence-policy";
import type { DecisionAtom } from "@shared/decision-atom";

/** A `play` decision, which the purpose table admits, with its conditions overridable. */
const decision = (over: Partial<DecisionAtom> = {}) =>
  ({
    purpose: "play",
    reveal_timing: null,
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    ...over,
  }) as unknown as DecisionAtom;

const strataOf = (atoms: DecisionAtom[]) =>
  forDiscovery(
    atoms,
    atoms.map((_, i) => `d${i}`),
  );

describe("two regimes are not one population", () => {
  it("keeps two decisions that differ ONLY in protocol out of the same population", () => {
    const strata = strataOf([
      decision({ measurement_protocol: "instrumented-standard" }),
      decision({ measurement_protocol: "instrumented-blitz" }),
    ]);
    expect(strata).toHaveLength(2);
    expect(strata.map((s) => stratumId(s.key)).sort()).toEqual([
      "instrumented-blitz/legacy",
      "instrumented-standard/legacy",
    ]);
    for (const s of strata) expect(s.atoms).toHaveLength(1);
  });

  it("keeps two decisions that differ ONLY in reveal timing out of the same population", () => {
    /*
     * The live defect this fixes, and it needs no blitz at all. A decision taken twenty moves into a
     * coached game was made by somebody who had been told, twenty times, how their last move scored.
     * One taken in a deferred game was not. Both are `purpose: "play"`.
     */
    const strata = strataOf([
      decision({ reveal_timing: "per-decision" }),
      decision({ reveal_timing: "end-of-game" }),
    ]);
    expect(strata).toHaveLength(2);
    expect(strata.map((s) => stratumId(s.key)).sort()).toEqual([
      "legacy/end-of-game",
      "legacy/per-decision",
    ]);
  });

  it("treats a row that recorded nothing as its own regime, not as either of the others", () => {
    // An unstamped row is not evidence that the condition was absent. It is a row from before.
    const strata = strataOf([
      decision({ reveal_timing: "per-decision" }),
      decision({ reveal_timing: null }),
    ]);
    expect(strata).toHaveLength(2);
    expect(strata.some((s) => s.key.revealTiming === "legacy")).toBe(true);
  });

  it("still pools decisions that ARE comparable, or the split would be useless", () => {
    /*
     * The control for the three above. A rule that puts every decision in its own stratum would
     * satisfy all of them and destroy the detector. Four decisions under identical conditions are
     * one population.
     */
    const same = { measurement_protocol: "instrumented-blitz", reveal_timing: "end-of-game" } as const;
    const strata = strataOf([decision(same), decision(same), decision(same), decision(same)]);
    expect(strata).toHaveLength(1);
    expect(strata[0].atoms).toHaveLength(4);
  });

  it("changes nothing for a record written before any of this existed", () => {
    /*
     * Behaviour preservation, stated as a test rather than as a hope. Every row in the shipped
     * record has a null protocol, so the whole record is one stratum and the search is what it was.
     */
    const strata = strataOf([decision(), decision(), decision()]);
    expect(strata).toHaveLength(1);
    expect(discoverySearchPopulation(strata).chosen?.atoms).toHaveLength(3);
    expect(discoverySearchPopulation(strata).setAside).toEqual([]);
  });

  it("searches the largest regime and REPORTS the ones it set aside, rather than dropping them", () => {
    const strata = strataOf([
      decision({ reveal_timing: "per-decision" }),
      decision({ reveal_timing: "per-decision" }),
      decision({ reveal_timing: "per-decision" }),
      decision({ reveal_timing: "end-of-game" }),
    ]);
    const { chosen, setAside } = discoverySearchPopulation(strata);
    expect(chosen?.key.revealTiming).toBe("per-decision");
    expect(chosen?.atoms).toHaveLength(3);
    // Not silently gone: named, counted, and available to whatever explains a population.
    expect(setAside).toEqual([{ id: "legacy/end-of-game", n: 1 }]);
  });

  it("chooses the same regime every time, whatever order the rows arrived in", () => {
    /*
     * A tie broken by arrival order would make the search depend on write order, so the same record
     * could yield two different claims. Two equal strata, both orders, same answer.
     */
    const a = decision({ reveal_timing: "per-decision" });
    const b = decision({ reveal_timing: "end-of-game" });
    const forward = discoverySearchPopulation(strataOf([a, b])).chosen;
    const backward = discoverySearchPopulation(strataOf([b, a])).chosen;
    expect(stratumId(forward!.key)).toBe(stratumId(backward!.key));
  });

  it("refuses purposes first, so a drill cannot enter any regime", () => {
    // The existing wall still stands: stratifying must not have widened anything.
    const strata = strataOf([
      decision({ purpose: "drill", measurement_protocol: "instrumented-blitz" }),
      decision({ purpose: "import", measurement_protocol: "instrumented-blitz" }),
      decision({ purpose: "play", measurement_protocol: "instrumented-blitz" }),
    ]);
    expect(strata).toHaveLength(1);
    expect(strata[0].atoms).toHaveLength(1);
  });

  it("bumps the policy version, because a claim under one population is not the same quantity", () => {
    expect(EVIDENCE_POLICY_VERSION).toBeGreaterThanOrEqual(3);
  });
});
