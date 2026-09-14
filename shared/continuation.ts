/**
 * A RUN THE PLAYER IS IN THE MIDDLE OF, AS A FACT ABOUT THE RECORD RATHER THAN ABOUT A COMPONENT.
 *
 * WHY THIS MODULE EXISTS. `deriveNextAction`'s first two branches are `continue-drill` and
 * `continue-transfer`, and they outrank everything -- a pre-registered set of eight positions with
 * four of them answered tests nothing, so finishing it is the only act that makes the four already
 * committed mean anything. Both branches were unreachable in production, because the only holder of
 * "a run is under way" was thirteen `useState` hooks in `Home.tsx` (`:377-400`), and a hook is
 * invisible to every screen that is not that screen, including that screen after a reload.
 *
 * `docs/decisions/D22-next-action-ownership.md` named this as the reversal condition that reopens
 * the design:
 *
 *   > **The blind spots close.** A drill and a transfer live in `Home.tsx`'s component state and do
 *   > not survive navigating away -- a LAW 4 defect with its own row. While they are invisible to
 *   > every other surface, `continue-drill` and `continue-transfer` are proposals no screen could
 *   > ever have agreed with, and a derivation cannot own a state whose highest-priority input it
 *   > cannot see.
 *
 * NOTHING NEW IS STORED AND NOTHING IS LIFTED. Both runs were ALREADY persisted before this module:
 * `beginDrill` writes a `StoredDrill` and `beginLearningTransfer` writes a `LearningTransfer`, both
 * before the first position is shown, because a test whose terms are not written down in advance is
 * not pre-registered. What was missing was not a write -- it was a READ. This module is that read's
 * arithmetic, kept away from any store so it can be tested against arrays.
 *
 * WHAT IS DELIBERATELY *NOT* HERE: the cursor. Which position of the run is on screen right now is
 * genuinely `Home.tsx`'s, it is genuinely lost on navigation, and centralising it would be lifting
 * eight hooks into a store to answer a question the policy never asks. The policy asks whether a
 * run is OPEN and how much of it is DONE. Both are answerable from the record, and `progressOf`
 * below is the argument for why `done` needs no new write either.
 */
import type { DrillSpec } from "./claim.js";
import type { RecordStore } from "./record-store.js";

/**
 * The one run that outranks everything else, or `null` for none.
 *
 * ONE VALUE AND NOT TWO FIELDS. A record cannot hold an open drill and an open transfer that both
 * deserve to be finished first; the derivation ranks the drill above the transfer and this type
 * makes the choice once, where it can be tested, rather than at each of three call sites.
 *
 * `runId` RATHER THAN `drillId` / `transferId`. The two `NextAction` kinds keep their own names
 * because their SENTENCES differ -- `shared/next-action.ts` argues that at length for the same
 * pair -- but the thing a reader needs from this object is which run and how far in, and a reader
 * that had to branch on the key to find the id would be doing the branch twice.
 */
export type ActiveContinuation =
  | { kind: "drill"; runId: string; done: number; total: number }
  | { kind: "transfer"; runId: string; done: number; total: number };

/**
 * How far into a drill the record says the player is.
 *
 * `done` IS COUNTED FROM THE ATOMS AND NEEDS NO NEW WRITE, and the reason is a property of how
 * drills are built rather than a convenience. `beginDrill` calls `selectDrillPositions(available,
 * decidedFens, ...)` -- every position in a drill spec is one the player had NOT decided when the
 * drill started. So an atom on a drill's fen can only have been recorded during the drill, and
 * counting them is exact without a timestamp to compare against.
 *
 * THE TRANSFER DOES NOT NEED THIS FUNCTION, because it already writes each observation as it
 * happens: `saveLearningTransferObservation` is append-only per position and
 * `record-store.ts` says why -- *"These used to be held in React state for the whole run and reach
 * the server only at completion, and three defects came out of that one choice."* The drill has the
 * identical defect and this read is the cheap half of the repair: it recovers the COUNT without
 * recovering the cursor. The expensive half -- resuming a drill mid-position after a reload -- is
 * not attempted here and is named in `docs/ARCHITECTURE_UI_AUTHORITY_TRANSFER.md`.
 *
 * A SET, NOT A COUNT OF MATCHES. Two drill positions can share a fen only if the selection let
 * them, and counting matches rather than matched positions would then report a run more finished
 * than it is.
 */
export function drillProgress(spec: DrillSpec, decidedFens: readonly string[]): {
  done: number;
  total: number;
} {
  const decided = new Set(decidedFens);
  return {
    done: spec.fens.filter((fen) => decided.has(fen)).length,
    total: spec.fens.length,
  };
}

/**
 * THE RUN THE PLAYER IS IN THE MIDDLE OF, AND THE RULE THEY WROTE THAT NOTHING HAS TESTED.
 *
 * ONE READ FOR TWO QUESTIONS, and they are two questions rather than one. The first is
 * `deriveNextAction`'s branches 1 and 2, the second is its branch 5, and they are answered together
 * because they are answered from the same rows: `listLearningRules` is the start of both the
 * transfer walk and the untested-rule check, so splitting them would cost a second pass over the
 * same table to answer half of what one pass already has.
 *
 * NOTHING HERE IS NEW STATE. Every value is read back off writes the product already made before
 * the first position of a run was shown. The defect being repaired is that nothing could read them.
 *
 * `untestedRule` IS `grade === "hypothesis" && retrieval_step === 0`, AND THE SECOND CONJUNCT IS
 * THE ONE THAT MATTERS. `gradeLearningRule` folds every completed sitting over the rule and steps
 * `retrieval_step` per result, so a rule that has been tested once and neither replicated nor
 * refuted is still graded `hypothesis` -- with `retrieval_step > 0`. Reading the grade alone would
 * call that rule untested, and `shared/next-action.ts` says what `test-hypothesis` means: *"a
 * pattern was found retrospectively and needs a forward test that could come back negative."* A
 * test that already came back is not that. Whether a rule that HAS been tested is DUE again is the
 * retrieval schedule's question -- `next_due_at` -- and it is deliberately not answered here,
 * because a derivation that proposed a scheduled repetition under the sentence "your rule has never
 * been tested" would be saying something false to the player.
 *
 * THE OLDEST FIRST, so that a record with two untested rules proposes the same one on every read.
 * A proposal that changed between two page loads over the same record would be a policy the player
 * could not learn.
 */
export async function continuationReading(store: RecordStore): Promise<{
  drill: ActiveContinuation | null;
  transfer: ActiveContinuation | null;
  untestedRule: string | null;
}> {
  const [openDrills, rules, atoms] = await Promise.all([
    store.listOpenDrills(),
    store.listLearningRules(),
    store.listAtoms(),
  ]);
  const decidedFens = atoms.map((atom) => atom.entry_state.fen);
  /*
   * THE MOST RECENT, NOT THE OLDEST, AND THE REASON IS THE ONE THING THIS READ CANNOT SEE.
   *
   * `listOpenDrills` returns drills started and never reported -- which is not the same set as
   * drills the player is still in. `closeDrill` (`Home.tsx:1391`) resets component state and writes
   * no result row, so a drill drawn at the briefing and dismissed stays open in the record forever.
   * Nothing in the record distinguishes it from one the player walked away from mid-way and means
   * to finish, and this module is not the place to invent the distinction.
   *
   * What it CAN do is refuse to let a stale one mask a live one: taking the newest means a drill
   * started ten seconds ago outranks one abandoned last month, so the proposal tracks what the
   * player most recently chose to do. The stale-drill gap itself is a product question and is
   * recorded as a blocking precondition in `docs/ARCHITECTURE_UI_AUTHORITY_TRANSFER.md`.
   */
  const newest = openDrills[openDrills.length - 1] ?? null;
  const drill: ActiveContinuation | null =
    newest === null
      ? null
      : { kind: "drill", runId: newest.spec.drill_id, ...drillProgress(newest.spec, decidedFens) };

  const ordered = [...rules].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let transfer: ActiveContinuation | null = null;
  const beingTested = new Set<string>();
  for (const rule of ordered) {
    const open = await store.getOpenLearningTransfer(rule.rule_id);
    if (!open) continue;
    beingTested.add(rule.rule_id);
    if (transfer !== null) continue;
    const seen = await store.listLearningTransferObservations(open.transfer_id);
    transfer = {
      kind: "transfer",
      runId: open.transfer_id,
      done: seen.length,
      total: open.fens.length,
    };
  }

  /*
   * A RULE WHOSE TEST IS ALREADY RUNNING IS NOT UNTESTED. It is branch 2, not branch 5, and
   * proposing that the player start a forward test they are three positions into would offer them
   * a second draw over the same rule -- the exact thing `getOpenLearningTransfer` exists to refuse.
   */
  const untested =
    ordered.find(
      (rule) =>
        rule.grade === "hypothesis" &&
        rule.retrieval_step === 0 &&
        !beingTested.has(rule.rule_id),
    ) ?? null;

  return { drill, transfer, untestedRule: untested?.rule_id ?? null };
}
