/**
 * THE DECISION ATOM (section 3.1).
 *
 *   entry_state -> known -> unknown -> decision -> bounded_action -> result -> feedback
 *
 * The same atom set, under the same field names, must appear in all three layers: the screen
 * state, the API event, and the session report. This module is the single definition all three
 * derive from, so drift is not expressible. GATE-ISO reflects over the three runtime artifacts
 * and compares them against ATOM_FIELDS.
 *
 * The atom is filled PROGRESSIVELY. At commit time `result` and `feedback` are null: the engine
 * has not spoken (R3) and the player has not revised anything yet. The FIELD is always present;
 * only its value is null. GATE-ISO checks presence, because a field that vanishes between layers
 * is how a product ends up unable to explain its own output six weeks later.
 */
import { z } from "zod";
import { CONFIDENCE_LEVELS } from "./confidence.js";
import { DECISION_PURPOSES, readsAreAsked } from "./confidence-asked.js";
import { REVEAL_TIMINGS } from "./reveal-timing.js";
import {
  ANALYSIS_TIMINGS,
  MEASUREMENT_PROTOCOLS,
} from "./measurement-protocol.js";

export const ATOM_FIELDS = [
  "entry_state",
  /*
   * DIRECTLY AFTER `entry_state`, because it is the rest of the same fact and the field order
   * here is the chain in section 3.1 rather than the order things were added. `entry_state` is
   * the position the player was handed; this is why they were handed it. Both are known before
   * the player reads anything, and putting the purpose at the end -- beside `reveal_timing`,
   * which is where a field added late naturally lands -- would separate it from the entry it
   * describes and make the list a history of the repository instead of a description of a
   * decision.
   */
  "purpose",
  "known",
  "unknown",
  "known_parts",
  "unknown_parts",
  "decision",
  "bounded_action",
  "probe",
  "reveal_timing",
  /*
   * AFTER `reveal_timing`, because it is the rest of the same fact: both say what the world was
   * like while the decision was being made, and neither is anything the player did.
   */
  "measurement_protocol",
  "protocol_version",
  "analysis_timing",
  "result",
  "feedback",
] as const;

export type AtomField = (typeof ATOM_FIELDS)[number];

export const PHASES = ["opening", "middlegame", "endgame"] as const;
export const ENGINE_SOURCES = ["local_sf18", "lichess_cloud"] as const;

/** entry_state -- the position the player was handed. FEN plus the constraints that framed it. */
export const entryStateSchema = z.object({
  game_id: z.string().min(1).max(64),
  fen: z.string().min(8).max(200),
  ply: z.number().int().min(0),
  phase: z.enum(PHASES),
  clock_ms_remaining: z.number().int().min(0).nullable(),
});

/**
 * bounded_action -- the act of committing, and the constraints it happened under.
 * seconds_taken is a predictor, not telemetry (section 4.1).
 */
/**
 * The parts one stated read was composed from.
 *
 * LABELS, NOT IDS, and for the same reason `DraftDecision.knownTags` holds labels: the label is
 * what the player saw and what `known` carries, so a record stays readable without a lookup
 * table. It also keeps the measurement honest across a rewording -- an option whose words change
 * IS a different option to the person reading it, and old rows go on naming what they were shown.
 */
export const statedPartsSchema = z.object({
  /** The options tapped. Empty is a real answer here: it means everything said was typed. */
  tapped: z.array(z.string().min(1).max(80)).max(20),
  /** What was typed beside them. Empty means the menu was enough, which is the measurement. */
  typed: z.string().max(200),
});
export type StatedParts = z.infer<typeof statedPartsSchema>;

export const boundedActionSchema = z.object({
  seconds_taken: z.number().min(0),
  /**
   * How sure the player said they were, on the scale below.
   *
   * NULLABLE, AND NULL IS NOT "UNANSWERED". It means the question was never put, because nothing
   * measures a confidence stated here -- see `shared/confidence-asked.ts` for which positions do.
   * The decision is complete without it: the move, the read and the doubt are all recorded, and
   * `scoreDecisions` leaves it out of the calibration record and counts it separately rather than
   * defaulting it to anything. A default here would be the machine stating a belief on the
   * player's behalf and then measuring them against it, which is the one thing this atom exists
   * to prevent.
   */
  confidence: z.number().int().min(1).max(CONFIDENCE_LEVELS).nullable(),
  /*
   * WHICH SCALE THAT CONFIDENCE WAS STATED ON, and why a bare number is not enough.
   *
   * The scale moved from five levels to seven, and the words moved with it: "בטוח" was 4 of 5 and
   * is 6 of 7. A stored `4` therefore asserts 0.75 or 0.50 depending only on when it was written,
   * and nothing in the row itself says which. Recording the scale is what keeps a decision a
   * statement the player actually made rather than one this build inferred on their behalf.
   *
   * Optional because rows written before this field existed do not have it. Absent means five --
   * a fact about that row's age, resolved once where stored rows are read, never defaulted here.
   */
  confidence_scale: z.number().int().min(2).max(CONFIDENCE_LEVELS).optional(),
  candidate_moves_considered: z.array(z.string().min(4).max(6)).max(8),
});

/** result -- what came back from outside the player. Null until reveal. */
export const resultSchema = z.object({
  engine_eval_cp: z.number().int(),
  engine_best_move: z.string().min(4).max(6),
  engine_depth: z.number().int().min(1),
  engine_source: z.enum(ENGINE_SOURCES),
  cp_loss: z.number().int().min(0),
});

/**
 * The three arms of the counterfactual probe, and the third is not a synonym for the second.
 *
 * `ineligible` is a position that could never have carried the question -- fewer than two legal
 * moves. Folding those into `not-probed` would make the control group a mixture of "eligible and
 * not drawn" and "never askable", and any difference between arms would then be a difference
 * between kinds of position.
 */
export const PROBE_ASSIGNMENTS = ["probed", "not-probed", "ineligible"] as const;
export type ProbeAssignment = (typeof PROBE_ASSIGNMENTS)[number];

/**
 * probe -- which arm this decision was randomised into, and what came back if it was asked.
 *
 * PRESENT ON EVERY DECISION, INCLUDING THE ONES NOTHING WAS ASKED ON. A record that holds only
 * the probed decisions has no denominator: "do probed decisions differ from unprobed ones" would
 * become a comparison of probed decisions against the record's own average, which mixes every
 * other difference between the groups into the estimate.
 */
export const probeSchema = z.object({
  assignment: z.enum(PROBE_ASSIGNMENTS),
  /**
   * Legal moves in the entry position, carried as a covariate rather than used as a filter.
   *
   * A position with three legal moves is a thinner question than one with forty. Setting a floor
   * -- "ask only where there are at least eight" -- would have made the probed arm look cleaner
   * and would have been a threshold chosen to shape a result. Eligibility stays definitional and
   * the count is stored, so an analysis can condition on it instead.
   */
  legal_moves: z.number().int().min(0),
  /** The move the player named. Null both when unasked and when asked and unable -- see below. */
  alternative: z.string().min(4).max(6).nullable(),
  /**
   * Whether the question was actually put and answered.
   *
   * A FIELD RATHER THAN AN INFERENCE FROM `alternative`, and R2 is the reason. A player who was
   * asked and could not produce an alternative has told the instrument something real -- on the
   * four readings it is arguably the most interesting thing available. A player who was never
   * asked has told it nothing. Both are `alternative === null`, and a record storing only the
   * move can never tell them apart again.
   */
  answered: z.boolean(),
  /** What the alternative cost, measured at reveal. Null until the engine has scored it. */
  alternative_cp_loss: z.number().int().min(0).nullable(),
});

export type Probe = z.infer<typeof probeSchema>;

/** feedback -- what the player revised after seeing the result. Null until they revise. */
export const feedbackSchema = z.object({
  revised_read: z.string().max(200),
  would_choose_again: z.boolean(),
});

/**
 * The full atom. Field order here is the canonical order and is asserted by GATE-ISO.
 *
 * DEVIATION FROM SECTION 3.2, REPORTED: the column list in 3.2 has no `unknown` column, but
 * 3.1 makes `unknown` an atom and GATE-ISO's positive control drops it from the API event.
 * An atom required on screen and in the event that had nowhere to land in storage would be
 * dropped on write -- the exact failure 3.1 warns about. The decisions table therefore carries
 * a `stated_unknown` column.
 */
export const decisionAtomSchema = z.object({
  entry_state: entryStateSchema,
  /**
   * WHY this position was in front of the player -- the front door's handoff, the shared bank, a
   * drill, a transfer check, an ordinary move, or a game already played.
   *
   * IT DECIDES WHAT MAY BE MISSING FROM THE ROW, which is why it is stored rather than derived at
   * render time and dropped. The confidence question is put on some purposes and sampled on
   * others, and the two read fields are required on every purpose except `first`; both of those
   * are rules ABOUT a purpose, so a record that did not carry one could not enforce either and
   * could not tell a permitted absence from a lost field afterwards.
   *
   * NULLABLE, AND NULL IS NOT `play`. A row written before this field existed was never stamped,
   * and the rows in that era are not all ordinary moves -- the bank, the drills and the transfer
   * checks are in there too. Writing `play` into them would not be a tidy default, it would file
   * every drill in that era as a free-play decision and quietly corrupt the one comparison the
   * drills exist to support.
   *
   * THE ONE ATOM FIELD THE SERVER CANNOT RE-DERIVE, and that is stated because everything else it
   * receives is checked: the phase is recomputed from the FEN and the legal-move count from the
   * position, precisely so a wrong label cannot bias what the record is later divided by. Why a
   * position was in front of a player is a fact about the client's loop, and nothing on the wire
   * proves it. This is a claim by the client -- the same standing `reveal_timing` has -- and a
   * reading that treats it as verified is reading more than the field carries.
   */
  purpose: z.enum(DECISION_PURPOSES).nullable(),
  /**
   * What the player can name about this position. <=200 chars.
   *
   * MAY BE EMPTY, AND ONLY ON THE FIRST DECISION OF A GAME. The two read fields are required
   * everywhere else; on the opening decision they are not, because that is the one moment the
   * player has not yet seen what the loop asks and the wall of questions is the whole of their
   * first impression. `draftProblems` is where that exemption is enforced on screen; the refusal
   * below is what makes it a rule of the record rather than a habit of one client.
   *
   * WHAT THE SCHEMA GAVE UP TO ALLOW IT, AND WHAT GAVE IT BACK. `min(1)` was a real guard -- a
   * client that dropped this field could not write -- and the exemption cost it, because the rule
   * became conditional on a fact the record did not carry. It carries it now: `purpose` above is
   * stored, so the guard is back as a conditional one. An empty read is accepted from a `first`
   * decision and refused from every other, which is stricter than the unconditional `min(1)` was
   * on five purposes and exactly as permissive as the product intends on the sixth.
   */
  known: z.string().max(200),
  /** What the player says they cannot evaluate here. <=200 chars. Same exemption, same guard. */
  unknown: z.string().max(200),
  /**
   * HOW the read was said -- what was tapped, and what was typed beside it.
   *
   * `known` above is one string, because `composeStatement` joins the tapped labels and the typed
   * sentence with " · ". That join threw away the only measurement the product has about its own
   * vocabulary. Every time somebody types instead of tapping, THAT IS A MEASUREMENT THAT THE MENU
   * FAILED: the position in front of them was not in the list, and what they typed is the missing
   * words. `client/src/lib/read-options.ts` says in as many words that a selected option and the
   * same words typed by hand are indistinguishable in the record. They are not any more.
   *
   * Four things become readable from the record alone, with no interview and no model in the
   * loop: how often each field is escaped to free text, what was written when it was, which
   * options nobody ever picks, and which options are always picked together (two words for one
   * thing). That is the whole method for deciding what the words should be.
   *
   * NULLABLE, AND NULL IS NOT "TAPPED NOTHING, TYPED NOTHING". A decision written before this
   * existed recorded no parts at all, and `{ tapped: [], typed: "" }` would assert that the player
   * answered with silence -- while `known` on the same row plainly holds text. Null is "nobody
   * recorded this", and the reading below counts it out of the denominator rather than into the
   * numerator.
   */
  known_parts: statedPartsSchema.nullable(),
  unknown_parts: statedPartsSchema.nullable(),
  /** The chosen move, UCI. */
  decision: z.string().min(4).max(6),
  bounded_action: boundedActionSchema,
  /**
   * NULLABLE, AND NULL IS A FOURTH STATE RATHER THAN A DEFAULT ARM. A decision written before the
   * probe existed was never randomised into anything, and assigning it to an arm on read would
   * enrol it retrospectively into a group it was never part of.
   */
  probe: probeSchema.nullable(),
  /**
   * Which reveal timing was in force -- see shared/reveal-timing.ts for why the two are not
   * poolable.
   *
   * NULLABLE, AND NULL IS NOT `per-decision`. Every decision written before the deferred game
   * existed was in fact made in the coached loop, because that was the only loop -- and writing
   * `per-decision` into those rows would still be wrong. It would assert that a condition was
   * recorded when nobody recorded one, and the first comparison between modes would show a
   * coached arm that is enormous and perfectly measured.
   */
  reveal_timing: z.enum(REVEAL_TIMINGS).nullable(),
  /**
   * The conditions this decision was produced under -- see shared/measurement-protocol.ts.
   *
   * NULLABLE FOR THE REASON DIRECTLY ABOVE, and the temptation here is stronger. Every row written
   * before this field existed really was made in the untimed commitment loop, so backfilling
   * `instrumented-standard` would be FACTUALLY correct -- and it is still refused. It would assert
   * that a condition was recorded when nobody recorded one, and a comparison between protocols
   * would open with a standard arm of thousands against a blitz arm of none.
   */
  measurement_protocol: z.enum(MEASUREMENT_PROTOCOLS).nullable(),
  /** Which version of that protocol produced it. Null wherever the protocol itself is null. */
  protocol_version: z.number().int().positive().nullable(),
  /**
   * When the ENGINE ran, which is not when the player was told.
   *
   * Not derivable from `reveal_timing`: today the engine runs in both reveal modes and only the
   * telling differs, so `end-of-game` says nothing about whether the engine was quiet. For an
   * instrumented blitz game that distinction is the whole measurement.
   */
  analysis_timing: z.enum(ANALYSIS_TIMINGS).nullable(),
  result: resultSchema.nullable(),
  feedback: feedbackSchema.nullable(),
}).superRefine((atom, ctx) => {
  /*
   * WHAT REPLACES `min(1)` ON THE TWO READ FIELDS, and why it is a different guard rather than a
   * weaker version of the same one.
   *
   * The old rule was "these are never empty", and it was enforceable because it was unconditional.
   * The exemption for a first decision makes it conditional on something the record does not
   * carry, so it cannot be enforced here at all. What CAN be enforced is that the two
   * representations of one answer agree: the composed sentence and the parts it was composed
   * from. An empty sentence beside a tapped label is not a lighter first decision, it is a client
   * that lost the string -- and that is the failure this pair has actually had, which is why
   * `known_parts` exists at all.
   */
  const said = (parts: { tapped: string[]; typed: string } | null | undefined) =>
    parts !== null && parts !== undefined && (parts.tapped.length > 0 || parts.typed.length > 0);
  /*
   * THE GUARD `min(1)` USED TO BE, BACK AS A CONDITIONAL ONE. The exemption is a rule about a
   * decision's purpose, and until the purpose was stored the rule could not be checked here at
   * all -- so an empty read was accepted from every decision in the product, and a client that
   * silently dropped the field looked identical to a player being spared a toll.
   *
   * NULL IS REFUSED ALONGSIDE THE OTHER FIVE, and that is the point rather than an oversight. An
   * unstamped decision is one this build did not write; it cannot claim an exemption that only
   * `first` carries. Stored rows of that age are unaffected -- they were written while `min(1)`
   * was unconditional, so none of them is empty, and nothing re-validates a row on the way out.
   */
  /*
   * RE-DERIVED, NOT BELIEVED. The exemption used to be "purpose is first", which the atom could
   * only take the client's word for. `readsAreAsked` is a pure function of the purpose, the game,
   * the position and the ply -- all of them on the atom -- so the rule can be recomputed here from
   * what was written down rather than accepted as a claim.
   *
   * A ROW WITH NO PURPOSE IS REQUIRED TO CARRY THE WORDS. Nothing recorded why it existed, so
   * nothing can say the draw passed it over, and an exemption that could be claimed by omission is
   * not an exemption.
   */
  const required =
    atom.purpose === null
      ? true
      : readsAreAsked({
          purpose: atom.purpose,
          gameId: atom.entry_state.game_id,
          fen: atom.entry_state.fen,
          ply: atom.entry_state.ply,
        });
  const exempt = !required;
  if (atom.known.length === 0 && !exempt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["known"],
      message: "known is empty on a decision whose purpose does not allow it",
    });
  }
  if (atom.unknown.length === 0 && !exempt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unknown"],
      message: "unknown is empty on a decision whose purpose does not allow it",
    });
  }
  if (atom.known.length === 0 && said(atom.known_parts)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["known"],
      message: "known is empty but known_parts says something was said",
    });
  }
  if (atom.unknown.length === 0 && said(atom.unknown_parts)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unknown"],
      message: "unknown is empty but unknown_parts says something was said",
    });
  }
});

export type DecisionAtom = z.infer<typeof decisionAtomSchema>;
export type EntryState = z.infer<typeof entryStateSchema>;
export type DecisionResult = z.infer<typeof resultSchema>;

/**
 * Runtime witness of the atom's field names, for GATE-ISO. TypeScript types are erased, so a
 * gate cannot reflect over them; this reads the zod shape, which survives to runtime.
 */
export function atomFieldNames(schema: { shape: Record<string, unknown> }): string[] {
  return Object.keys(schema.shape);
}
