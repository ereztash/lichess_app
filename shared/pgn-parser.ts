/**
 * PGN -> games, with clock and evaluation annotations pulled out.
 *
 * Ported from chess-mind-patterns (src/lib/pgn-parser.ts @2c7ced2) as phase 1 of merging the two
 * repositories. Unchanged in behaviour; moved to shared/ so client, server and tests all read one
 * copy.
 *
 * `evalScores` here are the ones Lichess wrote into the PGN. A game Lichess never analysed has
 * none, which is what made half of that dashboard go dark. shared/eval-analysis.ts does not care
 * where the numbers came from, so the engine can supply them instead -- see
 * client/src/lib/batch-analysis.ts.
 */
export interface ParsedGame {
  id: number;
  pgn: string;
  headers: Record<string, string>;
  white: string;
  black: string;
  date: string;
  event: string;
  result: string;
  moves: string;
  moveCount: number;
  /** Clock times in seconds for each half-move (ply), extracted from %clk annotations */
  clockTimes: number[];
  /** Engine evaluation per half-move (ply), extracted from %eval annotations. Mate scores stored as ±10000. */
  evalScores: number[];
}

export function parsePGN(pgnText: string): ParsedGame[] {
  const games: ParsedGame[] = [];
  const rawGames = splitPGNIntoGames(pgnText);

  rawGames.forEach((raw, index) => {
    const headers = parseHeaders(raw);
    const clockTimes = extractClockTimes(raw);
    const evalScores = extractEvalScores(raw);
    const moves = extractMoves(raw);
    const moveCount = countMoves(moves);

    if (moves.trim().length > 0 || Object.keys(headers).length > 0) {
      games.push({
        id: index,
        pgn: raw.trim(),
        headers,
        white: headers["White"] || "Unknown",
        black: headers["Black"] || "Unknown",
        date: headers["Date"] || "Unknown",
        event: headers["Event"] || "Unknown",
        result: headers["Result"] || "*",
        moves,
        moveCount,
        clockTimes,
        evalScores,
      });
    }
  });

  return games;
}

function splitPGNIntoGames(pgn: string): string[] {
  const games: string[] = [];
  const lines = pgn.split("\n");
  let currentGame = "";
  let inMoveSection = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect transition: we were in move section and now see a header tag
    if (trimmed.startsWith("[") && inMoveSection) {
      // This is a new game starting
      if (currentGame.trim().length > 0) {
        games.push(currentGame);
      }
      currentGame = "";
      inMoveSection = false;
    }

    // Track if we've entered the moves section (non-empty, non-header line)
    if (trimmed.length > 0 && !trimmed.startsWith("[")) {
      inMoveSection = true;
    }

    currentGame += lines[i] + "\n";
  }

  if (currentGame.trim().length > 0) {
    games.push(currentGame);
  }

  return games;
}

function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;

  while ((match = headerRegex.exec(pgn)) !== null) {
    headers[match[1]] = match[2];
  }

  return headers;
}

function extractMoves(pgn: string): string {
  // Remove headers
  const withoutHeaders = pgn.replace(/\[.*?\]\s*/g, "").trim();
  // Remove nested comments recursively (handles {..{..}..})
  let result = withoutHeaders;
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(/\{[^{}]*\}/g, "");
  }
  // Remove nested variations recursively
  prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(/\([^()]*\)/g, "");
  }
  // Clean up
  return result.replace(/\s+/g, " ").trim();
}

function countMoves(movesStr: string): number {
  const matches = movesStr.match(/\d+\./g);
  return matches ? matches.length : 0;
}

/** Extract %clk annotations from PGN comments before they are stripped.
 *  Returns an array of remaining-time-in-seconds for each half-move (ply). */
function extractClockTimes(pgn: string): number[] {
  const times: number[] = [];
  // Match {[%clk H:MM:SS]} or {[%clk M:SS]} patterns
  const regex = /\{\[%clk\s+(\d+):(\d+):(\d+)\]\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pgn)) !== null) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    times.push(hours * 3600 + minutes * 60 + seconds);
  }
  return times;
}

/** Extract %eval annotations from PGN comments.
 *  Returns centipawn evaluations per ply. Mate scores encoded as ±10000. */
function extractEvalScores(pgn: string): number[] {
  const scores: number[] = [];
  // Match {[%eval 0.25]} or {[%eval #3]} or {[%eval #-2]} patterns
  const regex = /\[%eval\s+(#?-?\d+\.?\d*)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pgn)) !== null) {
    const raw = match[1];
    if (raw.startsWith("#")) {
      // Mate score: positive = white mates, negative = black mates
      const mateIn = parseInt(raw.slice(1), 10);
      scores.push(mateIn > 0 ? 10000 : -10000);
    } else {
      // Centipawn (stored as pawns in Lichess, convert to centipawns)
      scores.push(Math.round(parseFloat(raw) * 100));
    }
  }
  return scores;
}

// Sample PGN games for demo
export const SAMPLE_AGGRESSIVE = `[Event "Immortal Game"]
[Site "London"]
[Date "1851.06.21"]
[White "Anderssen, Adolf"]
[Black "Kieseritzky, Lionel"]
[Result "1-0"]
[ECO "C33"]

1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7# 1-0`;

export const SAMPLE_POSITIONAL = `[Event "World Championship"]
[Site "Moscow"]
[Date "1985.09.03"]
[White "Karpov, Anatoly"]
[Black "Kasparov, Garry"]
[Result "0-1"]
[ECO "B44"]

1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nb5 d6 6.c4 Nf6 7.N1c3 a6 8.Na3 d5 9.cxd5 exd5 10.exd5 Nb4 11.Be2 Bc5 12.O-O O-O 13.Bf3 Bf5 14.Bg5 Re8 15.Qd2 b5 16.Rad1 Nd3 17.Nab1 h6 18.Bh4 b4 19.Na4 Bd6 20.Bg3 Rc8 21.b3 g5 22.Bxd6 Qxd6 23.g3 Nd7 24.Bg2 Qf6 25.a3 a5 26.axb4 axb4 27.Qa2 Bg6 28.d6 g4 29.Qd2 Kg7 30.f3 Qxd6 31.fxg4 Qd4+ 32.Kh1 Nf6 33.Rf4 Ne4 34.Qxd3 Nf2+ 35.Rxf2 Bxd3 36.Rfd2 Qe3 37.Rxd3 Rc1 38.Nb2 Qf2 39.Nd2 Rxd1+ 40.Nxd1 Re1+ 0-1`;

export const SAMPLE_SET = [
  SAMPLE_AGGRESSIVE,
  SAMPLE_POSITIONAL,
  `[Event "Casual Game"]
[Site "Berlin"]
[Date "1852.01.01"]
[White "Anderssen, Adolf"]
[Black "Dufresne, Jean"]
[Result "1-0"]
[ECO "C52"]

1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7# 1-0`,
  `[Event "Training Game"]
[Site "Online"]
[Date "2023.05.15"]
[White "Player1"]
[Black "Player2"]
[Result "1/2-1/2"]
[ECO "D35"]

1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5 exd5 5.Bg5 Be7 6.e3 O-O 7.Bd3 Nbd7 8.Nf3 Re8 9.Qc2 c6 10.O-O Nf8 11.Rab1 Ng6 12.b4 a6 13.a4 Bd6 14.b5 axb5 15.axb5 Bc7 16.bxc6 bxc6 17.Rb7 Bd6 18.Ne5 Bxe5 19.dxe5 Rxe5 20.Bxf6 Qxf6 21.Bxg6 hxg6 22.Qxc6 Be6 23.Nd1 Rc8 24.Qb5 Rc2 1/2-1/2`,
  `[Event "Blitz Game"]
[Site "Online"]
[Date "2023.06.20"]
[White "Player2"]
[Black "Player1"]
[Result "0-1"]
[ECO "B01"]

1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 Bf5 6.Bc4 e6 7.Bd2 Bb4 8.a3 Bxc3 9.Bxc3 Qb6 10.Qe2 Nc6 11.O-O-O O-O-O 12.d5 exd5 13.Bxd5 Nxd5 14.Rxd5 Rxd5 15.Bxa5 Nxa5 16.Qe7 Rd7 17.Qe5 f6 18.Qb5 b6 19.Re1 Nc6 20.Nd4 Nxd4 21.Qd3 Nc6 22.Qc3 Rhd8 23.h3 Rd1+ 24.Rxd1 Rxd1+ 25.Ka2 Rd2 0-1`,
].join("\n\n");
