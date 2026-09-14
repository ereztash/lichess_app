/**
 * A LEARNING COMMITMENT THE PLAYER HAS ALREADY STARTED, AND WHETHER IT IS STILL LIVE.
 *
 * WHAT THIS MODULE IS FOR. A drill and a transfer are pre-registered tests: eight positions, or
 * three, written down with their refutation condition before the first board is shown. Four of
 * eight answered tests nothing, so finishing the set is the only act that makes the four already
 * committed mean anything. `deriveNextAction`'s first two branches say exactly that -- they
 * outrank everything -- and this module is the read that makes them reachable from a surface that
 * is not the one running the test.
 *
 * WHAT WAS THERE BEFORE AND WHY IT WAS NOT ENOUGH. The previous version of this file answered one
 * question -- "is a run open" -- with `ActiveContinuation | null`, and that null carried four
 * different facts at once: this record has never drilled; a drill is open in another tab and has
 * just been reported; the player closed one a minute ago; and the read did not come back. A screen
 * handed that null cannot tell a finished commitment from a failed request, and the failure mode
 * is the expensive direction -- it offers to start something new over a set the player is halfway
 * through. `LiveLearningCommitment` below makes the four unrepresentable as one value.
 *
 * NOTHING NEW IS WRITTEN EXCEPT AN ENDING. Both runs were already persisted before this module:
 * `beginDrill` writes a `StoredDrill` and `beginLearningTransfer` writes a `LearningTransfer`,
 * both before the first position is shown, because a test whose terms are not written down in
 * advance is not pre-registered. The one write this work added is `StoredDrill.abandoned_at`, and
 * it exists because closing a drill wrote nothing at all -- see `abandonDrill` in
 * `shared/record-store.ts` and the argument in `docs/LEARNING_COMMITMENT_CONTINUITY.md` §2.
 *
 * THE RANKING IS NOT HERE. Which of an open drill and an open transfer the player should be sent
 * back to is `deriveNextAction`'s branch order and is answered there, once. This module reports
 * both slots and picks neither; a second ranking would be a second policy, and two policies over
 * one record is the defect `docs/decisions/D22-next-action-ownership.md` is about.
 */
import { drillProgress, drillRestorability, type Restorability } from "./drill-restore.js";
import type { DecisionAtom } from "./decision-atom.js";
import type { RecordStore, StoredDrill } from "./record-store.js";

export type { Restorability } from "./drill-restore.js";

/** The two things a player can be in the middle of. Both are pre-registered; neither is a game. */
export type CommitmentKind = "drill" | "transfer";

/**
 * One run, and how far into it the record says the player is.
 *
 * `runId` RATHER THAN `drillId` / `transferId`. The two `NextAction` kinds keep their own names
 * because their SENTENCES differ -- `shared/next-action.ts` argues that at length for the same
 * pair -- but what a reader needs from this object is which run and how far in, and a reader that
 * had to branch on the key to find the id would be doing the branch twice.
 */
export interface CommitmentRun {
  readonly kind: CommitmentKind;
  readonly runId: string;
  /**
   * The id the resume path takes, which is NOT always `runId`.
   *
   * A DRILL IS REOPENED BY ITS OWN ID and a transfer BY THE RULE IT TESTS, and the asymmetry is the
   * record's rather than this type's. `startLearningTransfer` takes a `rule_id` and hands back
   * whichever transfer is open over it, together with how far it got -- that read exists precisely
   * so a lost tab can resume, and the rule is the handle it offers. A drill has no such owner: a
   * claim may be drilled more than once, so "the open drill of claim X" is not a question with one
   * answer, and `getDrill` takes the drill's own id.
   *
   * CARRIED HERE RATHER THAN LOOKED UP AT THE CONTROL, because a control that had to know which
   * kind takes which id would be a third place that knows it, after this module and the board.
   */
  readonly resumeWith: string;
  readonly done: number;
  readonly total: number;
}

/**
 * Why the record could not say anything about a commitment.
 *
 * TWO CASES AND NOT ONE, because they call for different sentences. A read nobody has attempted
 * yet is a screen that is still loading; a read that came back an error is a screen that must not
 * pretend the record is empty. Neither is "there is no commitment", which is the whole point of
 * the state they both belong to.
 */
export type UnknownBecause = "not-attempted" | "read-failed";

/**
 * WHAT THE RECORD SAYS ABOUT THE PLAYER'S LEARNING COMMITMENT. Five states, none collapsible.
 *
 * The distinctions are the point, so they are stated as the differences they protect:
 *
 *   `unknown` vs everything else -- a failed or pending read is not an empty record. A surface
 *     that renders `none` while a request is in flight tells a player halfway through a drill that
 *     they have nothing open, and offers them something else, and that is the sentence they act on.
 *
 *   `none` vs `completed` -- "you have never started one of these" and "you finished the last one"
 *     are different things to say to a person, and only one of them is an achievement.
 *
 *   `completed` vs `abandoned` -- both are terminal and neither may be revived, but a drill that
 *     reported has a verdict that graded a claim, and a drill the player closed produced no
 *     evidence at all. A registry that folded the second into the first would be reporting
 *     pre-registered tests that never ran.
 *
 *   `active` vs all of them -- this is the only state with behavioural priority, and the only one
 *     that may suppress another surface's primary control.
 */
export type LiveLearningCommitment =
  | { readonly state: "unknown"; readonly kind: CommitmentKind; readonly because: UnknownBecause }
  | { readonly state: "none"; readonly kind: CommitmentKind }
  | { readonly state: "completed"; readonly kind: CommitmentKind; readonly runId: string }
  | { readonly state: "abandoned"; readonly kind: CommitmentKind; readonly runId: string }
  | {
      readonly state: "active";
      readonly kind: CommitmentKind;
      readonly run: CommitmentRun;
      readonly restore: Restorability;
    };

/** `unknown` for both slots, which is what a surface holds before its query resolves. */
export const COMMITMENT_UNREAD: ContinuationReading = {
  drill: { state: "unknown", kind: "drill", because: "not-attempted" },
  transfer: { state: "unknown", kind: "transfer", because: "not-attempted" },
  untestedRule: null,
};

/** `unknown` for both slots because a read was made and failed. Never `none`. */
export const COMMITMENT_READ_FAILED: ContinuationReading = {
  drill: { state: "unknown", kind: "drill", because: "read-failed" },
  transfer: { state: "unknown", kind: "transfer", because: "read-failed" },
  untestedRule: null,
};

/**
 * The two slots plus the rule nothing has tested, from one pass over the record.
 *
 * ONE READ FOR THREE QUESTIONS, and they are three rather than one. The first two are
 * `deriveNextAction`'s branches 1 and 2, the third is its branch 5, and they are answered together
 * because they are answered from the same rows: `listLearningRules` is the start of both the
 * transfer walk and the untested-rule check, so splitting them would cost a second pass over the
 * same table to answer half of what one pass already has.
 */
export interface ContinuationReading {
  readonly drill: LiveLearningCommitment;
  readonly transfer: LiveLearningCommitment;
  readonly untestedRule: string | null;
}

/**
 * THE STATE OF BOTH COMMITMENTS AND THE RULE NOTHING HAS TESTED.
 *
 * `untestedRule` IS `grade === "hypothesis" && retrieval_step === 0`, AND THE SECOND CONJUNCT IS
 * THE ONE THAT MATTERS. `gradeLearningRule` folds every completed sitting over the rule and steps
 * `retrieval_step` per result, so a rule that has been tested once and neither replicated nor
 * refuted is still graded `hypothesis` -- with `retrieval_step > 0`. Reading the grade alone would
 * call that rule untested, and `shared/next-action.ts` says what `test-hypothesis` means: *"a
 * pattern was found retrospectively and needs a forward test that could come back negative."* A
 * test that already came back is not that.
 *
 * THE OLDEST FIRST, so that a record with two untested rules proposes the same one on every read.
 * A proposal that changed between two page loads over the same record would be a policy the player
 * could not learn.
 */
export async function continuationReading(store: RecordStore): Promise<ContinuationReading> {
  const [openDrills, allDrills, rules, atoms] = await Promise.all([
    store.listOpenDrills(),
    store.listDrills(),
    store.listLearningRules(),
    store.listAtoms(),
  ]);

  return {
    drill: drillCommitment(openDrills, allDrills, atoms),
    ...(await transferCommitment(store, rules)),
  };
}

/**
 * THE MOST RECENT OPEN DRILL, NOT THE OLDEST, and the reason is what this read still cannot see.
 *
 * `listOpenDrills` now excludes drills the player closed, which is most of what used to make the
 * open set untrustworthy. What it cannot exclude is a drill whose tab died at the briefing, and
 * nothing in the record distinguishes that from one the player means to come back to -- correctly,
 * because the difference is in the player's head and inventing it here would be the reader deciding
 * a product question. Taking the newest means a drill started ten seconds ago outranks one left
 * open last month, so the proposal tracks what the player most recently chose to do.
 */
function drillCommitment(
  open: readonly StoredDrill[],
  all: readonly StoredDrill[],
  atoms: readonly DecisionAtom[],
): LiveLearningCommitment {
  const newestOpen = open[open.length - 1] ?? null;
  if (newestOpen !== null) {
    const { done, total } = drillProgress(newestOpen.spec, atoms);
    return {
      state: "active",
      kind: "drill",
      run: {
        kind: "drill",
        runId: newestOpen.spec.drill_id,
        resumeWith: newestOpen.spec.drill_id,
        done,
        total,
      },
      restore: drillRestorability(newestOpen.spec, atoms),
    };
  }
  const newest = all[all.length - 1] ?? null;
  if (newest === null) return { state: "none", kind: "drill" };
  /*
   * NOT OPEN AND NOT ABANDONED LEAVES EXACTLY ONE READING. `listOpenDrills` subtracts the reported
   * and the abandoned from the same set this list holds, so a drill that survives into `all` and
   * not into `open` has either an ending stamped on the row or a result row of its own.
   */
  return newest.abandoned_at !== null
    ? { state: "abandoned", kind: "drill", runId: newest.spec.drill_id }
    : { state: "completed", kind: "drill", runId: newest.spec.drill_id };
}

/**
 * The transfer slot, and the rule nothing has tested, from the same walk over the rules.
 *
 * `abandoned` IS UNREACHABLE HERE, AND THAT IS A FACT ABOUT THE PRODUCT RATHER THAN AN OVERSIGHT.
 * A transfer has no close control: `LearningTransferRunner` leaves the run open and
 * `startLearningTransfer` hands it back with its observation count, so the only endings a transfer
 * has are reported and still-running. The state exists on the type because the drill has it and
 * one type serves both slots; a reader that found `abandoned` on a transfer would be looking at a
 * bug, not at a state.
 *
 * A RULE WHOSE TEST IS ALREADY RUNNING IS NOT UNTESTED. It is branch 2, not branch 5, and
 * proposing that the player start a forward test they are three positions into would offer them a
 * second draw over the same rule -- the exact thing `getOpenLearningTransfer` exists to refuse.
 */
async function transferCommitment(
  store: RecordStore,
  rules: Awaited<ReturnType<RecordStore["listLearningRules"]>>,
): Promise<{ transfer: LiveLearningCommitment; untestedRule: string | null }> {
  const ordered = [...rules].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let transfer: LiveLearningCommitment | null = null;
  let reported: string | null = null;
  const beingTested = new Set<string>();
  for (const rule of ordered) {
    const open = await store.getOpenLearningTransfer(rule.rule_id);
    if (open) {
      beingTested.add(rule.rule_id);
      if (transfer === null) {
        const seen = await store.listLearningTransferObservations(open.transfer_id);
        transfer = {
          state: "active",
          kind: "transfer",
          run: {
            kind: "transfer",
            runId: open.transfer_id,
            resumeWith: rule.rule_id,
            done: seen.length,
            total: open.fens.length,
          },
          /*
           * ALWAYS RESTORABLE, because the transfer already had the repair the drill is getting.
           * `saveLearningTransferObservation` is append-only per position and
           * `startLearningTransfer` returns the open run together with `observed`, so a resumed
           * transfer lands on the first board nobody has answered without any reconstruction here.
           */
          restore: { ok: true },
        };
      }
      continue;
    }
    if (reported === null) {
      const results = await store.listLearningTransferResults(rule.rule_id);
      const last = results[results.length - 1] ?? null;
      if (last) reported = last.transfer_id;
    }
  }
  const untested =
    ordered.find(
      (rule) =>
        rule.grade === "hypothesis" && rule.retrieval_step === 0 && !beingTested.has(rule.rule_id),
    ) ?? null;
  return {
    transfer:
      transfer ??
      (reported === null
        ? { state: "none", kind: "transfer" }
        : { state: "completed", kind: "transfer", runId: reported }),
    untestedRule: untested?.rule_id ?? null,
  };
}
