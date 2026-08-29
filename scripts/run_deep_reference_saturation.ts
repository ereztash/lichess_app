/**
 * Gate 1: is there a node budget at which the deep reference stops moving?
 *
 * The preregistration forbids declaring a depth or a node count "ground truth" by assertion. This
 * measures it. For each of six budgets, and a stratified sample of positions, it asks whether
 * doubling the budget changes the answer by more than a tolerance that was DERIVED from the
 * product's own accuracy rule rather than chosen after looking:
 *
 *   eps1 = ACCURATE_WIN_PROBABILITY_LOSS / 2   -- half the smallest cost this product calls real
 *   eps2 = ACCURATE_WIN_PROBABILITY_LOSS
 *
 * Two criteria, both required (prereg §5):
 *   A'  V_2N(m_2N) - V_2N(m_N) < eps      -- the move chosen at N is still fine when judged at 2N
 *   B   |V_N - V_2N| < eps                -- the position's own value has stopped moving
 *
 * A' rather than `m_N == m_2N`: two moves of equal value that the engine alternates between are
 * not an unstable reference, and every downstream metric reads the VALUE, not the move's name.
 *
 * Run: npx tsx scripts/run_deep_reference_saturation.ts [--engine PATH] [--workers N]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { UciEngine, lineValue } from "./uci-engine.js";
import { ACCURATE_WIN_PROBABILITY_LOSS } from "../shared/detector.js";
import type { DecisionEvent } from "./build_blitz_research_dataset.js";
import { mulberry32 } from "./build_blitz_research_dataset.js";

export const SATURATION_BUDGETS = [25_000, 50_000, 100_000, 200_000, 400_000, 800_000];
/**
 * The grid actually used. `--budgets` exists for ONE purpose: re-running the identical, seeded
 * sample of positions on a longer grid, to answer whether the stability curve is climbing towards
 * the preregistered bar or flat. Extending a grid cannot rescue a failed criterion -- the
 * preregistered verdict is read off the preregistered grid -- but it distinguishes "we ran out of
 * compute" from "this does not converge", and those are different findings.
 */
function budgetGrid(): number[] {
  const i = process.argv.indexOf("--budgets");
  return i < 0 ? SATURATION_BUDGETS : process.argv[i + 1].split(",").map(Number);
}
export const EPSILON_STRICT = ACCURATE_WIN_PROBABILITY_LOSS / 2;
export const EPSILON_TOLERANT = ACCURATE_WIN_PROBABILITY_LOSS;
const SAMPLE = 300;
/** Positions given a cheap evaluation first, only so the sample can be stratified by eval band. */
const PRESCREEN = 1500;
const PRESCREEN_NODES = 50_000;
const MULTIPV = 3;
/**
 * The depth the product's own import path searches to, measured here in NODES on the same
 * positions.
 *
 * It is recorded for one reason: the results document has to say what a stable reference would
 * COST, and "depth 12" and "800,000 nodes" are not comparable quantities. Depth is not a unit of
 * computation -- the same depth costs a few thousand nodes in a locked position and millions in a
 * sharp one -- so the ratio between what the product spends and what a reference would need can
 * only be stated once both are in nodes.
 */
const PRODUCT_DEPTH = 12;

export function eloBand(elo: number): string {
  if (elo < 1500) return "<1500";
  if (elo < 1800) return "1500-1799";
  if (elo < 2100) return "1800-2099";
  return ">=2100";
}
export function evalBand(cp: number): string {
  const a = Math.abs(cp);
  return a <= 50 ? "level" : a <= 300 ? "unbalanced" : "decided";
}
export function clockBand(seconds: number, base: number): string {
  return seconds / base <= 0.34 ? "high-pressure" : "low-pressure";
}

/** Wilson score interval -- a proportion near 1 has no business carrying a symmetric interval. */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const half = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(centre - half) / d, (centre + half) / d];
}

interface BudgetRow {
  nodes: number;
  actualNodes: number;
  depth: number;
  bestMove: string | null;
  value: number;
  /** Value of every move in the MultiPV list at this budget, keyed by UCI move. */
  values: Record<string, number>;
}

export interface StabilityCheck {
  n: number;
  stableStrict: number;
  stableTolerant: number;
}

/** Whether budget N is stable against budget 2N for one position, at one tolerance. */
export function stableAt(low: BudgetRow, high: BudgetRow, epsilon: number): boolean {
  if (!low.bestMove || !high.bestMove) return false;
  const judged = high.values[low.bestMove];
  // Absent from the deeper engine's list: it cannot be shown to be fine, so it is not counted fine.
  if (judged === undefined) return false;
  if (high.value - judged >= epsilon) return false;
  return Math.abs(low.value - high.value) < epsilon;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function pool<T>(items: T[], workers: number, run: (item: T, engine: UciEngine) => Promise<void>, engines: UciEngine[]) {
  let next = 0;
  await Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        await run(items[index], engines[w]);
        if (index % 25 === 0) process.stderr.write(`  ${index}/${items.length}\n`);
      }
    }),
  );
}

async function main() {
  const binary = arg("engine", "/tmp/claude-0/-home-user-lichess-app/d8f48042-7db8-53cd-b32f-934c2bf91937/scratchpad/stockfish/stockfish-ubuntu-x86-64-avx2");
  const workers = Number(arg("workers", "4"));
  const dataDir = arg("data", "research/blitz/data");
  const tag = arg("tag", "saturation");
  const grid = budgetGrid();
  const events: DecisionEvent[] = readFileSync(`${dataDir}/decision_events.jsonl`, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  const engines = await Promise.all(
    Array.from({ length: workers }, () => UciEngine.spawn(binary, { Threads: 1, Hash: 16 })),
  );

  const random = mulberry32(20260829 ^ 0x5a7);
  const shuffled = [...events];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const screen = shuffled.slice(0, PRESCREEN);
  process.stderr.write(`prescreen ${screen.length} positions at ${PRESCREEN_NODES} nodes\n`);
  const band = new Map<string, string>();
  await pool(screen, workers, async (event, engine) => {
    const result = await engine.search({ fen: event.fenBefore, nodes: PRESCREEN_NODES, multipv: 1 });
    const cp = result.lines[0]?.scoreCp ?? 0;
    band.set(`${event.gameId}:${event.ply}`, evalBand(cp));
  }, engines);

  // Stratified draw: fill cells round-robin so a rare cell is not crowded out by a common one.
  const cells = new Map<string, DecisionEvent[]>();
  for (const event of screen) {
    const key = [
      eloBand(event.elo),
      event.phase,
      clockBand(event.clockBeforeSeconds, event.baseSeconds),
      band.get(`${event.gameId}:${event.ply}`) ?? "level",
    ].join("|");
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(event);
  }
  const order = [...cells.keys()].sort();
  const sample: DecisionEvent[] = [];
  for (let round = 0; sample.length < SAMPLE; round += 1) {
    let added = 0;
    for (const key of order) {
      const bucket = cells.get(key)!;
      if (round < bucket.length && sample.length < SAMPLE) {
        sample.push(bucket[round]);
        added += 1;
      }
    }
    if (!added) break;
  }
  process.stderr.write(`sampled ${sample.length} positions over ${order.length} strata\n`);

  const rows: Array<{ key: string; event: DecisionEvent; budgets: BudgetRow[]; productDepthNodes: number }> = [];
  await pool(sample, workers, async (event, engine) => {
    const budgets: BudgetRow[] = [];
    const atProductDepth = await engine.searchDepth(event.fenBefore, PRODUCT_DEPTH);
    for (const nodes of grid) {
      const result = await engine.search({ fen: event.fenBefore, nodes, multipv: MULTIPV });
      const values: Record<string, number> = {};
      for (const line of result.lines) if (line.pv[0]) values[line.pv[0]] = lineValue(line);
      budgets.push({
        nodes,
        actualNodes: result.nodes,
        depth: result.depth,
        bestMove: result.lines[0]?.pv[0] ?? result.bestMove,
        value: result.lines[0] ? lineValue(result.lines[0]) : Number.NaN,
        values,
      });
    }
    rows.push({ key: `${event.gameId}:${event.ply}`, event, budgets, productDepthNodes: atProductDepth.nodes });
  }, engines);

  engines.forEach((e) => e.quit());

  const checks: Array<StabilityCheck & { epsilonStrict: number; epsilonTolerant: number }> = [];
  for (let i = 0; i + 1 < grid.length; i += 1) {
    let strict = 0;
    let tolerant = 0;
    for (const row of rows) {
      if (stableAt(row.budgets[i], row.budgets[i + 1], EPSILON_STRICT)) strict += 1;
      if (stableAt(row.budgets[i], row.budgets[i + 1], EPSILON_TOLERANT)) tolerant += 1;
    }
    checks.push({
      n: grid[i],
      stableStrict: strict,
      stableTolerant: tolerant,
      epsilonStrict: EPSILON_STRICT,
      epsilonTolerant: EPSILON_TOLERANT,
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    engine: binary.split("/").pop(),
    engineOptions: { Threads: 1, Hash: 16, multiPv: MULTIPV },
    budgets: grid,
    positions: rows.length,
    strata: order.length,
    epsilonStrict: EPSILON_STRICT,
    epsilonTolerant: EPSILON_TOLERANT,
    checks: checks.map((c) => ({
      budget: c.n,
      against: c.n * 2,
      n: rows.length,
      strictRate: c.stableStrict / rows.length,
      strictCi: wilson(c.stableStrict, rows.length),
      tolerantRate: c.stableTolerant / rows.length,
      tolerantCi: wilson(c.stableTolerant, rows.length),
    })),
    productDepth: PRODUCT_DEPTH,
    productDepthNodes: {
      mean: rows.reduce((s2, r) => s2 + r.productDepthNodes, 0) / rows.length,
      median: [...rows].map((r) => r.productDepthNodes).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
    },
    meanDepthByBudget: grid.map((nodes, i) => ({
      nodes,
      meanDepth: rows.reduce((s, r) => s + r.budgets[i].depth, 0) / rows.length,
      meanActualNodes: rows.reduce((s, r) => s + r.budgets[i].actualNodes, 0) / rows.length,
    })),
  };
  const jsonl = rows.map((r) => JSON.stringify({ key: r.key, elo: r.event.elo, phase: r.event.phase, fen: r.event.fenBefore, clockBeforeSeconds: r.event.clockBeforeSeconds, baseSeconds: r.event.baseSeconds, productDepthNodes: r.productDepthNodes, budgets: r.budgets })).join("\n") + "\n";
  writeFileSync(`${dataDir}/${tag}.jsonl`, jsonl);
  writeFileSync(
    `${dataDir}/${tag}_summary.json`,
    JSON.stringify({ ...summary, sha256: createHash("sha256").update(jsonl).digest("hex") }, null, 2),
  );
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("run_deep_reference_saturation.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
