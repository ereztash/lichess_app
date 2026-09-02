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
 * FIVE RUNS, because "reproducible" is several different questions, and because the answer to one
 * of them changed the product.
 *
 *   A  the reading, with the transposition table cleared before every position -- which is what
 *      `StockfishClient` does now, on every search path.
 *   B  the identical corpus again, in a second engine process. Does the harness repeat itself?
 *   C  the same games in REVERSE ORDER, still cleared. Must match A, or the reading is not a
 *      reading.
 *   D, E  the HISTORICAL CONTROL: the same forward and reversed pair with the table left warm, as
 *      the product once left it. `StockfishClient.analyze` used to send no `ucinewgame`, so a
 *      game's evaluations were computed against a table warmed by whatever came before, and this
 *      harness measured a player's accuracy moving by up to 14.3 percentage points on game order
 *      alone. The fix shipped. The control stays, because a fix whose evidence has been deleted is
 *      a fix nobody can check.
 *
 * A AND D USED TO BE THE OTHER WAY ROUND, and that was a defect of exactly the kind this file
 * exists to find: the fix landed in `StockfishClient`, the uncleared runs stopped describing the
 * product that day, and this harness went on publishing them as the reading. Its manifest even
 * recorded `clearHashBetweenPositions: false` as a fact about the product while the product was
 * clearing on every search.
 *
 * Run: npx tsx scripts/run_import_harness.ts [--engine PATH] [--data DIR]
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

/**
 * What the engine called itself, rather than what the file was called.
 *
 * `binary.split("/").pop()` is fine while the binary IS the engine and worthless the moment it is
 * a wrapper: the first canonical run against the shipped WebAssembly build recorded `sf-wasm.sh`,
 * which names a shell script. The engine says its own name during the handshake.
 */
let engineName = "unknown";

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
 * `clearHash` is TRUE for the product and false for the historical control, and those roles were
 * swapped at some point after the fix shipped. `StockfishClient` now posts `ucinewgame` on every
 * search path, so true is what an import actually does. False is kept as the counterfactual that
 * identifies the cause: if order dependence had survived clearing, the table was not what produced
 * it.
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
  unreadable: number;
}> {
  const engine = await UciEngine.spawn(binary, { Threads: 1, Hash: 16 });
  engineName = engine.name;
  const started = Date.now();
  try {
    const result = await runImportDiagnostic(games, username, analyzerFor(engine, clearHash));
    /*
     * The evidence, from the SAME inputs the diagnostic was computed over. Calling the product's
     * own `decisionsFromGame` rather than re-deriving anything is what makes this a dump of the
     * run instead of a second opinion about it.
     */
    /*
     * LABELLED BY `keptGameIndexes`, NOT BY POSITION, and this used to be by position.
     *
     * `inputs` holds one entry per READABLE game -- `prepare` returns null for a PGN chess.js will
     * not replay -- so pairing it with `games` by index mislabels every row after the first dropped
     * game. Found on a different corpus, where it attributed 463 decisions to 20 games that had
     * produced no positions at all. The diagnostic was never wrong, because it reads `inputs` and
     * never looks at a game id; the EVIDENCE was, and evidence that cannot be traced to the game it
     * came from is what this harness exists to produce.
     *
     * Whether it ever bit the canonical record cannot be read off `harness_report.json`, because
     * that manifest did not record how many games were dropped. It does now.
     */
    const rows = result.inputs.flatMap((input, position) =>
      decisionsFromGame(input, result.isBook).map((d) => ({
        gameIndex: result.keptGameIndexes[position]!,
        gameId: games[result.keptGameIndexes[position]!]?.id ?? null,
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
      unreadable: result.unreadable,
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
    /*
     * THE CANONICAL RUN CLEARS THE HASH, because the product does.
     *
     * It did not always. `StockfishClient.analyze` sent no `ucinewgame`, this harness measured
     * that, and a player's accuracy turned out to depend on the order their games arrived in by up
     * to 14.3 percentage points. The fix landed: the client now posts `ucinewgame` on EVERY search
     * path. So the uncleared runs stopped describing the product on the day that shipped, and this
     * file went on treating them as the reading for a while afterwards -- which is the same class
     * of defect it was written to find.
     *
     * `a` and `b` are the product, twice, in two processes. `c` is the product with the games
     * reversed. `d` and `e` are the HISTORICAL control: the old uncleared behaviour, kept because
     * it is what establishes that the transposition table was the cause, and a fix whose evidence
     * has been deleted is a fix nobody can check.
     */
    const a = await runOnce(player.games, player.username, binary, true);
    const b = await runOnce(player.games, player.username, binary, true);
    const c = await runOnce(reversed, player.username, binary, true);
    /* The historical control: the same two orders, with the table left warm as it once was. */
    const d = await runOnce(player.games, player.username, binary);
    const e = await runOnce(reversed, player.username, binary);

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
      /* Games whose PGN produced no positions. Zero is the answer this record needs on file. */
      unreadableGames: a.unreadable,
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
      /* The product's own configuration, so this one must hold or the reading is not a reading. */
      orderIndependent: fa === fc,
      /* The historical control: without clearing, this is the pair that came apart. */
      orderIndependentWithWarmHash: fd === fe,
      /* How far the two orders' accuracy rates moved, per bucket, in percentage points. */
      /*
       * What clearing costs, measured rather than assumed -- the same discipline the MultiPV note
       * in stockfish.ts asks for. Both numbers are one run each on one machine, so the ratio is
       * the figure to read, not the seconds.
       */
      warmMs: d.elapsedMs,
      clearedMs: a.elapsedMs,
      clearedCostRatio: a.elapsedMs / d.elapsedMs,
      /*
       * The order effect is a fact about the WARM pair, which is where it exists. Measured on the
       * cleared pair it is zero by construction, and reporting that as "the order effect" would
       * turn the fix into evidence that there had never been anything to fix.
       */
      largestBucketShiftPp: Math.max(
        0,
        ...fingerprint(d.diagnostic).buckets.map((bucket, i) => {
          const other = fingerprint(e.diagnostic).buckets[i];
          return bucket.accurateRate !== null && other?.accurateRate != null
            ? Math.abs(bucket.accurateRate - other.accurateRate) * 100
            : 0;
        }),
      ),
      /* Where order changed something, name the field rather than only the verdict. */
      orderDifferences:
        fd === fe
          ? []
          : fingerprint(d.diagnostic).buckets.flatMap((bucket, i) => {
              const other = fingerprint(e.diagnostic).buckets[i];
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
    engine: engineName,
    engineInvokedAs: binary.split("/").pop(),
    engineOptions: { Threads: 1, Hash: 16, clearHashBetweenPositions: true },
    importDepth: IMPORT_DEPTH,
    corpus: corpus.provenance,
    players: report.length,
    decisions: allRows.length,
    reproducibility: {
      repeats: report.every((r) => r.repeats),
      repeatsPerDecision: report.every((r) => r.repeatsPerDecision),
      orderIndependent: report.every((r) => r.orderIndependent),
      orderIndependentWithWarmHash: report.every((r) => r.orderIndependentWithWarmHash),
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
