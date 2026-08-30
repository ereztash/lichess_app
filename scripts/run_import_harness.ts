/**
 * The product's own import path, run on real games, with every intermediate kept.
 *
 * WHAT WAS NEVER TESTED, in the repository's own words: "Every part of the path is tested with
 * synthetic games and a stub engine -- PGN clock extraction, colour matching, batch scoring,
 * bucketing, the screen. No real username has been searched, no real PGN scored." So the logic was
 * covered and the RUN was not, and a product whose central claim is measurement had never had its
 * measurement layer meet a real distribution.
 *
 * This is not a second pipeline. It calls `runImportDiagnostic` -- the same function the import
 * screen calls -- with a real engine in place of the stub, and then calls `decisionsFromGame` on
 * the inputs that run built, so every dumped row is the row the product used rather than a
 * re-derivation that could disagree with it.
 *
 * THREE RUNS, because "reproducible" is three different questions:
 *   A  the reading.
 *   B  the identical corpus again, in a second engine process -- does the harness repeat itself?
 *   C  the same games in REVERSE ORDER. The product does not clear the transposition table between
 *      positions (`StockfishClient.analyze` sends no `ucinewgame`), so a game's evaluations are
 *      computed against a table warmed by whatever came before. If C differs from A, a player's
 *      reading depends on the order their games came back in, which is a property of the product
 *      and not of their chess.
 *
 * Run: npx tsx scripts/run_import_harness.ts [--engine PATH] [--players N] [--games N]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { runImportDiagnostic, type AnalysableGame } from "../client/src/lib/import-run.js";
import {
  decisionsFromGame,
  diagnoseImportedGames,
  type ImportDiagnostic,
} from "../shared/import-diagnostic.js";
import { NO_BOOK } from "../shared/opening-book.js";
import type { EngineLine } from "../client/src/lib/engine-line.js";
import { UciEngine } from "./uci-engine.js";

/** The depth `analyzePositions` defaults to, which is what a real import searches at. */
const IMPORT_DEPTH = 12;

interface Corpus {
  players: Array<{ playerId: string; username: string; games: AnalysableGame[] }>;
  provenance: Record<string, unknown>;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/**
 * An `analyze` with a real engine behind it, shaped exactly like the one the app injects.
 *
 * `clearHash` is the CONTROL, not a setting. False mirrors the product: `StockfishClient.analyze`
 * sends no `ucinewgame`, so every position in an import is searched against a transposition table
 * warmed by the positions before it. True is the counterfactual that identifies the cause -- if
 * order dependence survives clearing, the table is not what produced it.
 */
function analyzerFor(engine: UciEngine, clearHash: boolean) {
  return async (fen: string, depth: number): Promise<EngineLine> => {
    const result = await engine.searchDepth(fen, depth, clearHash);
    const line = result.lines[0];
    return line ?? { scoreCp: 0, depth: 0, pv: [], fen };
  };
}

/** Everything a run produced, in a form two runs can be compared field by field. */
function fingerprint(diagnostic: ImportDiagnostic) {
  return {
    scored: diagnostic.scored,
    forced: diagnostic.forced,
    book: diagnostic.book,
    bookLoaded: diagnostic.bookLoaded,
    eligible: diagnostic.eligible,
    withoutTime: diagnostic.withoutTime,
    withoutClock: diagnostic.withoutClock,
    timeBucketSpeed: diagnostic.timeBucketSpeed,
    excludedForSpeed: diagnostic.excludedForSpeed,
    buckets: diagnostic.buckets.map((b) => ({
      key: b.key,
      n: b.n,
      accurateRate: b.accurateRate,
      measurable: b.measurable,
      unmeasurableReason: b.unmeasurableReason,
    })),
  };
}

async function runOnce(
  games: AnalysableGame[],
  username: string,
  binary: string,
  clearHash = false,
): Promise<{
  diagnostic: ImportDiagnostic;
  withoutBook: ImportDiagnostic;
  rows: unknown[];
  elapsedMs: number;
}> {
  const engine = await UciEngine.spawn(binary, { Threads: 1, Hash: 16 });
  const started = Date.now();
  try {
    const result = await runImportDiagnostic(games, username, analyzerFor(engine, clearHash));
    /*
     * The evidence, from the SAME inputs the diagnostic was computed over. Calling the product's
     * own `decisionsFromGame` rather than re-deriving anything is what makes this a dump of the
     * run instead of a second opinion about it.
     */
    const rows = result.inputs.flatMap((input, gameIndex) =>
      decisionsFromGame(input, result.isBook).map((d) => ({
        gameIndex,
        gameId: games[gameIndex]?.id ?? null,
        ply: d.ply,
        phase: d.phase,
        secondsTaken: d.secondsTaken,
        clockMsRemaining: d.clockMsRemaining,
        cpLoss: d.cpLoss,
        accurate: d.accurate,
        standing: d.standing,
        forced: d.forced,
        book: d.book,
        speed: d.speed,
      })),
    );
    /*
     * The same inputs read twice, once with the book and once without. No extra engine work: the
     * evaluations are identical and only the denominator differs, which is exactly the comparison
     * "what does excluding book cost and buy" needs.
     */
    return {
      diagnostic: result.diagnostic,
      withoutBook: diagnoseImportedGames(result.inputs, NO_BOOK),
      rows,
      elapsedMs: Date.now() - started,
    };
  } finally {
    engine.quit();
  }
}

async function main() {
  const binary = arg("engine", "stockfish");
  const dataDir = arg("data", "research/harness");
  const corpusPath = `${dataDir}/corpus.json`;
  if (!existsSync(corpusPath))
    throw new Error(`no corpus at ${corpusPath} -- run scripts/build_import_corpus.ts first`);
  const corpus: Corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
  mkdirSync(dataDir, { recursive: true });

  const report: Record<string, unknown>[] = [];
  const allRows: unknown[] = [];

  for (const player of corpus.players) {
    process.stderr.write(`${player.playerId}: ${player.games.length} games\n`);
    const reversed = [...player.games].reverse();
    const a = await runOnce(player.games, player.username, binary);
    const b = await runOnce(player.games, player.username, binary);
    const c = await runOnce(reversed, player.username, binary);
    /* The control: the same two orders, with the table cleared before every position. */
    const d = await runOnce(player.games, player.username, binary, true);
    const e = await runOnce(reversed, player.username, binary, true);

    const fa = JSON.stringify(fingerprint(a.diagnostic));
    const fb = JSON.stringify(fingerprint(b.diagnostic));
    const fc = JSON.stringify(fingerprint(c.diagnostic));
    const fd = JSON.stringify(fingerprint(d.diagnostic));
    const fe = JSON.stringify(fingerprint(e.diagnostic));
    const rowsA = JSON.stringify(a.rows);
    const rowsB = JSON.stringify(b.rows);

    report.push({
      playerId: player.playerId,
      games: player.games.length,
      reading: fingerprint(a.diagnostic),
      readingWithoutBook: fingerprint(a.withoutBook),
      /* What the book changed, per bucket, in percentage points of accuracy. */
      bookEffectPp: fingerprint(a.diagnostic).buckets.flatMap((bucket, i) => {
        const before = fingerprint(a.withoutBook).buckets[i];
        return bucket.accurateRate !== null && before?.accurateRate != null
          ? [
              {
                key: bucket.key,
                nBefore: before.n,
                nAfter: bucket.n,
                rateBefore: before.accurateRate,
                rateAfter: bucket.accurateRate,
                deltaPp: (bucket.accurateRate - before.accurateRate) * 100,
              },
            ]
          : [];
      }),
      repeats: fa === fb,
      repeatsPerDecision: rowsA === rowsB,
      orderIndependent: fa === fc,
      /* Same question, with the transposition table cleared between positions. */
      orderIndependentWithClearedHash: fd === fe,
      /* How far the two orders' accuracy rates moved, per bucket, in percentage points. */
      /*
       * What clearing costs, measured rather than assumed -- the same discipline the MultiPV note
       * in stockfish.ts asks for. Both numbers are one run each on one machine, so the ratio is
       * the figure to read, not the seconds.
       */
      warmMs: a.elapsedMs,
      clearedMs: d.elapsedMs,
      clearedCostRatio: d.elapsedMs / a.elapsedMs,
      largestBucketShiftPp: Math.max(
        0,
        ...fingerprint(a.diagnostic).buckets.map((bucket, i) => {
          const other = fingerprint(c.diagnostic).buckets[i];
          return bucket.accurateRate !== null && other?.accurateRate != null
            ? Math.abs(bucket.accurateRate - other.accurateRate) * 100
            : 0;
        }),
      ),
      /* Where order changed something, name the field rather than only the verdict. */
      orderDifferences:
        fa === fc
          ? []
          : fingerprint(a.diagnostic).buckets.flatMap((bucket, i) => {
              const other = fingerprint(c.diagnostic).buckets[i];
              return bucket.n !== other.n || bucket.accurateRate !== other.accurateRate
                ? [{ key: bucket.key, forward: bucket, reversed: other }]
                : [];
            }),
    });
    allRows.push(...a.rows.map((r) => ({ playerId: player.playerId, ...(r as object) })));
  }

  const evidence = allRows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(`${dataDir}/decision_evidence.jsonl`, evidence);
  const manifest = {
    generatedAt: new Date().toISOString(),
    engine: binary.split("/").pop(),
    engineOptions: { Threads: 1, Hash: 16, clearHashBetweenPositions: false },
    importDepth: IMPORT_DEPTH,
    corpus: corpus.provenance,
    players: report.length,
    decisions: allRows.length,
    reproducibility: {
      repeats: report.every((r) => r.repeats),
      repeatsPerDecision: report.every((r) => r.repeatsPerDecision),
      orderIndependent: report.every((r) => r.orderIndependent),
      orderIndependentWithClearedHash: report.every((r) => r.orderIndependentWithClearedHash),
      largestBucketShiftPp: Math.max(...report.map((r) => Number(r.largestBucketShiftPp))),
      /*
       * What clearing costs, measured rather than assumed -- the same discipline the MultiPV note
       * in stockfish.ts asks for. One run each on one machine, so the RATIO is the figure to read
       * and the seconds are not a benchmark.
       */
      clearedCostRatio:
        report.reduce((sum, r) => sum + Number(r.clearedMs), 0) /
        report.reduce((sum, r) => sum + Number(r.warmMs), 0),
    },
    perPlayer: report,
    evidenceSha256: createHash("sha256").update(evidence).digest("hex"),
  };
  writeFileSync(`${dataDir}/harness_report.json`, JSON.stringify(manifest, null, 2));
  process.stdout.write(`${JSON.stringify(manifest.reproducibility, null, 2)}\n`);
  process.stderr.write(`wrote ${allRows.length} decisions from ${report.length} players\n`);
}

if (process.argv[1]?.endsWith("run_import_harness.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
