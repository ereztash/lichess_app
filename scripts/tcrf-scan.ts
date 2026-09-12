/**
 * THE TWO EXP-R2 PREDICATES A REPOSITORY GATE CAN HONESTLY ASSERT.
 *
 * Everything else about EXP-R2 is a research state rather than a repository invariant, and the
 * difference matters more here than usual. "Fewer than 24 admissible templates" is `STOP-R2-STIMULUS`
 * and it is a decision taken before recruitment opens; it is NOT a defect in the tree, and a gate
 * that reddened on it would go red on the day the stimulus file is first created and stay red until
 * a chess reviewer signs 24 pairs. A gate like that gets disabled within a week.
 *
 * So the two predicates are:
 *
 *   1  no pair sits in the PRIMARY set while violating an invariant the preregistration froze, and
 *      no derived field on any pair disagrees with the position it was derived from;
 *   2  the payload handed to a blinded coder carries none of the fields §8 blinds them to.
 *
 * Both are properties of the tree, both can be violated by an ordinary edit, and both have a
 * positive control that is the same predicate over deliberately broken input. The stimulus counts
 * are REPORTED in the gate's detail so the research state is visible beside the verdict, which is
 * the `scripts/verify_scope.ts` idea: print the boundary rather than pretend it is an invariant.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "./gate-scan";
import {
  stimulusManifestSchema,
  type StimulusManifest,
} from "../research/tcrf/stimulus.js";
import { validateManifest, validatePair } from "../research/tcrf/validate-stimulus.js";
import {
  CODER_FORBIDDEN_FIELDS,
  blindnessBreaches,
  undeclaredFields,
  type CoderPayload,
  type CodingBatch,
} from "../research/tcrf/coder-export.js";
import type { ResourceTrial } from "../research/tcrf/trial.js";

export const MANIFEST_PATH = "research/tcrf/stimuli/PRIMARY_V1.json";

export interface StimulusReport {
  findings: Finding[];
  /** Printed beside the verdict. A research state, never a pass/fail input. */
  summary: string;
}

/**
 * A manifest that says something about its own pairs that the pairs do not say back.
 *
 * WHY A PARSE FAILURE IS A FINDING RATHER THAN A THROW. A manifest that no longer matches its own
 * schema is exactly the drift this is for, and a stack trace out of a gate runner reads as a broken
 * gate rather than as a broken artefact.
 */
export function findStimulusDrift(root: string): StimulusReport {
  const path = join(root, MANIFEST_PATH);
  if (!existsSync(path)) {
    return { findings: [], summary: "no stimulus manifest in the tree" };
  }
  let manifest: StimulusManifest;
  try {
    manifest = stimulusManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    return {
      findings: [
        {
          file: MANIFEST_PATH,
          line: 1,
          text: `the manifest does not satisfy its own schema: ${(error as Error).message.split("\n")[0]}`,
        },
      ],
      summary: "manifest unreadable",
    };
  }

  const findings: Finding[] = [];
  /*
   * MEMBERSHIP IS THE ASSERTION. A pair with a BLOCK finding sitting in a non-primary set is the
   * system working -- that is what the exploratory and pending sets are for. The same pair inside
   * PRIMARY_STRUCTURE_ONLY is a claim the record cannot support, and it is the claim H1 would be
   * computed from.
   */
  for (const entry of manifest.pairs) {
    const violations = validatePair(entry.pair);
    if (entry.set !== "PRIMARY_STRUCTURE_ONLY") {
      /*
       * STALENESS IS CHECKED IN EVERY SET, and only staleness. A derived field that disagrees with
       * its own position is wrong wherever it sits: an exploratory pair whose graph diff was
       * computed under an older detector will be read by the exploratory analysis all the same.
       */
      for (const stale of violations.filter((v) => v.code.endsWith("_STALE"))) {
        findings.push({
          file: MANIFEST_PATH,
          line: 1,
          text: `${stale.template_id} [${entry.set}] ${stale.code}: ${stale.detail}`,
        });
      }
      continue;
    }
    for (const violation of violations.filter((v) => v.severity === "BLOCK")) {
      findings.push({
        file: MANIFEST_PATH,
        line: 1,
        text: `${violation.template_id} is in the PRIMARY set and ${violation.code}: ${violation.detail}`,
      });
    }
  }

  if (manifest.frozen && !manifest.frozen_at_git_sha) {
    findings.push({
      file: MANIFEST_PATH,
      line: 1,
      text: "the manifest declares itself frozen and names no commit it was frozen at",
    });
  }

  const verdict = validateManifest(manifest);
  const counts = manifest.pairs.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.set] = (acc[entry.set] ?? 0) + 1;
    return acc;
  }, {});
  return {
    findings,
    summary:
      `${manifest.pairs.length} pairs ${JSON.stringify(counts)}; ` +
      `${verdict.primaryCount} admissible primary templates` +
      (verdict.stopStimulus ? " -- STOP-R2-STIMULUS would fire at recruitment" : ""),
  };
}

/** The exporter shape both the gate and its control are run against. */
export type CoderExporter = (batch: CodingBatch, trial: ResourceTrial) => unknown;

/**
 * A trial carrying, in every field, the thing a coder must not learn.
 *
 * BUILT RATHER THAN SAMPLED. A real trial might happen to have an unremarkable value in the field
 * that leaks, and a control that passes because the input was bland proves nothing.
 */
export function revealingTrial(): ResourceTrial {
  return {
    trial_id: "T-0001",
    participant_id: "P-0001",
    trial_index: 7,
    template_id: "SD-01",
    family: "support_defence",
    topology_condition: "present",
    is_base_arm: true,
    language: "en",
    time_regime: "tight",
    budget_ms: 12000,
    probe_assignment: "probed",
    probe_delivery: "answered",
    fen: "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20",
    move: "e5d7",
    think_ms: 8123,
    timed_out: false,
    commit_failed: false,
    resource_primary: { state: "answered", text: "the rook behind the knight", latency_ms: 4100 },
    resource_secondary: { state: "answered", text: "the back rank", latency_ms: 2200 },
    telos: { state: "answered", text: "keep the outpost", latency_ms: 1900 },
    reveal_timing: "per-decision",
    contamination: null,
    protocol_version: 1,
    stimulus_version: 1,
    git_sha: "0000000",
    detector_versions: { attacks: 1 },
    language_version: 1,
    randomisation_seed: "seed-1",
    rating_snapshot: 1840,
    cohort: "confirmatory",
  };
}

export function coderBatch(): CodingBatch {
  return {
    batch_id: "B-1",
    salt: "gate-salt",
    codebook_version: 1,
    rules: new Map([["SD-01", "the response asserts that the rook on e1 covers the knight on e5"]]),
  };
}

/**
 * Every way a coder payload can stop being blind, over one exporter.
 *
 * THREE CHECKS, NOT ONE. A forbidden key present is the obvious failure. A key the whitelist does
 * not declare is the failure that happens by accident, when a field is added to the trial and the
 * exporter spreads it. And the response text missing is the failure that makes blindness pointless
 * by making the payload uncodeable.
 */
export function findBlindnessBreaches(exporter: CoderExporter): Finding[] {
  const out: Finding[] = [];
  let payload: unknown;
  try {
    payload = exporter(coderBatch(), revealingTrial());
  } catch (error) {
    return [
      { file: "research/tcrf/coder-export.ts", line: 1, text: `the exporter threw: ${(error as Error).message}` },
    ];
  }
  for (const key of blindnessBreaches(payload)) {
    out.push({
      file: "research/tcrf/coder-export.ts",
      line: 1,
      text: `the coder payload carries \`${key}\`, which §8 blinds coders to`,
    });
  }
  const typed = payload as CoderPayload;
  for (const key of undeclaredFields(typed)) {
    out.push({
      file: "research/tcrf/coder-export.ts",
      line: 1,
      text: `the coder payload carries \`${key}\`, which CODER_VISIBLE_FIELDS does not declare`,
    });
  }
  if (!typed || typeof typed !== "object" || typeof typed.response_primary !== "string") {
    out.push({
      file: "research/tcrf/coder-export.ts",
      line: 1,
      text: "the coder payload carries no response to code",
    });
  }
  return out;
}

/** The forbidden list, exported so a test can assert the gate is checking §8's own words. */
export const BLINDED_FIELDS = CODER_FORBIDDEN_FIELDS;
