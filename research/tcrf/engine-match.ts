/**
 * THE NUISANCE CONTROL, KEPT AT ARM'S LENGTH FROM THE CONSTRUCT.
 *
 * §4.3 of the preregistration is careful about what this is for: gross-value matching exists so that
 * H1 is not a disguised comparison of "clearly better position" against "clearly worse position".
 * It does NOT make either engine ground truth, and nothing here may be read as the value of a
 * resource. TCRF §6.2 forbids exactly that inference, and `BLITZ_COMPUTATION_RESULTS.md` is this
 * repository's own evidence that an engine reference can be unstable where it matters most.
 *
 * TWO CONFIGURATIONS, BECAUSE §4.3 ASKS FOR TWO. The shipped one is what the product would tell a
 * player; the high-budget one is there so that a pair matched only by a shallow search cannot slip
 * through. A pair has to be matched under both.
 *
 * SEPARATE FILE FROM `validate-stimulus.ts` ON PURPOSE. Everything there is pure and runs in a unit
 * test in milliseconds, which is what lets the gate run on every commit. This spawns a process and
 * costs seconds per position, so it runs in the curator script and its OUTPUT is what the gate
 * reads. A gate that had to start an engine would be a gate nobody could run.
 */
import { UciEngine, type SearchResult } from "../../scripts/uci-engine.js";
import { comparableCp, type EngineLine } from "../../client/src/lib/engine-line.js";
import { winProbability } from "../../shared/win-probability.js";
import type { EngineReading } from "./stimulus.js";

export interface EngineBudget {
  label: "shipped" | "high_budget";
  /** Exactly one of these. Depth mirrors the product; nodes are the reproducible research unit. */
  depth?: number;
  nodes?: number;
  options: Record<string, string | number>;
}

/**
 * The shipped configuration: `analyze(fen, depth = 14)` in `client/src/lib/stockfish.ts`, which is
 * the search whose answer a player is shown at reveal. Depth is not a unit of computation -- that
 * module says so itself -- and it is used here anyway, because the question §4.3 asks is what the
 * SHIPPED product would say about these two positions, not what a fair budget would say.
 */
export const SHIPPED_BUDGET: EngineBudget = { label: "shipped", depth: 14, options: {} };

/**
 * The second, higher budget. Node-bounded so a rerun on different hardware sees the same search.
 *
 * 2,000,000 nodes sits above the 25k-1.6M band `BLITZ_COMPUTATION_RESULTS.md` measured and found
 * unstable. That study is the reason this is a second opinion and not a deeper truth: a reference
 * that does not saturate cannot be promoted by spending more on it.
 */
export const HIGH_BUDGET: EngineBudget = { label: "high_budget", nodes: 2_000_000, options: {} };

/** Winning chances for the side to move. Mate is a ceiling, not a magnitude. */
const valueOf = (line: EngineLine): number => winProbability(comparableCp(line));

const uci = (line: EngineLine): string | null => line.pv[0] ?? line.bestMove ?? null;

async function readOne(
  engine: UciEngine,
  fen: string,
  budget: EngineBudget,
): Promise<{ value: number; best: string | null; mate: number | null; gap: number | null }> {
  /*
   * MultiPV 2, so the second-best line is available. The forcing gap in §4.5's tactic check is the
   * distance between the best move and the next one, and asking for one line cannot produce it.
   */
  const result: SearchResult =
    budget.depth !== undefined
      ? await engine.searchDepth(fen, budget.depth)
      : await engine.search({ fen, nodes: budget.nodes ?? 0, multipv: 2 });
  const lines = [...result.lines].sort((a, b) => (a.multipv ?? 1) - (b.multipv ?? 1));
  const best = lines[0];
  if (!best) return { value: 0.5, best: null, mate: null, gap: null };
  const second = lines[1];
  return {
    value: valueOf(best),
    best: uci(best) ?? result.bestMove,
    mate: typeof best.mate === "number" ? best.mate : null,
    gap: second ? Math.max(0, valueOf(best) - valueOf(second)) : null,
  };
}

/**
 * One budget over both arms of one pair.
 *
 * RETURNS A READING EVEN WHEN THE ENGINE FAILS, carrying `FAILED` rather than throwing. A pair that
 * could not be scored and a pair that was scored and matched must be distinguishable afterwards,
 * and an exception that aborts the curator run loses which pairs had already been read.
 */
export async function readPair(
  engine: UciEngine,
  presentFen: string,
  disruptedFen: string,
  budget: EngineBudget,
): Promise<EngineReading> {
  const configuration: Record<string, string | number> = {
    ...budget.options,
    limit: budget.depth !== undefined ? `depth ${budget.depth}` : `nodes ${budget.nodes}`,
    multipv: budget.depth !== undefined ? 1 : 2,
  };
  try {
    const present = await readOne(engine, presentFen, budget);
    const disrupted = await readOne(engine, disruptedFen, budget);
    return {
      state: "MEASURED",
      identity: engine.name,
      configuration,
      value_present: present.value,
      value_disrupted: disrupted.value,
      value_delta: Math.abs(present.value - disrupted.value),
      best_move_present: present.best,
      best_move_disrupted: disrupted.best,
      mate_present: present.mate,
      mate_disrupted: disrupted.mate,
      best_gap_present: present.gap,
      best_gap_disrupted: disrupted.gap,
    };
  } catch {
    return {
      state: "FAILED",
      identity: engine.name || null,
      configuration,
      value_present: null,
      value_disrupted: null,
      value_delta: null,
      best_move_present: null,
      best_move_disrupted: null,
      mate_present: null,
      mate_disrupted: null,
      best_gap_present: null,
      best_gap_disrupted: null,
    };
  }
}

/** The reading a pair carries before any engine has run. Never a zero delta. */
export const unmeasured = (label: EngineBudget["label"]): EngineReading => ({
  state: "NOT_MEASURED",
  identity: null,
  configuration: { budget: label },
  value_present: null,
  value_disrupted: null,
  value_delta: null,
  best_move_present: null,
  best_move_disrupted: null,
  mate_present: null,
  mate_disrupted: null,
  best_gap_present: null,
  best_gap_disrupted: null,
});
