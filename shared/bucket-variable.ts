/**
 * Which VARIABLE each bucket is a level of -- and why testing levels separately manufactures a
 * finding that is not there.
 *
 * THE MEASUREMENT THAT PRODUCED THIS FILE. Four hundred simulated players, each with exactly one
 * weakness (overconfident in the middlegame, perfectly calibrated everywhere else), 240 decisions
 * apiece, seeded:
 *
 *   phase-middlegame fires on   85.5%   -- correct, and it is the real effect
 *   phase-opening fires on      19.5%   -- a phase where nothing whatever is wrong
 *   phase-endgame fires on      17.8%   -- likewise
 *   told they have MORE THAN ONE pattern:  35.0%   (43.0% once middlegame moves are quicker)
 *
 * IT IS ARITHMETIC, NOT CHANCE. `detect` measures each bucket against "the rest", and the rest
 * contains the real weakness. When the middlegame is bad and it is half the record, "opening
 * versus the rest" is good BY CONSTRUCTION. Of the 78 times `phase-opening` fired across those
 * runs it fired as underconfident 78 times out of 78 -- the product telling a player to trust
 * themselves more in a phase they are already calibrated in.
 *
 * WHY A HIGHER BAR IS NOT THE FIX. The mirror and the real finding are the same measurement seen
 * from two sides, so any threshold that suppresses one suppresses the other. The fix is to stop
 * asking one question three times.
 *
 * WHAT THIS FILE DOES NOT CHANGE. `BUCKETINGS` keeps every key it has. A stored claim and a
 * preregistered hypothesis both name a bucket key, and `detect`'s `onlyBucketKey` throws on a key
 * it cannot find -- so removing or renaming one would break records already written. This is a
 * reading built ON TOP of the detector's output, which is also why it cannot change what the
 * detector is allowed to look at.
 */
import type { CandidatePattern } from "./detector.js";

export interface BucketVariable {
  key: string;
  /** What the variable is, in the player's terms. The finding is stated about this. */
  label: string;
  /** The bucket keys that are levels of it. */
  levels: readonly string[];
}

/**
 * The variables, and the count is the mechanism: fewer variables than buckets is the whole point.
 *
 * `time-taken` and `clock` are deliberately separate. How long a player CHOSE to spend and how
 * much time they had LEFT are different questions -- one is deliberation, the other is pressure --
 * and merging them would collapse a finding about the first into a finding about the second.
 * Keeping them apart is also what makes crossing them meaningful.
 */
export const VARIABLES: readonly BucketVariable[] = [
  {
    key: "phase",
    label: "שלב המשחק",
    levels: ["phase-opening", "phase-middlegame", "phase-endgame"],
  },
  { key: "time-taken", label: "כמה זמן לקחתם", levels: ["fast-under-45s", "slow-over-2m"] },
  { key: "clock", label: "כמה זמן נשאר על השעון", levels: ["clock-under-1m"] },
];

/** Null rather than a default: a key that is not a level of anything is not a variable of its own. */
export function variableOf(bucketKey: string): BucketVariable | null {
  return VARIABLES.find((v) => v.levels.includes(bucketKey)) ?? null;
}

export interface VariableFinding {
  variable: BucketVariable;
  /** The level that sits furthest from the rest of the record. The finding is about this one. */
  strongest: CandidatePattern;
  /**
   * Levels that cleared on the OPPOSITE side of the record's average from `strongest`.
   *
   * KEPT RATHER THAN DISCARDED. That the opening reads high because the middlegame reads low is a
   * true and useful thing about the record, and this project's recurring defect is measuring a
   * distinction and throwing it away before it reaches anyone. It is a consequence of the
   * finding, and it is not a second claim.
   */
  mirrored: CandidatePattern[];
  /**
   * Levels that cleared on the SAME side as `strongest`.
   *
   * A different fact from a mirror: two levels bad in the same direction is a real statement
   * about the variable ("everything except the middlegame"), not an artefact of the arithmetic.
   */
  alongside: CandidatePattern[];
  levelsTested: number;
  levelsCleared: number;
}

export interface VariableReading {
  /** At most one per variable. Ordered by the support behind the strongest level. */
  findings: VariableFinding[];
}

/**
 * Collapse the detector's per-bucket candidates into at most one finding per variable.
 *
 * ORDERING WITHIN A VARIABLE IS BY DISTANCE, NOT BY SIZE. `detect` sorts its output by
 * `inside.n`, which is the right rule for choosing between unrelated claims -- the one with the
 * most support wins. Inside a single variable it is the wrong rule: the biggest level is the one
 * the record happens to contain most of, and picking it would report the middlegame simply for
 * being half the game. The level that sits furthest from the rest IN STANDARD ERRORS is the one
 * the variable is actually about.
 */
export function readVariables(
  candidates: CandidatePattern[],
  /**
   * The variables to read, when they are not the shipped three.
   *
   * Additive, unused by the product, and here for the same one caller as `detect`'s `searchSpace`:
   * a candidate bucket set whose levels are not the shipped keys would otherwise be read as no
   * variable at all and silently dropped, which would make a candidate look unreadable for a reason
   * that has nothing to do with the candidate.
   */
  variables: readonly BucketVariable[] = VARIABLES,
): VariableReading {
  const findings: VariableFinding[] = [];

  for (const variable of variables) {
    const cleared = candidates.filter((c) => variable.levels.includes(c.key));
    if (cleared.length === 0) continue;

    const distance = (c: CandidatePattern) => Math.abs(c.gapDifference) / c.standardError;
    const strongest = [...cleared].sort((a, b) => distance(b) - distance(a))[0];
    const rest = cleared.filter((c) => c !== strongest);

    findings.push({
      variable,
      strongest,
      mirrored: rest.filter((c) => Math.sign(c.gapDifference) !== Math.sign(strongest.gapDifference)),
      alongside: rest.filter((c) => Math.sign(c.gapDifference) === Math.sign(strongest.gapDifference)),
      levelsTested: variable.levels.length,
      levelsCleared: cleared.length,
    });
  }

  // Between variables, the detector's own rule stands: the claim with the most support leads.
  return { findings: findings.sort((a, b) => b.strongest.inside.n - a.strongest.inside.n) };
}
