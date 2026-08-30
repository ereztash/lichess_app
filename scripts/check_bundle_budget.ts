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

/**
 * Raw bytes of the entry chunk. What the browser must download and parse before anything runs.
 *
 * RAISED FROM 640 TO 648 FOR `shared/evidence-policy.ts`, and the ratchet firing is the mechanism
 * working rather than an obstacle to route around. What this budget protects is stated above: that
 * the engine and the chart library stay behind a dynamic import. Neither moved. What crossed the
 * line is ~4 kB of the evidence policy -- the table deciding which observations each analysis may
 * read -- and it has to be in the entry graph because the browser-record deployment runs the same
 * `commitDecision` and `currentClaim` the server does. A policy that shipped only to the server
 * would leave the local record with no filter at all, which is the hole it was written to close.
 *
 * MEASURED, NOT ESTIMATED. 639.4 kB before, 643.0 kB after, of which 0.9 kB was recovered by
 * deduplicating reasons that were repeated verbatim across cells. The remaining weight is the
 * table's structure, and trimming that further would mean deleting cells rather than bytes.
 *
 * STILL JUST ABOVE THE BUILD, which is the property that makes this a ratchet: 648 leaves 5 kB, so
 * the next hundred is visible on the day it arrives.
 *
 *
 * RAISED AGAIN, 652 -> 656 / 202 -> 204 / 724 -> 728, FOR THE DENOMINATOR LEDGER AND THE BOOK.
 * The property this budget protects is unchanged and was checked rather than assumed: the engine
 * is still reached by a dynamic import, the chart library is still its own chunk, and the opening
 * book's 833 keys -- 9.0 kB, the largest single thing this change adds -- are in a chunk of their
 * own (`opening-book-keys-*.js`) fetched when a player asks for a scan, exactly as the wasm is.
 *
 * MEASURED, NOT ESTIMATED. Entry raw 649.6 kB before, 651.9 kB after; gzipped 201.3 kB before,
 * 202.0 kB after. The 2.3 kB is the import panel's exclusion ledger -- the arithmetic that says
 * what the accuracy rate's denominator actually is -- plus the sentence that says what is still
 * counted, and the book plumbing in `import-diagnostic.ts`. Those bytes are the correction to a
 * number the ledger in docs/MEASUREMENTS.md called a known defect on screen, so trimming them
 * further would mean deleting the disclosure rather than deleting bytes.
 * RAISED AGAIN, 648 -> 652, FOR THE ACQUISITION EVIDENCE LEDGER, and all three ceilings moved this
 * time because all three were crossed. Measured: 645.0 kB before, 650.8 kB after, 649.2 kB once
 * the value-reconstruction prompt was moved behind a dynamic import -- it renders on the second
 * reveal of a browser's whole history and never again, so in almost every visit it was code
 * downloaded and not run.
 *
 * WHAT IS LEFT CANNOT BE DEFERRED, and that is the argument for the raise rather than for another
 * split. The remaining ~4 kB is the event vocabulary and the emitters, and the funnel's first
 * stage is `acquisition_entry` -- written on mount, before anything else, as the denominator every
 * later rate is computed against. Instrumentation that arrives after the first paint has already
 * missed the arrivals that leave before it.
 *
 * WHAT WAS CONSIDERED AND REFUSED. `SelfCheck` is statically imported and carries the report
 * generator with it; making it lazy would recover more than this costs. It stays eager on purpose:
 * it is the diagnostic for a browser where something is broken, and a diagnostic that has to fetch
 * a chunk before it can tell you the network is failing is not one.
 *
 * The gzip ceiling went 200 -> 202 (201.2 measured) and the initial-download ceiling 720 -> 724
 * (720.6 measured), for the same code and the same reason.
 *
 * RAISED A THIRD TIME, 652 -> 653, FOR THE VALUE-CLARITY SENTENCES. Measured 652.2 kB, so this is
 * the smallest raise that clears it and the ratchet keeps its property of sitting just above the
 * build. All three ceilings moved again because all three were crossed by the same 0.2 kB.
 *
 * IT IS TEXT AND IT CANNOT BE DEFERRED, which is the whole argument. The added weight is
 * `shared/promise.ts`, one evidence label per reveal branch, the continuation proposition and the
 * commitment screen's reason -- every one of them a sentence that has to be on screen at the
 * moment the player is deciding whether this product is worth their attention. A lazy chunk that
 * arrives after the first paint would be the front door's promise showing up late, which is the
 * one place in this app where late is the same as absent.
 *
 * WHAT WAS CONSIDERED. `shared/promise.ts` is imported by `Record.tsx`, which is the entry route:
 * there is nothing to split it away from. The evidence labels ride in `shared/reveal.ts`, already
 * in the entry chunk for the reveal path.
 *
 *
 * RAISED A FOURTH TIME, 656 -> 661 AND 728 -> 734, BY A MERGE RATHER THAN BY A COMMIT. Two
 * branches were in flight at once and each raised this ceiling for its own reason: the denominator
 * ledger and the opening book took it to 656, the value-clarity sentences to 653. Neither was over
 * its own ceiling. Their sum is, because the bytes are disjoint -- ledger arithmetic and promise
 * copy have nothing to share -- and 653 + 656 is not how two ratchets compose.
 *
 * MEASURED ON THE MERGED TREE, not inferred from the two numbers: entry raw 657.2 kB, initial
 * download 729.9 kB. The ceilings sit ~4 kB above, which is the headroom every previous raise in
 * this file used.
 *
 * THE GZIP CEILING DID NOT MOVE. It measures 203.6 kB against 204 and is the one that did not
 * fire, so it keeps its number and 0.4 kB of headroom. Raising a ceiling that has not been crossed
 * is loosening a budget for free, which is the drift this file exists to catch.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED. The property the budget protects is unchanged across the
 * merge: the 7.1 MB of WebAssembly is still held out of the entry, and the chart library, the
 * opening book's keys, the game review and the value-reconstruction prompt are each still in a
 * chunk of their own.
 *
 *
 * THE GZIP CEILING, 204 -> 206, FOR A BOARD A SCREEN READER CAN READ. It was left at 204 with
 * 0.4 kB of headroom one commit ago, on the stated ground that raising a ceiling that had not
 * fired is loosening a budget for free. It has now fired, on the next change, which is the
 * ratchet behaving exactly as designed rather than a ceiling set too tight.
 *
 * MEASURED: entry raw 657.2 -> 659.0 kB, gzipped 203.6 -> 204.3, initial download 729.9 -> 731.7.
 * The raw ceilings were NOT crossed and do not move; 206 leaves 1.7 kB, the same headroom the
 * 202 -> 204 raise took.
 *
 * WHAT THE 0.7 kB BUYS. Every gridcell used to carry `aria-label={square}`, and an `aria-label`
 * beats the element's contents in the accessible-name computation -- so a screen reader announced
 * "e4" and never "e4, white knight", on all sixty-four squares. The added weight is the piece
 * vocabulary, an arrow-key handler for the `role="grid"` this board had already declared, and one
 * `aria-live` region.
 *
 * IT CANNOT BE DEFERRED, which is the argument for the raise rather than for another split. The
 * board is on the entry route and the accessible name is computed at render: a name that arrives
 * after the first paint is a name a reader has already read past. Same shape as the promise copy
 * two raises above -- the bytes are on screen at the moment they matter or they are useless.
 *
 *
 * THE RAW CEILINGS, 661 -> 662 AND 734 -> 735, FOR THE BLITZ MEASUREMENT RECORD. Four commits of
 * the blitz integration crossed them by 0.3 kB and 0.1 kB, and the growth was ATTRIBUTED PER
 * COMMIT rather than accepted as a lump, by building each one and measuring the entry chunk:
 *
 *     before any of it   675,455 B
 *     time control       675,836 B   +381   a nullable base/increment pair, and the two adapters
 *                                           that finally read what both sites were already sending
 *     both clocks        676,019 B   +183   one derivation, and the time control on each decision
 *     protocol           676,585 B   +566   three schema fields and two enums, which zod needs as
 *                                           runtime arrays to validate against
 *     strata             677,206 B   +621   grouping the discovery population so two regimes
 *                                           cannot pool
 *     feature layer      677,206 B     +0
 *
 * THE LAST ROW IS THE INTERESTING ONE. `shared/blitz-features.ts` is nine features and about two
 * hundred lines, and it costs the entry chunk NOTHING, because nothing imports it yet and it
 * shakes out whole. It is the check that the other four numbers are the real cost of shipped
 * behaviour rather than of code that merely exists: if dead modules were riding along, that row
 * would not be zero.
 *
 * WHY IT CANNOT BE DEFERRED. It is not a screen and it is not copy -- it is the SHAPE OF EVERY
 * DECISION THE PRODUCT WRITES. `decisionAtomSchema` validates at commit, on the entry route, and a
 * validator that arrives after the first decision would let through exactly the rows it exists to
 * refuse. The enum arrays are the same fact: zod checks a value against them at runtime, so they
 * are data the entry chunk has to hold, not code a later chunk could bring.
 *
 * THE GZIP CEILING DID NOT MOVE. It measures 205.1 kB against 206 and did not fire, so it keeps
 * its number and 0.9 kB of headroom -- the rule two raises above, applied to my own change:
 * raising a ceiling that has not been crossed is loosening a budget for free. Gzipped is also
 * what a person on a slow link actually waits for, and this whole 1.75 kB of source compresses
 * into well under a kilobyte of it.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED. The property the budget protects is unchanged: the 7.1 MB
 * of WebAssembly is still held out of the entry, and no new chunk was created or merged away.
 */
const ENTRY_RAW_KB = 662;
/** Transferred bytes of the entry chunk, which is what a person on a slow link actually waits for. */
const ENTRY_GZIP_KB = 206;
/**
 * Everything the browser fetches before the first paint, entry chunk and CSS together.
 *
 * Separate from the entry ceiling because a stylesheet growing past a megabyte would be invisible
 * to a JavaScript-only budget, and `index.css` is already 3,693 lines.
 */
const INITIAL_RAW_KB = 735;

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
