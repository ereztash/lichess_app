/**
 * WHICH ENGINE SCORED A DECISION, as two strings any module may import.
 *
 * SEPARATE FROM `stockfish.ts` FOR ONE REASON, and it is the reason that file states about itself:
 * importing VALUES from there pulls the 7 MB wasm into the module graph. `Blitz.tsx` needs the
 * engine's identity at the moment it writes a record -- statically, on the entry path -- and must
 * not drag the engine in with it. A `?url` import yields a string and leaves the asset out of the
 * JavaScript chunk, which is what keeps `npm run bundle:budget` honest.
 */
import engineWasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";

/** The engine family. Stored beside every evaluation so two families can never be pooled. */
export const ENGINE_NAME = "stockfish";

/**
 * WHICH BUILD OF IT, TAKEN FROM THE ASSET URL RATHER THAN FROM `package.json`.
 *
 * `docs/ACTION_PLAN.md` B1 measured 13.61% of decisions flipping verdict between the engine that
 * produced this project's published numbers and the engine it ships. So "which engine scored this"
 * is not metadata, it is part of the measurement -- and until now nothing recorded it.
 *
 * THE DEPENDENCY'S VERSION WOULD BE THE WRONG ANSWER, and not only because the browser bundle
 * cannot read `package.json`. The range in it is `^18.0.8`, so the binary can change without any
 * version string a build could embed changing with it. Vite content-hashes this asset: the
 * filename moves when, and only when, the wasm actually differs. That is the identity the question
 * needs.
 *
 * In dev the URL carries a query string instead of a hash, which is why `/blitz` is a production
 * measurement -- the engine does not run under `npm run dev` at all (see the README).
 */
export function engineBuildId(): string {
  const file = engineWasmUrl.split("/").pop() ?? engineWasmUrl;
  return file.replace(/\.wasm.*$/, "").slice(0, 64);
}
