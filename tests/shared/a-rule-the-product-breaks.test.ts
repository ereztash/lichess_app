/**
 * INV-10 IS WRITTEN DOWN AND THE DRILL LOOP CONTRADICTS IT. This file holds the contradiction
 * still so that resolving it has to be deliberate.
 *
 * `protocolFor` (PR-13) says a claim about `fast-under-45s` needs a timed holdout, because a drill
 * removes the clock the claim is about. `beginDrill` builds one anyway, and `finishDrill` grades
 * the claim from it -- `refuted` is terminal. Both positions are argued in the tree, neither is
 * obviously wrong, and `docs/blitz/ADR-003-a-rule-the-product-breaks.md` states them side by side
 * and refuses to pick.
 *
 * SO THIS IS NOT A TEST OF CORRECT BEHAVIOUR. It asserts what the product DOES, next to what the
 * rule SAYS, and goes red the moment either moves -- which is the point. An open decision that
 * nothing watches is a decision that gets made by accident, six months later, by whoever touches
 * the file next.
 */
import { describe, expect, it } from "vitest";
import { protocolFor } from "../../shared/validation-protocol";
import { deriveClaim } from "../../shared/claim-derivation";
import type { CandidatePattern } from "../../shared/detector";
import { beginDrill } from "../../shared/record-service";
import { MemoryRecordStore } from "../../server/record";

const ADR = "see docs/blitz/ADR-003-a-rule-the-product-breaks.md";

/** Openings, none of them decided, which is what a client offers from a loaded game. */
const UNDECIDED = [
  "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
  "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
  "rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
  "rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 6",
  "rnbqkb1r/ppp2pp1/3p1n1p/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 7",
  "rnbqkb1r/ppp2pp1/3p1n1p/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 8",
  "rn1qkb1r/ppp2pp1/3p1n1p/4p3/2B1P1b1/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 9",
  "rn1qkb1r/ppp2pp1/3p1n1p/4p3/2B1P1b1/2NP1N1P/PPP2PP1/R1BQK2R b KQkq - 0 10",
];

const patternFor = (key: string): CandidatePattern => ({
  key,
  scope: `decisions in ${key}`,
  inside: { n: 42, meanConfidence: 0.8, accuracyRate: 0.24, gap: 0.56, gapVariance: 0.18 },
  outside: { n: 61, meanConfidence: 0.5, accuracyRate: 0.47, gap: 0.03, gapVariance: 0.21 },
  gapDifference: 0.53,
  standardError: 0.0973,
  supporting_decision_ids: Array.from({ length: 42 }, (_, i) => `d${i}`),
  predicts_overconfidence: true,
});

async function drillOutcome(key: string) {
  const store = new MemoryRecordStore();
  const claim = deriveClaim(patternFor(key), {
    claim_id: `claim-${key}`,
    created_at: "2026-08-30T00:00:00Z",
  });
  await store.saveClaim(claim);
  return beginDrill(
    store,
    { claim_id: claim.claim_id, candidate_fens: UNDECIDED },
    { drill_id: `drill-${key}`, started_at: "2026-08-30T00:01:00Z" },
  );
}

describe("a rule the product breaks", () => {
  it("routes every environment bucket to a holdout, which is INV-10 as PR-13 wrote it", () => {
    expect(protocolFor("fast-under-45s")).toBe("timed-holdout");
    expect(protocolFor("slow-over-2m")).toBe("timed-holdout");
    expect(protocolFor("clock-under-1m")).toBe("timed-holdout");
  });

  it("drills them anyway, and this assertion records that rather than approving it", async () => {
    for (const key of ["fast-under-45s", "slow-over-2m"]) {
      const { drill, reason } = await drillOutcome(key);
      expect(
        drill,
        `${key} produced no drill -- if INV-10 is now enforced, this file and ADR-003 are stale (${reason})`,
      ).not.toBeNull();
      expect(
        protocolFor(key),
        `${key} is drilled by the product and INV-10 sends it to a holdout; ${ADR}`,
      ).toBe("timed-holdout");
    }
  });

  it("has no such disagreement on a position bucket, so the contradiction is specific", async () => {
    const { drill } = await drillOutcome("phase-opening");
    expect(drill).not.toBeNull();
    expect(protocolFor("phase-opening")).toBe("position-drill");
  });

  it("keeps the two think-time buckets and the clock bucket distinguishable", () => {
    /*
     * ADR-003's second option narrows INV-10 to `clock-under-1m` alone, on the argument that think
     * time is a property of the DECISION and a clock reading is external state. Nothing here
     * endorses that. It asserts only that the three are still separately addressable, so option 2
     * remains implementable without first undoing a lumping done for convenience.
     */
    expect(new Set(["fast-under-45s", "slow-over-2m", "clock-under-1m"]).size).toBe(3);
    expect(protocolFor("standing-losing")).toBe("position-drill");
    expect(protocolFor("a-bucket-nobody-classified")).toBeNull();
  });
});
