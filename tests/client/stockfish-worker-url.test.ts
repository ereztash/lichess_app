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
const workerUrlLine = source
  .split("\n")
  .find((line) => line.includes("const workerUrl"))!;

describe("the Stockfish worker URL", () => {
  it("exists", () => {
    expect(workerUrlLine).toBeDefined();
  });

  it("does not append ',worker' to the hash", () => {
    expect(workerUrlLine, "',worker' silences the engine entirely").not.toContain(",worker");
  });

  it("passes the wasm path as the whole hash, url-encoded", () => {
    expect(workerUrlLine).toContain("encodeURIComponent(ENGINE_WASM)");
    expect(workerUrlLine).toMatch(/#\$\{encodeURIComponent\(ENGINE_WASM\)\}`/);
  });
});
