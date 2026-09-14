/**
 * PUTTING A PLAYER BACK INSIDE A DRILL THEY ALREADY STARTED.
 *
 * WHY THIS IS ITS OWN MODULE AND NOT PART OF `shared/continuation.ts`. The two halves of continuity
 * are downloaded by different people. The READ -- is a set open, how far in -- is wanted by the
 * surfaces that offer to carry on, and every one of them is lazy. The RESTORE is wanted by the
 * board, and `Home.tsx` is a static import in `App.tsx`, so anything it reaches is in the chunk
 * every arrival downloads before anything renders. Keeping them in one file put the reading into
 * the entry chunk and measured **+2.6 kB raw** against a ceiling with 0.2 kB of room.
 *
 * IT IS THE SAME SPLIT, FOR THE SAME REASON, AS `continuation-api.ts` and `blitz-reading-api.ts`,
 * whose headers both say it in as many words: a reading only the lazy surfaces need does not belong
 * in the bytes everybody pays for.
 *
 * NOTHING HERE MUTATES THE REGISTRATION. The positions, their order, the refutation condition and
 * the direction are read and returned as stored. A resume that re-selected positions would be a
 * player choosing their own evidence after seeing part of it, under a stamp that says they did not.
 */
import { samePosition } from "./position-key.js";
import type { DecisionAtom } from "./decision-atom.js";
import type { DrillSpec } from "./claim.js";
import type { RecordStore, StoredDrill } from "./record-store.js";

/**
 * Whether the player can actually be put back into a run that is open.
 *
 * A SEPARATE QUESTION FROM WHETHER IT IS LIVE, and conflating them is the failure the continuity
 * brief names: *never turn "commitment exists but cannot be restored" into "start a new one"*. An
 * open drill whose progress the record cannot reconstruct is still the highest-priority thing about
 * this record. What changes is what a control may honestly do about it.
 */
export type Restorability =
  | { readonly ok: true }
  /**
   * `terms-unreadable` -- the spec could not be read back, so the set being tested is unknown.
   * `progress-ambiguous` -- the run is open and the record cannot say which of its positions were
   * answered. Reachable for real: `decisions.drill_id` shipped in migration `0015` and
   * `drills.predicts_overconfidence` in `0006`, so a drill started between them is gradeable,
   * still open, and its decisions carry no binding to it. Guessing by position would either
   * re-serve a board the player has already seen the engine's verdict for, or drop one of the
   * registered positions from a test that `finishDrill` will then refuse as incomplete.
   */
  | { readonly ok: false; readonly because: "terms-unreadable" | "progress-ambiguous" };

/**
 * Which of a drill's registered positions the record shows an answer for.
 *
 * MATCHED BY `drill_id` AND BY BOARD, BOTH, and neither alone would do.
 *
 *   `drill_id` alone cannot say WHICH registered position a decision answered, and the cursor
 *   needs that: a run resumed at the wrong board re-serves a position whose engine verdict the
 *   player has already read.
 *
 *   The board alone is what the previous version of this file used, and it is the client's word
 *   dressed up as the record's. `commitDecision` verifies `drill_id` against a drill stored before
 *   the decision was made and requires that drill to contain the position; nothing verifies a bare
 *   FEN coincidence. Two runs over the same game can register the same board.
 *
 * `samePosition` RATHER THAN STRING EQUALITY, because that is the predicate `finishDrill` grades
 * with. A progress count stricter than the grader's under-reports the run and sends the player to
 * a board they already answered; `finishDrill` then refuses the whole drill for having one
 * decision too many. Two readings of "which position is this" is the drift this closes.
 */
export function drillProgress(
  spec: DrillSpec,
  atoms: readonly DecisionAtom[],
): { done: number; total: number; answered: readonly boolean[] } {
  const mine = atoms.filter((atom) => atom.drill_id === spec.drill_id);
  const answered = spec.fens.map((fen) => mine.some((atom) => samePosition(atom.entry_state.fen, fen)));
  return { done: answered.filter(Boolean).length, total: spec.fens.length, answered };
}

/**
 * Whether an open drill can be re-entered, from the record alone.
 *
 * THE TEST IS AN AGREEMENT BETWEEN TWO COUNTS, and that is what makes it able to say "no". Every
 * position of a drill is one the player had NOT decided when the drill started -- `beginDrill`
 * calls `selectDrillPositions(available, decidedFens, ...)` -- so an atom on a drill's board can
 * only have been recorded during that drill. If the number of atoms BOUND to this drill differs
 * from the number of its registered boards that have an answer, then some decision in this run
 * carries no binding, or some board was answered twice, and either way the record cannot say which
 * positions remain. Saying so is the honest exit; guessing is how a pre-registered set loses a
 * position.
 */
export function drillRestorability(spec: DrillSpec, atoms: readonly DecisionAtom[]): Restorability {
  const bound = atoms.filter((atom) => atom.drill_id === spec.drill_id).length;
  const { done } = drillProgress(spec, atoms);
  return bound === done ? { ok: true } : { ok: false, because: "progress-ambiguous" };
}

/**
 * Everything a screen needs to put the player back inside a drill they started.
 *
 * `decisionIds` IS NOT A CONVENIENCE. `finishDrill` takes the decision ids as its input and then
 * refuses any set whose size is not the registered size, so a resumed run that could not
 * reconstruct them would be a run that can be continued and never reported -- a rule frozen with a
 * due date and no path that can test it, which is the deadlock the transfer path was fixed for one
 * cycle ago. They come from the record's own binding, which is the server-verified mirror of the
 * accumulator `Home.tsx` was keeping in `useState`.
 *
 * `cursor` IS THE FIRST UNANSWERED REGISTERED POSITION, in registration order. Not the count: a
 * run whose third board is unanswered and whose fourth is answered would otherwise resume on the
 * fourth and re-serve a decided board.
 */
export interface DrillRestore {
  readonly spec: DrillSpec;
  readonly decisionIds: readonly string[];
  readonly cursor: number;
  readonly done: number;
  readonly total: number;
}

/**
 * Read back a drill in progress, or say why it cannot be read back.
 *
 * IT RE-READS RATHER THAN TRUSTING WHAT A SCREEN CARRIED, because the screen asking to resume may
 * have been showing a list rendered a minute ago in another tab, and the terms of a pre-registered
 * test are not a thing to take on a stale client's word.
 *
 * NOTHING HERE MUTATES THE REGISTRATION. The positions, their order, the refutation condition and
 * the direction are read and returned as stored. A resume that re-selected positions would be a
 * player choosing their own evidence after seeing part of it, under a stamp that says they did not.
 */
export async function restoreDrillRun(
  store: RecordStore,
  drillId: string,
): Promise<{ ok: true; restore: DrillRestore } | { ok: false; because: Restorability }> {
  let stored: StoredDrill | null;
  try {
    stored = await store.getDrill(drillId);
  } catch {
    /* `getDrill` throws `MissingClaimDirection` on a spec that cannot be graded. Unfinishable. */
    return { ok: false, because: { ok: false, because: "terms-unreadable" } };
  }
  if (!stored) return { ok: false, because: { ok: false, because: "terms-unreadable" } };
  if (stored.abandoned_at !== null) {
    /* Closed by the player. Terminal, and reviving it would overwrite their own decision. */
    return { ok: false, because: { ok: false, because: "terms-unreadable" } };
  }
  const [atoms, ids] = await Promise.all([store.listAtoms(), store.listDecisionIds()]);
  const restorable = drillRestorability(stored.spec, atoms);
  if (!restorable.ok) return { ok: false, because: restorable };

  const { done, total, answered } = drillProgress(stored.spec, atoms);
  /*
   * THE IDS IN THE RECORD'S OWN ORDER, which is the order `listDecisionIds` parallels `listAtoms`
   * in. `finishDrill` puts them into a `Set`, so order carries no meaning downstream -- but a list
   * built by walking the registered positions would silently drop a duplicate binding instead of
   * producing the count mismatch `drillRestorability` exists to catch.
   */
  const decisionIds = atoms
    .map((atom, index) => (atom.drill_id === stored.spec.drill_id ? ids[index] : null))
    .filter((id): id is string => typeof id === "string");
  const firstUnanswered = answered.indexOf(false);
  return {
    ok: true,
    restore: {
      spec: stored.spec,
      decisionIds,
      /* Every board answered: the run is complete and belongs at its last position, reporting. */
      cursor: firstUnanswered === -1 ? Math.max(0, total - 1) : firstUnanswered,
      done,
      total,
    },
  };
}
