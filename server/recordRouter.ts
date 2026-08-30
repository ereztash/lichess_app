/**
 * The record procedures (Layer A).
 *
 * R3 is enforced here, at the server, not in the interface: `reveal` REFUSES for a decision that
 * has not been committed. That is what makes GATE-COMMIT assertable on the network layer rather
 * than the DOM -- a DOM-only check passes happily while the answer sits in the props.
 */
import { TRPCError } from "@trpc/server";
import { storedBlitzRecordSchema } from "../shared/blitz-record.js";
import { z } from "zod";
import { REVEAL_TIMINGS } from "../shared/reveal-timing.js";
import {
  ANALYSIS_TIMINGS,
  MEASUREMENT_PROTOCOLS,
} from "../shared/measurement-protocol.js";
import { DECISION_PURPOSES } from "../shared/confidence-asked.js";
import { statedPartsSchema } from "../shared/decision-atom.js";
import {
  boundedActionSchema,
  entryStateSchema,
  probeSchema,
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
import { ownerProcedure } from "./_core/owner.js";
import { router } from "./_core/trpc.js";

/**
 * The largest an import diagnostic may serialise to, in JSON characters.
 *
 * 64 KiB. A real one is a fixed set of bucket readings plus a dozen counters -- the fixtures in
 * this repository run well under 4 KB -- so this is roughly sixteen times the largest honest
 * value, which is the margin an opaque object deserves rather than none at all.
 */
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;

/**
 * The check itself, exported so it can be tested as behaviour rather than read as source.
 *
 * It answers one question -- can this be stored and read back -- and deliberately not "is this a
 * valid diagnostic". The shape is the client's own output and a field-by-field schema here would
 * restate this codebase; the size is a property of the storage, which this layer owns.
 */
export function isStorableDiagnostic(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    return JSON.stringify(value).length <= MAX_DIAGNOSTIC_BYTES;
  } catch {
    // A cycle, or a BigInt. Either way it cannot be stored, and it must not throw out of a
    // validator -- a thrown parse is a 500 where a refusal was the honest answer.
    return false;
  }
}

/**
 * The API event. Carries every atom field (section 3.1). `result` and `feedback` are present and
 * null at commit time: the engine has not spoken and the player has not revised anything.
 * GATE-ISO checks that the FIELD is here, not that it holds a value.
 */
export const commitEventSchema = z.object({
  decision_id: z.string().uuid(),
  entry_state: entryStateSchema,
  /**
   * Why the position was in front of the player.
   *
   * IN THE ATOM'S POSITION, not appended at the end: GATE-ISO compares the field ORDER of this
   * schema against `ATOM_FIELDS`, so a field in the wrong place fails the gate as loudly as a
   * missing one.
   *
   * Optional, because a client that predates the field sends nothing and null is stored for it.
   * That absence has a price and the price is paid below rather than here -- an unstamped
   * decision cannot claim the first-decision exemption, and `service.commitDecision` refuses it.
   */
  purpose: z.enum(DECISION_PURPOSES).nullable().optional(),
  /*
   * `min(1)` IS GONE FROM BOTH, AND THIS IS THE LINE THAT MADE THE EXEMPTION REAL.
   *
   * The opening decision stopped requiring the two read fields one commit ago, and this schema
   * did not move -- so the whole exemption was unreachable over HTTP: a first decision made
   * against a server was refused at the boundary with a validation error naming a field the
   * player had deliberately not been asked for. It worked only in the browser-record deployment,
   * where nothing runs this schema. Nothing caught it, because every test of the exemption calls
   * the service directly.
   *
   * The guard did not become weaker, it became conditional and moved to where the condition is
   * legible: `decisionAtomSchema` refuses an empty read from any purpose but `first`, and
   * `service.commitDecision` does the same at the boundary with a message a player can read.
   */
  known: z.string().max(200),
  unknown: z.string().max(200),
  /**
   * How each read was said. Optional on the wire and NULLABLE, which are two different states.
   *
   * ABSENT is a client older than this change: it never recorded the parts, and null is stored.
   * NULL sent explicitly means the same thing. Neither is `{ tapped: [], typed: "" }`, which
   * would assert the player tapped nothing and typed nothing while `known` on the same event
   * plainly holds text. A zod object drops what it does not name, so leaving these out of this
   * schema would have made the whole change a no-op over HTTP while every local test passed.
   */
  known_parts: statedPartsSchema.nullable().optional(),
  unknown_parts: statedPartsSchema.nullable().optional(),
  decision: z.string().min(4).max(6),
  bounded_action: boundedActionSchema,
  /**
   * Nullable on the wire, because a client that predates the probe has no arm to send and its
   * decisions are still perfectly good calibration data. Null is stored as null and never read as
   * a control -- see the note on `probeSchema`.
   */
  probe: probeSchema.nullable(),
  reveal_timing: z.enum(REVEAL_TIMINGS).nullable(),
  /*
   * NULLABLE ON THE WIRE, AND NOT DEFAULTED ON ARRIVAL. A client that predates these fields sends
   * nothing, and its decisions are still perfectly good data -- what they are not is data that
   * recorded its own conditions. Filling in `instrumented-standard` at the boundary would make an
   * unstamped row indistinguishable from a stamped one for ever afterwards.
   *
   * `.default(null)` rather than `.optional()`: an older client's payload still parses, and the
   * stored value is an explicit null rather than an absent key that a later reader has to guess at.
   */
  measurement_protocol: z.enum(MEASUREMENT_PROTOCOLS).nullable().default(null),
  protocol_version: z.number().int().positive().nullable().default(null),
  analysis_timing: z.enum(ANALYSIS_TIMINGS).nullable().default(null),
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
    commitDecision: ownerProcedure
      .input(commitEventSchema)
      .mutation(({ input }): Promise<{ decision_id: string }> =>
        guard(() => service.commitDecision(store, input)),
      ),

    /**
     * The answer to the counterfactual probe. Its own procedure because it happens between the
     * commit and the reveal, which is a moment no other route occupies.
     */
    recordCounterfactual: ownerProcedure
      .input(
        z.object({
          decision_id: z.string().uuid(),
          /** Null is a real answer -- asked, and no other move -- not an omitted field. */
          alternative: z.string().min(4).max(6).nullable(),
        }),
      )
      .mutation(({ input }): Promise<{ decision_id: string }> =>
        guard(() => service.recordCounterfactual(store, input.decision_id, input.alternative)),
      ),

    reveal: ownerProcedure
      .input(
        z.object({
          decision_id: z.string().uuid(),
          result: resultSchema,
          /** The alternative's cost, off the same root search. Absent when none was named. */
          alternative_cp_loss: z.number().int().min(0).nullable().optional(),
        }),
      )
      .mutation(({ input }): Promise<DecisionAtom> =>
        guard(() =>
          service.reveal(store, input.decision_id, input.result, input.alternative_cp_loss),
        ),
      ),

    feedback: ownerProcedure
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

    createLearningRule: ownerProcedure.input(learningRuleEventSchema).mutation(({ input }) =>
      guard(() =>
        service.createLearningRule(store, input, {
          rule_id: `rule-${crypto.randomUUID()}`,
          created_at: new Date().toISOString(),
        }),
      ),
    ),

    learningRules: ownerProcedure.query(() => guard(() => service.learningRules(store))),

    startLearningTransfer: ownerProcedure
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

    /**
     * One position's observation, recorded when it is made.
     *
     * The whole set used to arrive at completion, which made the client their only holder for the
     * length of the run: a reload lost them, a failed reveal write stranded the run, and the
     * server had to believe whatever finally showed up.
     */
    recordTransferObservation: ownerProcedure
      .input(
        z
          .object({
            transfer_id: z.string().min(1).max(64),
            observation: z
              .object({
                decision_id: z.string().uuid(),
                recalled_rule: z.string().max(300),
                applied_rule: z.boolean(),
              })
              .strict(),
          })
          .strict(),
      )
      .mutation(({ input }) => guard(() => service.recordLearningTransferObservation(store, input))),

    /**
     * A TRANSFER ID AND NOTHING ELSE.
     *
     * The observations used to be posted here, so there was a shape of request that could report a
     * test the player never sat. They are read from the record now; this route can only ask for
     * the verdict on what was already written down.
     */
    completeLearningTransfer: ownerProcedure
      .input(z.object({ transfer_id: z.string().min(1).max(64) }).strict())
      .mutation(({ input }) =>
        guard(() =>
          service.finishLearningTransfer(store, input, {
            completed_at: new Date().toISOString(),
          }),
        ),
      ),

    retireLearningRule: ownerProcedure
      .input(z.object({ rule_id: z.string().min(1).max(64) }).strict())
      .mutation(({ input }) =>
        guard(() =>
          service.retireLearningRule(store, input, { retired_at: new Date().toISOString() }),
        ),
      ),

    atom: ownerProcedure
      .input(z.object({ decision_id: z.string().uuid() }))
      .query(({ input }) => store.getAtom(input.decision_id)),

    startDrill: ownerProcedure
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

    completeDrill: ownerProcedure
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
    storageAvailable: ownerProcedure.query(async () => ({
      available: await store.isAvailable(),
    })),

    reading: ownerProcedure.query(() => guard(() => service.recordReading(store))),

    /** Cold-start reporting (section 6): the curve, not a single number. */
    count: ownerProcedure.query(() => guard(() => service.countDecisions(store))),

    claim: ownerProcedure.query((): Promise<service.ClaimView> =>
      guard(() => service.currentClaim(store, { created_at: new Date().toISOString() })),
    ),

    /**
     * The import -> live-loop bridge (shared/prereg.ts).
     *
     * `decisions_before` is absent from the input on purpose, not merely optional: the service
     * reads it from the store. See registerHypothesis for why a caller must not get to choose it.
     */
    registerHypothesis: ownerProcedure
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

    hypothesis: ownerProcedure.query(() => guard(() => store.getPreregisteredHypothesis())),

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
     *
     * WHAT IS CHECKED INSTEAD IS SIZE, and it is checked because "opaque" was doing more work than
     * it should. `typeof value === "object"` accepts an array, a Date, and an object of any depth
     * and any size -- so the one property the rest of the system actually depends on, that this
     * fits in a row and renders without choking, was resting on the client being well behaved.
     * A bound on the serialised bytes is a real constraint that does not have to be edited when a
     * bucket is added; a real diagnostic is a fixed handful of readings and is orders of magnitude
     * under it.
     */
    saveImportReading: ownerProcedure
      .input(
        z.object({
          username: z.string().min(1).max(60),
          games: z.number().int().nonnegative(),
          diagnostic: z.custom<ImportDiagnostic>(isStorableDiagnostic, {
            message: "אבחון הייבוא אינו אובייקט או שהוא גדול מדי.",
          }),
        }),
      )
      .mutation(({ input }) => guard(() => service.saveImportReading(store, input))),

    importReading: ownerProcedure.query(() => guard(() => store.getImportDiagnostic())),

    /**
     * One finished, analysed blitz game.
     *
     * The schema is the shared one, not a copy: a second spelling of these fields on the server is
     * how a client and a server come to disagree about which of them may be null.
     */
    saveBlitzGame: ownerProcedure
      .input(storedBlitzRecordSchema)
      .mutation(({ input }) => guard(() => service.saveBlitzGame(store, input))),

    /** The second half of the two-phase write. See `RecordStore.attachBlitzAnalysis`. */
    attachBlitzAnalysis: ownerProcedure
      .input(storedBlitzRecordSchema)
      .mutation(({ input }) => guard(() => service.attachBlitzAnalysis(store, input))),

    blitzDecisions: ownerProcedure.query(() => guard(() => store.listBlitzDecisions())),
    blitzGames: ownerProcedure.query(() => guard(() => store.listBlitzGames())),
  });
}
