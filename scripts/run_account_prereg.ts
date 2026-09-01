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
  diagnoseImportedGames,
  resolutionFactor,
  worstBucketVerdict,
  type ImportDiagnostic,
} from "../shared/import-diagnostic.js";
import type { ImportedGameInput } from "../shared/import-diagnostic.js";
import type { BookLookup } from "../shared/opening-book.js";
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
    return {
      diagnostic: result.diagnostic,
      rows,
      elapsedMs: Date.now() - started,
      inputs: result.inputs,
      isBook: result.isBook,
      unreadable: result.unreadable,
    };
  } finally {
    engine.quit();
  }
}

/**
 * A second reading of the SAME evaluations, over a declared subset of the games.
 *
 * WHY THIS IS HERE AND NOT IN A SCRIPT BESIDE THE REPORT. `ACCOUNT_BRIDGE_FULL_PREREG.md` §4 names
 * two analyses as CO-PRIMARY -- every admissible game, and standard chess only -- with neither
 * privileged. A co-primary analysis computed by an ad-hoc reader of the evidence file would be a
 * second definition of what the verdict means, and the audit's own rule is that no rule it judges
 * has two definitions. So the subset goes through `diagnoseImportedGames` and the bridge, exactly
 * as the full set does.
 *
 * It costs no engine time: the evaluations are already in `inputs`, and only the denominator moves.
 * Same shape as the harness's `withoutBook` reading, for the same reason.
 *
 * INDEX ALIGNMENT IS CHECKED RATHER THAN ASSUMED. `runImportDiagnostic` drops a game whose PGN
 * yields no positions, so `inputs[i]` is `games[i]` only while nothing was dropped. The existing row
 * dump already assumes that; here the assumption is made explicit and the caller is handed `null`
 * instead of a quietly misaligned reading.
 */
function readSubset(
  run: { inputs: ImportedGameInput[]; isBook: BookLookup; unreadable: number },
  games: AnalysableGame[],
  keep: (game: AnalysableGame) => boolean,
): ImportDiagnostic | null {
  if (run.unreadable !== 0 || run.inputs.length !== games.length) return null;
  return diagnoseImportedGames(
    run.inputs.filter((_, index) => keep(games[index]!)),
    run.isBook,
  );
}

/**
 * The verdict and the bridge for one diagnostic, so every declared analysis shares ONE definition.
 *
 * `ACCOUNT_BRIDGE_FULL_PREREG.md` §4 names two analyses as co-primary. A second analysis judged by
 * a near-copy of this logic would be a measurement of the near-copy -- the defect
 * `research/discovery-oracle/README.md` states as a rule: no rule the audit judges may have two
 * definitions.
 */
function judge(diagnostic: ImportDiagnostic, games: number) {
  const verdict = worstBucketVerdict(diagnostic);
  const outcome = hypothesisFromImport(diagnostic, {
    registered_at: new Date().toISOString(),
    decisions_before: DECISIONS_BEFORE,
    games,
  });
  return {
    verdict: verdict && {
      worst: {
        key: verdict.worst.key,
        n: verdict.worst.n,
        accurateRate: verdict.worst.accurateRate,
      },
      runnerUp: verdict.runnerUp && {
        key: verdict.runnerUp.key,
        n: verdict.runnerUp.n,
        accurateRate: verdict.runnerUp.accurateRate,
      },
      separation: verdict.separation,
      threshold: verdict.threshold,
      separable: verdict.separable,
    },
    outcome,
    /*
     * `registered: false` is the truth about this run: the bridge SAYS a hypothesis may be
     * registered, and nothing here writes one to a record. Passing true would make the pipeline
     * claim a stage it has not reached.
     */
    progress: importProgress(outcome, false),
    resolutionFactor: verdict && verdict.runnerUp ? resolutionFactor(verdict) : null,
  };
}

/**
 * The `[Variant]` tag. Absent means standard, which is what Lichess omits it for.
 *
 * Read off the PGN rather than carried on `AnalysableGame`, because that type is the product's and
 * this is a research distinction the product has no use for.
 */
function variantOf(game: AnalysableGame): string {
  return game.pgn.match(/\[Variant "(.*?)"\]/)?.[1] ?? "Standard";
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
   * THE BRIDGE, on the canonical run. Called on run A, and not on whichever of the three gave the
   * friendliest answer -- which is why A is named the canonical one in the preregistration rather
   * than picked here.
   */
  const primary = judge(a.diagnostic, player.games.length);

  /*
   * ANALYSIS B, co-primary per ACCOUNT_BRIDGE_FULL_PREREG.md §4: standard chess only, because a
   * standard engine scoring an Atomic game produces a number that means nothing and a From Position
   * game starts outside the opening book. Declared before the run and reported whatever it says.
   * It does NOT replace analysis A -- if the two disagree on the outcome, that disagreement is the
   * finding, and neither is presented as the truth.
   */
  const isStandard = (game: AnalysableGame) => variantOf(game) === "Standard";
  const standardGames = player.games.filter(isStandard);
  const standardDiagnostic = readSubset(a, player.games, isStandard);
  const standardOnly = standardDiagnostic
    ? {
        games: standardGames.length,
        excludedGames: player.games.length - standardGames.length,
        reading: fingerprint(standardDiagnostic),
        ...judge(standardDiagnostic, standardGames.length),
      }
    : { unavailable: "a game produced no positions, so inputs and games are not aligned" };

  /*
   * The predicted window for a larger run, computed HERE rather than after seeing a second result.
   * It only exists when the reading has a separation to scale, and its assumption -- that the rates
   * stay where they are -- is the reason it is a prediction and not a promise.
   */
  const prediction =
    primary.outcome.kind === "not-separable" && primary.resolutionFactor !== null
      ? {
          resolutionFactor: primary.resolutionFactor,
          predictedWindow: Math.min(
            2209,
            Math.ceil(player.games.length * primary.resolutionFactor),
          ),
          assumption:
            "holds only if the bucket rates stay where they are; it is the size at which a gap THIS BIG would become readable, not a prediction that the gap survives",
        }
      : null;

  const evidence =
    a.rows.map((r) => JSON.stringify({ playerId: player.playerId, ...r })).join("\n") + "\n";
  writeFileSync(`${dataDir}/decision_evidence.jsonl`, evidence);

  const report = {
    generatedAt: new Date().toISOString(),
    preregistration: arg("prereg", "docs/research/ACCOUNT_BRIDGE_PREREG.md"),
    engine: engineName,
    engineInvokedAs: binary.split("/").pop(),
    engineOptions: { Threads: 1, Hash: 16, clearHashBetweenPositions: true },
    importDepth: IMPORT_DEPTH,
    corpus: corpus.provenance,
    playerId: player.playerId,
    games: player.games.length,
    decisions: a.rows.length,
    reproducibility: {
      repeats,
      orderIndependent,
      elapsedMsA: a.elapsedMs,
      unreadableGames: a.unreadable,
    },
    reading: fingerprint(a.diagnostic),
    verdict: primary.verdict,
    bridge: { outcome: primary.outcome, progress: primary.progress, prediction },
    /* Co-primary, not a footnote. ACCOUNT_BRIDGE_FULL_PREREG.md §4. */
    standardOnly,
    evidenceSha256: createHash("sha256").update(evidence).digest("hex"),
  };
  writeFileSync(`${dataDir}/prereg_report.json`, JSON.stringify(report, null, 2));
  process.stdout.write(
    `${JSON.stringify(
      {
        A: { outcome: primary.outcome.kind, verdict: primary.verdict },
        B: standardOnly,
        reproducibility: report.reproducibility,
        prediction,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1]?.endsWith("run_account_prereg.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
