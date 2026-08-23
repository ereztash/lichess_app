/**
 * The join: a list of Lichess games, the engine, and one reading.
 *
 * The three pieces existed separately and nothing connected them, which meant the whole cold-start
 * bridge was a component with tests and no way for a player to reach it. Most of the risk in the
 * join is in the boring parts -- whose moves are being scored, and what happens to a game that
 * cannot be read -- so that is what this covers.
 */
import { describe, expect, it, vi } from "vitest";
import { playerColour, runImportDiagnostic, type AnalysableGame } from "../../client/src/lib/import-run";
import type { EngineLine } from "../../client/src/lib/engine-line";

const PGN = (moves: string) =>
  `[TimeControl "300+3"]\n[Result "*"]\n\n${moves} *`;

const game = (over: Partial<AnalysableGame> = {}): AnalysableGame => ({
  id: "a1",
  white: "Erez",
  black: "Opponent",
  pgn: PGN("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"),
  ...over,
});

const flat = async (): Promise<EngineLine> => ({ scoreCp: 10, depth: 12, pv: [], fen: "" });

describe("whose game is being read", () => {
  it("matches the username case-insensitively on either side", () => {
    expect(playerColour(game(), "erez")).toBe("w");
    expect(playerColour(game(), "OPPONENT")).toBe("b");
  });

  it("returns null when neither side is the player, rather than defaulting to white", () => {
    // A default here would silently diagnose the opponent and label it the player's reading.
    expect(playerColour(game(), "someone-else")).toBeNull();
  });

  it("skips games the player is not in, and counts them as unreadable", async () => {
    const result = await runImportDiagnostic(
      [game(), game({ id: "b2", white: "X", black: "Y" })],
      "erez",
      flat,
    );
    expect(result.unreadable).toBe(1);
  });
});

describe("a game that cannot be read", () => {
  it("does not end the run", async () => {
    const analyze = vi.fn(flat);
    const result = await runImportDiagnostic(
      [game({ id: "bad", pgn: "this is not a pgn at all" }), game()],
      "erez",
      analyze,
    );
    expect(result.unreadable).toBe(1);
    expect(analyze).toHaveBeenCalled();
    expect(result.diagnostic.scored).toBeGreaterThan(0);
  });
});

describe("progress across the whole run", () => {
  it("knows its denominator before the first search", async () => {
    /*
     * All PGNs are parsed up front -- cheap, no engine -- so `total` is final from the first
     * callback. A total that grows as it goes makes a progress bar that goes backwards.
     */
    const totals: number[] = [];
    await runImportDiagnostic([game(), game({ id: "b2" })], "erez", flat, {
      onProgress: (p) => totals.push(p.total),
    });
    expect(new Set(totals).size).toBe(1);
    expect(totals[0]).toBeGreaterThan(0);
  });

  it("counts positions across games rather than restarting each game", async () => {
    const seen: number[] = [];
    await runImportDiagnostic([game(), game({ id: "b2" })], "erez", flat, {
      onProgress: (p) => seen.push(p.done),
    });
    // Monotonic: the second game continues the first game's count.
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(seen.length ? Math.max(...seen) : 0);
  });

  it("ends on the total it started with", async () => {
    let last = { done: 0, total: -1 };
    await runImportDiagnostic([game(), game({ id: "b2" })], "erez", flat, {
      onProgress: (p) => { last = p; },
    });
    expect(last.done).toBe(last.total);
  });
});

describe("stopping early", () => {
  it("reports the run as aborted and keeps what was scored", async () => {
    const controller = new AbortController();
    let calls = 0;
    const analyze = async (): Promise<EngineLine> => {
      calls += 1;
      if (calls === 3) controller.abort();
      return { scoreCp: 10, depth: 12, pv: [], fen: "" };
    };
    const result = await runImportDiagnostic([game(), game({ id: "b2" })], "erez", analyze, {
      signal: controller.signal,
    });
    expect(result.aborted).toBe(true);
    // Short, not empty and not fabricated: the positions that were scored really were scored.
    expect(result.diagnostic.scored).toBeGreaterThan(0);
    expect(result.diagnostic.buckets).toHaveLength(6);
  });
});

describe("what reaches the reading", () => {
  it("produces a reading whose buckets are all unmeasurable on this little data", async () => {
    // Six moves in two games is nowhere near MIN_BUCKET_N, and the reading has to say so rather
    // than report six rates over a handful of decisions.
    const result = await runImportDiagnostic([game()], "erez", flat);
    expect(result.diagnostic.buckets.every((b) => !b.measurable)).toBe(true);
  });

  it("carries the clocks through, so the time buckets are not blamed on the sample size", async () => {
    const withClocks = game({
      pgn:
        '[TimeControl "300+3"]\n[Result "*"]\n\n' +
        "1. e4 { [%clk 0:04:58] } e5 { [%clk 0:04:57] } 2. Nf3 { [%clk 0:04:50] } Nc6 { [%clk 0:04:44] } *",
    });
    const result = await runImportDiagnostic([withClocks], "erez", flat);
    expect(result.diagnostic.missingClockData).toBe(false);
    const fast = result.diagnostic.buckets.find((b) => b.key === "fast-under-45s")!;
    expect(fast.unmeasurableReason).toBe("too-few");
  });

  it("says no-clock-data when the PGN carried none", async () => {
    const result = await runImportDiagnostic([game()], "erez", flat);
    expect(result.diagnostic.missingClockData).toBe(true);
    const fast = result.diagnostic.buckets.find((b) => b.key === "fast-under-45s")!;
    expect(fast.unmeasurableReason).toBe("no-clock-data");
  });
});
