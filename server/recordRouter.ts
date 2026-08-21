/**
 * The record procedures (Layer A).
 *
 * R3 is enforced here, at the server, not in the interface: `reveal` REFUSES for a decision that
 * has not been committed. That is what makes GATE-COMMIT assertable on the network layer rather
 * than the DOM -- a DOM-only check passes happily while the answer sits in the props.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  boundedActionSchema,
  entryStateSchema,
  resultSchema,
  type DecisionAtom,
} from "../shared/decision-atom";
import { classifyPhase } from "../shared/phase";
import { MIN_BUCKET_N, detect } from "../shared/detector";
import { scoreDecisions, silenceReason } from "../shared/scoring";
import { selectClaim } from "../shared/claim-derivation";
import type { Claim } from "../shared/claim";
import type { RecordStore } from "./record";
import { protectedProcedure, router } from "./_core/trpc";

/**
 * The API event. Carries every atom field (section 3.1). `result` and `feedback` are present and
 * null at commit time: the engine has not spoken and the player has not revised anything.
 * GATE-ISO checks that the FIELD is here, not that it holds a value.
 */
export const commitEventSchema = z.object({
  decision_id: z.string().uuid(),
  entry_state: entryStateSchema,
  known: z.string().min(1).max(200),
  unknown: z.string().min(1).max(200),
  decision: z.string().min(4).max(6),
  bounded_action: boundedActionSchema,
  result: z.null(),
  feedback: z.null(),
});

export function buildRecordRouter(store: RecordStore) {
  return router({
    commitDecision: protectedProcedure
      .input(commitEventSchema)
      .mutation(async ({ input }): Promise<{ decision_id: string }> => {
        // Re-derive the phase from the FEN rather than trusting the client's label.
        const phase = classifyPhase(input.entry_state.fen, input.entry_state.ply);
        if (phase !== input.entry_state.phase) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `שלב המשחק שנשלח (${input.entry_state.phase}) אינו תואם את העמדה (${phase}).`,
          });
        }
        await store.commitDecision({
          decisionId: input.decision_id,
          gameId: input.entry_state.game_id,
          fen: input.entry_state.fen,
          ply: input.entry_state.ply,
          phase,
          clockMsRemaining: input.entry_state.clock_ms_remaining,
          secondsTaken: Math.round(input.bounded_action.seconds_taken),
          chosenMove: input.decision,
          candidateMovesConsidered: input.bounded_action.candidate_moves_considered,
          statedRead: input.known,
          statedUnknown: input.unknown,
          confidence: input.bounded_action.confidence,
        });
        // Deliberately returns no engine field of any kind.
        return { decision_id: input.decision_id };
      }),

    /**
     * Store the engine's verdict against an ALREADY COMMITTED decision, and hand back the atom.
     * Refuses when the decision was never recorded: that is R3 at the network boundary.
     */
    reveal: protectedProcedure
      .input(z.object({ decision_id: z.string().uuid(), result: resultSchema }))
      .mutation(async ({ input }): Promise<DecisionAtom> => {
        const existing = await store.getAtom(input.decision_id);
        if (!existing) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "אין החלטה רשומה למזהה הזה. המנוע אינו מדבר לפני שההחלטה נרשמה.",
          });
        }
        if (await store.hasReveal(input.decision_id)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "ההחלטה כבר נחשפה. הרשומה היא append-only.",
          });
        }
        await store.recordReveal(input.decision_id, input.result);
        const atom = await store.getAtom(input.decision_id);
        if (!atom) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "רשומה נעלמה." });
        return atom;
      }),

    feedback: protectedProcedure
      .input(
        z.object({
          decision_id: z.string().uuid(),
          revised_read: z.string().max(200),
          would_choose_again: z.boolean(),
        }),
      )
      .mutation(async ({ input }) => {
        if (!(await store.hasReveal(input.decision_id))) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "אי אפשר לתקן קריאה לפני שראית את התוצאה.",
          });
        }
        await store.recordFeedback(input.decision_id, {
          revisedRead: input.revised_read,
          wouldChooseAgain: input.would_choose_again,
        });
        return { decision_id: input.decision_id };
      }),

    atom: protectedProcedure
      .input(z.object({ decision_id: z.string().uuid() }))
      .query(({ input }) => store.getAtom(input.decision_id)),

    /** Cold-start reporting (section 6): the curve, not a single number. */
    count: protectedProcedure.query(async () => ({ decisions: await store.countDecisions() })),

    /**
     * The single claim to show, or an honest silence.
     *
     * A bucket needs MIN_BUCKET_N decisions inside it AND outside it, so the floor before any
     * claim is possible is twice that. Below it this returns `null` with a REASON rather than
     * an empty screen -- and the reason distinguishes "too few decisions" from "too few
     * revealed decisions", because those are different states.
     */
    claim: protectedProcedure.query(
      async (): Promise<{
        claim: Claim | null;
        othersWithheld: number;
        reason: string | null;
        recorded: number;
        scored: number;
      }> => {
        const atoms = await store.listAtoms();
        const ids = await store.listDecisionIds();
        const summary = scoreDecisions(atoms, ids);
        const floor = MIN_BUCKET_N * 2;
        const reason = silenceReason(summary, floor);
        if (reason) {
          return {
            claim: null,
            othersWithheld: 0,
            reason,
            recorded: summary.total,
            scored: summary.scored.length,
          };
        }
        const patterns = detect(summary.scored);
        const selection = selectClaim(patterns, {
          // Stable across queries, so a drill result can attach to the same claim.
          claim_id: patterns.length ? `claim-${patterns[0].key}` : "claim-none",
          created_at: new Date().toISOString(),
        });
        return {
          claim: selection?.claim ?? null,
          othersWithheld: selection?.othersWithheld ?? 0,
          reason: selection
            ? null
            : `נבדקו ${summary.scored.length} החלטות חשופות ולא נמצא דפוס שעובר את הסף. זו תשובה תקינה — הסף קיים כדי שלא נדווח על רעש.`,
          recorded: summary.total,
          scored: summary.scored.length,
        };
      },
    ),
  });
}
