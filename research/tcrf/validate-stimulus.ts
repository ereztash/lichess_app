/**
 * THE STIMULUS VALIDATOR: whether a matched pair is what its record says it is.
 *
 * EXP-R2's first hard problem is not the interface and not the analysis. It is whether topology can
 * be changed at all while material and gross chess value stay matched (§4.2, §4.3). Nobody knows
 * that in advance, and the preregistration's own `STOP-R2-STIMULUS` exists because the answer may
 * be no. So this runs before any participant sees anything, and it is allowed to say no.
 *
 * IT RECOMPUTES; IT DOES NOT READ. Every derived field on a `StimulusPair` is recalculated here from
 * the three FEN strings and compared against what the record claims. A validator that trusted the
 * curator's arithmetic would pass a manifest whose graph diff was computed under an older detector,
 * which is precisely the drift `scripts/research-scan.ts` was written for one directory over.
 *
 * TWO SEVERITIES, AND THE DISTINCTION IS NOT SOFTNESS.
 *
 *   BLOCK   a frozen invariant from §4.2/§4.3/§4.4 is violated. The pair cannot be PRIMARY. The
 *           preregistration already decided this and no verdict here may move it.
 *   REVIEW  something the frozen design did not list, recorded because silence about it would be
 *           worse. Legal-move asymmetry is the standing example: §4.2 does not require matched
 *           legal-move counts, so blocking on it would be amending a frozen document after the
 *           fact; saying nothing would let one arm offer forty options and the other eighteen and
 *           call that a topology manipulation. It is recorded, it demands a reviewer note, and it
 *           enters the analysis as a covariate.
 *
 * NO ENGINE HERE. Engine matching needs a process, a budget and a wall clock; keeping it in
 * `engine-match.ts` means every predicate in this file is pure and runs in a unit test in
 * milliseconds. What this file does check is that the engine BLOCK says something admissible --
 * including that it was measured at all.
 */
import { Chess } from "chess.js";
import { classifyPhase } from "../../shared/phase.js";
import { ACCURATE_CP_LOSS, ACCURATE_WIN_PROBABILITY_LOSS } from "../../shared/detector.js";
import { WIN_PROBABILITY_K } from "../../shared/win-probability.js";
import {
  DETECTOR_VERSIONS,
  diffFields,
  structuralField,
  type StimulusFamily,
} from "./relations.js";
import {
  STIMULUS_SCHEMA_VERSION,
  type ArmInvariants,
  type StimulusManifest,
  type StimulusPair,
} from "./stimulus.js";

export type Severity = "BLOCK" | "REVIEW";

export interface Violation {
  template_id: string;
  code: string;
  severity: Severity;
  detail: string;
}

/**
 * How far apart the two arms' legal-move counts may be before a reviewer has to say why.
 *
 * NOT A PREREGISTERED THRESHOLD AND NOT TREATED AS ONE. It is the smallest asymmetry that cannot
 * plausibly be one relation moving: a single edit that changes the option count by more than this
 * has done something else as well. It is a REVIEW trigger, never a BLOCK.
 */
export const LEGAL_MOVE_REVIEW_DELTA = 6;

/** §4.4: the edit must be local. Beyond this many collateral relations it is not a local edit. */
export const NON_TARGET_EDIT_REVIEW_CEILING = 12;

/**
 * How much more forcing one arm may be than the other before a reviewer has to look.
 *
 * Set at `ACCURATE_WIN_PROBABILITY_LOSS` -- the same winning-chance quantity §4.3 matches the arms
 * on -- so the pair's two tolerances are one number read twice rather than two invented ones.
 */
export const FORCING_ASYMMETRY_REVIEW_DELTA = ACCURATE_WIN_PROBABILITY_LOSS;

/**
 * THE BAND IN WHICH §4.3's MATCHING TEST ACTUALLY HAS RESOLUTION, and the reason it had to be added.
 *
 * §4.3 matches the two arms on winning chances. Winning chances are a logistic, and a logistic is
 * FLAT AT ITS ENDS. `shared/win-probability.ts` says so from the other direction and gives the
 * numbers: 30 centipawns costs 2.76 points of winning chances at a level position and 0.28 at
 * +10.00. Run backwards, that means two positions 200 centipawns apart in a won game differ by less
 * than the tolerance, and the matching test passes them.
 *
 * THIS WAS NOT A HYPOTHETICAL. The first pilot pair in the higher-order-coalition family came back
 * with a delta of EXACTLY 0.0000 under both engine configurations, which read as a perfect match
 * and was nothing of the kind: both arms evaluated at 1.000: White was winning by a queen in both.
 * The pair had passed §4.3 by being decided rather than by being matched.
 *
 * WHAT THIS IS AND IS NOT. It is not a new matching criterion and it does not move §4.3's tolerance.
 * It says when §4.3's test was PERFORMED at all. Outside the band the engine comparison has no
 * resolution, so the honest state of the measurement is `unresolved`, which is the same distinction
 * `NOT_MEASURED` carries one level up and the same one `scripts/run_gates.ts` keeps beside PASS.
 *
 * THE BOUND IS DERIVED, NOT PICKED. It is the winning chance at which the tolerance
 * `ACCURATE_WIN_PROBABILITY_LOSS` stretches to twice its own anchor, `ACCURATE_CP_LOSS`: 60
 * centipawns rather than 30. The factor of two is the one judgement in it and it is stated here
 * rather than buried: beyond it the same tolerance is silently buying a different position.
 */
const cpOfWinProbability = (p: number): number => Math.log(p / (1 - p)) / WIN_PROBABILITY_K;

function deriveResolvableBound(): number {
  let lo = 0.5;
  let hi = 0.999;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    const width = cpOfWinProbability(mid) - cpOfWinProbability(mid - ACCURATE_WIN_PROBABILITY_LOSS);
    if (width < 2 * ACCURATE_CP_LOSS) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** ~0.867. Above it, or below its mirror, the §4.3 comparison cannot discriminate. */
export const VALUE_RESOLVABLE_UPPER = deriveResolvableBound();
export const VALUE_RESOLVABLE_LOWER = 1 - VALUE_RESOLVABLE_UPPER;

export const valueMatchResolvable = (value: number): boolean =>
  value >= VALUE_RESOLVABLE_LOWER && value <= VALUE_RESOLVABLE_UPPER;

/** The material inventory as a comparable string: piece letters, case-sensitive, sorted. */
export function materialSignature(fen: string): string {
  return new Chess(fen)
    .board()
    .flat()
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => (s.color === "w" ? s.type.toUpperCase() : s.type))
    .sort()
    .join("");
}

/** Which squares hold which piece, so a relocation can be counted without a move list. */
const placement = (fen: string): Map<string, string> =>
  new Map(
    new Chess(fen)
      .board()
      .flat()
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => [s.square as string, `${s.color}${s.type}`]),
  );

/** Pieces that sit on a different square, or are a different piece, between two positions. */
export function pieceRelocations(a: string, b: string): number {
  const left = placement(a);
  const right = placement(b);
  let moved = 0;
  for (const [square, piece] of left) if (right.get(square) !== piece) moved += 1;
  for (const [square] of right) if (!left.has(square)) moved += 1;
  return moved;
}

/**
 * Ply is not in a FEN in a form `classifyPhase` can use directly, so it is derived from the move
 * number the FEN does carry. Phase only has to be EQUAL across the arms, and both arms share a move
 * number by construction, so a crude ply is sufficient and is stated rather than hidden.
 */
const plyOf = (fen: string): number => {
  const parts = fen.split(" ");
  const fullmove = Number(parts[5] ?? 1);
  return (Number.isFinite(fullmove) ? fullmove - 1 : 0) * 2 + (parts[1] === "b" ? 1 : 0);
};

export function computeInvariants(fen: string, targetAffordance: string[]): ArmInvariants {
  const board = new Chess(fen);
  const legal = board.moves({ verbose: true }) as Array<{ from: string; to: string; promotion?: string }>;
  const legalUci = new Set(legal.map((m) => `${m.from}${m.to}${m.promotion ?? ""}`));
  return {
    material: materialSignature(fen),
    side_to_move: board.turn() as "w" | "b",
    phase: classifyPhase(fen, plyOf(fen)),
    in_check: board.isCheck(),
    castling: fen.split(" ")[2] ?? "-",
    legal_moves: legal.length,
    target_affordance_available:
      targetAffordance.length > 0 && targetAffordance.every((m) => legalUci.has(m)),
  };
}

const legalFen = (fen: string): boolean => {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
};

/**
 * Every check on one pair, in one pass.
 *
 * ORDERED SO THAT A READER CAN FOLLOW THE PREREGISTRATION TOP TO BOTTOM: §4.1 identity, §4.2
 * matching, §4.4 locality, §4.3 value, §4.5 review, then provenance.
 */
export function validatePair(pair: StimulusPair): Violation[] {
  const out: Violation[] = [];
  const flag = (code: string, severity: Severity, detail: string) =>
    out.push({ template_id: pair.template_id, code, severity, detail });

  for (const [name, fen] of [
    ["base_fen", pair.base_fen],
    ["present_fen", pair.present_fen],
    ["disrupted_fen", pair.disrupted_fen],
  ] as const) {
    if (!legalFen(fen)) flag("FEN_ILLEGAL", "BLOCK", `${name} is not a position chess.js accepts`);
  }
  if (out.length) return out;

  if (pair.present_fen === pair.disrupted_fen) {
    flag("ARMS_IDENTICAL", "BLOCK", "the two arms are the same position");
    return out;
  }

  // §4.1 -- the base must BE one of the arms, or "unedited arm" names nothing.
  const claimedBase = pair.base_arm === "present" ? pair.present_fen : pair.disrupted_fen;
  if (pair.base_fen !== claimedBase) {
    flag(
      "BASE_ARM_MISMATCH",
      "BLOCK",
      `base_arm says ${pair.base_arm}, but base_fen matches neither that arm's position`,
    );
  }

  // §4.2 -- what every pair must preserve.
  const present = computeInvariants(pair.present_fen, pair.target_affordance_present);
  const disrupted = computeInvariants(pair.disrupted_fen, pair.target_affordance_disrupted);

  if (present.material !== disrupted.material) {
    flag("MATERIAL_DIFFERS", "BLOCK", `${present.material} vs ${disrupted.material}`);
  }
  if (present.side_to_move !== disrupted.side_to_move) {
    flag("SIDE_TO_MOVE_DIFFERS", "BLOCK", `${present.side_to_move} vs ${disrupted.side_to_move}`);
  }
  if (present.phase !== disrupted.phase) {
    flag("PHASE_DIFFERS", "BLOCK", `${present.phase} vs ${disrupted.phase}`);
  }
  if (present.in_check !== disrupted.in_check) {
    flag("CHECK_STATUS_DIFFERS", "BLOCK", `in_check ${present.in_check} vs ${disrupted.in_check}`);
  }
  if (present.castling !== disrupted.castling) {
    flag("CASTLING_DIFFERS", "BLOCK", `${present.castling} vs ${disrupted.castling}`);
  }
  for (const [arm, computed, recorded] of [
    ["present", present, pair.invariants_present],
    ["disrupted", disrupted, pair.invariants_disrupted],
  ] as const) {
    if (JSON.stringify(computed) !== JSON.stringify(recorded)) {
      flag(
        "INVARIANTS_STALE",
        "BLOCK",
        `${arm} arm records invariants that do not match the position: recorded ${JSON.stringify(recorded)}, computed ${JSON.stringify(computed)}`,
      );
    }
  }
  const legalDelta = Math.abs(present.legal_moves - disrupted.legal_moves);
  if (legalDelta > LEGAL_MOVE_REVIEW_DELTA) {
    flag(
      "LEGAL_MOVE_ASYMMETRY",
      "REVIEW",
      `${present.legal_moves} vs ${disrupted.legal_moves} legal moves (delta ${legalDelta}); not a §4.2 invariant, so it is recorded and carried as a covariate rather than blocking`,
    );
  }

  // The manipulation itself: the target relation must actually change, in the stated direction.
  const fieldPresent = structuralField(pair.present_fen);
  const fieldDisrupted = structuralField(pair.disrupted_fen);
  const inPresent = fieldPresent.includes(pair.target_relation);
  const inDisrupted = fieldDisrupted.includes(pair.target_relation);
  if (!inPresent) {
    flag("TARGET_ABSENT_FROM_PRESENT", "BLOCK", `${pair.target_relation} is not in the present arm`);
  }
  if (inDisrupted) {
    flag("TARGET_PRESENT_IN_DISRUPTED", "BLOCK", `${pair.target_relation} survives the disruption`);
  }
  const targetType = pair.target_relation.split(":")[1];
  const expectedFamily: StimulusFamily | undefined = (
    {
      attacks: "support_defence",
      defends: "support_defence",
      line_access: "line_activation",
      pin: "constraint_overload",
      overload: "constraint_overload",
      battery: "higher_order_coalition",
    } as Record<string, StimulusFamily>
  )[targetType];
  if (expectedFamily && expectedFamily !== pair.family) {
    flag(
      "FAMILY_MISMATCH",
      "BLOCK",
      `target relation is a ${targetType}, which belongs to family ${expectedFamily}, not ${pair.family}`,
    );
  }

  // §4.4 -- locality, and the recorded diff must be the diff.
  const diff = diffFields(fieldPresent, fieldDisrupted);
  if (JSON.stringify(diff) !== JSON.stringify(pair.graph_diff)) {
    flag(
      "GRAPH_DIFF_STALE",
      "BLOCK",
      `recorded diff of size ${pair.graph_diff.size} does not match the computed diff of size ${diff.size}`,
    );
  }
  const nonTarget = diff.size - (inPresent && !inDisrupted ? 1 : 0);
  if (nonTarget !== pair.non_target_edit_count) {
    flag(
      "NON_TARGET_COUNT_STALE",
      "BLOCK",
      `records ${pair.non_target_edit_count} non-target edits; ${nonTarget} computed`,
    );
  }
  if (nonTarget > NON_TARGET_EDIT_REVIEW_CEILING) {
    flag(
      "EDIT_NOT_LOCAL",
      "REVIEW",
      `${nonTarget} collateral relation changes; §4.4 retains the minimum, and above this a reviewer must say why no smaller variant exists`,
    );
  }
  const relocations = pieceRelocations(pair.present_fen, pair.disrupted_fen);
  if (relocations !== pair.piece_relocations) {
    flag(
      "RELOCATIONS_STALE",
      "BLOCK",
      `records ${pair.piece_relocations} relocations; ${relocations} computed`,
    );
  }

  // The affordance sets have to be legal moves, or `target_affordance_selected` is uncodeable.
  for (const [arm, fen, moves] of [
    ["present", pair.present_fen, pair.target_affordance_present],
    ["disrupted", pair.disrupted_fen, pair.target_affordance_disrupted],
  ] as const) {
    const board = new Chess(fen);
    const legal = new Set(
      (board.moves({ verbose: true }) as Array<{ from: string; to: string; promotion?: string }>).map(
        (m) => `${m.from}${m.to}${m.promotion ?? ""}`,
      ),
    );
    for (const move of moves) {
      if (!legal.has(move)) {
        flag("AFFORDANCE_ILLEGAL", "BLOCK", `${move} is not legal in the ${arm} arm`);
      }
    }
  }
  /*
   * AT LEAST ONE ARM MUST OFFER THE AFFORDANCE, AND IT NEED NOT BE THE PRESENT ONE.
   *
   * This was written as "the present arm must offer it" and that was wrong, in a way worth keeping
   * a note about. A defence relation is often what STOPS an action: with the defender in place the
   * capture loses material, and it is the DISRUPTED arm that opens the affordance. Requiring the
   * present arm to carry it would have excluded the entire support/defence family from the primary
   * set on a rule nothing in the preregistration asks for. What the DV actually needs is that
   * `target_affordance_selected` has a positive case SOMEWHERE, which is this.
   */
  if (
    pair.target_affordance_present.length === 0 &&
    pair.target_affordance_disrupted.length === 0
  ) {
    flag(
      "AFFORDANCE_EMPTY_IN_BOTH",
      "BLOCK",
      "neither arm offers a target affordance, so `target_affordance_selected` has no positive case in either condition",
    );
  }

  // §4.3 -- gross value matching, and the state of the measurement is part of the answer.
  for (const [label, reading] of [
    ["shipped", pair.engine_shipped],
    ["high_budget", pair.engine_high_budget],
  ] as const) {
    if (reading.state !== "MEASURED") {
      flag(
        "ENGINE_NOT_MEASURED",
        "BLOCK",
        `${label} engine reading is ${reading.state}; §4.3 requires BOTH configurations before a pair is primary`,
      );
      continue;
    }
    if (reading.value_delta === null) {
      flag("ENGINE_DELTA_MISSING", "BLOCK", `${label} reading is MEASURED but carries no delta`);
      continue;
    }
    /*
     * RESOLUTION BEFORE VERDICT. A delta measured where the curve is flat is not evidence of a
     * match, so it is checked first and the delta comparison below is not reached: reporting
     * "matched to 0.0000" about a pair both of whose arms are won would be the more misleading of
     * the two messages.
     */
    const present = reading.value_present;
    const disrupted = reading.value_disrupted;
    if (
      present !== null &&
      disrupted !== null &&
      (!valueMatchResolvable(present) || !valueMatchResolvable(disrupted))
    ) {
      flag(
        "VALUE_MATCH_UNRESOLVED",
        "BLOCK",
        `${label} arms evaluate at ${present.toFixed(3)} and ${disrupted.toFixed(3)} winning chances, outside the band [${VALUE_RESOLVABLE_LOWER.toFixed(3)}, ${VALUE_RESOLVABLE_UPPER.toFixed(3)}] where §4.3's tolerance still discriminates; the matching test did not resolve, which is not the same as the pair being matched`,
      );
      continue;
    }
    if (reading.value_delta > ACCURATE_WIN_PROBABILITY_LOSS) {
      flag(
        "VALUE_DELTA_EXCEEDED",
        "BLOCK",
        `${label} winning-chance delta ${reading.value_delta.toFixed(4)} exceeds ACCURATE_WIN_PROBABILITY_LOSS ${ACCURATE_WIN_PROBABILITY_LOSS.toFixed(4)}`,
      );
    }
    const mateAsymmetry =
      (reading.mate_present === null) !== (reading.mate_disrupted === null);
    if (mateAsymmetry) {
      flag(
        "MATE_IN_ONE_ARM_ONLY",
        "BLOCK",
        `${label} sees a forced mate in one arm and not the other: ${reading.mate_present} vs ${reading.mate_disrupted}`,
      );
    }
    if (!reading.identity) {
      flag("ENGINE_UNIDENTIFIED", "BLOCK", `${label} reading names no engine`);
    }
    /*
     * §4.5 GIVES THE TACTIC VERDICT TO TWO HUMAN REVIEWERS, so this cannot be a BLOCK without
     * amending a frozen document. What it can do is stop the reviewers reading 32 pairs evenly:
     * a forcing asymmetry this large is where an accidentally introduced one-move tactic shows up.
     */
    if (reading.best_gap_present !== null && reading.best_gap_disrupted !== null) {
      const gapAsymmetry = Math.abs(reading.best_gap_present - reading.best_gap_disrupted);
      if (gapAsymmetry > FORCING_ASYMMETRY_REVIEW_DELTA) {
        flag(
          "FORCING_ASYMMETRY",
          "REVIEW",
          `${label} best-move gap is ${reading.best_gap_present.toFixed(3)} in the present arm and ${reading.best_gap_disrupted.toFixed(3)} in the disrupted arm; one arm is far more forcing than the other, which is where §4.5's "unrelated one-move tactic" hides`,
        );
      }
    }
  }

  // §4.5 and provenance.
  if (pair.review_status !== "REVIEWED_ADMISSIBLE") {
    flag("NOT_REVIEWED", "BLOCK", `review_status is ${pair.review_status}`);
  }
  if (pair.reviewer_ids.length < 2) {
    flag("REVIEWERS_INSUFFICIENT", "BLOCK", "§4.5 requires two independent chess reviewers");
  }
  if (pair.description_reveals_manipulation) {
    flag("DESCRIPTION_LEAKS", "BLOCK", "the shown description reveals the manipulation");
  }
  if (!pair.derived_at_git_sha) {
    flag("PROVENANCE_MISSING", "BLOCK", "derived fields carry no commit");
  }
  for (const [detector, version] of Object.entries(DETECTOR_VERSIONS)) {
    if (pair.detector_versions[detector] !== version) {
      flag(
        "DETECTOR_VERSION_STALE",
        "BLOCK",
        `recorded ${detector} v${pair.detector_versions[detector]}, current v${version}`,
      );
    }
  }
  if (out.some((v) => v.severity === "REVIEW") && pair.review_notes.trim().length === 0) {
    flag("REVIEW_FLAG_UNANSWERED", "BLOCK", "a REVIEW finding is open and review_notes is empty");
  }
  return out;
}

export interface ManifestVerdict {
  violations: Violation[];
  primaryCount: number;
  perFamily: Record<StimulusFamily, number>;
  baseArmBalance: { present: number; disrupted: number };
  /** True when the manifest cannot support the confirmatory run. §12: STOP-R2-STIMULUS. */
  stopStimulus: boolean;
}

/** §4.4 floor: "Fewer than 24 valid primary templates -> STOP-R2-STIMULUS". */
export const MINIMUM_PRIMARY_TEMPLATES = 24;
/** §4.1 target: 32 templates, eight per family. */
export const TARGET_TEMPLATES_PER_FAMILY = 8;

export function validateManifest(manifest: StimulusManifest): ManifestVerdict {
  const violations: Violation[] = [];
  const perFamily: Record<StimulusFamily, number> = {
    support_defence: 0,
    line_activation: 0,
    constraint_overload: 0,
    higher_order_coalition: 0,
  };
  const baseArmBalance = { present: 0, disrupted: 0 };
  const seen = new Set<string>();

  if (manifest.schema_version !== STIMULUS_SCHEMA_VERSION) {
    violations.push({
      template_id: "MANIFEST",
      code: "SCHEMA_VERSION",
      severity: "BLOCK",
      detail: `manifest is schema v${manifest.schema_version}; this build reads v${STIMULUS_SCHEMA_VERSION}`,
    });
  }
  if (manifest.frozen && !manifest.frozen_at_git_sha) {
    violations.push({
      template_id: "MANIFEST",
      code: "FREEZE_UNPROVENANCED",
      severity: "BLOCK",
      detail: "the manifest declares itself frozen and names no commit it was frozen at",
    });
  }

  let primaryCount = 0;
  for (const entry of manifest.pairs) {
    if (seen.has(entry.pair.template_id)) {
      violations.push({
        template_id: entry.pair.template_id,
        code: "DUPLICATE_TEMPLATE_ID",
        severity: "BLOCK",
        detail: "two pairs claim the same template_id",
      });
    }
    seen.add(entry.pair.template_id);
    const found = validatePair(entry.pair);
    if (entry.set === "PRIMARY_STRUCTURE_ONLY") {
      violations.push(...found);
      if (!found.some((v) => v.severity === "BLOCK")) {
        primaryCount += 1;
        perFamily[entry.pair.family] += 1;
        baseArmBalance[entry.pair.base_arm] += 1;
      }
    } else {
      // A pair outside the primary set is still recorded, and a BLOCK on it is still reported --
      // at REVIEW severity, because §4.3 already decided such a pair carries no primary verdict.
      violations.push(
        ...found
          .filter((v) => v.severity === "BLOCK")
          .map((v) => ({ ...v, severity: "REVIEW" as const, detail: `[${entry.set}] ${v.detail}` })),
      );
    }
  }

  /*
   * THE BALANCE CHECK IS REVIEW, NOT BLOCK, AND THE ASYMMETRY IS THE POINT. `base_arm` is not in
   * the frozen design (see stimulus.ts), so an imbalance cannot invalidate a preregistered set. It
   * can, and must, be visible before recruitment, when it is still cheap to fix.
   */
  const skew = Math.abs(baseArmBalance.present - baseArmBalance.disrupted);
  if (primaryCount > 0 && skew > Math.ceil(primaryCount / 4)) {
    violations.push({
      template_id: "MANIFEST",
      code: "BASE_ARM_SKEW",
      severity: "REVIEW",
      detail: `${baseArmBalance.present} templates are edited away from PRESENT and ${baseArmBalance.disrupted} away from DISRUPTED; "topology present" is partly "position nobody edited"`,
    });
  }
  for (const [family, count] of Object.entries(perFamily) as [StimulusFamily, number][]) {
    if (count < TARGET_TEMPLATES_PER_FAMILY) {
      violations.push({
        template_id: "MANIFEST",
        code: "FAMILY_SHORTFALL",
        severity: "REVIEW",
        detail: `${family} has ${count} admissible templates; §4.1 asks for ${TARGET_TEMPLATES_PER_FAMILY}. C7 leaves this family out in turn, so a thin family weakens the holdout rather than the pooled estimate`,
      });
    }
  }
  const stopStimulus = primaryCount < MINIMUM_PRIMARY_TEMPLATES;
  if (stopStimulus) {
    violations.push({
      template_id: "MANIFEST",
      code: "STOP-R2-STIMULUS",
      severity: "BLOCK",
      detail: `${primaryCount} admissible primary templates; §12 requires at least ${MINIMUM_PRIMARY_TEMPLATES} before recruitment opens`,
    });
  }
  return { violations, primaryCount, perFamily, baseArmBalance, stopStimulus };
}
