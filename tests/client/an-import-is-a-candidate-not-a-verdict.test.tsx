// @vitest-environment jsdom
/**
 * The import names a place to look, and the screen has to make that structurally obvious.
 *
 * An import measures accuracy over games that are already over. It cannot measure a calibration
 * gap -- nobody was asked how sure they were during a game they have already played -- so it can
 * never produce a finding about the player. Everything that would turn it into one happens
 * afterwards and mostly elsewhere: registering the bucket BEFORE the data exist, collecting
 * decisions that carry a stated confidence, and testing the bucket on those rather than on the ones
 * that suggested it.
 *
 * The panel said the careful thing in prose and then stopped, and a screen that shows a reading and
 * stops invites the reading to be the answer. The stages that this screen cannot reach are now on
 * it, greyed rather than hidden -- and the branch where the player is FURTHEST from a finding, which
 * used to render nothing at all, is the one where saying so matters most.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IMPORT_PIPELINE, importProgress, type PreregOutcome } from "@shared/prereg";
import { ImportPipeline } from "@/components/ImportPipeline";

const outcomes: Record<string, PreregOutcome> = {
  nothingReadable: { kind: "nothing-readable" },
  onlyOne: { kind: "only-one-readable", worstKey: "phase-opening" },
  notSeparable: {
    kind: "not-separable",
    worstKey: "phase-opening",
    separation: 0.02,
    threshold: 0.19,
  },
  notRegistrable: { kind: "not-registrable", worstKey: "standing-level" },
};

describe("how far an import actually got", () => {
  it("stops at 'measured' whenever no candidate came out of it", () => {
    for (const key of ["nothingReadable", "onlyOne", "notSeparable"]) {
      const progress = importProgress(outcomes[key], false);
      expect(progress.reached, key).toBe("measured");
      expect(progress.blockedReason, `${key} must say why it stopped`).toBeTruthy();
    }
  });

  it("distinguishes a candidate that cannot be registered from one that was never found", () => {
    // Both are dead ends and they are not the same dead end: one has a bucket and no live twin,
    // the other has no bucket. A single "nothing to register" would merge two different facts.
    const blocked = importProgress(outcomes.notRegistrable, false);
    expect(blocked.reached).toBe("candidate");
    expect(blocked.blockedReason).toBeTruthy();
  });

  it("moves to collecting once something is on record, and stops claiming a blocker", () => {
    const registered = importProgress(outcomes.notSeparable, true);
    expect(registered.reached).toBe("collecting");
    expect(registered.blockedReason).toBeNull();
  });
});

describe("the stages this screen cannot reach are on it anyway", () => {
  it("renders every stage, including the ones still ahead", () => {
    render(<ImportPipeline progress={importProgress(outcomes.notSeparable, false)} />);
    for (const stage of IMPORT_PIPELINE) {
      expect(screen.getByText(stage.label), stage.key).toBeTruthy();
    }
  });

  it("marks the unreached stages as unreached rather than hiding them", () => {
    const { container } = render(
      <ImportPipeline progress={importProgress(outcomes.notSeparable, false)} />,
    );
    const ahead = container.querySelectorAll("li.ahead");
    // measured is reached; candidate, registered, collecting and tested are not.
    expect(ahead.length).toBe(IMPORT_PIPELINE.length - 1);
  });

  it("says the reading is an observation about games already played", () => {
    render(<ImportPipeline progress={importProgress(outcomes.notSeparable, false)} />);
    expect(screen.getByText(/משחקים שכבר שוחקו/)).toBeTruthy();
  });
});
