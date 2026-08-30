/**
 * A SUBGROUP, WRITTEN DOWN SO IT CAN BE FROZEN.
 *
 * `shared/detector.ts` has six subgroups and they are TypeScript closures. That is exactly right
 * for a fixed list -- the comment there says why the list is fixed and short -- and it is unusable
 * for anything a search produces: a closure cannot be hashed, stored, sent, or compared with the
 * one a study froze last month. The manifest in `hypothesis-manifest.ts` needs a subgroup that is
 * DATA, and this is that shape.
 *
 * A CONJUNCTION OF AT MOST TWO ATOMS, and the bound is a decision rather than a limitation of the
 * representation. Depth two is `A` and `A and B`; every extra term multiplies the search space and
 * buys a description no player can act on. The bound is enforced here so a candidate generator
 * cannot quietly exceed it, and raising it is a change to this constant with an argument beside it.
 *
 * THREE-VALUED, NOT BOOLEAN, and this is the part borrowed from the module it does not replace.
 * `bucketable` in the detector exists because a decision that is MISSING the field a bucket reads
 * belongs to NEITHER side: putting it outside turns "we could not measure how long this took" into
 * "this took more than 45 seconds", which is a fabrication pointing the other way, and it moves the
 * baseline the subgroup is judged against. Every predicate here inherits that.
 */
import type { MaterialisedRow } from "./feature-contract.js";

/**
 * The comparisons a predicate may make.
 *
 * DELIBERATELY SMALL. Each one has to be evaluable on a stored row, printable in a sentence a
 * player can read, and stable under the canonical form below. An arbitrary expression language
 * would satisfy none of the three and would make two predicates that mean the same thing hash
 * differently, which defeats the freeze.
 *
 * `is-null` and `not-null` are here because MISSINGNESS IS SOMETIMES THE FINDING. "Decisions where
 * no clock was recorded" is a real and testable subgroup -- `shared/detector.ts` documents that
 * imports lose the clock systematically -- and the alternative is that it can only be expressed by
 * accident, as the residue of a comparison.
 */
export const PREDICATE_OPS = ["lt", "lte", "gt", "gte", "eq", "neq", "is-null", "not-null"] as const;
export type PredicateOp = (typeof PREDICATE_OPS)[number];

export interface PredicateAtom {
  feature_id: string;
  op: PredicateOp;
  /** Absent for `is-null` and `not-null`, which compare against nothing. */
  value?: number | string | boolean;
}

export interface Predicate {
  atoms: PredicateAtom[];
}

/** The most terms a conjunction may carry. See the module note: this is a decision, not a limit. */
export const MAX_PREDICATE_DEPTH = 2;

export type Membership = "inside" | "outside" | "unreadable";

/**
 * Whether a decision is in the subgroup, out of it, or cannot be read at all.
 *
 * UNREADABLE WINS OVER OUTSIDE, and the order of the checks is the reason this is not a boolean.
 * A conjunction whose first atom is false and whose second reads a missing feature is NOT outside
 * the group -- it is a decision this predicate cannot classify, and counting it as a comparison
 * case would silently enlarge the baseline with rows the subgroup could never have contained.
 */
export function evaluatePredicate(predicate: Predicate, row: MaterialisedRow): Membership {
  let inside = true;
  for (const atom of predicate.atoms) {
    const present = Object.prototype.hasOwnProperty.call(row, atom.feature_id);
    if (atom.op === "is-null") {
      inside = inside && !present;
      continue;
    }
    if (atom.op === "not-null") {
      inside = inside && present;
      continue;
    }
    if (!present) return "unreadable";
    const result = compare(row[atom.feature_id], atom);
    if (result === null) return "unreadable";
    inside = inside && result;
  }
  return inside ? "inside" : "outside";
}

/**
 * One comparison, or null when the stored value cannot answer it.
 *
 * A TYPE MISMATCH IS UNREADABLE, NOT FALSE. `clockShare < 0.37` against a value that is a string
 * is a broken registry, and answering "false" would file every such decision in the comparison
 * group and let a study run to a verdict on a column it never read.
 */
function compare(value: unknown, atom: PredicateAtom): boolean | null {
  const bound = atom.value;
  if (atom.op === "eq") return value === bound;
  if (atom.op === "neq") return value !== bound;
  if (typeof value !== "number" || typeof bound !== "number") return null;
  if (!Number.isFinite(value)) return null;
  switch (atom.op) {
    case "lt":
      return value < bound;
    case "lte":
      return value <= bound;
    case "gt":
      return value > bound;
    case "gte":
      return value >= bound;
    default:
      return null;
  }
}

/**
 * THE CANONICAL FORM. Two predicates that describe the same subgroup must produce the same bytes,
 * or the freeze in `hypothesis-manifest.ts` is a freeze of an accident of construction.
 *
 * Atoms are sorted by feature, then operator, then value, and exact duplicates are dropped --
 * `A and A` is `A`, and a generator that emits it has not stated a different hypothesis. Nothing
 * else is normalised: `x < 5` and `x <= 4.999` describe the same set of integers and different
 * sets of numbers, and a canonicaliser that merged them would be making a claim about the
 * feature's domain that this module has no way to know.
 */
export function canonicalPredicate(predicate: Predicate): Predicate {
  const seen = new Set<string>();
  const atoms: PredicateAtom[] = [];
  for (const atom of predicate.atoms) {
    const key = atomKey(atom);
    if (seen.has(key)) continue;
    seen.add(key);
    atoms.push(atom.value === undefined ? { feature_id: atom.feature_id, op: atom.op } : { ...atom });
  }
  atoms.sort((a, b) => atomKey(a).localeCompare(atomKey(b)));
  return { atoms };
}

function atomKey(atom: PredicateAtom): string {
  return `${atom.feature_id} ${atom.op} ${atom.value === undefined ? "" : JSON.stringify(atom.value)}`;
}

/** Whether a predicate is one this project will accept at all. Reasons, not a boolean. */
export function predicateProblems(predicate: Predicate): string[] {
  const problems: string[] = [];
  const canonical = canonicalPredicate(predicate);
  if (canonical.atoms.length === 0) {
    problems.push("a predicate with no atoms describes every decision");
  }
  if (canonical.atoms.length > MAX_PREDICATE_DEPTH) {
    problems.push(`depth ${canonical.atoms.length} exceeds the maximum of ${MAX_PREDICATE_DEPTH}`);
  }
  for (const atom of canonical.atoms) {
    const needsValue = atom.op !== "is-null" && atom.op !== "not-null";
    if (needsValue && atom.value === undefined) {
      problems.push(`${atom.feature_id} ${atom.op} needs a value`);
    }
    if (!needsValue && atom.value !== undefined) {
      problems.push(`${atom.feature_id} ${atom.op} takes no value`);
    }
  }
  /*
   * TWO ATOMS ON ONE FEATURE ARE ALLOWED and are not an error: `clockShare > 0.2` together with
   * `clockShare < 0.4` is a band, which is a legitimate subgroup. What is dropped above is the
   * same atom twice, which is not a second condition.
   */
  return problems;
}

const OP_WORDS: Record<PredicateOp, string> = {
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
  eq: "=",
  neq: "is not",
  "is-null": "is missing",
  "not-null": "is recorded",
};

/** A predicate in words, for a reader. Never parsed back: `canonicalPredicate` is the identity. */
export function predicateText(predicate: Predicate): string {
  return canonicalPredicate(predicate)
    .atoms.map((atom) =>
      atom.value === undefined
        ? `${atom.feature_id} ${OP_WORDS[atom.op]}`
        : `${atom.feature_id} ${OP_WORDS[atom.op]} ${JSON.stringify(atom.value)}`,
    )
    .join(" AND ");
}

/**
 * The split a predicate makes, in the shape an estimator needs.
 *
 * UNREADABLE ROWS ARE RETURNED, NOT DROPPED. A caller that never sees them cannot report how many
 * decisions its comparison could not classify, and a subgroup analysis whose denominator shrank
 * silently is one whose population is unknown.
 */
export function splitByPredicate<T>(
  predicate: Predicate,
  rows: readonly { row: MaterialisedRow; subject: T }[],
): { inside: T[]; outside: T[]; unreadable: T[] } {
  const inside: T[] = [];
  const outside: T[] = [];
  const unreadable: T[] = [];
  for (const entry of rows) {
    const membership = evaluatePredicate(predicate, entry.row);
    if (membership === "inside") inside.push(entry.subject);
    else if (membership === "outside") outside.push(entry.subject);
    else unreadable.push(entry.subject);
  }
  return { inside, outside, unreadable };
}
