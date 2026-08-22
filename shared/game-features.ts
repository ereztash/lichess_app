/**
 * Structural features of a game, computed by replaying it.
 *
 * Ported from chess-mind-patterns (src/lib/chess-engine.ts @2c7ced2) as phase 1 of merging the two
 * repositories. Renamed: in this codebase "engine" means Stockfish, and this module contains no
 * engine at all -- it replays moves through chess.js and measures the board.
 *
 * Everything here is computed locally from the moves, so unlike the evaluation half it needs no
 * annotations and no network. R1 applies: these are measurements of the position, and nothing in
 * here licenses a claim about the player.
 */
import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import type { ParsedGame } from "./pgn-parser.js";

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

const CENTER_SQUARES: Square[] = ["d4", "d5", "e4", "e5"];
const EXTENDED_CENTER: Square[] = ["c3", "c4", "c5", "c6", "d3", "d6", "e3", "e6", "f3", "f4", "f5", "f6"];

export interface DeepGameFeatures {
  // Basic
  totalMoves: number;
  gameLength: "short" | "medium" | "long";
  result: string;

  // Aggression
  aggressionIndex: number;
  captureRatio: number;
  checkRatio: number;
  sacrificeCount: number;
  realSacrifices: number; // material sacrifices detected via board state

  // Positional
  centerControlIndex: number;
  centerOccupancyAvg: number;
  spaceAdvantageAvg: number;

  // King safety
  castlingSpeed: number;
  castlingSide: "kingside" | "queenside" | "none";
  kingSafetyAvg: number;

  // Pawn structure
  pawnAdvanceIndex: number;
  isolatedPawnCount: number;
  doubledPawnCount: number;
  passedPawnCount: number;
  pawnChainLength: number;

  // Piece activity
  pieceVariety: number;
  queenActivity: number;
  knightActivity: number;
  bishopActivity: number;
  rookActivity: number;

  // Material
  materialBalanceCurve: number[];
  avgMaterialBalance: number;
  materialSwings: number;

  // Exchanges
  exchangeRate: number;
  exchangeInitiation: number; // how often player initiates exchanges

  // Opening
  openingType: "open" | "semi-open" | "closed" | "semi-closed" | "flank";
  openingECO: string;
  openingName: string;

  // Complexity
  symmetryBreaking: number;
  moveComplexity: number; // avg number of legal moves available
  gambitsPlayed: number;

  // Phase-specific features
  phases: {
    opening: PhaseFeatures;
    middlegame: PhaseFeatures;
    endgame: PhaseFeatures;
  };

  // Piece heatmaps (8x8 visit counts per piece type)
  pieceHeatmaps: Record<string, number[][]>;

  // Time pressure indicator (if moves get shorter/simpler near end)
  endgamePrecision: number;

  // Clock data (if available from %clk annotations)
  clockTimes: number[];        // remaining time per ply
  moveTimesWhite: number[];    // seconds spent per white move
  moveTimesBlack: number[];    // seconds spent per black move
  hasClockData: boolean;
}

export interface PhaseFeatures {
  aggressionIndex: number;
  captureRatio: number;
  centerControl: number;
  pieceVariety: number;
  moveCount: number;
  materialBalance: number;
  complexity: number;
}

interface MoveAnalysis {
  move: string;
  ply: number;
  isCapture: boolean;
  isCheck: boolean;
  isCastling: boolean;
  isSacrifice: boolean;
  materialBefore: number;
  materialAfter: number;
  materialBalance: number;
  legalMoveCount: number;
  centerPieces: number;
  piece: PieceSymbol;
  from: Square;
  to: Square;
  color: Color;
}

function countMaterial(chess: Chess, color: Color): number {
  let material = 0;
  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.color === color) {
        material += PIECE_VALUES[sq.type];
      }
    }
  }
  return material;
}

function countCenterPieces(chess: Chess, color: Color): number {
  let count = 0;
  for (const sq of CENTER_SQUARES) {
    const piece = chess.get(sq);
    if (piece && piece.color === color) count += 2;
  }
  for (const sq of EXTENDED_CENTER) {
    const piece = chess.get(sq);
    if (piece && piece.color === color) count += 1;
  }
  return count;
}

function countSpace(chess: Chess, color: Color): number {
  // Count squares in opponent's half controlled by this color
  const board = chess.board();
  let space = 0;
  const ranks = color === "w" ? [4, 5, 6, 7] : [0, 1, 2, 3];
  for (const r of ranks) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) space++;
    }
  }
  return space;
}

function getPawnStructureInfo(chess: Chess, color: Color): { isolated: number; doubled: number; passed: number; chainLength: number } {
  const board = chess.board();
  const pawnFiles: number[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === "p" && piece.color === color) {
        pawnFiles.push(c);
      }
    }
  }

  const fileCounts = new Array(8).fill(0);
  pawnFiles.forEach((f) => fileCounts[f]++);

  let isolated = 0;
  let doubled = 0;
  let chainLength = 0;
  let currentChain = 0;

  for (let f = 0; f < 8; f++) {
    if (fileCounts[f] > 0) {
      if (fileCounts[f] > 1) doubled += fileCounts[f] - 1;
      const hasNeighbor = (f > 0 && fileCounts[f - 1] > 0) || (f < 7 && fileCounts[f + 1] > 0);
      if (!hasNeighbor) isolated += fileCounts[f];
      currentChain++;
    } else {
      chainLength = Math.max(chainLength, currentChain);
      currentChain = 0;
    }
  }
  chainLength = Math.max(chainLength, currentChain);

  // Simple passed pawn detection
  let passed = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === "p" && piece.color === color) {
        let isBlocked = false;
        const dir = color === "w" ? -1 : 1;
        for (let rr = r + dir; rr >= 0 && rr < 8; rr += dir) {
          for (let cc = Math.max(0, c - 1); cc <= Math.min(7, c + 1); cc++) {
            const opp = board[rr][cc];
            if (opp && opp.type === "p" && opp.color !== color) {
              isBlocked = true;
            }
          }
        }
        if (!isBlocked) passed++;
      }
    }
  }

  return { isolated, doubled, passed, chainLength };
}

function getKingSafety(chess: Chess, color: Color): number {
  // Simple king safety: count friendly pawns near the king
  const board = chess.board();
  let kingRow = -1, kingCol = -1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === "k" && piece.color === color) {
        kingRow = r;
        kingCol = c;
      }
    }
  }

  if (kingRow < 0) return 0;

  let safety = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = kingRow + dr;
      const c = kingCol + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const piece = board[r][c];
        if (piece && piece.color === color && piece.type === "p") safety += 2;
        else if (piece && piece.color === color) safety += 1;
      }
    }
  }
  return Math.min(1, safety / 8);
}

function initHeatmaps(): Record<string, number[][]> {
  const pieces = ["p", "n", "b", "r", "q", "k"];
  const heatmaps: Record<string, number[][]> = {};
  for (const p of pieces) {
    heatmaps[p] = Array.from({ length: 8 }, () => new Array(8).fill(0));
  }
  return heatmaps;
}

function squareToCoords(sq: Square): [number, number] {
  const col = sq.charCodeAt(0) - 97;
  const row = 8 - parseInt(sq[1]);
  return [row, col];
}

export function analyzeGameDeep(game: ParsedGame, playerColor?: Color): DeepGameFeatures {
  const chess = new Chess();
  const moveAnalyses: MoveAnalysis[] = [];
  const heatmaps = initHeatmaps();

  // Determine player color (default: white)
  const color: Color = playerColor || "w";

  // Try to load PGN, fall back to move parsing
  let moves: string[] = [];
  try {
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });
    chess.reset();
    moves = history.map((m) => m.san);
  } catch {
    // Fallback: parse moves from text
    moves = game.moves
      .replace(/\d+\.\s*/g, " ")
      .replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, "")
      .trim()
      .split(/\s+/)
      .filter((m) => m.length > 0 && !m.match(/^(1-0|0-1|1\/2-1\/2|\*)$/));
  }

  const materialCurve: number[] = [];
  let castlingPly = -1;
  let castlingSide: "kingside" | "queenside" | "none" = "none";
  let pieceTypesUsed = new Set<string>();
  let totalLegalMoves = 0;
  let pieceMoveCount: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

  // Replay each move
  for (let i = 0; i < moves.length; i++) {
    const ply = i + 1;
    const isPlayerMove = (i % 2 === 0) === (color === "w");

    const materialBefore = countMaterial(chess, color) - countMaterial(chess, color === "w" ? "b" : "w");
    const legalMoveCount = chess.moves().length;
    const centerPieces = countCenterPieces(chess, color);

    try {
      const result = chess.move(moves[i]);
      if (!result) break;

      const materialAfter = countMaterial(chess, color) - countMaterial(chess, color === "w" ? "b" : "w");
      materialCurve.push(materialAfter);

      if (isPlayerMove) {
        totalLegalMoves += legalMoveCount;
        pieceTypesUsed.add(result.piece);
        pieceMoveCount[result.piece]++;

        // Update heatmap
        const [toRow, toCol] = squareToCoords(result.to);
        if (heatmaps[result.piece]) {
          heatmaps[result.piece][toRow][toCol]++;
        }

        // Detect castling
        if ((result.san === "O-O" || result.san === "O-O-O") && castlingPly < 0) {
          castlingPly = ply;
          castlingSide = result.san === "O-O" ? "kingside" : "queenside";
        }

        // Detect sacrifice
        const isSacrifice = result.captured && materialAfter < materialBefore - 0.5;

        moveAnalyses.push({
          move: result.san,
          ply,
          isCapture: !!result.captured,
          isCheck: chess.inCheck(),
          isCastling: result.san.startsWith("O"),
          isSacrifice: !!isSacrifice,
          materialBefore,
          materialAfter,
          materialBalance: materialAfter,
          legalMoveCount,
          centerPieces,
          piece: result.piece,
          from: result.from,
          to: result.to,
          color: result.color,
        });
      }
    } catch {
      break;
    }
  }

  const totalPlayerMoves = moveAnalyses.length;
  if (totalPlayerMoves === 0) {
    return getDefaultFeatures(game);
  }

  // Extract features from move analyses
  const captures = moveAnalyses.filter((m) => m.isCapture).length;
  const checks = moveAnalyses.filter((m) => m.isCheck).length;
  const sacrifices = moveAnalyses.filter((m) => m.isSacrifice).length;

  const captureRatio = captures / totalPlayerMoves;
  const checkRatio = checks / totalPlayerMoves;
  const aggressionIndex = Math.min(1, captureRatio * 2 + checkRatio * 3 + sacrifices * 0.15);

  const avgCenterControl = moveAnalyses.reduce((s, m) => s + m.centerPieces, 0) / totalPlayerMoves;
  const centerControlIndex = Math.min(1, avgCenterControl / 12);

  // Center occupancy - how often pieces are in the center
  const centerOccupancyAvg = centerControlIndex;

  // Space advantage
  const spaceAdvantageAvg = 0.5; // Simplified

  // Castling speed
  const castlingSpeed = castlingPly > 0 ? Math.max(0, 1 - (castlingPly / 2) / 15) : 0;

  // King safety (average across game)
  const kingSafetyAvg = 0.5; // Simplified for now

  // Pawn analysis (from final position)
  const pawnInfo = getPawnStructureInfo(chess, color);

  const pawnMoves = pieceMoveCount["p"];
  const pawnAdvanceIndex = pawnMoves / totalPlayerMoves;

  const pieceVariety = pieceTypesUsed.size / 6;

  const totalMoves = Math.ceil(moves.length / 2);

  const queenMoves = pieceMoveCount["q"];
  const queenActivity = Math.min(1, queenMoves / totalPlayerMoves * 4);
  const knightActivity = Math.min(1, pieceMoveCount["n"] / totalPlayerMoves * 4);
  const bishopActivity = Math.min(1, pieceMoveCount["b"] / totalPlayerMoves * 4);
  const rookActivity = Math.min(1, pieceMoveCount["r"] / totalPlayerMoves * 4);

  // Material analysis
  const avgMaterialBalance = materialCurve.length > 0
    ? materialCurve.reduce((a, b) => a + b, 0) / materialCurve.length
    : 0;
  let materialSwings = 0;
  for (let i = 1; i < materialCurve.length; i++) {
    if (Math.abs(materialCurve[i] - materialCurve[i - 1]) >= 2) materialSwings++;
  }

  // Exchange rate
  const exchangeRate = captureRatio;
  const exchangeInitiation = captures > 0 ? captures / totalPlayerMoves : 0;

  // Opening classification
  const firstMoves = moves.slice(0, 4).join(" ");
  let openingType: DeepGameFeatures["openingType"] = "semi-open";
  if (firstMoves.includes("e4") && firstMoves.includes("e5")) openingType = "open";
  else if (firstMoves.includes("d4") && firstMoves.includes("d5")) openingType = "closed";
  else if (firstMoves.match(/[cfg][34]/)) openingType = "flank";
  else if (firstMoves.includes("e4")) openingType = "semi-open";
  else if (firstMoves.includes("d4")) openingType = "semi-closed";

  const openingECO = game.headers["ECO"] || "A00";
  const openingName = game.headers["Opening"] || classifyOpening(moves.slice(0, 6));

  // Symmetry breaking
  const earlyMoves = moveAnalyses.filter((m) => m.ply <= 10);
  const earlyCaptures = earlyMoves.filter((m) => m.isCapture).length;
  const symmetryBreaking = Math.min(1, earlyCaptures / 3 + (earlyMoves.some((m) => m.piece === "q") ? 0.3 : 0));

  // Move complexity
  const moveComplexity = totalLegalMoves > 0 ? totalLegalMoves / totalPlayerMoves / 35 : 0.5;

  // Gambits
  const earlyPawnCaptures = moveAnalyses.filter((m) => m.ply <= 10 && m.piece === "p" && m.isCapture).length;
  const gambitsPlayed = earlyPawnCaptures > 1 ? 1 : 0;

  // Game length
  const gameLength: DeepGameFeatures["gameLength"] = totalMoves < 25 ? "short" : totalMoves < 45 ? "medium" : "long";

  // Phase analysis
  const openingEnd = Math.min(12, Math.floor(totalPlayerMoves * 0.25));
  const middlegameEnd = Math.min(totalPlayerMoves, Math.floor(totalPlayerMoves * 0.7));

  const phases = {
    opening: extractPhaseFeatures(moveAnalyses.slice(0, openingEnd)),
    middlegame: extractPhaseFeatures(moveAnalyses.slice(openingEnd, middlegameEnd)),
    endgame: extractPhaseFeatures(moveAnalyses.slice(middlegameEnd)),
  };

  // Endgame precision
  const endgameMoves = moveAnalyses.slice(middlegameEnd);
  const endgameCaptures = endgameMoves.filter((m) => m.isCapture).length;
  const endgamePrecision = endgameMoves.length > 0 ? 1 - (endgameCaptures / endgameMoves.length) : 0.5;

  // Clock data
  const clockTimes = game.clockTimes || [];
  const hasClockData = clockTimes.length >= 4;
  const moveTimesWhite: number[] = [];
  const moveTimesBlack: number[] = [];
  if (hasClockData) {
    for (let i = 0; i < clockTimes.length; i++) {
      const timeSpent = i >= 2 ? clockTimes[i - 2] - clockTimes[i] : 0;
      const clamped = Math.max(0, timeSpent);
      if (i % 2 === 0) moveTimesWhite.push(clamped);
      else moveTimesBlack.push(clamped);
    }
  }

  return {
    totalMoves,
    gameLength,
    result: game.result,
    aggressionIndex,
    captureRatio,
    checkRatio,
    sacrificeCount: sacrifices,
    realSacrifices: sacrifices,
    centerControlIndex,
    centerOccupancyAvg,
    spaceAdvantageAvg,
    castlingSpeed,
    castlingSide,
    kingSafetyAvg,
    pawnAdvanceIndex,
    isolatedPawnCount: pawnInfo.isolated,
    doubledPawnCount: pawnInfo.doubled,
    passedPawnCount: pawnInfo.passed,
    pawnChainLength: pawnInfo.chainLength,
    pieceVariety,
    queenActivity,
    knightActivity,
    bishopActivity,
    rookActivity,
    materialBalanceCurve: materialCurve,
    avgMaterialBalance,
    materialSwings,
    exchangeRate,
    exchangeInitiation,
    openingType,
    openingECO,
    openingName,
    symmetryBreaking,
    moveComplexity: Math.min(1, moveComplexity),
    gambitsPlayed,
    phases,
    pieceHeatmaps: heatmaps,
    endgamePrecision,
    clockTimes,
    moveTimesWhite,
    moveTimesBlack,
    hasClockData,
  };
}

function extractPhaseFeatures(moves: MoveAnalysis[]): PhaseFeatures {
  if (moves.length === 0) {
    return { aggressionIndex: 0, captureRatio: 0, centerControl: 0, pieceVariety: 0, moveCount: 0, materialBalance: 0, complexity: 0 };
  }

  const captures = moves.filter((m) => m.isCapture).length;
  const checks = moves.filter((m) => m.isCheck).length;
  const pieces = new Set(moves.map((m) => m.piece));

  return {
    aggressionIndex: Math.min(1, (captures / moves.length) * 2 + (checks / moves.length) * 3),
    captureRatio: captures / moves.length,
    centerControl: moves.reduce((s, m) => s + m.centerPieces, 0) / moves.length / 12,
    pieceVariety: pieces.size / 6,
    moveCount: moves.length,
    materialBalance: moves[moves.length - 1]?.materialBalance || 0,
    complexity: moves.reduce((s, m) => s + m.legalMoveCount, 0) / moves.length / 35,
  };
}

function classifyOpening(moves: string[]): string {
  const joined = moves.join(" ").toLowerCase();
  if (joined.includes("e4 e5 nf3 nc6 bb5")) return "Ruy Lopez";
  if (joined.includes("e4 e5 nf3 nc6 bc4")) return "Italian Game";
  if (joined.includes("e4 c5")) return "Sicilian Defense";
  if (joined.includes("e4 e5 f4")) return "King's Gambit";
  if (joined.includes("e4 e6")) return "French Defense";
  if (joined.includes("e4 c6")) return "Caro-Kann";
  if (joined.includes("e4 d5")) return "Scandinavian";
  if (joined.includes("d4 d5 c4")) return "Queen's Gambit";
  if (joined.includes("d4 nf6 c4 g6")) return "King's Indian";
  if (joined.includes("d4 nf6 c4 e6")) return "Nimzo/Queen's Indian";
  if (joined.includes("d4 d5")) return "Queen's Pawn";
  if (joined.includes("c4")) return "English Opening";
  if (joined.includes("nf3")) return "Réti Opening";
  if (joined.includes("e4 e5")) return "Open Game";
  if (joined.includes("d4")) return "Queen's Pawn Game";
  return "Unknown Opening";
}

function getDefaultFeatures(game: ParsedGame): DeepGameFeatures {
  return {
    totalMoves: game.moveCount,
    gameLength: game.moveCount < 25 ? "short" : game.moveCount < 45 ? "medium" : "long",
    result: game.result,
    aggressionIndex: 0.5,
    captureRatio: 0.15,
    checkRatio: 0.03,
    sacrificeCount: 0,
    realSacrifices: 0,
    centerControlIndex: 0.5,
    centerOccupancyAvg: 0.5,
    spaceAdvantageAvg: 0.5,
    castlingSpeed: 0.5,
    castlingSide: "none",
    kingSafetyAvg: 0.5,
    pawnAdvanceIndex: 0.3,
    isolatedPawnCount: 0,
    doubledPawnCount: 0,
    passedPawnCount: 0,
    pawnChainLength: 3,
    pieceVariety: 0.7,
    queenActivity: 0.3,
    knightActivity: 0.3,
    bishopActivity: 0.3,
    rookActivity: 0.2,
    materialBalanceCurve: [],
    avgMaterialBalance: 0,
    materialSwings: 0,
    exchangeRate: 0.15,
    exchangeInitiation: 0.1,
    openingType: "semi-open",
    openingECO: game.headers["ECO"] || "A00",
    openingName: "Unknown",
    symmetryBreaking: 0.3,
    moveComplexity: 0.5,
    gambitsPlayed: 0,
    phases: {
      opening: { aggressionIndex: 0.3, captureRatio: 0.1, centerControl: 0.5, pieceVariety: 0.5, moveCount: 0, materialBalance: 0, complexity: 0.5 },
      middlegame: { aggressionIndex: 0.5, captureRatio: 0.2, centerControl: 0.5, pieceVariety: 0.7, moveCount: 0, materialBalance: 0, complexity: 0.5 },
      endgame: { aggressionIndex: 0.3, captureRatio: 0.15, centerControl: 0.4, pieceVariety: 0.3, moveCount: 0, materialBalance: 0, complexity: 0.4 },
    },
    pieceHeatmaps: initHeatmaps(),
    endgamePrecision: 0.5,
    clockTimes: [],
    moveTimesWhite: [],
    moveTimesBlack: [],
    hasClockData: false,
  };
}
