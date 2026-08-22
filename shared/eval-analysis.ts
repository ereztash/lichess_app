/**
 * Centipawn loss, accuracy and move classification from a list of evaluations.
 *
 * Ported from chess-mind-patterns (src/lib/eval-analysis.ts @2c7ced2) as phase 1 of merging the
 * two repositories. Unchanged in behaviour.
 *
 * It takes `evalScores: number[]` -- centipawns from White's perspective per ply, mate as +/-10000
 * -- and does not care who produced them. In the source repository they could only come from
 * [%eval] comments Lichess had already written. Here they can also come from the local engine,
 * which is the whole point of phase 1.
 *
 * One thing DID change: it used to carry its own phase rule -- `ply / total` ratio bands -- which
 * disagreed with `classifyPhase` in shared/phase.ts, the rule the record actually uses. Both were
 * exported from shared/ under the same word. That is unified now; see `accuracyByPhase`.
 */
import { classifyPhase } from "./phase.js";

export interface MoveEval {
  moveNumber: number;
  ply: number;
  eval: number; // centipawns from white's perspective
  evalPawns: number; // eval in pawns (for display)
  cpl: number; // centipawn loss for this move
  accuracy: number; // 0-100 accuracy for this move
  classification: "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  isWhite: boolean;
  moveSan?: string;
}

export interface EvalAnalysis {
  hasEvals: boolean;
  moveEvals: MoveEval[];
  evalCurve: number[]; // raw eval per ply (in pawns, capped)
  playerMoveEvals: MoveEval[]; // only for the analyzed player
  avgCPL: number;
  accuracy: number; // 0-100 overall accuracy
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  bestMoves: number;
  /**
   * Accuracy per phase, or null when the phase of each move is not knowable here.
   *
   * Null rather than zeroes: a zero is a measurement and this is an absence. It is null whenever
   * `fens` is not supplied, because the only correct phase rule needs a position and this
   * function is otherwise given nothing but numbers.
   */
  phaseAccuracy: PhaseAccuracy | null;
}

export interface PhaseAccuracy {
  opening: number;
  middlegame: number;
  endgame: number;
}

export interface AggregateEvalAnalysis {
  hasEvals: boolean;
  gamesWithEvals: number;
  avgAccuracy: number;
  avgCPL: number;
  accuracyOverTime: number[]; // per-game accuracy
  totalBlunders: number;
  totalMistakes: number;
  totalInaccuracies: number;
  /** Null when no analysed game carried positions; see EvalAnalysis.phaseAccuracy. */
  phaseAccuracy: PhaseAccuracy | null;
}

function classifyMove(cpl: number): MoveEval["classification"] {
  if (cpl <= 10) return "best";
  if (cpl <= 25) return "excellent";
  if (cpl <= 50) return "good";
  if (cpl <= 100) return "inaccuracy";
  if (cpl <= 200) return "mistake";
  return "blunder";
}

// Accuracy formula inspired by Lichess: accuracy = 103.1668 * exp(-0.04354 * (winChanceLoss)) - 3.1668
// Simplified version using CPL
function moveAccuracy(cpl: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * cpl) - 3.1668));
}

function capEval(cp: number): number {
  return Math.max(-1500, Math.min(1500, cp));
}

export function analyzeEval(
  evalScores: number[],
  playerColor: "w" | "b" = "w",
  totalPlies?: number,
  /**
   * One FEN per ply, as `gamePositions()` produces them: index 0 is the starting position and
   * index i is the position after ply i. Required for `phaseAccuracy`, and only for that.
   */
  fens?: string[],
): EvalAnalysis {
  if (evalScores.length < 4) {
    return emptyAnalysis();
  }

  const total = totalPlies || evalScores.length;
  const moveEvals: MoveEval[] = [];
  const evalCurve: number[] = [];

  for (let ply = 0; ply < evalScores.length; ply++) {
    const evalCp = capEval(evalScores[ply]);
    evalCurve.push(evalCp / 100); // store in pawns for chart

    if (ply === 0) continue; // no CPL for first position

    const isWhite = ply % 2 === 1; // ply 1 = after white's first move
    const prevEval = capEval(evalScores[ply - 1]);
    const currEval = evalCp;

    // CPL: how much the position got worse for the side that just moved
    let cpl: number;
    if (isWhite) {
      // White moved: eval should stay same or increase. Loss = prev - curr (if negative, no loss)
      cpl = Math.max(0, prevEval - currEval);
    } else {
      // Black moved: eval should stay same or decrease. Loss = curr - prev (if negative for black, no loss)
      cpl = Math.max(0, currEval - prevEval);
    }

    const moveNumber = Math.ceil(ply / 2);
    moveEvals.push({
      moveNumber,
      ply,
      eval: currEval,
      evalPawns: currEval / 100,
      cpl,
      accuracy: moveAccuracy(cpl),
      classification: classifyMove(cpl),
      isWhite,
    });
  }

  const playerMoves = moveEvals.filter((m) => (playerColor === "w") === m.isWhite);

  if (playerMoves.length === 0) return emptyAnalysis();

  const avgCPL = Math.round(playerMoves.reduce((s, m) => s + m.cpl, 0) / playerMoves.length);
  const accuracy = Math.round(playerMoves.reduce((s, m) => s + m.accuracy, 0) / playerMoves.length);
  const blunders = playerMoves.filter((m) => m.classification === "blunder").length;
  const mistakes = playerMoves.filter((m) => m.classification === "mistake").length;
  const inaccuracies = playerMoves.filter((m) => m.classification === "inaccuracy").length;
  const bestMoves = playerMoves.filter(
    (m) => m.classification === "best" || m.classification === "excellent",
  ).length;

  /*
   * Phase accuracy, by the ONE phase rule this repository has.
   *
   * There used to be a second one here: `ply / total` ratio bands, which disagreed with
   * `classifyPhase` -- the rule the record itself uses, documented in docs/MEASUREMENTS.md and
   * applied at decision-session.ts. Two definitions under one label is a disagreement waiting to
   * surface, and it was latent only because nothing rendered this field.
   *
   * The ratio rule also cannot be repaired in place: it needs the game's total length, so the
   * same move changes phase depending on how the game later ended. `classifyPhase` reads the
   * position, so a move's phase is a fact about that move.
   */
  const phaseAccuracy = fens ? accuracyByPhase(playerMoves, fens) : null;

  /*
   * An `insights` array lived here, and in the aggregate below, holding bilingual sentences like
   * "דיוק כללי: 78%" and "שלב חלש: סיום (62% דיוק)".
   *
   * Nothing rendered them -- ported with the file and never wired -- and each was a percentage
   * with no n and no threshold, which is what GATE-DENOM exists to stop. They survived because
   * the gate scanned client/src and this file is in shared/. Widening the scan surfaced six at
   * once. Deleted rather than exempted: dead code that manufactures claims still manufactures
   * claims, and leaving it makes the next reader think the feature exists.
   */

  return {
    hasEvals: true,
    moveEvals,
    evalCurve,
    playerMoveEvals: playerMoves,
    avgCPL,
    accuracy,
    blunders,
    mistakes,
    inaccuracies,
    bestMoves,
    phaseAccuracy,
  };
}

export function analyzeAggregateEval(
  allEvalScores: number[][],
  playerColor: "w" | "b" = "w",
): AggregateEvalAnalysis {
  const analyses = allEvalScores
    .map((scores) => analyzeEval(scores, playerColor))
    .filter((a) => a.hasEvals);

  if (analyses.length === 0) {
    return {
      hasEvals: false,
      gamesWithEvals: 0,
      avgAccuracy: 0,
      avgCPL: 0,
      accuracyOverTime: [],
      totalBlunders: 0,
      totalMistakes: 0,
      totalInaccuracies: 0,
      phaseAccuracy: { opening: 0, middlegame: 0, endgame: 0 },
    };
  }

  const accuracyOverTime = analyses.map((a) => a.accuracy);
  const avgAccuracy = Math.round(
    accuracyOverTime.reduce((a, b) => a + b, 0) / accuracyOverTime.length,
  );
  const avgCPL = Math.round(analyses.reduce((s, a) => s + a.avgCPL, 0) / analyses.length);

  /*
   * Averaged over the games that HAVE a phase reading, not over all of them. Treating a null as
   * a zero would drag the mean down by however many games were analysed without positions, and
   * report the result as though every game had been measured.
   */
  const withPhase = analyses
    .map((a) => a.phaseAccuracy)
    .filter((p): p is PhaseAccuracy => p !== null);
  const meanOver = (pick: (p: PhaseAccuracy) => number) =>
    Math.round(withPhase.reduce((s, p) => s + pick(p), 0) / withPhase.length);
  const phaseAccuracy: PhaseAccuracy | null = withPhase.length
    ? {
        opening: meanOver((p) => p.opening),
        middlegame: meanOver((p) => p.middlegame),
        endgame: meanOver((p) => p.endgame),
      }
    : null;

  /*
   * An `insights` array lived here, and in the aggregate below, holding bilingual sentences like
   * "דיוק כללי: 78%" and "שלב חלש: סיום (62% דיוק)".
   *
   * Nothing rendered them -- ported with the file and never wired -- and each was a percentage
   * with no n and no threshold, which is what GATE-DENOM exists to stop. They survived because
   * the gate scanned client/src and this file is in shared/. Widening the scan surfaced six at
   * once. Deleted rather than exempted: dead code that manufactures claims still manufactures
   * claims, and leaving it makes the next reader think the feature exists.
   */

  return {
    hasEvals: true,
    gamesWithEvals: analyses.length,
    avgAccuracy,
    avgCPL,
    accuracyOverTime,
    totalBlunders: analyses.reduce((s, a) => s + a.blunders, 0),
    totalMistakes: analyses.reduce((s, a) => s + a.mistakes, 0),
    totalInaccuracies: analyses.reduce((s, a) => s + a.inaccuracies, 0),
    phaseAccuracy,
  };
}

/**
 * Group the player's move accuracies by the phase of the position each move was made in.
 *
 * `fens[m.ply]` is the position AFTER the move, which is the same indexing `gamePositions()`
 * produces and the same one `evalScores` uses. A move whose FEN is missing is skipped rather
 * than defaulted into a phase: a wrong bucket is worse than a smaller n.
 */
function accuracyByPhase(playerMoves: MoveEval[], fens: string[]): PhaseAccuracy | null {
  const groups: Record<keyof PhaseAccuracy, number[]> = {
    opening: [],
    middlegame: [],
    endgame: [],
  };
  for (const m of playerMoves) {
    const fen = fens[m.ply];
    if (!fen) continue;
    groups[classifyPhase(fen, m.ply)].push(m.accuracy);
  }
  const mean = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
  if (!groups.opening.length && !groups.middlegame.length && !groups.endgame.length) return null;
  return {
    opening: mean(groups.opening),
    middlegame: mean(groups.middlegame),
    endgame: mean(groups.endgame),
  };
}

function emptyAnalysis(): EvalAnalysis {
  return {
    hasEvals: false,
    moveEvals: [],
    evalCurve: [],
    playerMoveEvals: [],
    avgCPL: 0,
    accuracy: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    bestMoves: 0,
    phaseAccuracy: null,
  };
}
