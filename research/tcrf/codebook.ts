/**
 * THE RESPONSE CODEBOOK, AND THE ONE AMBIGUITY IN THE FROZEN DESIGN THAT HAD TO BE RESOLVED.
 *
 * §8 of the preregistration requires the discovery cohort to build a codebook that allows
 * multi-label coding at six representation levels "without forcing a chess-content taxonomy", and
 * requires the `target_structure_mentioned` rule to be written before confirmatory data are opened.
 * This is the machine-readable half of that: the levels, the escape hatches, the uncertainty field,
 * and the primary binary's polarity rule.
 *
 * ---------------------------------------------------------------------------------------------
 * THE POLARITY PROBLEM, which is the most important thing in this file.
 *
 * H1 says participants are "more likely to represent that target structure" when it is PRESENT. But
 * a participant in the DISRUPTED arm can mention the target structure correctly and informatively:
 * "the rook no longer covers e5" names exactly the relation the edit removed. Under a naive rule
 * that counts any mention, both arms score 1, H1 is null, and `STOP-R2-A` fires on a coding
 * decision rather than on the construct.
 *
 * Worse, the naive rule is not merely insensitive -- it is pointed the wrong way. Noticing that a
 * defence is GONE is stronger evidence of relational representation than noticing it is there.
 *
 * SO TWO VARIABLES ARE CODED, AND ONLY ONE IS PRIMARY:
 *
 *   `target_structure_mentioned`  PRESENCE-ASSERTIONS ONLY. The response asserts the target
 *                                 relation holds. This is H1's DV, matching the direction §2 states.
 *   `target_structure_referenced` EITHER POLARITY, including explicit absence. Pre-registered as a
 *                                 SECONDARY with its own prediction: roughly flat across arms, or
 *                                 higher in the disrupted arm. A large POSITIVE coefficient here
 *                                 beside a null primary is not a rescue of H1; it is evidence that
 *                                 the construct is about noticing structure rather than about
 *                                 topology, and it belongs in the results as such.
 *
 * THIS IS NOT AN AMENDMENT. §8 assigns the rule to the codebook and the codebook did not exist;
 * writing it is the work the preregistration scheduled. `docs/research/TCRF_CONSTRUCT_AUDIT.md` A-1
 * records it as a finding so a reader can see it was a decision and not a default.
 * ---------------------------------------------------------------------------------------------
 *
 * NOTHING HERE CODES CHESS CONTENT. There is no "good move", no evaluation, no quality label. The
 * six levels are about the LEVEL of representation, not its correctness, which is §9 of the TCRF
 * specification and is what keeps the instrument from grading the participant.
 */
import { z } from "zod";

/**
 * Bumped on any change to the levels, the rules or the polarity definition. §5 freezes it.
 *
 * v2 adds `named_elements` and `predicate_arity`, the two variables Amendment 1's identifiability
 * argument rests on. v1 coding is not comparable and is not backfilled.
 */
export const CODEBOOK_VERSION = 2;

/**
 * §8's six levels. No level is superior to another and the order is not a ranking.
 *
 * `OTHER_UNCLASSIFIED` IS NOT A SEVENTH LEVEL, IT IS THE ESCAPE HATCH, and it is mandatory. A
 * scheme with no way to say "this does not fit" will always fit, and a codebook that always fits
 * has measured its own categories. §5 lists "identify responses that do not fit the candidate
 * representation levels" as discovery work; this is where those land.
 */
export const REPRESENTATION_LEVELS = [
  "OBJECT_CARRIER",
  "RELATION",
  "COALITION_MOTIF",
  "AFFORDANCE",
  "CONSTRAINT",
  "TELOS",
  "OTHER_UNCLASSIFIED",
] as const;
export type RepresentationLevel = (typeof REPRESENTATION_LEVELS)[number];

/**
 * How `COALITION_MOTIF` is separated from `RELATION`, because otherwise it is not separable.
 *
 * "The rook and the bishop both hit f7" is two relations or one coalition depending on who is
 * reading. A semantic rule would make the level a property of the coder. So the rule is STRUCTURAL
 * and stated in advance: a response is coded COALITION_MOTIF when it names three or more elements
 * as participating in ONE functional statement, or names a motif term that entails more than two
 * elements. Two elements in one statement is RELATION.
 *
 * This is a measurement convention, not a claim about cognition, and H3 -- which predicts a
 * rating gradient in coalition-level responses -- inherits the convention. It is recorded here so
 * that a failed H3 can be read as "the convention did not separate the levels" rather than only as
 * "expertise does not work that way".
 */
export const COALITION_ELEMENT_THRESHOLD = 3;

/** §8's reliability gates. Read by the analysis, not re-decided by it. */
export const KRIPPENDORFF_POOLED_FLOOR = 0.8;
export const KRIPPENDORFF_STRATUM_FLOOR = 0.7;

export const codedResponseSchema = z.object({
  trial_id: z.string().min(1).max(64),
  coder_id: z.string().min(1).max(64),
  codebook_version: z.number().int().positive(),

  /** Multi-label by construction. An empty array is legal: a response may name nothing codeable. */
  levels: z.array(z.enum(REPRESENTATION_LEVELS)),
  /**
   * §9 secondary: which level the participant reached for FIRST.
   *
   * Null when the response has no codeable level at all, which is different from the participant
   * leading with `OTHER_UNCLASSIFIED`.
   */
  first_level: z.enum(REPRESENTATION_LEVELS).nullable(),

  /** THE PRIMARY CONFIRMATORY VARIABLE. Presence-assertions only; see the polarity note above. */
  target_structure_mentioned: z.boolean(),
  /** Pre-registered secondary: either polarity, including explicit absence. */
  target_structure_referenced: z.boolean(),
  /** §8: whether the reported structure is linked to the reported intended state. */
  target_telos_linked: z.boolean(),

  /**
   * THE ELEMENTS THE RESPONSE ACTUALLY NAMES, and the reason this is a list of squares rather than
   * a verdict is the whole point of Amendment 1.
   *
   * The identifying question is whether a participant named an element whose own description is
   * IDENTICAL in both arms -- an element the object-local account has no reason to make anybody
   * mention. Asking a coder that question directly would hand them the manipulation: they would
   * have to be told which elements those are, which is the condition. So the coder records only
   * what the response refers to, in the response's own terms mapped to squares where that is
   * unambiguous, and the analysis intersects it with the per-template set computed by
   * `research/tcrf/identifiability.ts`. The theory-laden step happens after blindness has done its
   * work, not inside it.
   *
   * An element named without a square -- "the pawn in front of the king" -- is recorded as written.
   * Coders do not resolve chess references they are unsure of; unresolved entries are reported.
   */
  named_elements: z.array(z.string().max(60)).max(20),
  /**
   * How many things the response's main assertion is ABOUT. §9's representation levels say what
   * KIND of unit was used; this says how many places the predicate has.
   *
   * `one_place`     a property of one thing: "the knight is hanging"
   * `two_place`     a relation between two: "the rook is not covering the knight"
   * `higher_order`  a structure over three or more: "the pawn is holding both knights"
   *
   * CODEABLE WITHOUT KNOWING THE CONDITION, which is why it is here and not derived later. It is
   * the second identifying variable: an object-local representation has no reason to produce
   * two-place or higher-order predicates about elements that did not change.
   */
  predicate_arity: z.enum(["none", "one_place", "two_place", "higher_order"]),
  /**
   * The coder's own confidence, kept because §8's adjudication needs to know where to look.
   *
   * A CODER WHO IS UNSURE HAS SAID SOMETHING, and a scheme that forces a confident 0 or 1 throws it
   * away. It is not used to weight the primary variable -- that would make the DV depend on how
   * sure a coder felt -- and it is not permitted to gate adjudication silently: §8 requires the
   * pre-adjudication reliability figures to survive, and they are computed on the codes, not on
   * these.
   */
  coder_uncertain: z.boolean(),
  coder_comment: z.string().max(500),
});
export type CodedResponse = z.infer<typeof codedResponseSchema>;

/** Internal contradictions in one coded response. Same shape and reason as `trialContradictions`. */
export function codingContradictions(coded: CodedResponse): string[] {
  const out: string[] = [];
  if (coded.first_level !== null && !coded.levels.includes(coded.first_level)) {
    out.push("first_level names a level the response was not coded with");
  }
  if (coded.first_level === null && coded.levels.length > 0) {
    out.push("levels were assigned but none was recorded as first");
  }
  /*
   * THE POLARITY RULE, ENFORCED RATHER THAN DOCUMENTED. A presence-assertion is a reference, so
   * `mentioned` implies `referenced`. The reverse does not hold and that asymmetry is the whole
   * point of having two variables.
   */
  if (coded.target_structure_mentioned && !coded.target_structure_referenced) {
    out.push(
      "target_structure_mentioned is true while target_structure_referenced is false; a presence-assertion is a reference",
    );
  }
  if (coded.target_telos_linked && !coded.target_structure_referenced) {
    out.push("a telos is linked to a target structure the response never referenced");
  }
  if (coded.predicate_arity === "none" && coded.named_elements.length > 0) {
    out.push("elements were named while the response was coded as asserting nothing about them");
  }
  if (coded.predicate_arity === "higher_order" && coded.named_elements.length < COALITION_ELEMENT_THRESHOLD) {
    out.push(
      `a higher-order predicate was coded over fewer than ${COALITION_ELEMENT_THRESHOLD} named elements`,
    );
  }
  if (coded.levels.includes("COALITION_MOTIF") && coded.predicate_arity === "one_place") {
    out.push("a coalition was coded from a one-place predicate");
  }
  if (coded.codebook_version !== CODEBOOK_VERSION) {
    out.push(
      `coded under codebook v${coded.codebook_version}; this build reads v${CODEBOOK_VERSION}`,
    );
  }
  return out;
}

/**
 * The freeze record. §5: the codebook is committed before the first confirmatory participant.
 *
 * `frozen_at_git_sha` IS THE WHOLE ARTEFACT. A codebook that says it is frozen and cannot say when
 * is a codebook that could have been edited after the confirmatory set was opened, which is the
 * exact failure `research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json` recorded in
 * this repository and `scripts/research-scan.ts` now watches for.
 */
export interface CodebookFreeze {
  codebook_version: number;
  frozen_at_git_sha: string | null;
  /** How many discovery responses the codebook was developed against. §5 allows exactly these. */
  discovery_responses_read: number;
  /** Confirmatory responses must be zero at the freeze. Anything else voids §5. */
  confirmatory_responses_read: number;
  notes: string;
}

export function freezeIsAdmissible(freeze: CodebookFreeze): string[] {
  const out: string[] = [];
  if (!freeze.frozen_at_git_sha) out.push("the freeze names no commit");
  if (freeze.confirmatory_responses_read !== 0) {
    out.push(
      `the codebook was developed against ${freeze.confirmatory_responses_read} confirmatory responses; §5 permits none`,
    );
  }
  if (freeze.discovery_responses_read === 0) {
    out.push("no discovery responses were read, so the codebook is not discovery-built");
  }
  if (freeze.codebook_version !== CODEBOOK_VERSION) {
    out.push(`the freeze records v${freeze.codebook_version}; the code is v${CODEBOOK_VERSION}`);
  }
  return out;
}
