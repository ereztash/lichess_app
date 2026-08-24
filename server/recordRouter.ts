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
} from "../shared/decision-atom.js";
import {
  learningRuleDraftSchema,
  reflectionDraftSchema,
  TRANSFER_POSITION_COUNT,
} from "../shared/learning-record.js";
import * as service from "../shared/record-service.js";
import { RecordError } from "../shared/record-service.js";
import type { RecordStore } from "./record.js";
import type { ImportDiagnostic } from "../shared/import-diagnostic.js";
import { protectedProcedure, router } from "./_core/trpc.js";

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

export const learningRuleEventSchema = z
  .object({
    reflection: reflectionDraftSchema.strict(),
    rule: learningRuleDraftSchema.strict(),
  })
  .strict();

/**
 * Map a transport-neutral refusal onto the wire.
 *
 * The rules themselves live in shared/record-service.ts so the browser runs the same ones. This
 * router is now only the HTTP boundary: validate, delegate, translate the error.
 */
function toTrpc(error: unknown): never {
  if (error instanceof RecordError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return toTrpc(error);
  }
}

export function buildRecordRouter(store: RecordStore) {
  return router({
    commitDecision: protectedProcedure
      .input(commitEventSchema)
      .mutation(({ input }): Promise<{ decision_id: string }> =>
        guard(() => service.commitDecision(store, input)),
      ),

    reveal: protectedProcedure
      .input(z.object({ decision_id: z.string().uuid(), result: resultSchema }))
      .mutation(({ input }): Promise<DecisionAtom> =>
        guard(() => service.reveal(store, input.decision_id, input.result)),
      ),

    feedback: protectedProcedure
      .input(
        z.object({
          decision_id: z.string().uuid(),
          revised_read: z.string().max(200),
          would_choose_again: z.boolean(),
        }),
      )
      .mutation(({ input }) =>
        guard(() =>
          service.feedback(store, input.decision_id, {
            revisedRead: input.revised_read,
            wouldChooseAgain: input.would_choose_again,
          }),
        ),
      ),

    createLearningRule: protectedProcedure.input(learningRuleEventSchema).mutation(({ input }) =>
      guard(() =>
        service.createLearningRule(store, input, {
          rule_id: `rule-${crypto.randomUUID()}`,
          created_at: new Date().toISOString(),
        }),
      ),
    ),

    learningRules: protectedProcedure.query(() => guard(() => service.learningRules(store))),

    startLearningTransfer: protectedProcedure
      .input(
        z
          .object({
            rule_id: z.string().min(1).max(64),
            candidate_fens: z.array(z.string().min(8).max(200)).min(1).max(400),
          })
          .strict(),
      )
      .mutation(({ input }) =>
        guard(() =>
          service.beginLearningTransfer(store, input, {
            transfer_id: `transfer-${crypto.randomUUID()}`,
            started_at: new Date().toISOString(),
          }),
        ),
      ),

    completeLearningTransfer: protectedProcedure
      .input(
        z
          .object({
            transfer_id: z.string().min(1).max(64),
            observations: z
              .array(
                z
                  .object({
                    decision_id: z.string().uuid(),
                    recalled_rule: z.string().max(300),
                    applied_rule: z.boolean(),
                  })
                  .strict(),
              )
              .length(TRANSFER_POSITION_COUNT),
          })
          .strict(),
      )
      .mutation(({ input }) =>
        guard(() =>
          service.finishLearningTransfer(store, input, {
            completed_at: new Date().toISOString(),
          }),
        ),
      ),

    retireLearningRule: protectedProcedure
      .input(z.object({ rule_id: z.string().min(1).max(64) }).strict())
      .mutation(({ input }) =>
        guard(() =>
          service.retireLearningRule(store, input, { retired_at: new Date().toISOString() }),
        ),
      ),

    atom: protectedProcedure
      .input(z.object({ decision_id: z.string().uuid() }))
      .query(({ input }) => store.getAtom(input.decision_id)),

    startDrill: protectedProcedure
      .input(
        z.object({
          claim_id: z.string().min(1).max(64),
          /**
           * Positions the client can offer, from the games it has loaded. The SERVER decides
           * which are usable, by excluding every position already decided. Deriving candidates
           * from decided positions instead would be circular -- an earlier draft did exactly
           * that and produced an empty drill every time.
           */
          candidate_fens: z.array(z.string().min(8).max(200)).min(1).max(400),
        }),
      )
      .mutation(({ input }) =>
        guard(() =>
          service.beginDrill(store, input, {
            // Unique per drill. Deriving this from the record's size collided whenever two
            // drills started without a decision between them.
            drill_id: `drill-${crypto.randomUUID()}`,
            started_at: new Date().toISOString(),
          }),
        ),
      ),

    completeDrill: protectedProcedure
      .input(
        z.object({
          drill_id: z.string().min(1).max(64),
          decision_ids: z.array(z.string().uuid()).min(1),
        }),
      )
      .mutation(({ input }) =>
        guard(() => service.finishDrill(store, input, { recorded_at: new Date().toISOString() })),
      ),

    /**
     * Whether the SERVER can actually store a decision right now.
     *
     * Signing in used to be enough to route the record to the server, and the server store throws
     * when DATABASE_URL is unset. So a successful sign-in moved a working local record onto a
     * broken server one and the loop stopped: "I signed in and now I cannot play". Having a
     * session and having storage are different facts, and the client needs the second one.
     */
    storageAvailable: protectedProcedure.query(async () => ({
      available: await store.isAvailable(),
    })),

    reading: protectedProcedure.query(() => guard(() => service.recordReading(store))),

    /** Cold-start reporting (section 6): the curve, not a single number. */
    count: protectedProcedure.query(() => guard(() => service.countDecisions(store))),

    claim: protectedProcedure.query((): Promise<service.ClaimView> =>
      guard(() => service.currentClaim(store, { created_at: new Date().toISOString() })),
    ),

    /**
     * The import -> live-loop bridge (shared/prereg.ts).
     *
     * `decisions_before` is absent from the input on purpose, not merely optional: the service
     * reads it from the store. See registerHypothesis for why a caller must not get to choose it.
     */
    registerHypothesis: protectedProcedure
      .input(
        z.object({
          bucket_key: z.string().min(1).max(40),
          scope: z.string().min(1).max(200),
          registered_at: z.string().min(1),
          evidence: z.object({
            accurate_rate: z.number().min(0).max(1),
            n: z.number().int().nonnegative(),
            runner_up_key: z.string().min(1).max(40),
            separation: z.number(),
            threshold: z.number(),
            games: z.number().int().nonnegative(),
          }),
          refutation_condition: z.string().min(1),
        }),
      )
      .mutation(({ input }) => guard(() => service.registerHypothesis(store, input))),

    hypothesis: protectedProcedure.query(() => guard(() => store.getPreregisteredHypothesis())),

    /**
     * The kept reading (shared/import-diagnostic.ts).
     *
     * `scanned_at` is absent from the input on purpose, exactly as `decisions_before` is above:
     * the service stamps it. A caller that could choose the scan date could keep an old reading
     * looking current, which is the one way this object can become dishonest.
     *
     * The diagnostic passes through as an opaque object. It is produced by the client's own
     * `diagnoseImportedGames` from PGNs it fetched, never typed by a user, so a field-by-field
     * schema here would restate this codebase rather than validate input -- and it would have to
     * be edited in lockstep every time a bucket is added.
     */
    saveImportReading: protectedProcedure
      .input(
        z.object({
          username: z.string().min(1).max(60),
          games: z.number().int().nonnegative(),
          diagnostic: z.custom<ImportDiagnostic>((value) => typeof value === "object" && value !== null),
        }),
      )
      .mutation(({ input }) => guard(() => service.saveImportReading(store, input))),

    importReading: protectedProcedure.query(() => guard(() => store.getImportDiagnostic())),
  });
}
