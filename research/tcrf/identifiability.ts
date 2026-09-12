/**
 * CAN THE RELATIONAL ACCOUNT PREDICT ANYTHING THE SIMPLER ACCOUNTS CANNOT?
 *
 * This module exists because the stimulus pilot found something the frozen design does not model:
 * for several families, "relation topology" and "objective value" are not independent variables.
 * `docs/research/EXP_R2_AMENDMENT_1.md` is the decision record. This is the part of it a machine
 * can check.
 *
 * THE PROBLEM, STATED PRECISELY. EXP-R2's manipulation is an ABLATION: the target relation is
 * present in one arm and removed in the other. An ablation cannot leave the board's object-level
 * description unchanged -- if you remove a defence, something becomes undefended, and "undefended"
 * is a property of ONE PIECE. So a participant who notices the change has told you nothing about
 * whether they represent relations, because an account that tracks only per-piece properties
 * predicts exactly the same noticing.
 *
 * THE TEST THIS MODULE IMPLEMENTS. Give the strongest simpler account everything it could want:
 * every piece's colour, type, material value, how many enemies attack it, how many friends defend
 * it, and how many squares it covers. Compute that for both arms. Anything that differs is
 * OBJECT-VISIBLE, and the simpler account explains a participant mentioning it.
 *
 * Then ask one question:
 *
 *     Does the target relation have an endpoint that is NOT object-visible?
 *
 * An element that participates in the changed relation while its own local description is
 * identical in both arms, and which did not move, is an element the simpler account has no reason
 * to make anybody mention. A participant who names it has produced an observation only a
 * relational representation predicts. That, and only that, is identifiability.
 *
 * WHY THE ANSWER IS NOT OBVIOUS IN ADVANCE. Higher-order relations can change without any single
 * element's first-order description changing -- an overloaded defender is still defending exactly
 * the same number of things, still attacked by the same number, still covering the same squares;
 * what changed is how many jobs depend on it alone. First-order relations usually cannot. So the
 * question is empirical per family, and `identifiabilityOf` answers it per pair.
 *
 * THE ACCOUNT IS DELIBERATELY GENEROUS, INCLUDING MOBILITY. It would be easy to make the relational
 * account win by defining the object account without `reach`, and that would be motivated
 * reasoning: a pin IS a mobility restriction on one piece, and an account with mobility explains
 * pin-noticing without any relational machinery. Giving the simpler account its best form is the
 * whole point; a construct that only survives against a weakened rival has not survived.
 */
import { Chess, type Color, type Square } from "chess.js";
import { parseRelation, structuralField } from "./relations.js";
import { ACCURATE_WIN_PROBABILITY_LOSS } from "../../shared/detector.js";
import { valueMatchResolvable } from "./value-band.js";
import type { StimulusPair } from "./stimulus.js";

/** Bumped when the object account's feature list changes. A verdict is only about one version. */
export const IDENTIFIABILITY_VERSION = 1;

/**
 * The competing explanations, named so a verdict can say which one it ruled out.
 *
 * These are the four the amendment requires every family to be scored against. They are ordered by
 * how little they assume: an account earlier in this list beating a later one is the simpler
 * construct winning, which is the outcome the governing rule says to prefer.
 */
export const ACCOUNTS = [
  /** Per-piece local properties only. No pairing, no structure. The strongest simple rival. */
  "object_local",
  /** One number: what the engine says the position is worth. */
  "scalar_value",
  /** Whether one move is far ahead of the alternatives. */
  "tactical_forcing",
  /** Relations between elements as the represented unit. TCRF. */
  "relational",
] as const;
export type Account = (typeof ACCOUNTS)[number];

const PIECE_VALUE: Readonly<Record<string, number>> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

/**
 * Everything the object-local account is allowed to see about one piece.
 *
 * `reach` IS THE CONTENTIOUS ONE AND IT IS IN. A pinned piece has fewer squares it covers, so an
 * account with mobility already explains pin-noticing. Leaving it out would hand the constraint
 * family a win it has not earned.
 */
export interface ObjectFeatures {
  square: Square;
  /** Null on an empty square. An empty square still has local properties: who controls it. */
  color: Color | null;
  type: string;
  value: number;
  /** Occupied: enemy attackers. Empty: black's control count. */
  attackedBy: number;
  /** Occupied: friendly defenders. Empty: white's control count. */
  defendedBy: number;
  reach: number;
  /**
   * Whether removing this piece would expose its own king.
   *
   * THE OBJECT ACCOUNT'S ANSWER TO A PIN, and it is here because leaving it out would have handed
   * the constraint family an identifiability it has not earned. A pin restricts ONE piece's legal
   * moves, and "this piece cannot move" is a property of that piece. `reach` cannot see it, because
   * `chess.js`'s attack map is pin-blind by design; this is computed by removing the piece and
   * asking whether its king comes under fire.
   */
  absolutelyPinned: boolean;
}

const ALL_SQUARES: Square[] = (() => {
  const out: Square[] = [];
  for (const file of "abcdefgh") for (let rank = 1; rank <= 8; rank += 1) out.push(`${file}${rank}` as Square);
  return out;
})();

/**
 * How many squares a piece covers, computed from the attack map rather than from `moves()`.
 *
 * TURN-INDEPENDENT ON PURPOSE. `chess.js`'s `moves()` only answers for the side to move, and §4.2
 * holds side to move fixed across a pair for an unrelated reason; an asymmetric feature would make
 * one colour's pieces permanently featureless and the comparison meaningless.
 */
function reachOf(board: Chess, square: Square, color: Color): number {
  let count = 0;
  for (const target of ALL_SQUARES) {
    if (target === square) continue;
    if (board.attackers(target, color).includes(square)) count += 1;
  }
  return count;
}

/**
 * Whether this piece is holding a line in front of its own king.
 *
 * Computed by removing it and asking whether the king is then attacked, which is the definition,
 * and which `chess.js`'s deliberately pin-blind attack map cannot answer any other way.
 */
function absolutelyPinned(fen: string, square: Square, color: Color, type: string): boolean {
  if (type === "k") return false;
  const probe = new Chess(fen);
  const king = probe
    .board()
    .flat()
    .find((p) => p && p.type === "k" && p.color === color);
  if (!king) return false;
  probe.remove(square);
  const enemy: Color = color === "w" ? "b" : "w";
  return probe.attackers(king.square as Square, enemy).length > 0;
}

/**
 * The object-local description of a position, over EVERY square rather than every piece.
 *
 * EMPTY SQUARES ARE IN, and leaving them out was a real defect rather than an omission: the first
 * run of this scan reported the terminal square of a rook's open file as an element only a
 * relational account could explain, purely because nothing stood on it and so it had no feature
 * vector to compare. An empty square that white controls in one arm and not the other is exactly
 * the kind of thing an object-local account notices, and pretending otherwise would have handed
 * the line-activation family a free identifiability.
 */
export function objectFeatures(fen: string): Map<Square, ObjectFeatures> {
  const board = new Chess(fen);
  const out = new Map<Square, ObjectFeatures>();
  for (const square of ALL_SQUARES) {
    const piece = board.get(square);
    if (!piece) {
      out.set(square, {
        square,
        color: null,
        type: "-",
        value: 0,
        attackedBy: board.attackers(square, "b").length,
        defendedBy: board.attackers(square, "w").length,
        reach: 0,
        absolutelyPinned: false,
      });
      continue;
    }
    const color = piece.color as Color;
    const enemy: Color = color === "w" ? "b" : "w";
    out.set(square, {
      square,
      color,
      type: piece.type as string,
      value: PIECE_VALUE[piece.type as string] ?? 0,
      attackedBy: board.attackers(square, enemy).length,
      defendedBy: board.attackers(square, color).filter((s) => s !== square).length,
      reach: reachOf(board, square, color),
      absolutelyPinned: absolutelyPinned(fen, square, color, piece.type as string),
    });
  }
  return out;
}

export interface ObjectVisibility {
  /** Squares occupied in exactly one arm: the edit's footprint. Salient by movement alone. */
  placementChanged: Square[];
  /** Squares holding the same piece in both arms whose local description differs. */
  attributeChanged: Square[];
  /** The union. Everything the simpler account has a reason to make somebody mention. */
  objectVisible: Set<Square>;
  /** Which feature moved, per changed square, so a reader can see WHY it is visible. */
  why: Record<string, string[]>;
}

/** What an account with only per-piece local properties can tell apart between two arms. */
export function objectVisibility(presentFen: string, disruptedFen: string): ObjectVisibility {
  const a = objectFeatures(presentFen);
  const b = objectFeatures(disruptedFen);
  const placementChanged: Square[] = [];
  const attributeChanged: Square[] = [];
  const why: Record<string, string[]> = {};

  for (const square of new Set([...a.keys(), ...b.keys()])) {
    const left = a.get(square);
    const right = b.get(square);
    if (!left || !right) continue;
    if (left.type !== right.type || left.color !== right.color) {
      placementChanged.push(square);
      why[square] =
        left.type === "-"
          ? ["occupied only in the disrupted arm"]
          : right.type === "-"
            ? ["occupied only in the present arm"]
            : ["a different piece stands here"];
      continue;
    }
    const moved: string[] = [];
    const counts = left.type === "-" ? ["controlled by black", "controlled by white"] : ["attackedBy", "defendedBy"];
    if (left.attackedBy !== right.attackedBy) moved.push(`${counts[0]} ${left.attackedBy}->${right.attackedBy}`);
    if (left.defendedBy !== right.defendedBy) moved.push(`${counts[1]} ${left.defendedBy}->${right.defendedBy}`);
    if (left.reach !== right.reach) moved.push(`reach ${left.reach}->${right.reach}`);
    if (left.absolutelyPinned !== right.absolutelyPinned) {
      moved.push(`absolutelyPinned ${left.absolutelyPinned}->${right.absolutelyPinned}`);
    }
    if (moved.length) {
      attributeChanged.push(square);
      why[square] = moved;
    }
  }
  placementChanged.sort();
  attributeChanged.sort();
  return {
    placementChanged,
    attributeChanged,
    objectVisible: new Set([...placementChanged, ...attributeChanged]),
    why,
  };
}

export const IDENTIFIABILITY_VERDICTS = [
  "RELATIONAL_IDENTIFIABILITY_DEMONSTRATED",
  "RELATIONAL_IDENTIFIABILITY_PARTIAL",
  "SIMPLER_ACCOUNT_EQUIVALENT",
  "STIMULUS_CONSTRUCTION_NOT_IDENTIFIABLE",
] as const;
export type IdentifiabilityVerdict = (typeof IDENTIFIABILITY_VERDICTS)[number];

/**
 * Where a family's engine value sits relative to its topology, which is the §4.3 question.
 *
 * `CONFOUND`      topology and value move independently: matching on value removes a nuisance.
 * `MEDIATOR`      topology changes value, which changes behaviour: matching on value removes part
 *                 of the causal path the theory is about.
 * `CONSTITUTIVE`  the structure IS the advantage: there is no version of the position with the
 *                 structure and without its value, so a value-matched arm is a different claim.
 *
 * DECIDED FROM MEASUREMENT, NOT FROM ARGUMENT. `valueRole` reads the pair's own engine deltas.
 */
export const VALUE_ROLES = ["CONFOUND", "MEDIATOR", "CONSTITUTIVE", "UNRESOLVED"] as const;
export type ValueRole = (typeof VALUE_ROLES)[number];

/**
 * Three bands, and the boundaries are the tolerance the preregistration already froze rather than
 * new numbers. Inside the tolerance the two variables came apart, so value is a nuisance. Past four
 * times the tolerance the edit moved the evaluation more than the whole matching budget several
 * times over, which is not a nuisance, it is the thing itself.
 */
export const CONSTITUTIVE_MULTIPLE = 4;

export function valueRole(pair: StimulusPair): ValueRole {
  const readings = [pair.engine_shipped, pair.engine_high_budget];
  if (readings.some((r) => r.state !== "MEASURED")) return "UNRESOLVED";
  const values = readings.flatMap((r) => [r.value_present, r.value_disrupted]);
  if (values.some((v) => v === null) || values.some((v) => !valueMatchResolvable(v as number))) {
    return "UNRESOLVED";
  }
  const deltas = readings.map((r) => r.value_delta as number);
  if (deltas.every((d) => d <= ACCURATE_WIN_PROBABILITY_LOSS)) return "CONFOUND";
  if (deltas.some((d) => d > CONSTITUTIVE_MULTIPLE * ACCURATE_WIN_PROBABILITY_LOSS)) {
    return "CONSTITUTIVE";
  }
  return "MEDIATOR";
}

export interface IdentifiabilityReport {
  template_id: string;
  family: StimulusPair["family"];
  verdict: IdentifiabilityVerdict;
  value_role: ValueRole;
  /** Endpoints of the target relation that the object account cannot see. The whole ballgame. */
  relational_only_elements: Square[];
  /** Endpoints the object account CAN see, with the feature that gives them away. */
  object_visible_endpoints: Array<{ square: Square; why: string[] }>;
  /** What a relational representation predicts that no simpler account does. Empty means nothing. */
  discriminating_observation: string | null;
  /** The strongest simpler account that survives this pair. */
  surviving_simpler_account: Account | null;
  notes: string[];
}

/**
 * One pair, scored against all four accounts.
 *
 * THE ORDER OF THE CHECKS IS THE ARGUMENT. A pair is only identifying if the relational account is
 * the LAST one standing: if the object account can see every endpoint, nothing downstream matters,
 * and the engine numbers are beside the point.
 */
export function identifiabilityOf(pair: StimulusPair): IdentifiabilityReport {
  const notes: string[] = [];
  const relation = parseRelation(pair.target_relation);
  if (!relation) {
    return {
      template_id: pair.template_id,
      family: pair.family,
      verdict: "STIMULUS_CONSTRUCTION_NOT_IDENTIFIABLE",
      value_role: "UNRESOLVED",
      relational_only_elements: [],
      object_visible_endpoints: [],
      discriminating_observation: null,
      surviving_simpler_account: null,
      notes: ["the target relation does not parse, so there are no endpoints to score"],
    };
  }

  const presentField = structuralField(pair.present_fen);
  const disruptedField = structuralField(pair.disrupted_fen);
  if (!presentField.includes(pair.target_relation) || disruptedField.includes(pair.target_relation)) {
    notes.push("the target relation does not change between the arms as labelled");
  }

  const visibility = objectVisibility(pair.present_fen, pair.disrupted_fen);
  const endpoints = relation.elements;
  const relationalOnly = endpoints.filter((sq) => !visibility.objectVisible.has(sq));
  const visibleEndpoints = endpoints
    .filter((sq) => visibility.objectVisible.has(sq))
    .map((square) => ({ square, why: visibility.why[square] ?? ["visible"] }));

  const role = valueRole(pair);

  if (relationalOnly.length === 0) {
    notes.push(
      "every element of the target relation is object-visible: the simpler account predicts the same noticing, so a difference between the arms cannot be attributed to relational representation",
    );
    return {
      template_id: pair.template_id,
      family: pair.family,
      verdict: "SIMPLER_ACCOUNT_EQUIVALENT",
      value_role: role,
      relational_only_elements: [],
      object_visible_endpoints: visibleEndpoints,
      discriminating_observation: null,
      surviving_simpler_account: "object_local",
      notes,
    };
  }

  const discriminating =
    `a response naming ${relationalOnly.join(", ")} -- an element whose colour, value, attacker count, ` +
    `defender count, covered squares and pin status are IDENTICAL in both arms, and which did not move. ` +
    `The object-local account has no reason to produce it; a relational representation does, because ` +
    `it is the other end of the relation that changed`;

  if (role === "CONFOUND") {
    notes.push("engine value came apart from topology here, so matching on it removes a nuisance rather than a mechanism");
    return {
      template_id: pair.template_id,
      family: pair.family,
      verdict: "RELATIONAL_IDENTIFIABILITY_DEMONSTRATED",
      value_role: role,
      relational_only_elements: relationalOnly,
      object_visible_endpoints: visibleEndpoints,
      discriminating_observation: discriminating,
      surviving_simpler_account: null,
      notes,
    };
  }

  notes.push(
    role === "UNRESOLVED"
      ? "a discriminating element exists, and the value comparison did not resolve, so the scalar-value account has not been ruled out"
      : `a discriminating element exists, and engine value is ${role.toLowerCase()} here, so the scalar-value account still explains any arm difference`,
  );
  return {
    template_id: pair.template_id,
    family: pair.family,
    verdict: "RELATIONAL_IDENTIFIABILITY_PARTIAL",
    value_role: role,
    relational_only_elements: relationalOnly,
    object_visible_endpoints: visibleEndpoints,
    discriminating_observation: discriminating,
    surviving_simpler_account: role === "UNRESOLVED" ? "scalar_value" : "scalar_value",
    notes,
  };
}

/** The best a family achieves, and how many of its pairs got there. §3 of the amendment. */
export interface FamilyVerdict {
  family: StimulusPair["family"];
  verdict: IdentifiabilityVerdict;
  counts: Record<IdentifiabilityVerdict, number>;
  branch: "R2-A" | "R2-B" | "DEFER" | "STOP";
}

const RANK: Record<IdentifiabilityVerdict, number> = {
  RELATIONAL_IDENTIFIABILITY_DEMONSTRATED: 3,
  RELATIONAL_IDENTIFIABILITY_PARTIAL: 2,
  SIMPLER_ACCOUNT_EQUIVALENT: 1,
  STIMULUS_CONSTRUCTION_NOT_IDENTIFIABLE: 0,
};

/**
 * Which branch of the amended design a family belongs to.
 *
 * `R2-A` is the value-neutral branch and may carry the strong claim. `R2-B` holds families whose
 * topology is constitutive of value: they are a different claim, not a weaker version of the same
 * one. `STOP` is for a family the object account explains as well -- and per §5 of the amendment
 * that is `STOP-R2-CONSTRUCT` for that family, not a reason to recruit and find out.
 */
export function familyVerdict(reports: IdentifiabilityReport[]): FamilyVerdict {
  const counts = {
    RELATIONAL_IDENTIFIABILITY_DEMONSTRATED: 0,
    RELATIONAL_IDENTIFIABILITY_PARTIAL: 0,
    SIMPLER_ACCOUNT_EQUIVALENT: 0,
    STIMULUS_CONSTRUCTION_NOT_IDENTIFIABLE: 0,
  } as Record<IdentifiabilityVerdict, number>;
  for (const report of reports) counts[report.verdict] += 1;
  const best = reports.reduce<IdentifiabilityVerdict>(
    (acc, r) => (RANK[r.verdict] > RANK[acc] ? r.verdict : acc),
    "STIMULUS_CONSTRUCTION_NOT_IDENTIFIABLE",
  );
  const constitutive = reports.some((r) => r.value_role === "CONSTITUTIVE");
  const branch =
    best === "RELATIONAL_IDENTIFIABILITY_DEMONSTRATED"
      ? ("R2-A" as const)
      : best === "RELATIONAL_IDENTIFIABILITY_PARTIAL"
        ? constitutive
          ? ("R2-B" as const)
          : ("DEFER" as const)
        : ("STOP" as const);
  return { family: reports[0]?.family ?? "support_defence", verdict: best, counts, branch };
}
