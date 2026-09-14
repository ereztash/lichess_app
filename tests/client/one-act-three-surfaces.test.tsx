// @vitest-environment jsdom
/**
 * ONE SEMANTIC ACT, THREE LEGITIMATE PRESENTATIONS, AND NO SECOND RANKING.
 *
 * WHAT THIS FILE IS ABOUT. A drill and a transfer are pre-registered tests, and `deriveNextAction`
 * puts finishing one above every other branch. Until this work the product had a single control
 * that could express that act -- inside the run, in `Home.tsx`'s header, under
 * `learningTransferStage === "running"` -- so it was reachable only by somebody who was already
 * there. Navigate away and the commitment survived as a ROW and not as a PRIORITY: every screen went
 * on offering a new game at full weight, and nothing anywhere said a set was waiting.
 *
 * WHY THE OFFER IS TESTED RATHER THAN THE MARKUP. Three surfaces render this act and each renders it
 * in its own frame -- a bare button on the front door, a card action on the resume screen, the slot
 * under the post-game summary. What must be identical across the three is WHICH ACT they offer and
 * WHEN they stand their own primary down, and both are `continuationOffer`'s answer. A test that
 * asserted three DOM shapes would be pinning presentation and would go red the first time a
 * designer moved a button.
 */
import { describe, expect, it } from "vitest";
import { continuationOffer } from "@/components/ContinueCommitment";
import { CONTINUE_HEADLINE } from "@/components/ContinueCommitment";
import {
  COMMITMENT_READ_FAILED,
  COMMITMENT_UNREAD,
  type ContinuationReading,
  type LiveLearningCommitment,
} from "@shared/continuation";
import { PRIMARY_ACTIONS } from "@shared/primary-action";

const active = (
  kind: "drill" | "transfer",
  over: { done?: number; total?: number; ok?: boolean } = {},
): LiveLearningCommitment => ({
  state: "active",
  kind,
  run: {
    kind,
    runId: `${kind}-1`,
    resumeWith: kind === "drill" ? "drill-1" : "rule-1",
    done: over.done ?? 3,
    total: over.total ?? 8,
  },
  restore: over.ok === false ? { ok: false, because: "progress-ambiguous" } : { ok: true },
});

const reading = (over: Partial<ContinuationReading> = {}): ContinuationReading => ({
  drill: { state: "none", kind: "drill" },
  transfer: { state: "none", kind: "transfer" },
  untestedRule: null,
  ...over,
});

describe("what every surface is told about a set the player started", () => {
  it("offers the drill when both are open, because that is the ladder's order and not a new one", () => {
    /*
     * THE RANKING IS `deriveNextAction`'s AND IS ASKED THERE. `continue-drill` is branch 1 and
     * `continue-transfer` is branch 2; a control that compared the two itself would be a second
     * policy over one record, and the two would drift the first time the order changed.
     */
    const offer = continuationOffer(
      reading({ drill: active("drill"), transfer: active("transfer") }),
    );
    expect(offer.kind).toBe("resume");
    if (offer.kind !== "resume") return;
    expect(offer.commitment.kind).toBe("drill");
  });

  it("offers the transfer when only the transfer is open", () => {
    const offer = continuationOffer(reading({ transfer: active("transfer", { total: 3 }) }));
    expect(offer.kind).toBe("resume");
    if (offer.kind !== "resume") return;
    /* And by the rule, not the transfer id: that is what resuming one takes. */
    expect(offer.commitment.run.resumeWith).toBe("rule-1");
  });

  it("is silent on a record that has read and found nothing open", () => {
    expect(continuationOffer(reading()).kind).toBe("silent");
    /* Finished and closed are terminal too, and neither may be revived. */
    expect(
      continuationOffer(
        reading({ drill: { state: "completed", kind: "drill", runId: "d1" } }),
      ).kind,
    ).toBe("silent");
    expect(
      continuationOffer(
        reading({ drill: { state: "abandoned", kind: "drill", runId: "d1" } }),
      ).kind,
    ).toBe("silent");
  });

  it("never reads a failed or pending request as a record with nothing open", () => {
    /*
     * THE FAILURE THIS EXISTS FOR. `data: undefined` on a failed query is indistinguishable from a
     * query that has not run, and a surface that rendered both as silence would tell a player four
     * positions into an eight-position set that they had nothing waiting -- and then offer them
     * something else, at full weight, which is the sentence they would act on.
     */
    expect(continuationOffer(COMMITMENT_UNREAD).kind).toBe("unreadable");
    expect(continuationOffer(COMMITMENT_READ_FAILED).kind).toBe("unreadable");
    /* And `unreadable` is not `silent`, which is the whole of the distinction. */
    expect(continuationOffer(COMMITMENT_UNREAD).kind).not.toBe("silent");
  });

  it("says a set cannot be reopened rather than offering a fresh one", () => {
    const offer = continuationOffer(reading({ drill: active("drill", { ok: false }) }));
    expect(offer.kind).toBe("stuck");
  });
});

describe("which surface stands down, and when", () => {
  /**
   * The rule the three surfaces share, stated once.
   *
   * `resume` IS THE ONLY STATE THAT SUPPRESSES ANYTHING. LAW 2 is about how many DIFFERENT acts a
   * state asks a player to choose between, and a set they can be put back into is an act that
   * outranks a new game by the derivation's own order. A set that cannot be reopened offers no act
   * at all, so nothing outranks anything; a read that failed has decided nothing and may not
   * silence a control either.
   */
  const suppresses = (r: ContinuationReading) => continuationOffer(r).kind === "resume";

  it("suppresses the competing primary only when the set can actually be reopened", () => {
    expect(suppresses(reading({ drill: active("drill") }))).toBe(true);
    expect(suppresses(reading({ drill: active("drill", { ok: false }) }))).toBe(false);
    expect(suppresses(COMMITMENT_READ_FAILED)).toBe(false);
    expect(suppresses(reading())).toBe(false);
  });
});

describe("what the player is told", () => {
  it("names a set of positions and never names the architecture", () => {
    /*
     * §12. The words a player reads are about what they were doing. "continuation", "canonical",
     * "branch" and "preregistered evidence set" are how this repository talks to itself.
     */
    const forbidden = [
      "continue-run",
      "continuation",
      "canonical",
      "branch",
      "next action",
      "preregistered",
      "רצף",
      "קנוני",
      "ענף",
    ];
    for (const sentence of Object.values(CONTINUE_HEADLINE)) {
      for (const word of forbidden) {
        expect(sentence.toLowerCase(), `"${sentence}" names "${word}"`).not.toContain(word);
      }
      /* And it says what the player did, which is the sentence §12 asks for. */
      expect(sentence).toContain("סיימו את הסט שהתחלתם");
    }
  });

  it("names an act the derivation already has a word for", () => {
    /*
     * A screen that offered an act the derivation cannot name is a screen the derivation could
     * never own. `continue-run` was in this vocabulary before this work and had one caller.
     */
    expect([...PRIMARY_ACTIONS]).toContain("continue-run");
  });
});
