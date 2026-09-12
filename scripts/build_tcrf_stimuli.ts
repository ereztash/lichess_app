/**
 * THE STIMULUS CURATOR: from a candidate perturbation to a record that can be checked.
 *
 * §4.4 of the preregistration describes a workflow and does not implement one: candidate variants
 * are generated before participant data, the target relation must change, and among the candidates
 * that satisfy §4.2 and §4.3 the one with the smallest non-target graph edit count is kept. This is
 * that workflow, in the order a researcher performs it:
 *
 *    1  read a legal base position and one or more proposed legal perturbations of it
 *    2  compute the relation topology of both arms and diff them
 *    3  score the collateral structural change
 *    4  run engine matching under both configurations
 *    5  reject what §4.2/§4.3/§4.4 do not admit
 *    6  keep the provenance of everything, including the rejections
 *
 * REJECTIONS ARE WRITTEN DOWN, NOT DROPPED. A manifest holding only the pairs that passed would
 * make "matched topology pairs are constructible" unfalsifiable: a reader could never tell twenty
 * survivors out of twenty-one from twenty out of two hundred. Every candidate is recorded with its
 * verdict, and `STOP-R2-STIMULUS` is computed over the survivors.
 *
 *    npx tsx scripts/build_tcrf_stimuli.ts                  # derive + validate, no engine
 *    npx tsx scripts/build_tcrf_stimuli.ts --engine <path>  # the full §4.3 matching run
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { UciEngine } from "./uci-engine.js";
import {
  HIGH_BUDGET,
  SHIPPED_BUDGET,
  readPair,
  unmeasured,
} from "../research/tcrf/engine-match.js";
import { currentDetectorVersions, type StimulusManifest, type StimulusPair } from "../research/tcrf/stimulus.js";
import { diffFields, structuralField } from "../research/tcrf/relations.js";
import {
  computeInvariants,
  pieceRelocations,
  validateManifest,
  validatePair,
} from "../research/tcrf/validate-stimulus.js";

const CANDIDATES = "research/tcrf/stimuli/CANDIDATES.json";
const OUTPUT = "research/tcrf/stimuli/PRIMARY_V1.json";

/** The fields a researcher writes by hand. Everything else on a `StimulusPair` is derived here. */
interface Candidate {
  template_id: string;
  family: StimulusPair["family"];
  base_fen: string;
  present_fen: string;
  disrupted_fen: string;
  base_arm: StimulusPair["base_arm"];
  target_relation: string;
  target_affordance_present: string[];
  target_affordance_disrupted: string[];
  description_reveals_manipulation: boolean;
  review_status: StimulusPair["review_status"];
  review_notes: string;
  reviewer_ids: string[];
}

const gitSha = (): string | null => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

function derive(candidate: Candidate, sha: string | null): StimulusPair {
  const fieldPresent = structuralField(candidate.present_fen);
  const fieldDisrupted = structuralField(candidate.disrupted_fen);
  const graph_diff = diffFields(fieldPresent, fieldDisrupted);
  const targetChanged =
    fieldPresent.includes(candidate.target_relation) &&
    !fieldDisrupted.includes(candidate.target_relation);
  return {
    ...candidate,
    invariants_present: computeInvariants(candidate.present_fen, candidate.target_affordance_present),
    invariants_disrupted: computeInvariants(
      candidate.disrupted_fen,
      candidate.target_affordance_disrupted,
    ),
    graph_diff,
    non_target_edit_count: graph_diff.size - (targetChanged ? 1 : 0),
    piece_relocations: pieceRelocations(candidate.present_fen, candidate.disrupted_fen),
    engine_shipped: unmeasured("shipped"),
    engine_high_budget: unmeasured("high_budget"),
    detector_versions: currentDetectorVersions(),
    stimulus_version: 1,
    derived_at_git_sha: sha,
  };
}

async function main() {
  const engineArg = process.argv.indexOf("--engine");
  const binary = engineArg > -1 ? process.argv[engineArg + 1] : null;
  const candidates = JSON.parse(readFileSync(resolve(CANDIDATES), "utf8")) as Candidate[];
  const sha = gitSha();
  const pairs = candidates.map((c) => derive(c, sha));

  if (binary) {
    const engine = await UciEngine.spawn(binary);
    for (const pair of pairs) {
      pair.engine_shipped = await readPair(engine, pair.present_fen, pair.disrupted_fen, SHIPPED_BUDGET);
      pair.engine_high_budget = await readPair(engine, pair.present_fen, pair.disrupted_fen, HIGH_BUDGET);
      process.stdout.write(
        `${pair.template_id} shipped Δ=${pair.engine_shipped.value_delta?.toFixed(4) ?? "n/a"} ` +
          `high Δ=${pair.engine_high_budget.value_delta?.toFixed(4) ?? "n/a"}\n`,
      );
    }
    engine.quit();
  }

  /*
   * SET MEMBERSHIP IS DECIDED BY THE VALIDATOR, NOT BY THE AUTHOR. A candidate enters the primary
   * set only if nothing blocks it; §4.3's exploratory set is where a value-shifted pair goes, and
   * anything else is REJECTED. Writing the verdict here rather than in the candidate file is what
   * stops a pair being promoted by editing a label.
   */
  const REVIEW_PENDING_CODES = new Set(["NOT_REVIEWED", "REVIEWERS_INSUFFICIENT"]);
  const VALUE_CODES = new Set([
    "VALUE_DELTA_EXCEEDED",
    "VALUE_MATCH_UNRESOLVED",
    "ENGINE_NOT_MEASURED",
    "ENGINE_DELTA_MISSING",
  ]);
  const entries = pairs.map((pair) => {
    const violations = validatePair(pair);
    const blocking = violations.filter((v) => v.severity === "BLOCK");
    const codes = new Set(blocking.map((v) => v.code));
    /*
     * VALUE FAILURE OUTRANKS REVIEW STATE, and structural failure outranks both. A pair that has
     * not been reviewed but whose arms are not value-matched is not "awaiting review": §4.3 already
     * says it can never carry the primary verdict, and a reviewer's signature cannot change that.
     */
    const structural = [...codes].filter(
      (c) => !REVIEW_PENDING_CODES.has(c) && !VALUE_CODES.has(c),
    );
    const set = structural.length
      ? ("REJECTED" as const)
      : [...codes].some((c) => VALUE_CODES.has(c))
        ? ("EXPLORATORY_VALUE_SHIFT" as const)
        : codes.size
          ? ("PENDING_REVIEW" as const)
          : ("PRIMARY_STRUCTURE_ONLY" as const);
    return { set, pair, violations };
  });

  const manifest: StimulusManifest = {
    manifest_version: 1,
    schema_version: 1,
    frozen: false,
    frozen_at_git_sha: null,
    detector_versions: currentDetectorVersions(),
    pairs: entries.map(({ set, pair }) => ({ set, pair })),
  };
  writeFileSync(resolve(OUTPUT), `${JSON.stringify(manifest, null, 2)}\n`);

  const verdict = validateManifest(manifest);
  for (const { set, pair, violations } of entries) {
    process.stdout.write(`\n${pair.template_id} [${pair.family}] -> ${set}\n`);
    process.stdout.write(
      `  diff ${pair.graph_diff.size} (non-target ${pair.non_target_edit_count}), ` +
        `relocations ${pair.piece_relocations}, ` +
        `legal ${pair.invariants_present.legal_moves}/${pair.invariants_disrupted.legal_moves}\n`,
    );
    for (const v of violations) process.stdout.write(`  ${v.severity} ${v.code}: ${v.detail}\n`);
  }
  process.stdout.write(
    `\nadmissible primary templates: ${verdict.primaryCount}` +
      ` (${JSON.stringify(verdict.perFamily)})\n` +
      `base-arm balance: ${JSON.stringify(verdict.baseArmBalance)}\n` +
      `STOP-R2-STIMULUS: ${verdict.stopStimulus ? "WOULD FIRE" : "clear"}\n` +
      `written: ${OUTPUT}\n`,
  );
}

void main();
