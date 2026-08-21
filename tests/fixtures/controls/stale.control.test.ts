/**
 * GATE-STALE positive control, run as a Vitest file.
 *
 * It asserts EXACTLY what tests/gates/stale.test.ts asserts, but against the superseding logic
 * as it shipped. It is expected to FAIL: that failure is the proof the gate is a gate.
 *
 * It lives under tests/fixtures/, which vitest.config.ts excludes from the normal run, so it
 * never breaks `npm test`. The gate runner invokes it explicitly in --positive-controls mode.
 */
import { describe, expect, it } from "vitest";
import { LegacyStockfishClient } from "../legacy-stockfish";
import { ScriptedWorker, runSupersede, supersedeVerdict } from "../supersede-scenario";

describe("GATE-STALE control: the superseding logic as it shipped", () => {
  it("must NOT discard the abandoned search's bestmove (this is expected to fail)", async () => {
    const worker = new ScriptedWorker();
    const legacy = new LegacyStockfishClient(worker);
    const outcome = await runSupersede(
      worker,
      () => legacy.analyze("fenA"),
      () => legacy.analyze("fenB"),
    );
    const verdict = supersedeVerdict(outcome);
    expect(verdict.ok, verdict.detail).toBe(true);
  });
});
