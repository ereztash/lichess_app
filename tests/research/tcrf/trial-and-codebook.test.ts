/**
 * The two rules this repository has already paid for, applied to the research record:
 * a missing measurement never becomes a zero, and a coded response cannot contradict itself.
 */
import { describe, expect, it } from "vitest";
import {
  codingContradictions,
  freezeIsAdmissible,
  CODEBOOK_VERSION,
  type CodedResponse,
} from "../../../research/tcrf/codebook";
import { trialContradictions, type ResourceTrial } from "../../../research/tcrf/trial";
import { revealingTrial } from "../../../scripts/tcrf-scan";

const trial = (patch: Partial<ResourceTrial> = {}): ResourceTrial => ({ ...revealingTrial(), ...patch });

const coded = (patch: Partial<CodedResponse> = {}): CodedResponse => ({
  trial_id: "T-0001",
  coder_id: "C-1",
  codebook_version: CODEBOOK_VERSION,
  levels: ["RELATION"],
  first_level: "RELATION",
  target_structure_mentioned: true,
  target_structure_referenced: true,
  target_telos_linked: false,
  named_elements: ["e1", "e5"],
  predicate_arity: "two_place",
  coder_uncertain: false,
  coder_comment: "",
  ...patch,
});

describe("a trial cannot describe a measurement that did not happen", () => {
  it("accepts the ordinary completed trial", () => {
    expect(trialContradictions(trial())).toEqual([]);
  });

  it("refuses a move with no decision time", () => {
    expect(trialContradictions(trial({ think_ms: null }))).toContain(
      "a move was committed with no decision time; a commit is what freezes the clock",
    );
  });

  it("refuses a decision time with no move", () => {
    expect(
      trialContradictions(trial({ move: null, timed_out: true, probe_delivery: "blocked_timeout" })),
    ).toContain("a decision time exists with no move to have frozen it");
  });

  it("requires a timed-out trial to say its probe was blocked rather than unanswered", () => {
    const t = trial({
      move: null,
      think_ms: null,
      timed_out: true,
      probe_delivery: "asked_unanswered",
    });
    expect(trialContradictions(t)).toContain(
      "a timed-out trial must record its probe as blocked_timeout: there was no decision to ask about",
    );
  });

  it("refuses a missing move that nothing explains", () => {
    const t = trial({ move: null, think_ms: null, timed_out: false, commit_failed: false });
    expect(trialContradictions(t)).toContain(
      "no move, and neither timed_out nor commit_failed explains it",
    );
  });

  it("refuses text on a response marked unanswered, and an answered response with no text", () => {
    expect(
      trialContradictions(
        trial({ resource_primary: { state: "asked_unanswered", text: "something", latency_ms: 10 } }),
      ),
    ).toContain("resource_primary carries text while marked asked_unanswered");
    expect(
      trialContradictions(
        trial({ resource_primary: { state: "answered", text: null, latency_ms: 10 } }),
      ),
    ).toContain("resource_primary is marked answered and carries no text");
  });

  it("refuses a response on a trial the probe was never assigned to", () => {
    const t = trial({ probe_assignment: "not_probed", probe_delivery: "not_asked" });
    expect(trialContradictions(t).length).toBeGreaterThan(0);
  });

  it("accepts an optional second question left empty, which is not the same as unasked", () => {
    const t = trial({
      resource_secondary: { state: "asked_unanswered", text: null, latency_ms: 800 },
    });
    expect(trialContradictions(t)).toEqual([]);
  });
});

describe("the polarity rule between the primary and secondary coded variables", () => {
  it("accepts a presence assertion, which is also a reference", () => {
    expect(codingContradictions(coded())).toEqual([]);
  });

  it("accepts a reference without a presence assertion: noticing the structure is GONE", () => {
    expect(
      codingContradictions(
        coded({ target_structure_mentioned: false, target_structure_referenced: true }),
      ),
    ).toEqual([]);
  });

  it("refuses a presence assertion that is not a reference", () => {
    expect(
      codingContradictions(
        coded({ target_structure_mentioned: true, target_structure_referenced: false }),
      ),
    ).toContain(
      "target_structure_mentioned is true while target_structure_referenced is false; a presence-assertion is a reference",
    );
  });

  it("refuses a first level the response was not coded with", () => {
    expect(codingContradictions(coded({ first_level: "TELOS" }))).toContain(
      "first_level names a level the response was not coded with",
    );
  });

  it("allows a response coded with nothing at all, and requires it to name no first level", () => {
    expect(
      codingContradictions(
        coded({ levels: [], first_level: null, named_elements: [], predicate_arity: "none" }),
      ),
    ).toEqual([]);
    expect(codingContradictions(coded({ levels: ["RELATION"], first_level: null }))).toContain(
      "levels were assigned but none was recorded as first",
    );
  });

  it("keeps OTHER_UNCLASSIFIED available, so the scheme can fail to fit", () => {
    expect(
      codingContradictions(
        coded({
          levels: ["OTHER_UNCLASSIFIED"],
          first_level: "OTHER_UNCLASSIFIED",
          target_structure_mentioned: false,
          target_structure_referenced: false,
          named_elements: [],
          predicate_arity: "none",
        }),
      ),
    ).toEqual([]);
  });
});

describe("the codebook freeze is a claim about when, not only about what", () => {
  const freeze = {
    codebook_version: CODEBOOK_VERSION,
    frozen_at_git_sha: "abc1234",
    discovery_responses_read: 480,
    confirmatory_responses_read: 0,
    notes: "",
  };

  it("accepts a freeze built on discovery data alone", () => {
    expect(freezeIsAdmissible(freeze)).toEqual([]);
  });

  it("refuses a freeze that read any confirmatory response", () => {
    expect(freezeIsAdmissible({ ...freeze, confirmatory_responses_read: 1 })).toContain(
      "the codebook was developed against 1 confirmatory responses; §5 permits none",
    );
  });

  it("refuses a freeze with no commit", () => {
    expect(freezeIsAdmissible({ ...freeze, frozen_at_git_sha: null })).toContain(
      "the freeze names no commit",
    );
  });

  it("refuses a codebook frozen with no discovery behind it", () => {
    expect(freezeIsAdmissible({ ...freeze, discovery_responses_read: 0 })).toContain(
      "no discovery responses were read, so the codebook is not discovery-built",
    );
  });
});
