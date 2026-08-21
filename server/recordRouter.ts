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
import { evaluateClaim, type Claim, type ProspectiveDrillResult } from "../shared/claim";
import {
  completeDrillAgainstBaseline,
  createDrill,
  describeResult,
  evaluateRefutation,
  startDrill,
  type DrillDecision,
} from "../shared/drill";
import { selectDrillPositions } from "../shared/drill-positions";
import { BUCKETINGS, MIN_GAP_DIFFERENCE, summarise } from "../shared/detector";
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

    /**
     * Start a drill for a claim. THIS IS WHERE R5 BINDS.
     *
     * The refutation condition is copied from the claim and WRITTEN TO STORAGE before a single
     * position is shown, together with the prediction. A drill row that exists is a drill that
     * could have failed. `startDrill` refuses a spec whose condition is missing.
     *
     * Positions are drawn from plies the player has NOT decided on. Re-showing a position whose
     * verdict they have already seen is not a forward test.
     */
    startDrill: protectedProcedure
      .input(
        z.object({
          claim_id: z.string().min(1).max(64),
          /**
           * Positions the client can offer, from the games it has loaded. The SERVER decides
           * which are usable, by excluding every position already decided.
           *
           * The server holds decisions, not games, so it cannot enumerate candidates itself.
           * Deriving them from decided positions instead would be circular -- an earlier draft
           * did exactly that and produced an empty drill every time.
           */
          candidate_fens: z.array(z.string().min(8).max(200)).min(1).max(400),
        }),
      )
      .mutation(async ({ input }) => {
        const claim = await store.getClaim(input.claim_id);
        if (!claim) {
          throw new TRPCError({ code: "NOT_FOUND", message: "אין טענה עם המזהה הזה." });
        }
        if (claim.grade === "refuted") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "הטענה כבר הופרכה. הפרכה סופית — לא בודקים אותה שוב.",
          });
        }
        const atoms = await store.listAtoms();
        const decidedFens = atoms.map((atom) => atom.entry_state.fen);
        const available = input.candidate_fens.map((fen, index) => ({ fen, ply: index }));
        // Every position the player has already decided is excluded: they have seen the
        // engine's verdict on it, so re-showing it is not a forward test.
        const selection = selectDrillPositions(available, decidedFens);
        if (selection.reason) {
          return { drill: null, reason: selection.reason } as const;
        }
        const spec = createDrill(claim, selection.fens, {
          // Unique per drill. Deriving this from the record's size collided whenever two drills
          // started without a decision between them, and the append-only guard rejected the
          // second -- correctly, but for a reason that looked like a storage fault.
          drill_id: `drill-${crypto.randomUUID()}`,
        });
        const started = startDrill(spec, {
          // What the claim predicts, fixed now, before any position is shown.
          predicted: true,
          started_at: new Date().toISOString(),
        });
        await store.saveDrill(started);
        return { drill: started.spec, reason: null } as const;
      }),

    /**
     * Close a drill and grade the claim -- in either direction.
     *
     * The verdict is computed from the condition the drill STORED, not from a fresh rule: the
     * drill's mean calibration gap against the baseline from the rest of the record. A drill
     * that writes down one condition and tests another has pre-registered nothing.
     */
    completeDrill: protectedProcedure
      .input(
        z.object({
          drill_id: z.string().min(1).max(64),
          decision_ids: z.array(z.string().uuid()).min(1),
        }),
      )
      .mutation(async ({ input }) => {
        const stored = await store.getDrill(input.drill_id);
        if (!stored) {
          throw new TRPCError({ code: "NOT_FOUND", message: "אין דריל עם המזהה הזה." });
        }
        const claim = await store.getClaim(stored.spec.claim_id);
        if (!claim) {
          throw new TRPCError({ code: "NOT_FOUND", message: "הטענה של הדריל אינה קיימת." });
        }

        // Score the drill's decisions, and the rest of the record as the baseline.
        const atoms = await store.listAtoms();
        const ids = await store.listDecisionIds();
        const summary = scoreDecisions(atoms, ids);
        const drillSet = new Set(input.decision_ids);
        const drillDecisions: DrillDecision[] = summary.scored
          .filter((d) => drillSet.has(d.decision_id))
          .map((d) => ({
            decision_id: d.decision_id,
            confidence: d.confidence,
            accurate: d.accurate,
          }));
        if (drillDecisions.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "אף החלטה מהדריל לא נחשפה עדיין, ולכן אין מה למדוד.",
          });
        }
        const bucketing = BUCKETINGS.find((b) => claim.claim_id.endsWith(b.key));
        const baseline = summarise(
          summary.scored.filter(
            (d) => !drillSet.has(d.decision_id) && (!bucketing || !bucketing.predicate(d)),
          ),
        );

        const verdict = evaluateRefutation(drillDecisions, {
          baselineGap: baseline.gap,
          predictsOverconfidence: true,
          minGapDifference: MIN_GAP_DIFFERENCE,
        });
        const result: ProspectiveDrillResult = completeDrillAgainstBaseline(
          stored,
          drillDecisions,
          verdict,
          { recorded_at: new Date().toISOString() },
        );
        await store.saveDrillResult(result);

        // The ONLY path that changes a grade, and it accepts a prospective result only.
        const graded = evaluateClaim(claim, result);
        await store.saveClaim(graded);

        return {
          claim: graded,
          verdict,
          // Section 3.5: report the result even when it refutes -- especially then.
          description: describeResult(result),
        };
      }),

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
        if (selection) {
          // Persist, then read back: a claim already graded by a past drill must keep that
          // grade rather than being re-derived as a fresh hypothesis every query.
          const existing = await store.getClaim(selection.claim.claim_id);
          if (existing) {
            return {
              claim: existing,
              othersWithheld: selection.othersWithheld,
              reason: null,
              recorded: summary.total,
              scored: summary.scored.length,
            };
          }
          await store.saveClaim(selection.claim);
        }
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
