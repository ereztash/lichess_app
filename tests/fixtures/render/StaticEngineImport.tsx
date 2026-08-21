/**
 * GATE-COMMIT positive control (second half): a static VALUE import of the engine
 * implementation from a render path, which puts the 7MB wasm into the initial module graph.
 * This regression really happened; the gate must catch it.
 */
import { isStale } from "@/lib/stockfish";

export function StaticEngineImportPanel({ fen }: { fen: string }) {
  return <span>{String(isStale(null, fen))}</span>;
}
