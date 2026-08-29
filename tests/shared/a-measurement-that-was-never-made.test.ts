/**
 * A think time that was never derivable, and the zero it used to become.
 *
 * `secondsSpentAt` is careful: it returns null rather than 0 when a decision's think time cannot be
 * derived, and its own comment says why -- "a first move recorded as 0 seconds is a fabricated data
 * point in the bucket this product cares most about". The import path then wrote `seconds ?? 0`,
 * which is that fabrication, one line later.
 *
 * The defence in the comment beside it was that the time buckets are reported unmeasurable when an
 * import carries NO clocks at all. That covers the whole-import case and misses the per-decision
 * one, which happens in every import that works: the player's FIRST MOVE has no previous reading of
 * their own clock, so it is null even when every other ply has a perfect one. So the bug did not
 * fire on imports without clocks. It fired on the imports that succeeded.
 *
 * Three separate things had to change, and only the first is the obvious one:
 *   1. the import stops writing zero;
 *   2. `BucketableDecision` admits null, so nothing downstream can quietly re-invent it;
 *   3. a bucket that reads a missing field excludes the decision from its COMPARISON SET too --
 *      otherwise "unmeasured" silently becomes "took longer than 45 seconds".
 */
import { describe, expect, it } from "vitest";
import {
  decisionsFromGame,
  diagnoseImportedGames,
  type ImportedGameInput,
} from "../../shared/import-diagnostic";
import { BUCKETINGS, MIN_BUCKET_N, splitByBucket, type ScoredDecision } from "../../shared/detector";
import { effortFollowsDoubt } from "../../shared/control";

const FULL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A game where every move takes 20 seconds and the clocks are complete. */
function clean(plies: number, timeControl: string | undefined = "600+0"): ImportedGameInput {
  return {
    fens: Array.from({ length: plies + 1 }, () => FULL),
    evalScores: Array.from({ length: plies + 1 }, () => 0),
    clockTimes: Array.from({ length: plies + 1 }, (_, i) => 600 - Math.floor(i / 2) * 20),
    timeControl,
    playerColor: "w",
    speed: "blitz",
  };
}

const bucketing = (key: string) => BUCKETINGS.find((b) => b.key === key)!;

const scored = (over: Partial<ScoredDecision>): ScoredDecision => ({
  decision_id: `d${Math.random()}`,
  fen: FULL,
  phase: "middlegame",
  secondsTaken: 60,
  clockMsRemaining: 120_000,
  confidence: 0.6,
  accurate: true,
  ...over,
});

describe("the import stops inventing a zero", () => {
  it("gives the player's first move no think time at all, rather than none-as-zero", () => {
    const decisions = decisionsFromGame(clean(20));
    expect(decisions[0].ply).toBe(1);
    expect(decisions[0].secondsTaken).toBeNull();
    // And the rest are real measurements, so the fix is not "give up on time".
    expect(decisions[1].secondsTaken).toBe(20);
  });

  it("gives no think time to a move whose starting clock is unknown", () => {
    /*
     * A SECOND, DIFFERENT SOURCE OF THE SAME NULL, and it costs a decision that would otherwise
     * have been perfectly measurable.
     *
     * With no parseable TimeControl the starting clock is NaN by design -- `clockSecondsFromPgn`
     * refuses to guess it, because the tempting fill is the first `[%clk]` value and that is wrong
     * by exactly one move's thinking. Only index 0 is affected, so this is invisible for White,
     * whose first decision has no previous reading of their own clock anyway. For BLACK the first
     * decision is derived from index 0, and it is the difference between a measurement and none.
     */
    const withHeader = clean(20);
    withHeader.playerColor = "b";
    expect(decisionsFromGame(withHeader)[0].secondsTaken).toBe(20);

    const noHeader = clean(20, undefined);
    noHeader.playerColor = "b";
    noHeader.clockTimes = [Number.NaN, ...noHeader.clockTimes.slice(1)];
    const decisions = decisionsFromGame(noHeader);
    expect(decisions[0].ply).toBe(2);
    expect(decisions[0].secondsTaken).toBeNull();
    expect(decisions[1].secondsTaken).toBe(20);
  });

  it("counts what it could not measure instead of absorbing it", () => {
    const d = diagnoseImportedGames([clean(60), clean(60)]);
    expect(d.scored).toBe(60);
    expect(d.eligible).toBe(60);
    // One first move per game, and nothing else.
    expect(d.withoutTime).toBe(2);
    const fast = d.buckets.find((b) => b.key === "fast-under-45s")!;
    expect(fast.n).toBe(d.eligible - d.withoutTime);
  });
});

describe("an unmeasured decision belongs to neither side", () => {
  it("keeps it out of the time bucket AND out of what the bucket is compared against", () => {
    const measured = [
      ...Array.from({ length: 10 }, () => scored({ secondsTaken: 10 })),
      ...Array.from({ length: 10 }, () => scored({ secondsTaken: 300 })),
    ];
    const before = splitByBucket(bucketing("fast-under-45s"), measured);
    const after = splitByBucket(bucketing("fast-under-45s"), [
      ...measured,
      ...Array.from({ length: 8 }, () => scored({ secondsTaken: null })),
    ]);
    expect(after.inside.length).toBe(before.inside.length);
    expect(after.outside.length).toBe(before.outside.length);
  });

  it("does the same for a missing clock, which was never a decision made with time to spare", () => {
    /*
     * This half predates the think-time defect. `clock-under-1m`'s predicate has always checked
     * for null, so a decision with no clock was correctly kept OUT of the bucket -- and dropped
     * straight into the comparison set, where it counted as a decision made with over a minute
     * left. The predicate looked defensive. The split was not.
     */
    const measured = Array.from({ length: 12 }, (_, i) =>
      scored({ clockMsRemaining: i < 6 ? 30_000 : 300_000 }),
    );
    const before = splitByBucket(bucketing("clock-under-1m"), measured);
    const after = splitByBucket(bucketing("clock-under-1m"), [
      ...measured,
      ...Array.from({ length: 9 }, () => scored({ clockMsRemaining: null })),
    ]);
    expect(after.inside.length).toBe(before.inside.length);
    expect(after.outside.length).toBe(before.outside.length);
  });

  it("still counts it in a bucket that reads neither field", () => {
    // Phase is a fact about the position. It does not stop being knowable because nobody timed
    // the move, and a fix that dropped the decision everywhere would be the same defect inverted.
    const withGaps = Array.from({ length: 9 }, () =>
      scored({ phase: "endgame", secondsTaken: null, clockMsRemaining: null }),
    );
    const split = splitByBucket(bucketing("phase-endgame"), withGaps);
    expect(split.inside.length).toBe(9);
  });
});

describe("the effort control reads only the pairs it has", () => {
  it("reports n over the measured decisions rather than over the record", () => {
    const timed = Array.from({ length: MIN_BUCKET_N + 5 }, (_, i) =>
      scored({ secondsTaken: 5 + i * 3, confidence: (i % 7) / 7 }),
    );
    const untimed = Array.from({ length: 20 }, () => scored({ secondsTaken: null }));
    const control = effortFollowsDoubt([...timed, ...untimed]);
    expect(control.n).toBe(timed.length);
    expect(control.rho).not.toBeNull();
  });

  it("waits rather than correlating a column of absences", () => {
    const control = effortFollowsDoubt(
      Array.from({ length: MIN_BUCKET_N + 10 }, () => scored({ secondsTaken: null })),
    );
    expect(control.rho).toBeNull();
    expect(control.readable).toBe(false);
  });
});
