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
 */

export interface MoveEval {
  moveNumber: number;
  ply: number;
  eval: number;          // centipawns from white's perspective
  evalPawns: number;     // eval in pawns (for display)
  cpl: number;           // centipawn loss for this move
  accuracy: number;      // 0-100 accuracy for this move
  classification: "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  isWhite: boolean;
  moveSan?: string;
}

export interface EvalAnalysis {
  hasEvals: boolean;
  moveEvals: MoveEval[];
  evalCurve: number[];         // raw eval per ply (in pawns, capped)
  playerMoveEvals: MoveEval[]; // only for the analyzed player
  avgCPL: number;
  accuracy: number;            // 0-100 overall accuracy
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  bestMoves: number;
  phaseAccuracy: {
    opening: number;
    middlegame: number;
    endgame: number;
  };
  insights: { en: string; he: string }[];
}

export interface AggregateEvalAnalysis {
  hasEvals: boolean;
  gamesWithEvals: number;
  avgAccuracy: number;
  avgCPL: number;
  accuracyOverTime: number[];   // per-game accuracy
  totalBlunders: number;
  totalMistakes: number;
  totalInaccuracies: number;
  phaseAccuracy: {
    opening: number;
    middlegame: number;
    endgame: number;
  };
  insights: { en: string; he: string }[];
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
  totalPlies?: number
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
  const bestMoves = playerMoves.filter((m) => m.classification === "best" || m.classification === "excellent").length;

  // Phase accuracy
  const getPhase = (ply: number): "opening" | "middlegame" | "endgame" => {
    const ratio = ply / total;
    if (ratio < 0.25 || ply <= 20) return "opening";
    if (ratio < 0.7) return "middlegame";
    return "endgame";
  };

  const phaseGroups: Record<string, number[]> = { opening: [], middlegame: [], endgame: [] };
  for (const m of playerMoves) {
    phaseGroups[getPhase(m.ply)].push(m.accuracy);
  }

  const phaseAccuracy = {
    opening: phaseGroups.opening.length > 0 ? Math.round(phaseGroups.opening.reduce((a, b) => a + b, 0) / phaseGroups.opening.length) : 0,
    middlegame: phaseGroups.middlegame.length > 0 ? Math.round(phaseGroups.middlegame.reduce((a, b) => a + b, 0) / phaseGroups.middlegame.length) : 0,
    endgame: phaseGroups.endgame.length > 0 ? Math.round(phaseGroups.endgame.reduce((a, b) => a + b, 0) / phaseGroups.endgame.length) : 0,
  };

  // Insights
  const insights: { en: string; he: string }[] = [];
  insights.push({
    en: `Overall accuracy: ${accuracy}% with average CPL of ${avgCPL}`,
    he: `דיוק כללי: ${accuracy}% עם CPL ממוצע של ${avgCPL}`,
  });

  if (blunders > 0) {
    insights.push({
      en: `${blunders} blunder${blunders > 1 ? "s" : ""} detected — positions where ${blunders > 1 ? "significant" : "a significant"} advantage was lost`,
      he: `${blunders} טעות${blunders > 1 ? "ות" : ""} חמורה — עמדות שבהן אבד יתרון משמעותי`,
    });
  }

  const worstPhase = Object.entries(phaseAccuracy)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[1] - b[1])[0];
  if (worstPhase) {
    const phaseNames = {
      opening: { en: "opening", he: "פתיחה" },
      middlegame: { en: "middlegame", he: "אמצע המשחק" },
      endgame: { en: "endgame", he: "סיום" },
    };
    const p = phaseNames[worstPhase[0] as keyof typeof phaseNames];
    insights.push({
      en: `Weakest phase: ${p.en} (${worstPhase[1]}% accuracy)`,
      he: `שלב חלש: ${p.he} (${worstPhase[1]}% דיוק)`,
    });
  }

  if (bestMoves > playerMoves.length * 0.6) {
    insights.push({
      en: "Excellent play — over 60% of moves were best or excellent quality",
      he: "משחק מצוין — מעל 60% מהמהלכים היו באיכות מעולה או מיטבית",
    });
  }

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
    insights,
  };
}

export function analyzeAggregateEval(
  allEvalScores: number[][],
  playerColor: "w" | "b" = "w"
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
      insights: [],
    };
  }

  const accuracyOverTime = analyses.map((a) => a.accuracy);
  const avgAccuracy = Math.round(accuracyOverTime.reduce((a, b) => a + b, 0) / accuracyOverTime.length);
  const avgCPL = Math.round(analyses.reduce((s, a) => s + a.avgCPL, 0) / analyses.length);

  const phaseAccuracy = {
    opening: Math.round(analyses.reduce((s, a) => s + a.phaseAccuracy.opening, 0) / analyses.length),
    middlegame: Math.round(analyses.reduce((s, a) => s + a.phaseAccuracy.middlegame, 0) / analyses.length),
    endgame: Math.round(analyses.reduce((s, a) => s + a.phaseAccuracy.endgame, 0) / analyses.length),
  };

  const insights: { en: string; he: string }[] = [];
  insights.push({
    en: `Average accuracy: ${avgAccuracy}% across ${analyses.length} analyzed games`,
    he: `דיוק ממוצע: ${avgAccuracy}% לאורך ${analyses.length} משחקים מנותחים`,
  });

  // Trend
  if (accuracyOverTime.length >= 3) {
    const firstHalf = accuracyOverTime.slice(0, Math.floor(accuracyOverTime.length / 2));
    const secondHalf = accuracyOverTime.slice(Math.floor(accuracyOverTime.length / 2));
    const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    if (avg2 > avg1 + 3) {
      insights.push({ en: "Your accuracy is trending upward — good progress!", he: "הדיוק שלך במגמת עלייה — התקדמות טובה!" });
    } else if (avg2 < avg1 - 3) {
      insights.push({ en: "Your accuracy has been declining — focus on reducing blunders", he: "הדיוק שלך במגמת ירידה — התמקד בהפחתת טעויות" });
    }
  }

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
    insights,
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
    phaseAccuracy: { opening: 0, middlegame: 0, endgame: 0 },
    insights: [],
  };
}
