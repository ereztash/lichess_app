/**
 * The SHIPPED engine, driven over stdio, so a research harness can spawn it like any other binary.
 *
 * `docs/research/ENGINE_PARITY_PREREG.md` records a run against `sf-wasm.sh` -- a wrapper that
 * never reached the repository, which is why the canonical shipped-engine reading cannot be
 * reproduced from a clean checkout today. This file is that wrapper, committed.
 *
 * WHY A WRAPPER AND NOT `node stockfish-18-lite-single.js`. That build installs its own readline on
 * stdin when Node runs it, and it installs it AFTER the WebAssembly module resolves. A caller that
 * writes `uci` in the same tick it spawns the process -- which is exactly what
 * `scripts/uci-engine.ts` does -- has its handshake read by nobody, and a piped stdin then reaches
 * EOF and the process exits having printed nothing. Measured: zero bytes out for a piped
 * `uci\nisready\ngo depth 12`. So every line that arrives before the engine answers is held here
 * and replayed in order once it does.
 *
 * `quit` IS QUEUED LIKE ANY OTHER COMMAND rather than exiting on sight. Exiting on sight is the
 * same defect one level up: a caller that writes its whole session at once would kill the process
 * before the engine had loaded, and the run would report an engine failure that was really this
 * wrapper.
 */
import { createRequire } from "node:module";
import { createInterface } from "node:readline";

const require = createRequire(import.meta.url);
const initEngine = require("stockfish");

const flavour = process.argv[2] ?? "lite-single";
const pending = [];
let engine = null;

function dispatch(line) {
  if (!engine) {
    pending.push(line);
    return;
  }
  engine.sendCommand(line);
  // The WASM build has no process to end, so the wrapper owns the exit. Give the command a tick to
  // reach the module before tearing the runtime down.
  if (line === "quit") setTimeout(() => process.exit(0), 50);
}

createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  const text = line.trim();
  if (text) dispatch(text);
});

engine = await initEngine(flavour);
engine.listener = (line) => process.stdout.write(`${line}\n`);
for (const line of pending.splice(0)) dispatch(line);
