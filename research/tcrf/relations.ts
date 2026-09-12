/**
 * DETERMINISTIC STRUCTURE DETECTORS FOR EXP-R2, AND NOTHING ELSE.
 *
 * The preregistration (`docs/research/EXP_R2_RESOURCE_FIELD_PREREG.md` §4.1) names four stimulus
 * families, and this module exists to make the phrase "the target relation changed" checkable
 * instead of asserted. One detector family per stimulus family, no more:
 *
 *   family 1  support / defence connectivity   -> `attacks`, `defends`
 *   family 2  line activation                  -> `line_access`
 *   family 3  constraint / overload            -> `pin`, `overload`
 *   family 4  higher-order coalition           -> `battery`
 *
 * WHY THE OUTPUT IS A FLAT SET OF STRINGS AND NOT A GRAPH OBJECT. The only quantity EXP-R2 derives
 * from structure is a DIFF between two positions (§4.4: "retain the variant with the smallest
 * non-target graph edit count"). A diff needs one canonical comparable form, and a set of sorted
 * strings is the cheapest thing that has one. Nodes, adjacency indices and a query layer would be
 * machinery with no consumer in R2, and `docs/research/EXP_R2_EXECUTION_PLAN.md` §6 records the two
 * architectures that were rejected and why.
 *
 * WHAT THESE ARE NOT. They are not the construct. TCRF §3.3 is explicit that a structural motif on
 * the board and a motif a player represents are different objects, and EXP-R2's whole point is to
 * find out whether the second tracks the first. A detector firing is a fact about the FEN. It is
 * never evidence that anybody saw anything.
 *
 * NO PROSE DETECTORS. `good knight`, `initiative`, `weak dark squares` and `active rook` are absent
 * deliberately: none decomposes into an observable the two arms of a matched pair could be said to
 * differ in, so a stimulus built on one could not be shown to have changed what it claims.
 */
import { Chess, type Color, type Square } from "chess.js";

/**
 * Every detector carries its own version, and the version travels with each recorded stimulus.
 *
 * ONE VERSION PER DETECTOR RATHER THAN ONE FOR THE MODULE, because they fail independently. A fix
 * to `overload` must not make a reader believe the `battery` edges under it were recomputed too:
 * a stimulus validated under `battery: 1` is still validated under `battery: 1` after the fix, and
 * the recorded map is what says so.
 */
export const DETECTOR_VERSIONS = {
  attacks: 1,
  defends: 1,
  line_access: 1,
  pin: 1,
  overload: 1,
  battery: 1,
} as const;

export type RelationType = keyof typeof DETECTOR_VERSIONS;
export const RELATION_TYPES = Object.keys(DETECTOR_VERSIONS) as RelationType[];

/** Which preregistered stimulus family each detector serves. §4.1 of the preregistration. */
export const FAMILY_OF: Readonly<Record<RelationType, StimulusFamily>> = {
  attacks: "support_defence",
  defends: "support_defence",
  line_access: "line_activation",
  pin: "constraint_overload",
  overload: "constraint_overload",
  battery: "higher_order_coalition",
};

export const STIMULUS_FAMILIES = [
  "support_defence",
  "line_activation",
  "constraint_overload",
  "higher_order_coalition",
] as const;
export type StimulusFamily = (typeof STIMULUS_FAMILIES)[number];

export interface Relation {
  type: RelationType;
  /** The side whose structure this is: the owner of the acting element. */
  side: Color;
  /** Squares in the detector's own canonical order, documented at each detector. */
  elements: Square[];
}

/**
 * One relation as one comparable string.
 *
 * THE ORDER INSIDE `elements` IS PART OF THE IDENTITY and each detector fixes it, because
 * `w:pin:c4>d5>e6` and `w:pin:e6>d5>c4` are different claims about the same three squares. A
 * detector that emitted an unordered set would make the diff insensitive to direction, which is
 * exactly the thing a constraint manipulation changes.
 */
export const canonical = (r: Relation): string =>
  `${r.side}:${r.type}:${r.elements.join(">")}`;

/** A relation field written by hand in a stimulus file, parsed back into the same identity. */
export function parseRelation(text: string): Relation | null {
  const parts = text.split(":");
  if (parts.length !== 3) return null;
  const [side, type, elements] = parts;
  if (side !== "w" && side !== "b") return null;
  if (!RELATION_TYPES.includes(type as RelationType)) return null;
  const squares = elements.split(">");
  if (!squares.length || squares.some((s) => !/^[a-h][1-8]$/.test(s))) return null;
  return { side, type: type as RelationType, elements: squares as Square[] };
}

const SLIDERS = { r: "rook", b: "bishop", q: "queen" } as const;
const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAGONAL: ReadonlyArray<readonly [number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const RAYS_OF: Readonly<Record<"r" | "b" | "q", ReadonlyArray<readonly [number, number]>>> = {
  r: ORTHOGONAL,
  b: DIAGONAL,
  q: [...ORTHOGONAL, ...DIAGONAL],
};
/** For the pin detector only: whether a shielded piece is worth shielding. Not a resource claim. */
const PIN_WORTH: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const FILES = "abcdefgh";
const squareAt = (file: number, rank: number): Square | null =>
  file < 0 || file > 7 || rank < 0 || rank > 7 ? null : (`${FILES[file]}${rank + 1}` as Square);
const coords = (square: Square): [number, number] => [
  FILES.indexOf(square[0]),
  Number(square[1]) - 1,
];

interface Occupant {
  square: Square;
  type: string;
  color: Color;
}

const occupants = (board: Chess): Occupant[] =>
  board
    .board()
    .flat()
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => ({ square: s.square as Square, type: s.type as string, color: s.color as Color }));

/**
 * Walk one ray from a square, reporting every empty square crossed and the first occupant.
 *
 * Shared by `line_access`, `pin` and `battery` so the three cannot disagree about what a line is.
 */
function ray(
  board: Chess,
  from: Square,
  step: readonly [number, number],
): { crossed: Square[]; blocker: Occupant | null } {
  const [df, dr] = step;
  let [file, rank] = coords(from);
  const crossed: Square[] = [];
  for (;;) {
    file += df;
    rank += dr;
    const square = squareAt(file, rank);
    if (!square) return { crossed, blocker: null };
    const piece = board.get(square);
    if (piece) {
      return {
        crossed,
        blocker: { square, type: piece.type as string, color: piece.color as Color },
      };
    }
    crossed.push(square);
  }
}

/**
 * `attacks` -- an enemy unit is under contact. Elements: `attacker > target`.
 *
 * Read off `chess.js`'s `attackers()`, which is a raw attack map: it reports contact regardless of
 * whose turn it is and regardless of whether the attacker is itself pinned. That is the wanted
 * semantics. Legality of the capture is a different question from whether the relation is on the
 * board, and folding the two together would make the detector's output depend on side to move,
 * which §4.2 holds fixed across a pair for a different reason entirely.
 */
export function detectAttacks(board: Chess): Relation[] {
  const out: Relation[] = [];
  for (const unit of occupants(board)) {
    const enemy: Color = unit.color === "w" ? "b" : "w";
    for (const from of board.attackers(unit.square, enemy)) {
      out.push({ type: "attacks", side: enemy, elements: [from as Square, unit.square] });
    }
  }
  return out;
}

/** `defends` -- an own unit is supported. Elements: `defender > defended`. */
export function detectDefends(board: Chess): Relation[] {
  const out: Relation[] = [];
  for (const unit of occupants(board)) {
    for (const from of board.attackers(unit.square, unit.color)) {
      if (from === unit.square) continue;
      out.push({ type: "defends", side: unit.color, elements: [from as Square, unit.square] });
    }
  }
  return out;
}

/**
 * `line_access` -- how far a slider's ray actually reaches. Elements: `slider > furthest`.
 *
 * ONE EDGE PER RAY, NOT ONE PER SQUARE. A rook on an open file would otherwise emit seven edges
 * that all move together, and the non-target edit count in §4.4 would then be dominated by however
 * many squares a line happens to be long rather than by how many distinct relations an edit
 * touched. The furthest reachable square carries the same information for a diff and weighs one.
 *
 * A ray blocked on the adjacent square emits nothing: there is no line to activate. Opening it is
 * exactly the edit family 2 is made of, so the edge appearing is the manipulation.
 */
export function detectLineAccess(board: Chess): Relation[] {
  const out: Relation[] = [];
  for (const unit of occupants(board)) {
    const rays = RAYS_OF[unit.type as keyof typeof RAYS_OF];
    if (!rays) continue;
    for (const step of rays) {
      const { crossed, blocker } = ray(board, unit.square, step);
      const furthest = blocker && blocker.color !== unit.color ? blocker.square : crossed.at(-1);
      if (!furthest) continue;
      out.push({ type: "line_access", side: unit.color, elements: [unit.square, furthest] });
    }
  }
  return out;
}

/**
 * `pin` -- a unit cannot leave a line without exposing something worth more behind it.
 * Elements: `pinner > pinned > shielded`.
 *
 * ABSOLUTE AND RELATIVE PINS ARE THE SAME EDGE, and `PIN_WORTH` giving the king 100 is a detector
 * convention rather than a resource claim. TCRF §6.1 rejects a fixed global hierarchy for the
 * CONSTRUCT; it does not forbid an ordering inside a detector whose whole job is to be reproducible.
 * The ordering is stated here so a reader can see exactly which comparison the edge depends on.
 */
export function detectPins(board: Chess): Relation[] {
  const out: Relation[] = [];
  for (const unit of occupants(board)) {
    const rays = RAYS_OF[unit.type as keyof typeof RAYS_OF];
    if (!rays) continue;
    const enemy: Color = unit.color === "w" ? "b" : "w";
    for (const step of rays) {
      const first = ray(board, unit.square, step).blocker;
      if (!first || first.color !== enemy) continue;
      const second = ray(board, first.square, step).blocker;
      if (!second || second.color !== enemy) continue;
      if (PIN_WORTH[second.type] <= PIN_WORTH[first.type]) continue;
      out.push({
        type: "pin",
        side: unit.color,
        elements: [unit.square, first.square, second.square],
      });
    }
  }
  return out;
}

/**
 * `overload` -- one defender is the ONLY defender of two or more units that are under attack.
 * Elements: `defender > target > target ...`, targets sorted so the identity is stable.
 *
 * SOLE defender, not merely a defender. A unit with two defenders can lose one without the
 * structure collapsing, so counting it here would make the edge fire on positions where the
 * dependency family 3 manipulates does not exist. This is the strictest reading the word supports
 * and it is the one that makes the disrupted arm constructible: add a second defender, and the
 * dependency is gone while every carrier stays on the board.
 */
export function detectOverloads(board: Chess): Relation[] {
  const byDefender = new Map<string, Square[]>();
  for (const unit of occupants(board)) {
    const enemy: Color = unit.color === "w" ? "b" : "w";
    if (!board.attackers(unit.square, enemy).length) continue;
    const defenders = board.attackers(unit.square, unit.color).filter((s) => s !== unit.square);
    if (defenders.length !== 1) continue;
    const key = `${unit.color}:${defenders[0]}`;
    byDefender.set(key, [...(byDefender.get(key) ?? []), unit.square as Square]);
  }
  const out: Relation[] = [];
  for (const [key, targets] of byDefender) {
    if (targets.length < 2) continue;
    const [side, defender] = key.split(":");
    out.push({
      type: "overload",
      side: side as Color,
      elements: [defender as Square, ...[...targets].sort()],
    });
  }
  return out;
}

/**
 * `battery` -- two or more friendly sliders stacked on one ray, the rear ones firing through the
 * front one. Elements: `rear > ... > front > terminal`, ordered back to front.
 *
 * THE ONLY HIGHER-ORDER DETECTOR IN R2, and the terminal square is in the identity on purpose: a
 * battery aimed down an open file and the same two pieces aimed into a pawn are not the same
 * structure, and family 4 needs an edit that can break the second without moving either carrier.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM. It is not asserted that a battery is a coalition in the
 * cooperative-game sense, that it is worth more than its pieces, or that anybody perceives it.
 * TCRF §3.3 keeps the list of motifs open and admits one only after a versioned detector exists;
 * this is that detector and nothing more.
 */
export function detectBatteries(board: Chess): Relation[] {
  const out: Relation[] = [];
  for (const unit of occupants(board)) {
    const rays = RAYS_OF[unit.type as keyof typeof RAYS_OF];
    if (!rays) continue;
    for (const step of rays) {
      const stack: Square[] = [unit.square];
      let cursor: Square = unit.square;
      for (;;) {
        const { crossed, blocker } = ray(board, cursor, step);
        if (!blocker || blocker.color !== unit.color) {
          if (stack.length < 2) break;
          const terminal =
            blocker && blocker.color !== unit.color ? blocker.square : crossed.at(-1);
          if (terminal) {
            out.push({ type: "battery", side: unit.color, elements: [...stack, terminal] });
          }
          break;
        }
        const rays2 = RAYS_OF[blocker.type as keyof typeof RAYS_OF];
        // The unit in front must be able to fire along the SAME ray, or it is a blocker and not a
        // battery partner: a knight in front of a rook stops the line rather than extending it.
        if (!rays2 || !rays2.some(([f, r]) => f === step[0] && r === step[1])) break;
        stack.push(blocker.square);
        cursor = blocker.square;
      }
    }
  }
  /*
   * ONLY MAXIMAL STACKS SURVIVE. A queen behind two rooks on one file is found three times: once
   * from the queen, once from the rear rook, once from nothing. Keeping all three would let one
   * carrier moving out of the line count as several edits in §4.4's non-target edit count, which is
   * a weight on how many pieces happen to be stacked rather than on how much structure changed.
   * A battery whose elements are a suffix of a longer one, with the same terminal square, is the
   * same structure read from further forward.
   */
  const keys = new Set(out.map(canonical));
  const maximal = out.filter((r) => {
    const suffix = r.elements.join(">");
    return ![...keys].some((other) => {
      const tail = other.split(":")[2];
      return tail !== suffix && tail.endsWith(`>${suffix}`) && other.startsWith(`${r.side}:battery:`);
    });
  });
  const seen = new Set<string>();
  return maximal.filter((r) => {
    const key = canonical(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Every detector over one position, as a sorted set of canonical strings. */
export function structuralField(fen: string): string[] {
  const board = new Chess(fen);
  const relations = [
    ...detectAttacks(board),
    ...detectDefends(board),
    ...detectLineAccess(board),
    ...detectPins(board),
    ...detectOverloads(board),
    ...detectBatteries(board),
  ];
  return [...new Set(relations.map(canonical))].sort();
}

export interface FieldDiff {
  added: string[];
  removed: string[];
  /** Symmetric difference size: the edit count §4.4 minimises. */
  size: number;
}

/** What changed between two positions' structure. The one derived quantity R2 needs. */
export function diffFields(present: string[], disrupted: string[]): FieldDiff {
  const a = new Set(present);
  const b = new Set(disrupted);
  const added = disrupted.filter((e) => !a.has(e)).sort();
  const removed = present.filter((e) => !b.has(e)).sort();
  return { added, removed, size: added.length + removed.length };
}
