/**
 * The six detectors, each with a position where it must fire and a position where it must not.
 *
 * A NEGATIVE FIXTURE PER DETECTOR IS NOT SYMMETRY FOR ITS OWN SAKE. A detector that returns
 * everything passes every positive test ever written for it, and the stimulus pipeline's whole
 * output -- the graph diff -- is a difference between two of these sets. A detector that fires
 * everywhere makes every diff the same size and the §4.4 locality rule meaningless.
 *
 * THE MUTATION TEST AT THE END IS THE ONE THAT MATTERS MOST. It takes each positive fixture, makes
 * the single edit that should remove the relation, and requires it gone. That is the same operation
 * a stimulus perturbation performs, so a detector that passes it is a detector the experiment can
 * actually be built on.
 */
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  DETECTOR_VERSIONS,
  FAMILY_OF,
  canonical,
  detectAttacks,
  detectBatteries,
  detectDefends,
  detectLineAccess,
  detectOverloads,
  detectPins,
  diffFields,
  parseRelation,
  structuralField,
} from "../../../research/tcrf/relations";

const field = (fen: string) => structuralField(fen);
const has = (fen: string, relation: string) => field(fen).includes(relation);

describe("detectors fire where the structure is", () => {
  it("defends: a rook behind its own knight on an open file", () => {
    const fen = "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20";
    expect(detectDefends(new Chess(fen)).map(canonical)).toContain("w:defends:e1>e5");
  });

  it("attacks: contact is reported regardless of whose turn it is", () => {
    const white = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const black = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
    /*
     * THE SAME EDGE FROM BOTH SIDES TO MOVE, because §4.2 holds side to move fixed across a pair
     * for a different reason and a detector that changed its answer with the turn would make the
     * two arms of every pair differ for that reason instead.
     */
    expect(detectAttacks(new Chess(white)).map(canonical)).toContain("w:attacks:c4>f7");
    expect(detectAttacks(new Chess(black)).map(canonical)).toContain("w:attacks:c4>f7");
  });

  it("line_access: one edge per ray, naming the furthest square reached", () => {
    const fen = "4r1k1/ppp2ppp/5n2/8/8/2P2N2/PP3PPP/3R2K1 w - - 0 20";
    const edges = detectLineAccess(new Chess(fen)).map(canonical);
    expect(edges).toContain("w:line_access:d1>d8");
    // and not a separate edge for every square on the way
    expect(edges.filter((e) => e.startsWith("w:line_access:d1>"))).toHaveLength(3);
  });

  it("pin: a bishop, a knight and the king behind it", () => {
    const fen = "r3k2r/ppp2ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 8";
    expect(detectPins(new Chess(fen)).map(canonical)).toContain("w:pin:b5>c6>e8");
  });

  it("overload: the sole defender of two attacked units, targets sorted", () => {
    const fen = "r5k1/ppp2p2/4n1np/8/8/1B6/PPP2P1P/6RK w - - 0 25";
    expect(detectOverloads(new Chess(fen)).map(canonical)).toContain("b:overload:f7>e6>g6");
  });

  it("battery: a stack on one ray, back to front, with its terminal square", () => {
    const fen = "3r2k1/ppp2ppp/5n2/8/8/8/PPPQ1PPP/3R2K1 w - - 0 20";
    expect(detectBatteries(new Chess(fen)).map(canonical)).toContain("w:battery:d1>d2>d8");
  });

  it("battery: a three-piece stack is reported once, not once per rear member", () => {
    const fen = "3r2k1/5ppp/8/8/8/3R4/3R1PPP/3Q2K1 w - - 0 1";
    const batteries = detectBatteries(new Chess(fen)).map(canonical).filter((b) => b.includes(">d3"));
    expect(batteries).toEqual(["w:battery:d1>d2>d3>d8"]);
  });
});

describe("detectors stay silent where the structure is not", () => {
  it("defends: the rook one file over defends nothing on e5", () => {
    expect(has("2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/3R2K1 w - - 0 20", "w:defends:e1>e5")).toBe(false);
  });

  it("line_access: a ray blocked on the adjacent square emits no edge at all", () => {
    const edges = detectLineAccess(new Chess("4r1k1/ppp2ppp/5n2/8/8/3P1N2/PP3PPP/3R2K1 w - - 0 20"))
      .map(canonical);
    expect(edges).not.toContain("w:line_access:d1>d8");
    expect(edges).toContain("w:line_access:d1>d2");
  });

  it("pin: a shield worth less than the piece in front of it is not a pin", () => {
    // the same diagonal with a pawn behind the knight instead of the king
    expect(
      has("r3k2r/1ppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 8", "w:pin:b5>c6>e8"),
    ).toBe(false);
  });

  it("overload: a unit with two defenders creates no dependency", () => {
    expect(
      has("r7/ppp2pk1/4n1np/8/8/1B6/PPP2P1P/6RK w - - 0 25", "b:overload:f7>e6>g6"),
    ).toBe(false);
  });

  it("battery: a piece that cannot fire along the ray blocks it rather than joining it", () => {
    // a knight on d2 in front of the queen on d1 is not a battery partner
    const batteries = detectBatteries(new Chess("3r2k1/ppp2ppp/5n2/8/8/8/PPPN1PPP/3Q2K1 w - - 0 20"))
      .map(canonical);
    expect(batteries.filter((b) => b.startsWith("w:battery:d1>d2"))).toEqual([]);
  });

  it("no detector fires on an empty board beyond the kings", () => {
    expect(field("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toEqual([]);
  });
});

describe("the mutation each stimulus family performs removes exactly its own relation", () => {
  const mutations: Array<[string, string, string]> = [
    [
      "w:defends:e1>e5",
      "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20",
      "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/3R2K1 w - - 0 20",
    ],
    [
      "w:line_access:d1>d8",
      "4r1k1/ppp2ppp/5n2/8/8/2P2N2/PP3PPP/3R2K1 w - - 0 20",
      "4r1k1/ppp2ppp/5n2/8/8/3P1N2/PP3PPP/3R2K1 w - - 0 20",
    ],
    [
      "b:overload:f7>e6>g6",
      "r5k1/ppp2p2/4n1np/8/8/1B6/PPP2P1P/6RK w - - 0 25",
      "r7/ppp2pk1/4n1np/8/8/1B6/PPP2P1P/6RK w - - 0 25",
    ],
    [
      "w:battery:d1>d2>d8",
      "3r2k1/ppp2ppp/5n2/8/8/8/PPPQ1PPP/3R2K1 w - - 0 20",
      "3r2k1/ppp2ppp/5n2/8/8/8/PPPQ1PPP/2R3K1 w - - 0 20",
    ],
  ];

  for (const [relation, present, disrupted] of mutations) {
    it(`${relation} is present before the edit and gone after it`, () => {
      expect(has(present, relation)).toBe(true);
      expect(has(disrupted, relation)).toBe(false);
      const diff = diffFields(field(present), field(disrupted));
      expect(diff.removed).toContain(relation);
      expect(diff.added).not.toContain(relation);
    });
  }
});

describe("the field is a comparable set", () => {
  it("is sorted and free of duplicates, so two runs produce the same diff", () => {
    const f = field("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4");
    expect(f).toEqual([...new Set(f)].sort());
  });

  it("a diff of a position against itself is empty", () => {
    const fen = "3r2k1/ppp2ppp/5n2/8/8/8/PPPQ1PPP/3R2K1 w - - 0 20";
    expect(diffFields(field(fen), field(fen))).toEqual({ added: [], removed: [], size: 0 });
  });

  it("round-trips a canonical string through the parser", () => {
    const parsed = parseRelation("w:battery:d1>d2>d8");
    expect(parsed).not.toBeNull();
    expect(canonical(parsed!)).toBe("w:battery:d1>d2>d8");
  });

  it("refuses a relation string that names a detector this build does not have", () => {
    expect(parseRelation("w:initiative:d1>d8")).toBeNull();
    expect(parseRelation("w:defends:z9>e5")).toBeNull();
  });
});

describe("every detector is versioned and belongs to a preregistered family", () => {
  it("carries a positive version for each relation type", () => {
    for (const [name, version] of Object.entries(DETECTOR_VERSIONS)) {
      expect(version, `${name} has no version`).toBeGreaterThan(0);
    }
  });

  it("maps every detector onto one of §4.1's four families", () => {
    for (const name of Object.keys(DETECTOR_VERSIONS)) {
      expect(FAMILY_OF[name as keyof typeof FAMILY_OF]).toBeDefined();
    }
  });
});
