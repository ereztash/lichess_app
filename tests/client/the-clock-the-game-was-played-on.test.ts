/**
 * The time control survives normalization, from both sources.
 *
 * WHAT THIS IS GUARDING. Both sites supply base and increment, and both adapters threw it away.
 * Lichess returns `clock: { initial, increment, totalTime }` beside the PGN in every response and
 * `toGame` mapped eleven fields without it. Chess.com went further: `time_control` was DECLARED in
 * the raw type, so a reader would conclude it was handled, and then never referenced.
 *
 * What survived was `speed`, and `speed` cannot tell 3+0 from 5+5. Those are not two labels for one
 * environment: at 5+5 a player spending five seconds a move never loses time at all, and at 3+0 the
 * same player has burned two thirds of their clock by move twenty. Four time controls arriving under
 * one word is how four experiments become one number with nobody deciding to pool them.
 *
 * SO THE ASSERTIONS ARE EXACT MILLISECONDS, not "is defined". A test that only checked presence
 * would pass against an adapter that returned a constant, which is the precise failure being fixed
 * -- the old code was, in effect, returning the constant `unknown` for every game.
 */
import { describe, expect, it, vi } from "vitest";
import { fetchUserGames } from "../../client/src/lib/lichess-public";
import { fetchChesscomGames } from "../../client/src/lib/chesscom-public";

const PGN = '[Event "Rated blitz game"]\n\n1. e4 c5 2. Nf3 *';

const lichessGame = (clock: unknown, id = "g1") => ({
  id,
  status: "mate",
  speed: "blitz",
  rated: true,
  createdAt: 1700000000000,
  players: { white: { user: { name: "alice" } }, black: { user: { name: "bob" } } },
  pgn: PGN,
  ...(clock === undefined ? {} : { clock }),
});

const respond = (body: string, status = 200) =>
  vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

async function lichessTimeControl(clock: unknown) {
  const result = await fetchUserGames("alice", 5, respond(JSON.stringify(lichessGame(clock))));
  if (!result.ok) throw new Error(`import failed: ${result.failure.kind}`);
  return result.games[0].timeControl;
}

async function chesscomTimeControl(timeControl: unknown) {
  const archives = JSON.stringify({ archives: ["https://api.chess.com/pub/x/games/2026/08"] });
  const games = JSON.stringify({
    games: [
      {
        url: "https://www.chess.com/game/live/123456",
        pgn: PGN,
        time_class: "blitz",
        rules: "chess",
        rated: true,
        end_time: 1700000000,
        white: { username: "alice", result: "win" },
        black: { username: "bob", result: "checkmated" },
        ...(timeControl === undefined ? {} : { time_control: timeControl }),
      },
    ],
  });
  const fetchImpl = vi.fn(async (url: string) =>
    new Response(url.endsWith("/archives") ? archives : games, { status: 200 }),
  ) as unknown as typeof fetch;
  const result = await fetchChesscomGames("alice", 5, fetchImpl);
  if (!result.ok) throw new Error(`import failed: ${result.failure.kind}`);
  return result.games[0].timeControl;
}

describe("the clock the game was played on", () => {
  it("keeps 3+0 from Lichess, with the increment as a measured nought", async () => {
    expect(await lichessTimeControl({ initial: 180, increment: 0, totalTime: 180 })).toEqual({
      initialMs: 180_000,
      incrementMs: 0,
    });
  });

  it("keeps 3+2 from Lichess", async () => {
    expect(await lichessTimeControl({ initial: 180, increment: 2, totalTime: 260 })).toEqual({
      initialMs: 180_000,
      incrementMs: 2_000,
    });
  });

  it("keeps 3+0 from Chess.com, whose grammar writes it as a bare number", async () => {
    expect(await chesscomTimeControl("180")).toEqual({ initialMs: 180_000, incrementMs: 0 });
  });

  it("keeps 5+5 from Chess.com", async () => {
    expect(await chesscomTimeControl("300+5")).toEqual({ initialMs: 300_000, incrementMs: 5_000 });
  });

  it("tells 3+0 and 5+5 apart, which `speed` alone cannot", async () => {
    /*
     * The control for every assertion above. An adapter that returned one constant would satisfy a
     * presence check and every "is it 180000" check written against a single fixture; it cannot
     * satisfy this one. Both games are `speed: "blitz"` and the field that distinguishes them is
     * the one being added.
     */
    const fast = await chesscomTimeControl("180");
    const slow = await chesscomTimeControl("300+5");
    expect(fast).not.toEqual(slow);
    expect(fast.incrementMs).toBe(0);
    expect(slow.incrementMs).toBe(5_000);
  });

  it("says nothing rather than zero when Lichess sends no clock at all", async () => {
    /*
     * A correspondence game carries `daysPerTurn` and no `clock`. `initialMs: 0` would put it in
     * every "under a second" bucket in the product; null keeps it out of all of them.
     */
    expect(await lichessTimeControl(undefined)).toEqual({ initialMs: null, incrementMs: null });
  });

  it("says nothing rather than a guess for a Chess.com daily game", async () => {
    // "1/259200" is one move per three days. The numerator is not a starting clock.
    expect(await chesscomTimeControl("1/259200")).toEqual({ initialMs: null, incrementMs: null });
  });

  it("says nothing for a malformed value from either source", async () => {
    expect(await chesscomTimeControl("not-a-time-control")).toEqual({
      initialMs: null,
      incrementMs: null,
    });
    expect(await lichessTimeControl({ initial: "180", increment: null })).toEqual({
      initialMs: null,
      incrementMs: null,
    });
  });
});
