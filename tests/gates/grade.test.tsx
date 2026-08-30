// @vitest-environment jsdom
/**
 * GATE-GRADE (section 3.3): no claim renders above its grade, and the word for a hypothesis is
 * never the word for a replicated finding.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClaimCard } from "@/components/ClaimCard";
import { N1_HYPOTHESIS, claimRenderVerdict } from "../fixtures/claim-render-assertions";
import { evaluateClaim, type ProspectiveDrillResult } from "@shared/claim";

describe("GATE-GRADE: a claim never renders above its grade", () => {
  it("renders an n=1 hypothesis with its grade and its n", () => {
    const { container } = render(<ClaimCard claim={N1_HYPOTHESIS} othersWithheld={0} />);
    const verdict = claimRenderVerdict(container.innerHTML, N1_HYPOTHESIS);
    expect(verdict.ok, verdict.detail).toBe(true);
  });

  it("does not borrow the word for a finding when the claim is a hypothesis", () => {
    const { container } = render(<ClaimCard claim={N1_HYPOTHESIS} othersWithheld={0} />);
    expect(container.textContent).toContain("השערה");
    expect(container.textContent).not.toContain("שוחזר");
  });

  it("says what would refute it, on screen, next to the claim", () => {
    /*
     * THE CONDITION ITSELF, and the block that introduces it -- not the wording of its heading.
     * What section 3.3 requires is that a claim cannot be read without the thing that would sink
     * it; the label above it is copy, and keying a gate to copy makes the gate fail on a rewrite
     * that changed nothing about the guarantee.
     */
    const { container } = render(<ClaimCard claim={N1_HYPOTHESIS} othersWithheld={0} />);
    const block = container.querySelector(".claim-refutation");
    expect(block, "the refutation condition has no block of its own").not.toBeNull();
    expect(block!.textContent).toContain(N1_HYPOTHESIS.refutation_condition);
  });

  it("says how many other patterns were withheld rather than showing them all", () => {
    const { container } = render(<ClaimCard claim={N1_HYPOTHESIS} othersWithheld={2} />);
    // The COUNT is the guarantee: they are counted rather than listed. The noun is copy.
    const withheld = container.querySelector(".claim-withheld");
    expect(withheld, "nothing says how many were withheld").not.toBeNull();
    expect(withheld!.textContent).toContain("2");
  });

  it("uses the finding word only once a prospective drill has been survived", () => {
    const result: ProspectiveDrillResult = {
      kind: "prospective_drill_result",
      protocol: "position-drill",
      drill_id: "dr1",
      claim_id: N1_HYPOTHESIS.claim_id,
      decision_ids: ["x1", "x2"],
      predicted: true,
      observed: true,
      recorded_at: "2026-08-22T00:00:00Z",
    };
    const replicated = evaluateClaim(N1_HYPOTHESIS, [result]);
    expect(replicated.grade).toBe("replicated");
    const { container } = render(<ClaimCard claim={replicated} othersWithheld={0} />);
    expect(container.textContent).toContain("שוחזר");
  });

  it("names the protocol instead of claiming a question is settled that the test could not reach", () => {
    /*
     * ADR-003, ON SCREEN. `replicated` reached by a position drill on a claim about the CLOCK is a
     * real measurement of something, and it is not a measurement of what the claim says. Printing
     * the settled sentence -- "עמד בבדיקה אחת לפחות על החלטות חדשות, שיכלה להפיל אותו" -- would
     * tell the player a clockless drill closed a question about playing under a clock. Rendering
     * above the grade is exactly what this gate is for; the grade just got a second dimension.
     */
    const clockClaim = { ...N1_HYPOTHESIS, claim_id: "claim-fast-under-45s" };
    const offProtocol = evaluateClaim(clockClaim, [
      {
        kind: "prospective_drill_result",
        protocol: "position-drill",
        drill_id: "dr-clock",
        claim_id: clockClaim.claim_id,
        decision_ids: ["z1"],
        predicted: true,
        observed: true,
        recorded_at: "2026-08-22T00:00:00Z",
      },
    ]);
    const { container } = render(<ClaimCard claim={offProtocol} othersWithheld={0} />);
    expect(container.textContent).not.toContain("עמד בבדיקה אחת לפחות");
    expect(container.textContent).toContain("דריל עמדות");
    expect(container.textContent).toContain("בדיקה תחת שעון");
  });

  it("keeps the settled sentence for a claim its own protocol did close", () => {
    // The assertion above must not be satisfied by never printing the sentence at all.
    const boardClaim = { ...N1_HYPOTHESIS, claim_id: "claim-phase-endgame" };
    const onProtocol = evaluateClaim(boardClaim, [
      {
        kind: "prospective_drill_result",
        protocol: "position-drill",
        drill_id: "dr-board",
        claim_id: boardClaim.claim_id,
        decision_ids: ["z1"],
        predicted: true,
        observed: true,
        recorded_at: "2026-08-22T00:00:00Z",
      },
    ]);
    const { container } = render(<ClaimCard claim={onProtocol} othersWithheld={0} />);
    expect(container.textContent).toContain("עמד בבדיקה אחת לפחות");
    expect(container.textContent).not.toContain("בדיקה תחת שעון");
  });

  it("keeps a refuted claim forever rather than deleting it", () => {
    const failed: ProspectiveDrillResult = {
      kind: "prospective_drill_result",
      protocol: "position-drill",
      drill_id: "dr2",
      claim_id: N1_HYPOTHESIS.claim_id,
      decision_ids: ["y1"],
      predicted: true,
      observed: false,
      recorded_at: "2026-08-22T00:00:00Z",
    };
    const refuted = evaluateClaim(N1_HYPOTHESIS, [failed]);
    expect(refuted.grade).toBe("refuted");
    expect(refuted.prospective_tests).toHaveLength(1);
    /*
     * Refutation is terminal: a later "success" cannot revive it. Asserted as a SEQUENCE now that
     * the grade is a fold -- the drill that refuted and the drill that followed it, in the order
     * they were reported. Re-feeding an already-refuted claim tested the guard; this tests the
     * history, which is what the record actually holds.
     */
    const revived = evaluateClaim(N1_HYPOTHESIS, [failed, { ...failed, observed: true, drill_id: "dr3" }]);
    expect(revived.grade, "a refuted claim was revived").toBe("refuted");
    expect(revived.prospective_tests).toHaveLength(2);
  });
});
