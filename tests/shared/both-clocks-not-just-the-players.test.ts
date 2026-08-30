/**
 * The opponent's clock, which was always in the PGN and never read.
 *
 * `clockTimes` interleaves both players -- index i is the time remaining after ply i, whoever moved
 * -- so the opponent's readings have sat at the alternating indices since the parser was written,
 * and nothing has ever asked for them. This was not a field a source withheld. It was a field
 * nobody asked the data for, and its absence meant a player two minutes DOWN on a three-minute
 * clock and one two minutes UP read as the same record.
 *
 * EVERY EXPECTED NUMBER BELOW IS DERIVED IN A COMMENT BESIDE IT. A clock test whose expectations
 * were produced by running the code proves the code agrees with itself. These were worked out from
 * the PGN by hand first, which is the only way the increment case can catch anything: at 3+2 the
 * clock goes UP while the player thinks, so a raw difference of three seconds is five seconds of
 * thinking, and code that forgets the increment still produces a plausible-looking number.
 */
import { describe, expect, it } from "vitest";
import {
  clockMsRemainingAt,
  clockSecondsFromPgn,
  opponentClockMsRemainingAt,
  parseTimeControl,
  secondsSpentAt,
} from "../../shared/pgn-clock";
import { decisionsFromGame, type ImportedGameInput } from "../../shared/import-diagnostic";

/*
 * 3+0. White's clock: 180 -> 177 -> 170 -> 161. Black's: 180 -> 175 -> 164.
 * clockTimes indexes as [initial, after ply1, after ply2, ...] = [180, 177, 175, 170, 164, 161].
 */
const THREE_ZERO = `[TimeControl "180+0"]

1. e4 {[%clk 0:02:57]} e5 {[%clk 0:02:55]} 2. Nf3 {[%clk 0:02:50]} Nc6 {[%clk 0:02:44]}
3. Bb5 {[%clk 0:02:41]} *`;

/*
 * 3+2, where the clock CLIMBS. White: 180 -> 181 -> 178 -> 175. Black: 180 -> 180 -> 177.
 * clockTimes = [180, 181, 180, 178, 177, 175].
 */
const THREE_TWO = `[TimeControl "180+2"]

1. e4 {[%clk 0:03:01]} e5 {[%clk 0:03:00]} 2. Nf3 {[%clk 0:02:58]} Nc6 {[%clk 0:02:57]}
3. Bb5 {[%clk 0:02:55]} *`;

/* 5+0, read from BLACK's side. clockTimes = [300, 298, 295, 292, 287]. */
const FIVE_ZERO = `[TimeControl "300+0"]

1. e4 {[%clk 0:04:58]} e5 {[%clk 0:04:55]} 2. Nf3 {[%clk 0:04:52]} Nc6 {[%clk 0:04:47]} *`;

const increment = (pgn: string) => parseTimeControl(/"([^"]+)"/.exec(pgn)![1])!.incrementSeconds;

describe("both clocks, not just the player's", () => {
  it("indexes the readings the way the arithmetic below assumes", () => {
    // The control for every other expectation here: if this is wrong they are all wrong together.
    expect(clockSecondsFromPgn(THREE_ZERO)).toEqual([180, 177, 175, 170, 164, 161]);
    expect(clockSecondsFromPgn(THREE_TWO)).toEqual([180, 181, 180, 178, 177, 175]);
    expect(clockSecondsFromPgn(FIVE_ZERO)).toEqual([300, 298, 295, 292, 287]);
  });

  it("reads the opponent's clock at 3+0, White to move", () => {
    const t = clockSecondsFromPgn(THREE_ZERO);
    // Ply 3 is White's second move. The position came from Black's ply 2, after which Black had 175.
    expect(opponentClockMsRemainingAt(t, 3)).toBe(175_000);
    // Ply 5. Black's ply 4 left them 164.
    expect(opponentClockMsRemainingAt(t, 5)).toBe(164_000);
  });

  it("gives the opponent the full clock at ply 1, because they have not moved", () => {
    // Index 0 is the starting clock. This is correct rather than a fallback.
    expect(opponentClockMsRemainingAt(clockSecondsFromPgn(THREE_ZERO), 1)).toBe(180_000);
  });

  it("makes the clock difference derivable, which is the point of the field", () => {
    const t = clockSecondsFromPgn(THREE_ZERO);
    // At ply 5 White faced 170 with Black on 164: White is 6 seconds UP.
    const own = clockMsRemainingAt(t, 5)!;
    const theirs = opponentClockMsRemainingAt(t, 5)!;
    expect(own).toBe(170_000);
    expect(theirs).toBe(164_000);
    expect(own - theirs).toBe(6_000);
  });

  it("keeps the increment out of the opponent's reading and inside the think time", () => {
    const t = clockSecondsFromPgn(THREE_TWO);
    const inc = increment(THREE_TWO);
    expect(inc).toBe(2);
    /*
     * White at ply 3: before 181, after 178. The RAW difference is 3 seconds and the thinking was
     * FIVE -- two of those three seconds were handed back by the increment. This is the case that
     * catches a clock reader which subtracts and stops.
     */
    expect(clockMsRemainingAt(t, 3)).toBe(181_000);
    expect(secondsSpentAt(t, 3, inc)).toBe(5);
    expect(181 - 178).toBe(3); // stated so the gap between 3 and 5 is on the page
    // The opponent's reading is a clock STATE and takes no increment adjustment at all.
    expect(opponentClockMsRemainingAt(t, 3)).toBe(180_000);
  });

  it("reads both clocks from Black's side at 5+0", () => {
    const t = clockSecondsFromPgn(FIVE_ZERO);
    const inc = increment(FIVE_ZERO);
    // Ply 2 is Black's first move: they faced the full 300, and White's ply 1 left White on 298.
    expect(clockMsRemainingAt(t, 2)).toBe(300_000);
    expect(opponentClockMsRemainingAt(t, 2)).toBe(298_000);
    expect(secondsSpentAt(t, 2, inc)).toBe(5); // 300 -> 295
    // Ply 4: Black faced 295 with White on 292.
    expect(clockMsRemainingAt(t, 4)).toBe(295_000);
    expect(opponentClockMsRemainingAt(t, 4)).toBe(292_000);
    expect(secondsSpentAt(t, 4, inc)).toBe(8); // 295 -> 287
  });

  it("says nothing rather than zero when the TimeControl header is missing", () => {
    /*
     * Index 0 is NaN without a header, so ply 1's opponent reading is unknown -- and unknown is
     * null. A zero here would say the opponent had flagged before the first move.
     */
    const headerless = THREE_ZERO.replace(/\[TimeControl "[^"]+"\]\n\n/, "");
    const t = clockSecondsFromPgn(headerless);
    expect(opponentClockMsRemainingAt(t, 1)).toBeNull();
    expect(opponentClockMsRemainingAt(t, 3)).toBe(175_000); // later plies are unaffected
  });

  describe("and every decision carries them", () => {
    const game = (pgn: string, playerColor: "w" | "b"): ImportedGameInput => ({
      // Five plies of a real game: the FENs and evaluations only have to exist and be uniform,
      // because what is under test is the clock trace, not the scoring.
      fens: Array.from({ length: 6 }, () => "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
      evalScores: Array.from({ length: 6 }, () => 0),
      clockTimes: clockSecondsFromPgn(pgn),
      timeControl: /"([^"]+)"/.exec(pgn)![1],
      playerColor,
      speed: "blitz",
    });

    it("puts the opponent clock and the time control on each imported decision", () => {
      const decisions = decisionsFromGame(game(THREE_TWO, "w"));
      // White's plies are 1, 3, 5; ply 1 has no previous own reading and is still a decision.
      const atPly3 = decisions.find((d) => d.ply === 3)!;
      expect(atPly3.clockMsRemaining).toBe(181_000);
      expect(atPly3.opponentClockMsRemaining).toBe(180_000);
      expect(atPly3.secondsTaken).toBe(5);
      expect(atPly3.timeControl).toEqual({ initialMs: 180_000, incrementMs: 2_000 });
    });

    it("carries a null opponent clock rather than a zero when the game has no clocks", () => {
      const noClocks: ImportedGameInput = { ...game(THREE_ZERO, "w"), clockTimes: [] };
      for (const d of decisionsFromGame(noClocks)) {
        expect(d.opponentClockMsRemaining).toBeNull();
        expect(d.clockMsRemaining).toBeNull();
      }
    });

    it("makes the clock after the move recoverable, so it is not stored twice", () => {
      /*
       * own_after = own_before - spent + increment. With the time control on the decision this is
       * exact, which is why there is no `clockMsAfter` field: a second stored copy of a derivable
       * number is a second thing that can disagree.
       */
      const d = decisionsFromGame(game(THREE_TWO, "w")).find((x) => x.ply === 3)!;
      const incrementMs = d.timeControl.incrementMs!;
      const after = d.clockMsRemaining! - d.secondsTaken! * 1000 + incrementMs;
      expect(after).toBe(178_000); // the reading the PGN actually recorded after ply 3
    });
  });
});
