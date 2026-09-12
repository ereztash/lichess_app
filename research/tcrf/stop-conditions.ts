/**
 * THE STOP CODES, AS VALUES RATHER THAN AS A TABLE IN A DOCUMENT.
 *
 * §12 of the preregistration lists nine conditions and this task names nine codes. They are the
 * same set under two naming schemes, and that mismatch is itself a hazard: a report that cites
 * `STOP-R2-A` while a runbook cites `STOP-R2-H1` invites a reader to think two different things
 * fired. So both names live on one row and `canonicalStopCode` maps either to the same object.
 *
 * WHAT A STOP CODE IS FOR. It is the sentence a result is not allowed to talk its way out of.
 * `docs/research/BLITZ_COMPUTATION_RESULTS.md` in this repository is what that looks like when it
 * works: a gate failed, the verdict was that the reference does not exist, and nothing was rebuilt
 * around the failure. The codes here exist so the same thing can happen to TCRF.
 *
 * NO THRESHOLD IS CHANGED AFTER A STOP CONDITION FIRES. §12's last line, and the reason the
 * thresholds are imported from the modules that own them rather than restated here.
 */
import { KRIPPENDORFF_POOLED_FLOOR, KRIPPENDORFF_STRATUM_FLOOR } from "./codebook.js";
import { MINIMUM_PRIMARY_TEMPLATES } from "./validate-stimulus.js";

export interface StopCondition {
  /** The name this task uses. */
  code: string;
  /** The name §12 of the preregistration uses, where it differs. */
  prereg_code: string | null;
  condition: string;
  consequence: string;
  /** What the project is allowed to do next. Never "adjust the threshold". */
  permitted_response: string;
}

export const CONFIRMATORY_PARTICIPANT_FLOOR = 120;
export const LANGUAGE_STRATUM_FLOOR = 35;

export const STOP_CONDITIONS: readonly StopCondition[] = [
  {
    code: "STOP-R2-SAMPLE",
    prereg_code: "STOP-R2-SAMPLE",
    condition: `fewer than ${CONFIRMATORY_PARTICIPANT_FLOOR} confirmatory participants`,
    consequence: "no confirmatory verdict of any kind",
    permitted_response:
      "recruit more, or report the study as not run. A pooled analysis on a short sample is not a smaller verdict, it is a different study",
  },
  {
    code: "STOP-R2-STIMULUS",
    prereg_code: "STOP-R2-STIMULUS",
    condition: `fewer than ${MINIMUM_PRIMARY_TEMPLATES} admissible primary templates`,
    consequence: "recruitment does not open",
    permitted_response:
      "rebuild stimuli and re-run the validator. Loosening §4.2 or §4.3 to admit more pairs is forbidden: the tolerances are what make the comparison a topology comparison",
  },
  {
    code: "STOP-R2-CODE",
    prereg_code: "STOP-R2-CODE",
    condition: `pooled Krippendorff's alpha below ${KRIPPENDORFF_POOLED_FLOOR} on target_structure_mentioned`,
    consequence: "the TCRF subjective layer is not established",
    permitted_response:
      `report the alpha. A stratum below ${KRIPPENDORFF_STRATUM_FLOOR} blocks H4 for that stratum only and is investigated WITHOUT changing the confirmatory codebook`,
  },
  {
    code: "STOP-R2-H1",
    prereg_code: "STOP-R2-A",
    condition: "controlled topology changes do not reliably change representation",
    consequence: "the TCRF relation/coalition programme stops. No EXP-R3",
    permitted_response:
      "report the null. This is the construct-validity gate and there is no analysis that rescues it",
  },
  {
    code: "STOP-R2-H2",
    prereg_code: "STOP-R2-B",
    condition: "H1 passes and reported representation adds no held-out information about action",
    consequence: "RESEARCH ONLY: the representation may be real and is not decision-relevant",
    permitted_response:
      "no product work, no resource score, no coaching claim. A descriptive finding is still a finding",
  },
  {
    code: "STOP-R2-CONFOUND",
    prereg_code: "STOP-R2-D",
    condition:
      "gross engine value, an accidentally introduced tactic, or collateral graph changes explain the effect",
    consequence: "the manipulation was invalid",
    permitted_response:
      "rebuild the stimuli. Reinterpreting the result as evidence for something else is the move this code exists to forbid",
  },
  {
    code: "STOP-R2-TEMPLATE",
    prereg_code: "STOP-R2-C",
    condition: "the result depends on one motif family, or does not survive unseen templates",
    consequence: "no general resource-field claim",
    permitted_response:
      "state which family carried it and treat that as the scope of anything further. A family-specific effect is not a field",
  },
  {
    code: "STOP-R2-LANGUAGE",
    prereg_code: "STOP-R2-E",
    condition: "language strata show an unexplained sign reversal, or a lexical artefact explains H4",
    consequence: "no universal ontology claim",
    permitted_response:
      "report per-stratum results. Pooling across a reversal to recover a pooled effect is forbidden",
  },
  {
    code: "STOP-R2-REACTIVITY",
    prereg_code: "STOP-R2-G",
    condition: "probe exposure at trial t changes behaviour at t+1",
    consequence: "resource probes are classified as an INTERVENTION in all later work",
    permitted_response:
      "keep H1 for the already committed move, and never again describe repeated probing as passive telemetry",
  },
  {
    /*
     * §12's `STOP-R2-F` HAS NO SHORT NAME IN THIS TASK'S LIST AND IS KEPT ANYWAY, because it is the
     * one that catches the instrument inventing its own subject: an effect that appears only when
     * the interface names the relation is an effect the interface made.
     */
    code: "STOP-R2-INSTRUMENT",
    prereg_code: "STOP-R2-F",
    condition: "only explicitly named or forced representations produce the effect",
    consequence: "the measurement created the construct",
    permitted_response: "stop. There is no version of this that becomes a finding by being reworded",
  },
];

const INDEX = new Map<string, StopCondition>(
  STOP_CONDITIONS.flatMap((s) =>
    s.prereg_code && s.prereg_code !== s.code
      ? [
          [s.code, s] as [string, StopCondition],
          [s.prereg_code, s] as [string, StopCondition],
        ]
      : [[s.code, s] as [string, StopCondition]],
  ),
);

/** Either naming scheme resolves to one row, so two documents cannot describe two events. */
export const canonicalStopCode = (code: string): StopCondition | undefined => INDEX.get(code);

/** §13's verdict matrix, as the only four things EXP-R2 may conclude. */
export const VERDICTS = [
  "STOP",
  "RESEARCH_ONLY",
  "CONDITIONAL_RESEARCH",
  "UNLOCK_EXP_R3",
] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * §13, as a function so the matrix cannot be read generously.
 *
 * NO ARGUMENT ORDER PRODUCES A PRODUCT VERDICT. The preregistration's last line of §13 is "No
 * EXP-R2 outcome directly unlocks production UI", and the return type is what enforces it: there is
 * no value of `Verdict` that means build something.
 */
export function verdict(input: {
  h1: boolean;
  h2: boolean;
  h4_established: boolean;
}): Verdict {
  if (!input.h1) return "STOP";
  if (!input.h2) return "RESEARCH_ONLY";
  return input.h4_established ? "UNLOCK_EXP_R3" : "CONDITIONAL_RESEARCH";
}
