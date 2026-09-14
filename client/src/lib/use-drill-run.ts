/**
 * A DRILL, FROM THE PRESS THAT STARTS ONE TO THE PRESS THAT PUTS IT DOWN.
 *
 * WHY A HOOK RATHER THAN SIX `useState` CALLS IN THE PAGE, and the argument is `useNewGameSetup`'s
 * one file over: `Home.tsx` is under a ratchet whose number is pieces of state in one scope, and
 * the file's own note says why that number is the one pinned -- *"line count is a symptom;
 * fifty-odd pieces of state in one scope is the cause."* These six belong together. They are set
 * together on every transition, read together by `DrillRunner`, and there is no state of the board
 * in which one of them is meaningful without the rest.
 *
 * `docs/... the file that only ever grew` SAYS THE CEILINGS ONLY GO DOWN, and this is what paying
 * for that looks like: a group that really is one thing moves out, and the ceiling tightens behind
 * it. What did NOT move is anything the rest of the page closes over -- the board, the engine, the
 * commitment draft -- because threading those through would be the redesign that note is sceptical
 * of.
 *
 * THE BOARD IS INJECTED AND NOT OWNED. A drill starting, advancing, closing or resuming all clear
 * the position and put the player back on `deciding`, and that state is genuinely the page's: the
 * same board serves free play, a loaded game and a transfer. `DrillBoard` below is the two things a
 * drill needs to ask of it, named so the hook cannot reach further.
 */
import { useCallback, useRef, useState } from "react";

import type { DrillStage } from "@/components/DrillRunner";
import { readableFailureText } from "@/lib/commit-error";
import { retryOnce } from "@/lib/retry-once";
import type { DrillSpec } from "@shared/claim";

/**
 * What a drill may ask of the board it is borrowing.
 *
 * TWO METHODS AND NOT FIVE SETTERS, deliberately. `advanceDrill` used to call `setAnalysis`,
 * `setRevealInputs`, `setCommittedDraft`, `setCandidateMove`, `setCandidatesConsidered` and
 * `setCommitError` one after another, which is six chances for a later edit to forget one and leave
 * the previous position's reveal on screen over the next position's board. Naming the ACT means the
 * page decides once what clearing a position means.
 */
export interface DrillBoard {
  /** Forget everything about the position just answered: the analysis, the reveal, the draft. */
  clearPosition: () => void;
  /** Clear the position and put the player back in front of a board, with a sentence saying why. */
  backToDeciding: (notice: string) => void;
}

/** The mutations a drill drives, injected so this file names no query client. */
export interface DrillMutations {
  start: { mutateAsync: (input: { claim_id: string; candidate_fens: string[] }) => Promise<{ drill: DrillSpec | null; reason: string | null }> };
  complete: {
    mutateAsync: (input: { drill_id: string; decision_ids: string[] }) => Promise<{
      description: string;
      claim: { grade: string };
    }>;
  };
  abandon: { mutateAsync: (input: { drill_id: string }) => Promise<unknown> };
  restore: {
    fetch: (drillId: string) => Promise<
      | {
          ok: true;
          restore: {
            spec: DrillSpec;
            decisionIds: readonly string[];
            cursor: number;
            done: number;
            total: number;
          };
        }
      | { ok: false; because: unknown }
    >;
  };
}

export function useDrillRun({
  history,
  clearPosition,
  backToDeciding,
  startDrillMutation,
  completeDrillMutation,
  abandonDrillMutation,
  restoreDrill,
}: {
  history: readonly { fen: string }[];
  startDrillMutation: DrillMutations["start"];
  completeDrillMutation: DrillMutations["complete"];
  abandonDrillMutation: DrillMutations["abandon"];
  restoreDrill: DrillMutations["restore"];
} & DrillBoard) {
  /*
   * HELD ONCE, because the page passes fresh closures on every render and every callback below
   * lists the board in its dependencies. Without this the four transitions would be rebuilt each
   * render and `useCallback` would be buying nothing -- and the resume effect that lists
   * `resumeDrill` would fire on every render instead of once.
   */
  const board = useRef<DrillBoard>({ clearPosition, backToDeciding });
  board.current = { clearPosition, backToDeciding };
  // --- Drill state ------------------------------------------------------------------------
  // A drill overrides where the board's position comes from. The decision protocol is
  // unchanged: same CommitmentScreen, same commit-before-reveal, same record.
  const [drill, setDrill] = useState<DrillSpec | null>(null);
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillDecisionIds, setDrillDecisionIds] = useState<string[]>([]);
  const [drillStage, setDrillStage] = useState<DrillStage>("briefing");
  const [drillVerdict, setDrillVerdict] = useState<{
    description: string;
    refuted: boolean;
  } | null>(null);
  const [drillError, setDrillError] = useState<string>();

  /** Ask the server for a drill. The refutation condition is stored there before it returns. */
  const beginDrill = useCallback(
    async (claimId: string) => {
      setDrillError(undefined);
      // Offer every position from the loaded game. The server decides which are usable by
      // excluding the ones already decided -- it holds decisions, not games.
      const candidates = history.map((snapshot) => snapshot.fen);
      if (candidates.length === 0) {
        setDrillError("אין משחק טעון שאפשר לקחת ממנו עמדות. טענו PGN קודם.");
        return;
      }
      try {
        const response = await startDrillMutation.mutateAsync({
          claim_id: claimId,
          candidate_fens: candidates,
        });
        if (!response.drill) {
          setDrillError(response.reason ?? "אי אפשר לבנות דריל כרגע.");
          return;
        }
        setDrill(response.drill);
        setDrillIndex(0);
        setDrillDecisionIds([]);
        setDrillVerdict(null);
        setDrillStage("briefing");
      } catch (error) {
        setDrillError(readableFailureText(error, "הדריל לא התחיל."));
      }
    },
    [history, startDrillMutation],
  );

  /** Advance to the next drill position, or close the drill and grade the claim. */
  const advanceDrill = useCallback(async () => {
    if (!drill) return;
    const next = drillIndex + 1;
    board.current.clearPosition();

    if (next < drill.fens.length) {
      setDrillIndex(next);
      board.current.backToDeciding(`עמדה ${next + 1} מתוך ${drill.fens.length} בדריל.`);
      return;
    }

    setDrillStage("reporting");
    /*
     * THE SAME PAYLOAD, TWICE, for the same reason the reveal does it.
     *
     * `finishDrill` gained an idempotent replay branch that repairs a claim whose grade write was
     * lost -- and it was unreachable from here. This catch sets the stage to "done", not back to
     * "running" the way the transfer runner does, and at "done" with no verdict `DrillRunner`
     * renders an error paragraph and no control at all: the verdict block is gated on `verdict`
     * and the abandon button on briefing|running. The drill id lives only in React state, so a
     * reload discards it. Nothing would ever have called `completeDrill` with it again.
     *
     * A server-side repair branch nothing retries is worth nothing. One retry, with the object
     * already built -- the decision ids are the record's, not recomputed, so the second attempt
     * asks the identical question and the replay branch answers it.
     */
    const drillPayload = { drill_id: drill.drill_id, decision_ids: drillDecisionIds };
    try {
      const result = await retryOnce(() => completeDrillMutation.mutateAsync(drillPayload));
      // Reported either way -- a refutation is the result, not a failure to report.
      setDrillVerdict({
        description: result.description,
        refuted: result.claim.grade === "refuted",
      });
      setDrillStage("done");
    } catch (error) {
      setDrillError(readableFailureText(error, "אי אפשר היה לסגור את הדריל."));
      setDrillStage("done");
    }
  }, [completeDrillMutation, drill, drillDecisionIds, drillIndex]);

  /**
   * PUT THE DRILL DOWN, AND WRITE THAT THE PLAYER DID.
   *
   * THIS USED TO RESET ELEVEN HOOKS AND WRITE NOTHING, and once any surface routes on "a drill is
   * open" that is a defect with teeth: the drill stayed open in the record forever, so a player who
   * drew one at the briefing and dismissed it would be sent back to it on every arrival, from every
   * screen, indefinitely. `docs/LEARNING_COMMITMENT_CONTINUITY.md` §2 argues the three ways out and
   * why this is the one that reads what the player actually did.
   *
   * THE WRITE IS NOT AWAITED BEFORE THE SCREEN CLEARS, and that is the right order. The player asked
   * to leave; holding the board while a request goes out would make their own decision feel like it
   * needed permission. If the write fails the drill stays open, which is the recoverable direction:
   * they are offered it again and can close it again. The unrecoverable direction would be clearing
   * the screen on a drill this reset cannot name afterwards, and the id is read before the reset for
   * exactly that reason.
   *
   * A VERDICT IS NOT WRITTEN AND NO CLAIM IS GRADED. `finishDrill` is the only path that may do
   * either and it refuses a partial set. An abandonment is the absence of evidence, recorded as
   * such -- not a result, and never counted as a forward test that ran.
   */
  const closeDrill = () => {
    const closing = drill?.drill_id ?? null;
    if (closing !== null) {
      void abandonDrillMutation
        .mutateAsync({ drill_id: closing })
        .catch(() => {
          /* Still open in the record, and every surface will say so. One more press closes it. */
        });
    }
    setDrill(null);
    setDrillIndex(0);
    setDrillDecisionIds([]);
    setDrillVerdict(null);
    setDrillStage("briefing");
    setDrillError(undefined);
    board.current.backToDeciding("בחרו מהלך.");
  };

  /**
   * PUT THE PLAYER BACK INSIDE A DRILL THEY ALREADY STARTED.
   *
   * WHAT IS RESTORED AND WHY EACH PIECE HAS TO BE. The spec, so the set being tested is the set that
   * was registered. The decision ids, because `finishDrill` takes them and refuses any set whose
   * size is not the registered size -- a run that could be continued and never reported would leave
   * a claim frozen with no path that could test it, which is the deadlock the transfer path was
   * fixed for one cycle ago. And the cursor, because resuming at zero would re-serve a board whose
   * engine verdict the player has already read.
   *
   * NOTHING IS RE-SELECTED. `restoreDrillRun` reads the positions, their order and the refutation
   * condition back from the record exactly as stored. A resume that chose fresh positions would be
   * a player picking their own evidence after seeing part of it, under a stamp that says they did
   * not.
   *
   * THE STAGE IS `running` AND NOT `briefing`, because the briefing is where the terms are shown
   * BEFORE the test starts. Somebody four positions in has read them.
   */
  const resumeDrill = useCallback(
    async (drillId: string) => {
      setDrillError(undefined);
      try {
        const outcome = await restoreDrill.fetch(drillId);
        if (!outcome.ok) {
          /*
           * NOT "START A NEW ONE". The run exists and the record cannot reconstruct where it got
           * to; saying so is the honest exit and offering a fresh drill over the same claim would
           * be the evidence-selection this whole path is built to refuse.
           */
          setDrillError(
            "הסט הזה פתוח, אבל אי אפשר להמשיך אותו: ההיסטוריה לא יכולה להגיד על אילו עמדות כבר עניתם.",
          );
          return;
        }
        const { spec, decisionIds, cursor, done, total } = outcome.restore;
        setDrill(spec);
        setDrillIndex(cursor);
        setDrillDecisionIds([...decisionIds]);
        setDrillVerdict(null);
        setDrillStage("running");
        board.current.backToDeciding(`עמדה ${done + 1} מתוך ${total} בסט שהתחלתם.`);
      } catch (error) {
        setDrillError(readableFailureText(error, "לא הצלחנו לפתוח מחדש את הסט."));
      }
    },
    [restoreDrill],
  );

  return {
    drill,
    drillIndex,
    drillDecisionIds,
    drillStage,
    drillVerdict,
    drillError,
    /* The two writes the page still makes itself: a committed decision, and the briefing's start. */
    setDrillDecisionIds,
    setDrillStage,
    beginDrill,
    advanceDrill,
    closeDrill,
    resumeDrill,
  };
}
