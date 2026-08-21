/**
 * The supersede scenario, shared by GATE-STALE and its positive control.
 *
 * Both run this identical sequence; only the client under test differs. A control with its own
 * weaker predicate proves nothing.
 */
import type { WorkerLike } from "../../client/src/lib/stockfish";

export class ScriptedWorker implements WorkerLike {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  postMessage(message: string) {
    if (message === "uci") queueMicrotask(() => this.reply("uciok"));
    if (message === "isready") queueMicrotask(() => this.reply("readyok"));
  }
  terminate() {}
  reply(data: string) {
    this.onmessage?.({ data });
  }
}

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export interface SupersedeOutcome {
  bestMove?: string;
  depth: number;
  pv: string[];
}

/**
 * Start a search, supersede it, then let the ABANDONED search report first.
 * A correct client discards that reply and answers with the live search's result.
 */
export async function runSupersede(
  worker: ScriptedWorker,
  analyzeA: () => Promise<unknown>,
  analyzeB: () => Promise<SupersedeOutcome>,
): Promise<SupersedeOutcome> {
  analyzeA().catch(() => {});
  await tick();
  const second = analyzeB();
  await tick();
  worker.reply("bestmove a2a3"); // owed by the abandoned search
  worker.reply("info depth 18 score cp 55 pv d2d4 d7d5");
  worker.reply("bestmove d2d4"); // the live search
  return second;
}

/** The predicate. Same logic for the gate and the control. */
export function supersedeVerdict(outcome: SupersedeOutcome): { ok: boolean; detail: string } {
  if (outcome.bestMove !== "d2d4") {
    return {
      ok: false,
      detail: `superseded search resolved with "${outcome.bestMove}" -- the abandoned search's move`,
    };
  }
  if (outcome.depth !== 18 || outcome.pv.length !== 2) {
    return {
      ok: false,
      detail: `live result was clobbered: depth ${outcome.depth}, pv [${outcome.pv.join(" ")}]`,
    };
  }
  return { ok: true, detail: "abandoned search discarded; live result intact (depth 18)" };
}
