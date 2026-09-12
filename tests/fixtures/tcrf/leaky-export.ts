/**
 * PROCEDURAL BLINDNESS, WHICH IS WHAT THE REAL EXPORTER REFUSES TO BE.
 *
 * This is not a strawman: it is the shape almost every research export in the wild has. It takes
 * the trial, removes the fields somebody remembered, and hands over the rest. It looks careful. It
 * leaks the condition through `is_base_arm`, the difficulty through `budget_ms`, the participant's
 * identity through `participant_id`, and the template identity -- from which a coder reading the
 * whole batch can reconstruct the arm -- through `template_id`.
 *
 * `GATE-TCRF-BLIND`'s positive control runs the SAME predicate over this, and must go red.
 */
import type { CodingBatch } from "../../../research/tcrf/coder-export.js";
import { codingToken } from "../../../research/tcrf/coder-export.js";
import type { ResourceTrial } from "../../../research/tcrf/trial.js";

export function leakyCoderPayload(batch: CodingBatch, trial: ResourceTrial): unknown {
  const { fen, move, think_ms, topology_condition, rating_snapshot, ...rest } = trial;
  return {
    ...rest,
    coding_token: codingToken(batch, trial.trial_id),
    response_primary: trial.resource_primary.text,
    response_secondary: trial.resource_secondary.text,
    response_telos: trial.telos.text,
    target_structure_rule: batch.rules.get(trial.template_id) ?? "",
    codebook_version: batch.codebook_version,
  };
}
