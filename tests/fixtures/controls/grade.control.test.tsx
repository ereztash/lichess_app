// @vitest-environment jsdom
/**
 * GATE-GRADE positive control: an n=1 claim rendered WITHOUT its grade.
 * Expected to FAIL. That failure is the proof the gate is a gate.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Claim } from "../../../shared/claim";
import { N1_HYPOTHESIS, claimRenderVerdict } from "../claim-render-assertions";

/** The defect: a claim card that shows only the sentence. */
function UngradedClaimCard({ claim }: { claim: Claim }) {
  return (
    <section>
      <p>{claim.statement}</p>
      <p>תחום: {claim.scope}</p>
    </section>
  );
}

describe("GATE-GRADE control: a claim rendered without its grade", () => {
  it("must carry its grade and n (this is expected to fail)", () => {
    const { container } = render(<UngradedClaimCard claim={N1_HYPOTHESIS} />);
    const verdict = claimRenderVerdict(container.innerHTML, N1_HYPOTHESIS);
    expect(verdict.ok, verdict.detail).toBe(true);
  });
});
