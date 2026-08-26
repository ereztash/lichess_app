/**
 * The entry graph, against a written-down ceiling.
 *
 * WHY A BUDGET AND NOT A WARNING. Vite already prints "some chunks are larger than 500 kB" on
 * every build, and it has printed it on every build for a long time, which is what a warning
 * nobody can fail becomes. A budget is the same measurement with a consequence: growth past the
 * line is a decision somebody makes on purpose, in a diff, rather than a drift nobody notices.
 *
 * WHAT IT PROTECTS. The engine is 7.3 MB of WebAssembly. `GATE-COMMIT` already proves the engine
 * module is absent from the initial graph -- R3 requires it, because the machine must not be able
 * to answer before the player's decision is recorded. This checks the other half: that the graph
 * R3 keeps small STAYS small, and that the engine and the chart library are still reached by a
 * dynamic import rather than pulled back into the entry by an innocuous-looking static one.
 *
 * THE NUMBERS ARE A RATCHET, NOT A TARGET. They sit just above what the build currently produces.
 * That is deliberate: a budget with generous headroom is a budget that never fires, and the point
 * is to make the next 100 kB visible on the day it arrives rather than a year later.
 *
 * Run: npx tsx scripts/check_bundle_budget.ts   (after `npm run build`)
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ASSETS = "dist/public/assets";
const INDEX = "dist/public/index.html";

/** Raw bytes of the entry chunk. What the browser must download and parse before anything runs. */
const ENTRY_RAW_KB = 640;
/** Transferred bytes of the entry chunk, which is what a person on a slow link actually waits for. */
const ENTRY_GZIP_KB = 200;
/**
 * Everything the browser fetches before the first paint, entry chunk and CSS together.
 *
 * Separate from the entry ceiling because a stylesheet growing past a megabyte would be invisible
 * to a JavaScript-only budget, and `index.css` is already 3,693 lines.
 */
const INITIAL_RAW_KB = 720;

interface Asset {
  name: string;
  raw: number;
  gzip: number;
}

function asset(name: string): Asset {
  const bytes = readFileSync(join(ASSETS, name));
  return { name, raw: bytes.length, gzip: gzipSync(bytes).length };
}

const kb = (bytes: number) => bytes / 1024;
const fmt = (bytes: number) => `${kb(bytes).toFixed(1)} kB`;

try {
  statSync(INDEX);
} catch {
  // Louder than a skip. A budget that silently passes when there is nothing to measure is worse
  // than no budget, because it reports a ceiling was respected that was never tested.
  console.error(`no build found at ${INDEX} -- run \`npm run build\` first`);
  process.exit(1);
}

const html = readFileSync(INDEX, "utf8");
/*
 * The entry is read from the HTML rather than guessed from a filename. Vite hashes every chunk,
 * and `index-*.js` is a naming convention rather than a guarantee -- matching on it would silently
 * measure the wrong file the day the convention changes, and report a pass.
 */
const entryName = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
if (!entryName) {
  console.error(`could not find the entry script in ${INDEX}`);
  process.exit(1);
}

const entry = asset(entryName);
const styles = readdirSync(ASSETS)
  .filter((name) => name.endsWith(".css") && html.includes(name))
  .map(asset);
const initialRaw = entry.raw + styles.reduce((sum, sheet) => sum + sheet.raw, 0);

const failures: string[] = [];
const check = (label: string, actual: number, ceilingKb: number) => {
  const over = kb(actual) > ceilingKb;
  console.log(
    `${over ? "OVER " : "ok   "} ${label.padEnd(28)} ${fmt(actual).padStart(10)} / ${ceilingKb} kB`,
  );
  if (over) failures.push(`${label}: ${fmt(actual)} exceeds ${ceilingKb} kB`);
};

console.log(`\nBundle budget -- entry chunk ${entry.name}\n`);
check("entry, raw", entry.raw, ENTRY_RAW_KB);
check("entry, gzipped", entry.gzip, ENTRY_GZIP_KB);
check("initial download, raw", initialRaw, INITIAL_RAW_KB);

/*
 * NOTHING THE PAGE FETCHES EAGERLY MAY BE THE ENGINE, and the check is on the HTML rather than on
 * the chunk.
 *
 * The first version of this searched the entry chunk for the word "stockfish" and failed the
 * build. It was wrong: what it found was `await import("./stockfish-...")`, which is EXACTLY what
 * correct lazy loading looks like -- a dynamic import necessarily leaves the chunk's name in the
 * importer. The check was flagging the evidence that R3 is respected.
 *
 * What a build artifact CAN show is whether the browser is told to fetch the engine before
 * anything asks for it. `<script>` and `<link rel="modulepreload">` in index.html are eager;
 * a chunk named only inside an `import()` call is not. GATE-COMMIT already proves the module is
 * absent from the initial import graph, and this is the complementary claim: absent from the
 * graph, and also not preloaded around it.
 */
const eager = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((match) => match[1]);
const eagerEngine = eager.filter((name) => /stockfish|\.wasm$/i.test(name));
if (eagerEngine.length > 0) {
  failures.push(
    `index.html eagerly fetches the engine (${eagerEngine.join(", ")}): R3 requires it to be ` +
      "reached only when a reveal asks for it",
  );
}
console.log(`\neagerly fetched: ${eager.join(", ")}`);

const wasm = readdirSync(ASSETS).filter((name) => name.endsWith(".wasm"));
console.log(`\nheld out of the entry: ${wasm.length} wasm file(s), ${wasm.map((n) => fmt(statSync(join(ASSETS, n)).size)).join(", ")}`);

if (failures.length > 0) {
  console.error(`\nBUDGET EXCEEDED\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  console.error(
    "\nIf the growth is intended, raise the constant in scripts/check_bundle_budget.ts in the same" +
      " commit that causes it, so the decision is on the record.",
  );
  process.exit(1);
}
console.log("\nwithin budget\n");
