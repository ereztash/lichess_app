/**
 * The import path, run on one real account, with the PRE-REGISTRATION BRIDGE on the end of it.
 *
 * `run_import_harness.ts` answers "does the reading reproduce" and stops at the reading.
 * `shared/prereg.ts` answers the question after that one -- may this reading name a bucket for the
 * live loop to search, or must it refuse -- and until now nothing had ever run the two together
 * against a named living account. Both halves exist. This is the join, and it is the study
 * described in `docs/research/ACCOUNT_BRIDGE_PREREG.md`.
 *
 * THE BRIDGE IS CALLED, NOT REIMPLEMENTED. `hypothesisFromImport`, `importProgress` and
 * `resolutionFactor` are imported from the modules the product screen imports them from. A harness
 * that recomputed a separability bar would be measuring its own copy of the rule, and the outcome
 * that matters here is precisely what the shipped predicate does with real numbers.
 *
 * THREE RUNS, and each one is load-bearing:
 *
 *   A  the reading, hash cleared before every position, which is what `StockfishClient` does.
 *   B  the identical corpus in a second engine process. A reading that does not repeat is not a
 *      reading, and the bridge would be registering a bucket chosen by the transposition table.
 *   C  the same games in REVERSE ORDER. Must match A. `run_import_harness.ts` records that this
 *      pair once came apart by 14.3 percentage points on game order alone, before the client began
 *      sending `ucinewgame`.
 *
 * THE OUTCOME IS WHATEVER IT IS. Four of the bridge's five answers are refusals, and §7 of the
 * preregistration counts every one of them as a result. Nothing here retries, widens the window, or
 * relaxes a bar to reach `registered`.
 *
 * Run: npx tsx scripts/run_account_prereg.ts [--engine PATH] [--data DIR]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runImportDiagnostic, type AnalysableGame } from "../client/src/lib/import-run.js";
import {
  decisionsFromGame,
  resolutionFactor,
  worstBucketVerdict,
  type ImportDiagnostic,
} from "../shared/import-diagnostic.js";
import { hypothesisFromImport, importProgress } from "../shared/prereg.js";
import type { EngineLine } from "../client/src/lib/engine-line.js";
import { UciEngine } from "./uci-engine.js";

/** The depth `analyzePositions` defaults to, which is what a real import searches at. */
const IMPORT_DEPTH = 12;

/**
 * No live decisions exist for this account, so every decision it ever records is one recorded
 * AFTER registration. Zero here is a fact about the account and not a convenience: the field is the
 * whole reason the word "pre-registered" is true rather than decorative, and a run against an
 * account that already had a record would have to read the real count.
 */
const DECISIONS_BEFORE = 0;

interface Corpus {
  players: Array<{ playerId: string; username: string; games: AnalysableGame[] }>;
  provenance: Record<string, unknown>;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

let engineName = "unknown";

function analyzerFor(engine: UciEngine, clearHash: boolean) {
  return async (fen: string, depth: number): Promise<EngineLine> => {
    const result = await engine.searchDepth(fen, depth, clearHash);
    return result.lines[0] ?? { scoreCp: 0, depth: 0, pv: [], fen };
  };
}

/** Everything a run produced, in a form two runs can be compared field by field. */
function fingerprint(diagnostic: ImportDiagnostic) {
  return {
    scored: diagnostic.scored,
    forced: diagnostic.forced,
    book: diagnostic.book,
    eligible: diagnostic.eligible,
    withoutTime: diagnostic.withoutTime,
    withoutClock: diagnostic.withoutClock,
    timeBucketSpeed: diagnostic.timeBucketSpeed,
    excludedForSpeed: diagnostic.excludedForSpeed,
    buckets: diagnostic.buckets.map((b) => ({
      key: b.key,
      scope: b.scope,
      n: b.n,
      accurateRate: b.accurateRate,
      measurable: b.measurable,
      unmeasurableReason: b.unmeasurableReason,
    })),
  };
}

async function runOnce(games: AnalysableGame[], username: string, binary: string) {
  const engine = await UciEngine.spawn(binary, { Threads: 1, Hash: 16 });
  engineName = engine.name;
  const started = Date.now();
  try {
    let lastLogged = 0;
    const result = await runImportDiagnostic(games, username, analyzerFor(engine, true), {
      onProgress: ({ done, total, gamesDone }) => {
        if (done - lastLogged < 250) return;
        lastLogged = done;
        process.stderr.write(`  ${done}/${total} positions, ${gamesDone}/${games.length} games\n`);
      },
    });
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
    return { diagnostic: result.diagnostic, rows, elapsedMs: Date.now() - started };
  } finally {
    engine.quit();
  }
}

async function main() {
  const binary = arg("engine", "./scripts/sf-wasm.sh");
  const dataDir = arg("data", "research/harness-account");
  const corpusPath = `${dataDir}/corpus.json`;
  if (!existsSync(corpusPath))
    throw new Error(`no corpus at ${corpusPath} -- run scripts/build_account_corpus.ts first`);
  const corpus: Corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
  mkdirSync(dataDir, { recursive: true });

  const player = corpus.players[0];
  if (!player) throw new Error("corpus holds no player");
  process.stderr.write(`${player.playerId}: ${player.games.length} games\n`);

  process.stderr.write("run A (canonical)\n");
  const a = await runOnce(player.games, player.username, binary);
  process.stderr.write("run B (repeat, second process)\n");
  const b = await runOnce(player.games, player.username, binary);
  process.stderr.write("run C (reversed order)\n");
  const c = await runOnce([...player.games].reverse(), player.username, binary);

  const fa = JSON.stringify(fingerprint(a.diagnostic));
  const repeats = fa === JSON.stringify(fingerprint(b.diagnostic));
  const orderIndependent = fa === JSON.stringify(fingerprint(c.diagnostic));

  /*
   * THE BRIDGE, on the canonical run. Called once, on run A, and not on whichever of the three
   * gave the friendliest answer -- which is why A is named the canonical one in the
   * preregistration rather than picked here.
   */
  const verdict = worstBucketVerdict(a.diagnostic);
  const outcome = hypothesisFromImport(a.diagnostic, {
    registered_at: new Date().toISOString(),
    decisions_before: DECISIONS_BEFORE,
    games: player.games.length,
  });
  /*
   * `registered: false` is the truth about this run: the bridge SAYS a hypothesis may be
   * registered, and nothing here writes one to a record. Passing true would make the pipeline claim
   * a stage it has not reached.
   */
  const progress = importProgress(outcome, false);

  /*
   * The predicted window for the larger run, computed HERE rather than after seeing a second
   * result, per §8. It only exists when the reading has a separation to scale, and its assumption
   * -- that the rates stay where they are -- is the reason it is a prediction and not a promise.
   */
  const factor = verdict && verdict.runnerUp ? resolutionFactor(verdict) : null;
  const prediction =
    outcome.kind === "not-separable" && factor !== null
      ? {
          resolutionFactor: factor,
          predictedWindow: Math.min(2209, Math.ceil(player.games.length * factor)),
          assumption:
            "holds only if the bucket rates stay where they are; it is the size at which a gap THIS BIG would become readable, not a prediction that the gap survives",
        }
      : null;

  const evidence = a.rows.map((r) => JSON.stringify({ playerId: player.playerId, ...r })).join("\n") + "\n";
  writeFileSync(`${dataDir}/decision_evidence.jsonl`, evidence);

  const report = {
    generatedAt: new Date().toISOString(),
    preregistration: "docs/research/ACCOUNT_BRIDGE_PREREG.md",
    engine: engineName,
    engineInvokedAs: binary.split("/").pop(),
    engineOptions: { Threads: 1, Hash: 16, clearHashBetweenPositions: true },
    importDepth: IMPORT_DEPTH,
    corpus: corpus.provenance,
    playerId: player.playerId,
    games: player.games.length,
    decisions: a.rows.length,
    reproducibility: { repeats, orderIndependent, elapsedMsA: a.elapsedMs },
    reading: fingerprint(a.diagnostic),
    verdict: verdict && {
      worst: { key: verdict.worst.key, n: verdict.worst.n, accurateRate: verdict.worst.accurateRate },
      runnerUp: verdict.runnerUp && {
        key: verdict.runnerUp.key,
        n: verdict.runnerUp.n,
        accurateRate: verdict.runnerUp.accurateRate,
      },
      separation: verdict.separation,
      threshold: verdict.threshold,
      separable: verdict.separable,
    },
    bridge: { outcome, progress, prediction },
    evidenceSha256: createHash("sha256").update(evidence).digest("hex"),
  };
  writeFileSync(`${dataDir}/prereg_report.json`, JSON.stringify(report, null, 2));
  process.stdout.write(
    `${JSON.stringify({ outcome: outcome.kind, verdict: report.verdict, reproducibility: report.reproducibility, prediction }, null, 2)}\n`,
  );
}

if (process.argv[1]?.endsWith("run_account_prereg.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
