/**
 * The engine the product SHIPS, over the corpus the record was measured on.
 *
 * WHY THIS EXISTS. Every number this repository quotes about real games came from
 * `run_import_harness.ts`, and `research/harness/harness_report.json` records what produced them:
 * `stockfish-ubuntu-x86-64-avx2`, a native full-strength Stockfish. The product ships
 * `stockfish-18-lite-single.wasm` -- a different build with a smaller net, compiled to
 * WebAssembly. Nobody had checked whether the two agree, so the record did not say which
 * instrument it described.
 *
 * ONE VARIABLE. Same corpus, same `runImportDiagnostic`, same depth 12, same `Threads 1` and
 * `Hash 16`, same `clearHashBetweenPositions: false`. The hash setting matches the BASELINE rather
 * than today's product on purpose: the product clears now, and that change was measured when it
 * was made (`largestBucketShiftPp` 7.0, `clearedCostRatio` 1.41). Folding it in here would
 * confound two known effects and let either be blamed for the result.
 *
 * NOT A SECOND PIPELINE, for the same reason the harness is not one: it calls the product's own
 * `runImportDiagnostic` and its own `decisionsFromGame`, so every row is the row the product used.
 *
 * The thresholds and the outcome rule are in `docs/research/ENGINE_PARITY_PREREG.md`, committed
 * before this script was run. This file computes; it does not decide.
 *
 * Run: npx tsx scripts/run_engine_parity.ts --engine <uci-binary> [--out research/harness]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { runImportDiagnostic, type AnalysableGame } from "../client/src/lib/import-run.js";
import { decisionsFromGame } from "../shared/import-diagnostic.js";
import type { EngineLine } from "../client/src/lib/engine-line.js";
import { UciEngine } from "./uci-engine.js";

/** The depth `analyzePositions` defaults to, which is what a real import searches at. */
const IMPORT_DEPTH = 12;

interface Corpus {
  players: Array<{ playerId: string; username: string; games: AnalysableGame[] }>;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/** Shaped exactly like the analyzer the app injects, so the product cannot tell the difference. */
function analyzerFor(engine: UciEngine) {
  return async (fen: string, depth: number): Promise<EngineLine> => {
    const result = await engine.searchDepth(fen, depth, false);
    const line = result.lines[0];
    return line ?? { scoreCp: 0, depth: 0, pv: [], fen };
  };
}

interface Row {
  playerId: string;
  gameIndex: number;
  gameId: string | null;
  ply: number;
  phase: string;
  secondsTaken: number | null;
  clockMsRemaining: number | null;
  cpLoss: number;
  accurate: boolean;
  standing: string;
  forced: boolean;
  book: boolean;
  speed: string | null;
}

async function main() {
  const binary = arg("engine", "stockfish");
  const dataDir = arg("out", "research/harness");
  const corpusPath = `${dataDir}/corpus.json`;
  if (!existsSync(corpusPath))
    throw new Error(`no corpus at ${corpusPath} -- run scripts/build_import_corpus.ts first`);
  const corpus: Corpus = JSON.parse(readFileSync(corpusPath, "utf8"));

  const rows: Row[] = [];
  const readings: Array<{ playerId: string; reading: unknown }> = [];
  const started = Date.now();

  for (const player of corpus.players) {
    process.stderr.write(`${player.playerId}: ${player.games.length} games ... `);
    const at = Date.now();
    const engine = await UciEngine.spawn(binary, { Threads: 1, Hash: 16 });
    try {
      const result = await runImportDiagnostic(player.games, player.username, analyzerFor(engine));
      for (const [gameIndex, input] of result.inputs.entries()) {
        for (const d of decisionsFromGame(input, result.isBook)) {
          rows.push({
            playerId: player.playerId,
            gameIndex,
            gameId: player.games[gameIndex]?.id ?? null,
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
          });
        }
      }
      readings.push({
        playerId: player.playerId,
        reading: {
          scored: result.diagnostic.scored,
          forced: result.diagnostic.forced,
          book: result.diagnostic.book,
          eligible: result.diagnostic.eligible,
          buckets: result.diagnostic.buckets.map((b) => ({
            key: b.key,
            n: b.n,
            accurateRate: b.accurateRate,
            measurable: b.measurable,
            unmeasurableReason: b.unmeasurableReason,
          })),
        },
      });
    } finally {
      engine.quit();
    }
    process.stderr.write(`${Math.round((Date.now() - at) / 1000)}s\n`);
  }

  const evidence = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(`${dataDir}/decision_evidence_shipped.jsonl`, evidence);
  writeFileSync(
    `${dataDir}/parity_report.json`,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        engine: binary,
        engineName: "stockfish-18-lite-single (the build the product ships)",
        engineOptions: { Threads: 1, Hash: 16, clearHashBetweenPositions: false },
        importDepth: IMPORT_DEPTH,
        decisions: rows.length,
        elapsedMs: Date.now() - started,
        perPlayer: readings,
        evidenceSha256: createHash("sha256").update(evidence).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  process.stderr.write(`\n${rows.length} decisions -> ${dataDir}/decision_evidence_shipped.jsonl\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
