/**
 * Regression guard for the worker URL.
 *
 * The shipped code appended ",worker" to the hash. That sends the stockfish.js loader down a
 * branch where it never initialises -- the script loads, the worker is created, and then
 * nothing happens: no wasm fetch, no message, not even an error. The engine had therefore never
 * produced a single evaluation in this application.
 *
 * This is a SOURCE-LEVEL check on purpose. Importing StockfishClient pulls in the 7MB wasm via
 * ?url asset imports, and jsdom has no real Worker or WebAssembly host to run it against, so a
 * behavioural test here would assert nothing. The real verification was driving a browser
 * against the production build; this pins the one character that broke it.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../client/src/lib/stockfish.ts"),
  "utf8",
);
const workerConstruction = source.split("\n").find((line) => line.includes("new Worker("));

describe("the Stockfish worker URL", () => {
  it("is constructed somewhere in this module", () => {
    // If this fails, the construction moved and the assertions below are no longer guarding
    // anything. A test that cannot find its subject must fail, not quietly pass.
    expect(workerConstruction, "no `new Worker(` found in stockfish.ts").toBeDefined();
  });

  it("does not append ',worker' to the hash", () => {
    expect(workerConstruction!, "',worker' silences the engine entirely").not.toContain(",worker");
  });

  it("passes the wasm path as the whole hash, url-encoded", () => {
    expect(workerConstruction!).toContain("encodeURIComponent(ENGINE_WASM)");
    expect(workerConstruction!).toMatch(/#\$\{encodeURIComponent\(ENGINE_WASM\)\}`/);
  });
});
