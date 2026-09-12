/**
 * THE CONTROLS THAT ARE ALLOWED TO KILL THE CONSTRUCT, IMPLEMENTED BEFORE THERE IS A RESULT.
 *
 * §11 of the preregistration lists seven adversarial controls and this task adds six more in the
 * same spirit. Written afterwards they would be a defence of whatever was found; written now they
 * are a set of ways to be wrong that the design has already agreed to accept.
 *
 * WHAT IS HERE AND WHAT IS NOT. These are the DATA TRANSFORMS and the pass rules -- the parts that
 * decide what a control is -- not the model fits. C1 is a permutation of a label, C2 is a swap of a
 * response between matched rows, C5 is a holdout split; each is a pure function of the dataset and
 * each is the part that can be quietly done wrong. The fitting is the same fitting as the primary
 * analysis, on the transformed rows.
 *
 * THE RULE FROM §11, RESTATED BECAUSE IT IS THE POINT: "A failed control is a result, not a request
 * to tune the experiment."
 */
import type { CodedResponse } from "../codebook.js";
import type { ResourceTrial } from "../trial.js";
import { foldOf, type HoldoutScheme } from "./plan.js";

export interface ControlSpec {
  id: string;
  name: string;
  /** What must happen for the primary claim to survive this control. */
  expectation: string;
  /** What it means if the expectation fails. Never "re-run with different settings". */
  on_failure: string;
}

export const CONTROLS: readonly ControlSpec[] = [
  {
    id: "C1",
    name: "topology label permutation, within template",
    expectation: "the H1 coefficient collapses to a null distribution centred on zero",
    on_failure:
      "an H1 effect that survives shuffled labels is an artefact of the model or of the clustering, not of the manipulation. The estimate is withdrawn",
  },
  {
    id: "C2",
    name: "response donor swap",
    expectation:
      "replacing each response with one from a DIFFERENT trial matched on template and condition destroys H2's held-out improvement",
    on_failure:
      "if a donor response predicts action as well as the participant's own, H2 is measuring template or condition, not representation. STOP-R2-H2",
  },
  {
    id: "C3",
    name: "object-only baseline",
    expectation:
      "a model using only OBJECT_CARRIER-level features and simple piece/material/location variables does NOT match B1's held-out performance",
    on_failure:
      "if it matches, the relational claim is not supported. Report the object-level construct and do not claim relational representation. This is the simpler-construct rule, and it wins",
  },
  {
    id: "C4",
    name: "engine-value and collateral-topology nuisance",
    expectation:
      "the H1 coefficient keeps its sign with engine pair-difference, non-target graph-edit count, legal-move delta and forcing-gap asymmetry entered as covariates",
    on_failure: "STOP-R2-CONFOUND. The stimuli are rebuilt; the result is not reinterpreted",
  },
  {
    id: "C5",
    name: "template holdout",
    expectation: "H1's sign and H2's improvement survive on templates never seen in training",
    on_failure:
      "the effect is template memorisation. STOP-R2-TEMPLATE, and no general resource-field claim",
  },
  {
    id: "C6",
    name: "language lexical control",
    expectation:
      "H4's direction is not produced by one translation carrying more relation-signalling wording than the others",
    on_failure: "STOP-R2-LANGUAGE. The wording is revised and the language stratum is re-run, not reinterpreted",
  },
  {
    id: "C7",
    name: "motif family holdout",
    expectation: "H1's sign survives leaving each of the four families out in turn",
    on_failure: "the result depends on one family. STOP-R2-C, and no general claim",
  },
  {
    id: "C8",
    name: "coder blindness audit",
    expectation:
      "the coder payload carries none of the forbidden fields, demonstrated by a test rather than by a procedure",
    on_failure: "coding was not blind; the reliability figures describe a different instrument",
  },
  {
    id: "C9",
    name: "reveal-ordering audit",
    expectation:
      "every contaminated trial is mechanically detectable and excluded before analysis, with its count reported",
    on_failure: "§7.4 was not enforced and the probed responses postdate information they should not have had",
  },
];

/**
 * C1. Permute the topology label WITHIN template.
 *
 * WITHIN TEMPLATE, NOT ACROSS IT, AND THE DIFFERENCE IS THE WHOLE CONTROL. A global shuffle would
 * also break the template-condition pairing, so a null result would be explained by the template
 * structure collapsing rather than by the label carrying nothing. Permuting inside each template
 * leaves every other structure intact and removes exactly one thing.
 *
 * DETERMINISTIC FROM A SEED. A control whose null distribution cannot be regenerated is a control
 * whose reported percentile nobody can check.
 */
export function permuteTopologyWithinTemplate(
  trials: ResourceTrial[],
  seed: number,
): ResourceTrial[] {
  const byTemplate = new Map<string, number[]>();
  trials.forEach((trial, index) => {
    byTemplate.set(trial.template_id, [...(byTemplate.get(trial.template_id) ?? []), index]);
  });
  const out = [...trials];
  let state = (seed >>> 0) || 1;
  const next = () => {
    // xorshift32: small, seeded, and reproducible from the integer alone.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  for (const indices of byTemplate.values()) {
    const labels = indices.map((i) => trials[i].topology_condition);
    for (let i = labels.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }
    indices.forEach((index, k) => {
      /*
       * `is_base_arm` MOVES WITH THE LABEL OR THE CONTROL LEAKS. It is a deterministic function of
       * the arm, so leaving it alone would let a model recover the true condition from a column the
       * shuffle forgot, and C1 would fail to null for a reason that has nothing to do with H1.
       */
      out[index] = {
        ...trials[index],
        topology_condition: labels[k],
        is_base_arm: labels[k] === trials[index].topology_condition ? trials[index].is_base_arm : !trials[index].is_base_arm,
      };
    });
  }
  return out;
}

/**
 * C2. Give each trial somebody else's response, from a trial matched on template AND condition.
 *
 * MATCHED ON BOTH, which is what makes the donor a fair one: an unmatched donor would differ in
 * condition, so its predictive failure could be read as the condition mattering rather than as the
 * individual response mattering. Returns null when a stratum has fewer than two members, because a
 * stratum of one has no donor and silently keeping the original response would make the control
 * partly a copy of the real analysis.
 */
export function donorSwap(
  trials: ResourceTrial[],
  coded: Map<string, CodedResponse>,
  seed: number,
): { swapped: Map<string, CodedResponse>; unmatched: string[] } {
  const strata = new Map<string, string[]>();
  for (const trial of trials) {
    if (!coded.has(trial.trial_id)) continue;
    const key = `${trial.template_id}:${trial.topology_condition}`;
    strata.set(key, [...(strata.get(key) ?? []), trial.trial_id]);
  }
  const swapped = new Map<string, CodedResponse>();
  const unmatched: string[] = [];
  let state = (seed >>> 0) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  for (const ids of strata.values()) {
    if (ids.length < 2) {
      unmatched.push(...ids);
      continue;
    }
    /* A derangement, so no trial keeps its own response: a single rotation guarantees it. */
    const offset = 1 + Math.floor(next() * (ids.length - 1));
    ids.forEach((id, index) => {
      const donor = coded.get(ids[(index + offset) % ids.length])!;
      swapped.set(id, { ...donor, trial_id: id });
    });
  }
  return { swapped, unmatched };
}

/** C5 / C7. The train and test split for one holdout run, from the recorded seed. */
export function holdoutSplit(
  trials: ResourceTrial[],
  scheme: HoldoutScheme,
  seed: string,
  testFold: number,
): { train: ResourceTrial[]; test: ResourceTrial[] } {
  const train: ResourceTrial[] = [];
  const test: ResourceTrial[] = [];
  for (const trial of trials) {
    (foldOf(trial, scheme, seed) === testFold ? test : train).push(trial);
  }
  return { train, test };
}

/** C7's four runs: everything but one family trains, that family tests. */
export function familyHoldout(
  trials: ResourceTrial[],
  heldOut: ResourceTrial["family"],
): { train: ResourceTrial[]; test: ResourceTrial[] } {
  return {
    train: trials.filter((t) => t.family !== heldOut),
    test: trials.filter((t) => t.family === heldOut),
  };
}

/**
 * C9. Contaminated trials, counted by kind rather than summed.
 *
 * §7.4 requires the count to be REPORTED, and a single total would hide the one that matters: a
 * reveal before commit is a broken instrument, while a reveal before probe is a broken question.
 */
export function contaminationCounts(trials: ResourceTrial[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const trial of trials) {
    if (!trial.contamination) continue;
    counts[trial.contamination.kind] = (counts[trial.contamination.kind] ?? 0) + 1;
  }
  return counts;
}
