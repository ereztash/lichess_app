/**
 * Crossing the variables, which is where a game profile lives.
 *
 * WHY THE MARGINAL PANEL CANNOT DO THIS. A record reporting "worse in the middlegame" and "worse
 * when fast" as two facts cannot say whether that is two weaknesses or one seen twice. And a
 * player who is fine in slow middlegame positions and miscalibrated in fast ones has a weakness
 * that NO marginal bucket describes: "middlegame" dilutes it with the slow half, "fast" dilutes it
 * with the opening and the endgame. Only the cell holds it undiluted.
 *
 * WHAT IT COSTS, measured on perfectly calibrated players with nothing to find anywhere, 500 runs
 * per size, seeded:
 *
 *                      marginal buckets only     with every phase x time crossing
 *     n = 120                0.6%                          0.0%
 *     n = 240                0.4%                          0.0%
 *     n = 480                0.2%                          0.0%
 *
 * IT COSTS NOTHING IN FALSE POSITIVES, and that is not a virtue of crossing. `MIN_BUCKET_N` is
 * required on BOTH sides, so a cell too small to be trusted is never tested and cannot produce
 * one. The floor already in the product does the work; the crossing just inherits it.
 *
 * WHAT IT COSTS IS SILENCE. Cells with enough decisions to be measurable at all:
 *
 *     n = 120     0.1%        n = 240     17.1%        n = 480     65.1%
 *
 * A profile is unreadable on a short record and mostly readable past roughly five hundred
 * decisions. So the fraction is reported rather than hidden: an absence with a denominator is a
 * state a player can act on, a blank panel is indistinguishable from a bug.
 *
 * LEVELS OF ONE VARIABLE ARE NEVER CROSSED. "opening AND middlegame" is empty by construction, as
 * is "fast AND slow". Testing them would spend the comparison budget on cells that cannot contain
 * a decision -- and would put rows on a screen that can never say anything.
 *
 * AND THE CROSSING INHERITS THE MARGINAL PANEL'S OWN DEFECT, so it inherits the cure. A cell is
 * measured against everything outside it, and everything outside it contains the weakness. On a
 * player miscalibrated ONLY in fast middlegame positions, over 200 seeded runs:
 *
 *     fast x middlegame   separated 200 times   the real cell
 *     slow x middlegame   separated  35 times   its mirror, on a cell that is calibrated
 *     four other cells    separated  24 times between them
 *
 * So the six cells of one variable pair are six levels of one composite variable, and they get
 * ONE finding between them -- ranked by distance in standard errors, exactly as the phase levels
 * are. Fixing this for the marginal panel and not for the crossing would have shipped the same
 * arithmetic under a new name.
 *
 * TWO REASONS A CELL CANNOT BE READ, AND THEY ARE NOT THE SAME STATE. Too few decisions is a
 * matter of time; a record with no clock data can never fill a `clock` cell no matter how long
 * the player keeps playing. Reporting "6 of 11 readable" to somebody whose five missing cells are
 * structurally impossible tells them to keep going toward something unreachable.
 */
import {
  BUCKETINGS,
  MIN_BUCKET_N,
  SEPARABILITY_K,
  gapDifferenceStandardError,
  summarise,
  type Bucketing,
  type CalibrationSummary,
  type ScoredDecision,
} from "./detector.js";
import { VARIABLES, variableOf } from "./bucket-variable.js";

export interface CrossedSide {
  /** The bucket key, e.g. `phase-middlegame`. */
  key: string;
  /** The variable it is a level of, e.g. `phase`. Two sides never share one. */
  variable: string;
  scope: string;
}

/** Why a cell could not be tested. `too-few` improves with time; `no-clock-data` never does. */
export type CellSilence = "too-few" | "no-clock-data";

export interface CrossedCell {
  /** `left×right`, stable and derived from the two bucket keys. */
  key: string;
  left: CrossedSide;
  right: CrossedSide;
  inside: CalibrationSummary;
  outside: CalibrationSummary;
  gapDifference: number;
  /**
   * The sampling error of the difference, carried with it because the difference alone is not a
   * finding -- the same rule the marginal panel was brought under.
   */
  standardError: number;
  /** True when the difference clears `SEPARABILITY_K` of its own error. */
  separated: boolean;
  /** Null when the cell was tested. Otherwise why it was not. */
  silence: CellSilence | null;
}

/**
 * One finding per variable PAIR, for the reason stated in the module note: the cells of a pair are
 * levels of one composite variable, and testing each against everything outside it makes the
 * mirror of a real cell look like a second finding.
 */
export interface CrossedFinding {
  /** e.g. `time-taken×phase`. */
  pair: string;
  strongest: CrossedCell;
  /** Cells that cleared on the opposite side. A consequence of the finding, not a second one. */
  mirrored: CrossedCell[];
  /** Cells that cleared on the same side: a real statement about more than one cell. */
  alongside: CrossedCell[];
  cellsCleared: number;
}

export interface CrossingReading {
  /** Every distinct pair of levels from two DIFFERENT variables. */
  cells: CrossedCell[];
  /** Cells with enough decisions on both sides to be tested at all. */
  readable: CrossedCell[];
  /** Of those, the ones that cleared the bar. Not the findings -- see `findings`. */
  separated: CrossedCell[];
  /** At most one per variable pair. This is what a screen should show. */
  findings: CrossedFinding[];
  /** How many cells were formed. The denominator `measurable` is reported against. */
  tried: number;
  measurable: number;
  /**
   * Cells that no amount of further play can fill, because the record carries no clock at all.
   * Held apart from `tried - measurable` so "keep playing" is never said about an impossibility.
   */
  impossible: number;
}

/** Every ordered-once pair of levels drawn from two different variables. */
function pairs(): [Bucketing, Bucketing][] {
  const out: [Bucketing, Bucketing][] = [];
  for (let i = 0; i < BUCKETINGS.length; i += 1) {
    for (let j = i + 1; j < BUCKETINGS.length; j += 1) {
      const a = BUCKETINGS[i];
      const b = BUCKETINGS[j];
      const va = variableOf(a.key);
      const vb = variableOf(b.key);
      /*
       * A bucket belonging to no variable is skipped rather than crossed as its own. The
       * completeness of that map is asserted in tests/shared/one-weakness-told-three-times.ts,
       * so this branch is a guard against a future bucket rather than a live case.
       */
      if (!va || !vb || va.key === vb.key) continue;
      out.push([a, b]);
    }
  }
  return out;
}

export function crossVariables(decisions: ScoredDecision[]): CrossingReading {
  const cells: CrossedCell[] = [];
  // One pass, like the marginal panel's: whether the record carries any clock at all decides
  // which of the two silences a clock cell reports.
  const anyClock = decisions.some((d) => d.clockMsRemaining !== null);

  for (const [a, b] of pairs()) {
    const inside = decisions.filter((d) => a.predicate(d) && b.predicate(d));
    const outside = decisions.filter((d) => !(a.predicate(d) && b.predicate(d)));
    const insideSummary = summarise(inside);
    const outsideSummary = summarise(outside);
    /*
     * THE FLOOR IS WHAT MAKES THIS AFFORDABLE. A cell under it is not reported as "no difference"
     * -- it is not tested, and `readable` excludes it, so the fraction printed on screen is the
     * share of the profile that could be read rather than the share that came out empty.
     */
    const measurable = inside.length >= MIN_BUCKET_N && outside.length >= MIN_BUCKET_N;
    const standardError = measurable
      ? gapDifferenceStandardError(insideSummary, outsideSummary)
      : null;
    const gapDifference = insideSummary.gap - outsideSummary.gap;
    /*
     * A cell needing a clock, in a record that has none, is structurally unreadable rather than
     * short of decisions -- the same distinction the marginal panel already draws, and for the
     * same reason: telling somebody to keep playing toward a cell that can never fill is worse
     * than telling them nothing.
     */
    const needsClock = a.requiresClock === true || b.requiresClock === true;
    const silence: CellSilence | null =
      standardError !== null ? null : needsClock && !anyClock ? "no-clock-data" : "too-few";

    cells.push({
      key: `${a.key}×${b.key}`,
      left: { key: a.key, variable: variableOf(a.key)!.key, scope: a.scope },
      right: { key: b.key, variable: variableOf(b.key)!.key, scope: b.scope },
      inside: insideSummary,
      outside: outsideSummary,
      gapDifference,
      // Zero rather than null when the cell was not measured: `separated` below is what says
      // whether anything was found, and a null here would have to be handled at every reader.
      standardError: standardError ?? 0,
      separated:
        standardError !== null && Math.abs(gapDifference) >= SEPARABILITY_K * standardError,
      silence,
    });
  }

  const readable = cells.filter((c) => c.silence === null);
  const separated = readable.filter((c) => c.separated);
  return {
    cells,
    readable,
    separated,
    findings: collapse(separated),
    tried: cells.length,
    measurable: readable.length,
    impossible: cells.filter((c) => c.silence === "no-clock-data").length,
  };
}

/**
 * One finding per variable pair, ranked by distance in standard errors.
 *
 * The same rule and the same reason as `readVariables`: a cell measured against everything outside
 * it produces a mirror whenever the outside contains the weakness, and the mirror is a claim about
 * a cell that is fine. Distance rather than size, because size names whichever cell the record
 * happens to contain most of.
 */
function collapse(separated: CrossedCell[]): CrossedFinding[] {
  const byPair = new Map<string, CrossedCell[]>();
  for (const cell of separated) {
    const pair = [cell.left.variable, cell.right.variable].sort().join("×");
    byPair.set(pair, [...(byPair.get(pair) ?? []), cell]);
  }

  const distance = (c: CrossedCell) => Math.abs(c.gapDifference) / c.standardError;
  return [...byPair.entries()]
    .map(([pair, cleared]) => {
      const strongest = [...cleared].sort((a, b) => distance(b) - distance(a))[0];
      const rest = cleared.filter((c) => c !== strongest);
      const sign = Math.sign(strongest.gapDifference);
      return {
        pair,
        strongest,
        mirrored: rest.filter((c) => Math.sign(c.gapDifference) !== sign),
        alongside: rest.filter((c) => Math.sign(c.gapDifference) === sign),
        cellsCleared: cleared.length,
      };
    })
    .sort((a, b) => b.strongest.inside.n - a.strongest.inside.n);
}

/** How many variables are available to cross. Fewer than two makes the whole reading empty. */
export const CROSSABLE_VARIABLES = VARIABLES.length;
