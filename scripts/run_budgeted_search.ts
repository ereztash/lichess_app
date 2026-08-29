/**
 * Budgeted searches, and what the failed saturation gate COSTS.
 *
 * Gate 1 established that no tested budget produces a deep reference stable to the preregistered
 * tolerance. That sentence on its own does not tell a reader whether the study was blocked by a
 * technicality or by something fatal. This measures the consequence directly, in the one place it
 * decides everything: the LABEL. For each decision, the cost of the move the human actually played
 * is computed twice -- once against a 400,000-node reference and once against an 800,000-node one --
 * under the preregistered uniform scoring procedure (`go searchmoves <move>`), and the two binary
 * verdicts are compared under this repository's own accuracy rule.
 *
 * It also records how often the reference is INCOHERENT: the move the reference calls best scoring
 * WORSE, under the same uniform procedure, than the move the human played. That number cannot be
 * explained as noise around a true value; it is the reference contradicting itself.
 *
 * It does two jobs in one pass over the same sample, because both need the same expensive deep
 * searches:
 *
 *   1. THE TRAJECTORY. Nine node budgets from 50 to 20,000, MultiPV 2, hash cleared between each,
 *      with every move any budget chose scored by the deep reference under one uniform procedure.
 *      The metrics come from research/blitz/search-trajectory.ts -- one definition, not a second
 *      copy that could disagree with the one that is tested.
 *   2. THE LABEL'S DEPENDENCE ON THE REFERENCE. The same decision scored against a 400,000-node
 *      reference and against an 800,000-node one, so the binary verdict this repository's accuracy
 *      rule produces can be compared with itself.
 *
 * Run: npx tsx scripts/run_budgeted_search.ts [--engine PATH] [--workers N] [--games N]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { UciEngine, lineValue } from "./uci-engine.js";
import { ACCURATE_WIN_PROBABILITY_LOSS } from "../shared/detector.js";
import { mulberry32, type DecisionEvent } from "./build_blitz_research_dataset.js";
import {
  searchTrajectory,
  type BudgetObservation,
  type DeepReference,
  type SearchTrajectory,
} from "../research/blitz/search-trajectory.js";

export const REFERENCE_BUDGETS = [400_000, 800_000];
/** The primary reference: the largest budget the preregistered grid tested below its ceiling. */
export const PRIMARY_REFERENCE = 400_000;
/** Frozen in the preregistration (§6.1). Not tuned, and not extended after seeing anything. */
export const TRAJECTORY_BUDGETS = [50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000];
const TRAJECTORY_MULTIPV = 2;
/** How many of the reference's ranked candidates get a uniform deep score. */
const RANKED_DEPTH = 3;
const EVENTS_PER_GAME = 2;
const MULTIPV = 3;

export interface LabelRow {
  key: string;
  gameId: string;
  playerId: string;
  elo: number;
  phase: string;
  clockBeforeSeconds: number;
  thinkTimeSeconds: number;
  playedMove: string;
  /** The nine budgeted observations, smallest first. */
  trajectory: BudgetObservation[];
  /** The metrics of prereg §6.3, from research/blitz/search-trajectory.ts. */
  metrics: SearchTrajectory;
  /** The primary reference's ranked candidates, uniformly scored. */
  reference: DeepReference;
  /** One entry per reference budget, in the order of REFERENCE_BUDGETS. */
  references: Array<{
    nodes: number;
    bestMove: string | null;
    /** Uniform deep value of the reference's own best move. */
    bestValue: number | null;
    /** Uniform deep value of the move the human played. */
    playedValue: number | null;
    /** Unclamped, so a reference that contradicts itself is visible rather than floored to zero. */
    rawLoss: number | null;
    loss: number | null;
    inaccurate: boolean | null;
  }>;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function pool<T>(
  items: T[],
  engines: UciEngine[],
  run: (item: T, engine: UciEngine) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    engines.map(async (engine) => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        await run(items[index], engine);
        if (index % 25 === 0) process.stderr.write(`  ${index}/${items.length}\n`);
      }
    }),
  );
}

async function main() {
  const binary = arg("engine", "stockfish");
  const workers = Number(arg("workers", "4"));
  const dataDir = arg("data", "research/blitz/data");
  const targetGames = Number(arg("games", "350"));
  /*
   * Output name. Exists so the identical, seeded positions can be run a SECOND time through fresh
   * engine processes and the two outputs compared: every feature here is a function of the position
   * alone, so a replication that disagrees means something outside the position reached it -- a
   * transposition table that was not cleared being the likeliest candidate. See Control 3.
   */
  const tag = arg("tag", "budgeted_search");

  const events: DecisionEvent[] = readFileSync(`${dataDir}/decision_events.jsonl`, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  // Two decisions per game rather than one, so the cluster bootstrap has clusters to work with.
  const byGame = new Map<string, DecisionEvent[]>();
  for (const event of events) {
    const list = byGame.get(event.gameId) ?? [];
    list.push(event);
    byGame.set(event.gameId, list);
  }
  const random = mulberry32(20260829 ^ 0x1abe1);
  const gameIds = [...byGame.keys()].sort();
  for (let i = gameIds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [gameIds[i], gameIds[j]] = [gameIds[j], gameIds[i]];
  }
  const sample: DecisionEvent[] = [];
  for (const gameId of gameIds.slice(0, targetGames))
    sample.push(...(byGame.get(gameId) ?? []).slice(0, EVENTS_PER_GAME));
  process.stderr.write(`sample ${sample.length} decisions from ${targetGames} games\n`);

  const engines = await Promise.all(
    Array.from({ length: workers }, () => UciEngine.spawn(binary, { Threads: 1, Hash: 16 })),
  );

  const rows: LabelRow[] = [];
  await pool(sample, engines, async (event, engine) => {
    /*
     * The trajectory first, and deliberately BEFORE any deep search of this position. The hash is
     * cleared between searches, so ordering cannot leak a deep result into a shallow one -- but
     * running the cheap searches first means that if the clearing ever regressed, the trajectory
     * would be the thing that broke loudly rather than the thing that quietly agreed with itself.
     */
    const observations: BudgetObservation[] = [];
    for (const nodes of TRAJECTORY_BUDGETS) {
      const result = await engine.search({
        fen: event.fenBefore,
        nodes,
        multipv: TRAJECTORY_MULTIPV,
      });
      observations.push({
        nodes,
        actualNodes: result.nodes,
        chosenMove: result.lines[0]?.pv[0] ?? result.bestMove,
        shallowValue: result.lines[0] ? lineValue(result.lines[0]) : null,
        deepValueOfChosenMove: null, // filled in below, by the reference and never by this budget
        topMoves: result.lines
          .filter((line) => line.pv[0])
          .map((line) => ({ move: line.pv[0], shallowValue: lineValue(line) })),
      });
    }

    const references: LabelRow["references"] = [];
    let reference: DeepReference = {
      nodes: PRIMARY_REFERENCE,
      bestMove: null,
      bestValue: null,
      ranked: [],
    };
    /* One uniform score per move, cached: the same move asked for twice is the same search. */
    const deepValue = new Map<string, number | null>();
    const scoreDeep = async (move: string, nodes: number) => {
      const cacheKey = `${nodes}:${move}`;
      if (deepValue.has(cacheKey)) return deepValue.get(cacheKey)!;
      const result = await engine.search({
        fen: event.fenBefore,
        nodes,
        multipv: 1,
        searchmoves: [move],
      });
      const value = result.lines[0] ? lineValue(result.lines[0]) : null;
      deepValue.set(cacheKey, value);
      return value;
    };

    for (const nodes of REFERENCE_BUDGETS) {
      const ranked = await engine.search({ fen: event.fenBefore, nodes, multipv: MULTIPV });
      const bestMove = ranked.lines[0]?.pv[0] ?? ranked.bestMove;
      const ranked_ = ranked.lines
        .map((line) => line.pv[0])
        .filter((move): move is string => !!move);
      if (!bestMove) {
        references.push({
          nodes,
          bestMove: null,
          bestValue: null,
          playedValue: null,
          rawLoss: null,
          loss: null,
          inaccurate: null,
        });
        continue;
      }
      /*
       * Both moves scored by the SAME procedure at the SAME budget. Reading the best move's value
       * off the MultiPV list instead would compare a line that shared its search with two others
       * against a line that had the whole budget to itself -- a difference in the instrument, which
       * would then show up as a difference in the move.
       */
      const bestValue = await scoreDeep(bestMove, nodes);
      const playedValue = await scoreDeep(event.actualMoveUci, nodes);
      if (nodes === PRIMARY_REFERENCE) {
        const ranked: DeepReference["ranked"] = [];
        for (const line of ranked_.slice(0, RANKED_DEPTH)) {
          const value = await scoreDeep(line, nodes);
          if (value !== null) ranked.push({ move: line, value });
        }
        ranked.sort((a, b) => b.value - a.value);
        reference = { nodes, bestMove, bestValue, ranked };
        for (const observation of observations)
          observation.deepValueOfChosenMove = observation.chosenMove
            ? await scoreDeep(observation.chosenMove, nodes)
            : null;
      }
      const rawLoss = bestValue !== null && playedValue !== null ? bestValue - playedValue : null;
      const loss = rawLoss === null ? null : Math.max(0, rawLoss);
      references.push({
        nodes,
        bestMove,
        bestValue,
        playedValue,
        rawLoss,
        loss,
        inaccurate: loss === null ? null : loss > ACCURATE_WIN_PROBABILITY_LOSS,
      });
    }
    rows.push({
      key: `${event.gameId}:${event.ply}`,
      gameId: event.gameId,
      playerId: event.playerId,
      elo: event.elo,
      phase: event.phase,
      clockBeforeSeconds: event.clockBeforeSeconds,
      thinkTimeSeconds: event.thinkTimeSeconds,
      playedMove: event.actualMoveUci,
      trajectory: observations,
      metrics: searchTrajectory(reference, observations),
      reference,
      references,
    });
  });
  engines.forEach((e) => e.quit());

  rows.sort((a, b) => (a.key < b.key ? -1 : 1));
  const jsonl = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(`${dataDir}/${tag}.jsonl`, jsonl);
  writeFileSync(
    `${dataDir}/${tag}_manifest.json`,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        engine: binary.split("/").pop(),
        engineOptions: { Threads: 1, Hash: 16, multiPv: MULTIPV },
        referenceBudgets: REFERENCE_BUDGETS,
        primaryReference: PRIMARY_REFERENCE,
        trajectoryBudgets: TRAJECTORY_BUDGETS,
        trajectoryMultiPv: TRAJECTORY_MULTIPV,
        accuracyRule: ACCURATE_WIN_PROBABILITY_LOSS,
        games: targetGames,
        decisions: rows.length,
        sha256: createHash("sha256").update(jsonl).digest("hex"),
      },
      null,
      2,
    ),
  );
  process.stderr.write(`wrote ${rows.length} rows\n`);
}

if (process.argv[1]?.endsWith("run_budgeted_search.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
