/**
 * THE PROVENANCE RECORD. A result without one is not evidence.
 *
 * §15 of the preregistration lists what every run records. This assembles it in one place so that
 * "we forgot to store the seed" is a compile error rather than a discovery made six months later
 * while trying to reproduce a number.
 *
 * WHY THE FIELDS ARE ALL REQUIRED AND NONE IS NULLABLE EXCEPT WHERE ABSENCE IS MEANINGFUL. A
 * provenance field that may be omitted will be omitted, and a record with a missing commit reads
 * exactly like a record whose commit was irrelevant. Where a value genuinely may not exist -- a
 * participant with no rating snapshot, an engine that was never run -- the surrounding type says so
 * and says why.
 *
 * RAW ACCOUNT DATA IS NOT HERE AND CANNOT BE PUT HERE. §15's last line: identifying account data is
 * not committed to the public repository. `participant_id` is the study's own opaque id; there is
 * no field for a Lichess username, and adding one would be the change a reviewer should refuse.
 */
import { execFileSync } from "node:child_process";
import { CODEBOOK_VERSION } from "./codebook.js";
import { DETECTOR_VERSIONS } from "./relations.js";
import { LANGUAGE_VERSION } from "./probe-wording.js";
import { STIMULUS_SCHEMA_VERSION } from "./stimulus.js";
import { TRIAL_PROTOCOL_VERSION } from "./trial.js";
import { ANALYSIS_PLAN_VERSION } from "./analysis/plan.js";

export interface ResearchTrace {
  git_sha: string;
  protocol_version: number;
  stimulus_version: number;
  stimulus_schema_version: number;
  detector_versions: Record<string, number>;
  language_version: number;
  codebook_version: number;
  analysis_plan_version: number;
  /** The engine's own `id name`, or null when no engine was involved in this artefact. */
  engine_identity: string | null;
  engine_options: Record<string, string | number | boolean> | null;
  /** The seed every randomised assignment in the session was drawn from. */
  randomisation_seed: string;
  recorded_at: string;
}

export class ProvenanceError extends Error {}

const headSha = (): string => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    /*
     * REFUSING RATHER THAN RETURNING "unknown". A trace whose commit is the string `unknown` is a
     * trace that passes every shape check and reconstructs nothing. The caller has to decide what
     * to do about a working tree with no git, and the decision has to be visible.
     */
    throw new ProvenanceError("no git commit available; a derived research artefact needs one");
  }
};

export function currentTrace(input: {
  stimulusVersion: number;
  randomisationSeed: string;
  engineIdentity?: string | null;
  engineOptions?: Record<string, string | number | boolean> | null;
  now?: () => Date;
}): ResearchTrace {
  return {
    git_sha: headSha(),
    protocol_version: TRIAL_PROTOCOL_VERSION,
    stimulus_version: input.stimulusVersion,
    stimulus_schema_version: STIMULUS_SCHEMA_VERSION,
    detector_versions: { ...DETECTOR_VERSIONS },
    language_version: LANGUAGE_VERSION,
    codebook_version: CODEBOOK_VERSION,
    analysis_plan_version: ANALYSIS_PLAN_VERSION,
    engine_identity: input.engineIdentity ?? null,
    engine_options: input.engineOptions ?? null,
    randomisation_seed: input.randomisationSeed,
    recorded_at: (input.now ?? (() => new Date()))().toISOString(),
  };
}

/**
 * Whether a stored trace still describes the tree it claims to.
 *
 * DRIFT IS REPORTED PER FIELD, NOT AS A BOOLEAN. A run recorded under detector `overload: 1` while
 * the tree is at `overload: 2` is reproducible for every other variable; collapsing that to "stale"
 * would throw away a dataset that is perfectly readable with one caveat.
 */
export function traceDrift(trace: ResearchTrace): string[] {
  const out: string[] = [];
  const compare = (name: string, recorded: number, current: number) => {
    if (recorded !== current) out.push(`${name}: recorded v${recorded}, tree is v${current}`);
  };
  compare("protocol_version", trace.protocol_version, TRIAL_PROTOCOL_VERSION);
  compare("stimulus_schema_version", trace.stimulus_schema_version, STIMULUS_SCHEMA_VERSION);
  compare("language_version", trace.language_version, LANGUAGE_VERSION);
  compare("codebook_version", trace.codebook_version, CODEBOOK_VERSION);
  compare("analysis_plan_version", trace.analysis_plan_version, ANALYSIS_PLAN_VERSION);
  for (const [detector, version] of Object.entries(DETECTOR_VERSIONS)) {
    const recorded = trace.detector_versions[detector];
    if (recorded === undefined) out.push(`detector ${detector}: not recorded at all`);
    else if (recorded !== version) out.push(`detector ${detector}: recorded v${recorded}, tree is v${version}`);
  }
  for (const detector of Object.keys(trace.detector_versions)) {
    if (!(detector in DETECTOR_VERSIONS)) {
      out.push(`detector ${detector}: recorded, and the tree no longer has it`);
    }
  }
  return out;
}
