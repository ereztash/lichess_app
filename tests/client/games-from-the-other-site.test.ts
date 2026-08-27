/**
 * Chess.com as a second front door, and the three ways it is not Lichess.
 *
 * Lichess was the only route in by username, and it is a route only some people have. The import
 * is the bridge over a cold start of 60-90 recorded decisions -- the difference between a first
 * session that ends on six unmeasurable buckets and one with something to read -- so which site a
 * player happens to use decided whether the product worked for them at all.
 *
 * The bargain is identical and that is the point: `api.chess.com/pub/...` is public and sends
 * `access-control-allow-origin: *`, so the browser reads it with no API token, no sign-in and no
 * settings, and the only thing that leaves is a username the player typed. What differs is the
 * shape, and each difference below is a correctness requirement rather than a matter of taste.
 */
import { describe, expect, it, vi } from "vitest";
import { fetchChesscomGames, MAX_MONTHS, openingFromEco, statusFrom } from "@/lib/chesscom-public";
import { clockSecondsFromPgn, hasClockData, parseTimeControl, timeControlHeader } from "@shared/pgn-clock";

/**
 * A real game as Chess.com serves it, kept verbatim.
 *
 * Written by hand this fixture would only prove that the parser reads what I imagined; the whole
 * question is whether the format the site actually publishes carries what the record needs.
 */
const REAL_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.27"]
[White "erik"]
[Black "VimalaRajeshkumar"]
[Result "1-0"]
[ECO "B00"]
[ECOUrl "https://www.chess.com/openings/Nimzowitsch-Defense-Declined"]
[TimeControl "60+1"]
[Termination "erik won by resignation"]
[Link "https://www.chess.com/game/live/100124500103"]

1. e4 {[%clk 0:01:01]} 1... Nc6 {[%clk 0:00:55.9]} 2. Nf3 {[%clk 0:01:00.6]} 1-0`;

const game = (over: Record<string, unknown> = {}) => ({
  url: "https://www.chess.com/game/live/100124500103",
  pgn: REAL_PGN,
  time_class: "bullet",
  time_control: "60+1",
  rated: true,
  rules: "chess",
  end_time: 1706385345,
  eco: "https://www.chess.com/openings/Nimzowitsch-Defense-Declined",
  white: { username: "erik", rating: 1767, result: "win" },
  black: { username: "VimalaRajeshkumar", rating: 1474, result: "resigned" },
  ...over,
});

const ARCHIVE = "https://api.chess.com/pub/player/erik/games/2024/01";

/**
 * A fetch that answers the archives listing and each month from a map.
 *
 * Records every URL asked for, because how many requests this makes is part of the contract with
 * a free API whose maintainers ask callers to be considerate.
 */
function stub(months: Record<string, unknown>, listing: string[] = Object.keys(months)) {
  const asked: string[] = [];
  const impl = vi.fn(async (url: RequestInfo | URL) => {
    const href = String(url);
    asked.push(href);
    if (href.endsWith("/games/archives"))
      return new Response(JSON.stringify({ archives: listing }), { status: 200 });
    const body = months[href];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, asked };
}

describe("a username is the whole credential", () => {
  it("sends no authorization, no cookie and no key, to the public endpoints only", async () => {
    const calls: RequestInit[] = [];
    const impl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      const href = String(url);
      expect(href.startsWith("https://api.chess.com/pub/"), `left the public API: ${href}`).toBe(
        true,
      );
      if (href.endsWith("/games/archives"))
        return new Response(JSON.stringify({ archives: [ARCHIVE] }), { status: 200 });
      return new Response(JSON.stringify({ games: [game()] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await fetchChesscomGames("erik", 5, impl);
    expect(result.ok).toBe(true);
    for (const init of calls) {
      const headers = Object.keys((init.headers ?? {}) as Record<string, string>).map((h) =>
        h.toLowerCase(),
      );
      expect(headers, "a credential reached a public endpoint").not.toContain("authorization");
      expect(headers).not.toContain("cookie");
      expect(init.credentials ?? "omit").not.toBe("include");
    }
  });
});

describe("the archive is a month at a time, walked from the newest", () => {
  it("reads the newest month first, and stops as soon as it has enough", async () => {
    const older = "https://api.chess.com/pub/player/erik/games/2023/12";
    const { impl, asked } = stub(
      { [older]: { games: [game({ url: "https://www.chess.com/game/live/1" })] },
        [ARCHIVE]: { games: [game(), game({ url: "https://www.chess.com/game/live/2" })] } },
      [older, ARCHIVE],
    );
    const result = await fetchChesscomGames("erik", 2, impl);
    expect(result.ok).toBe(true);
    // Listing plus the newest month only. The older month is never asked for.
    expect(asked.filter((u) => u.includes("/games/2"))).toEqual([ARCHIVE]);
  });

  it("walks back when the newest month is thin, and no further than the cap", async () => {
    const months = Array.from(
      { length: MAX_MONTHS + 4 },
      (_, i) => `https://api.chess.com/pub/player/erik/games/2020/${String(i + 1).padStart(2, "0")}`,
    );
    const { impl, asked } = stub(Object.fromEntries(months.map((m) => [m, { games: [] }])), months);
    const result = await fetchChesscomGames("erik", 20, impl);
    expect(result.ok).toBe(false);
    expect(
      asked.filter((u) => u.includes("/games/2020")).length,
      "the walk did not stop at the cap",
    ).toBe(MAX_MONTHS);
  });

  it("says the cap is why, rather than telling a player they have no games", async () => {
    /*
     * NO SILENT BOUND. A player whose games are all older than the months walked HAS games.
     * Reporting this screen's own limit as a fact about them is the exact shape of every defect
     * this product is built against.
     */
    const months = Array.from(
      { length: MAX_MONTHS + 2 },
      (_, i) => `https://api.chess.com/pub/player/erik/games/2019/${String(i + 1).padStart(2, "0")}`,
    );
    const { impl } = stub(Object.fromEntries(months.map((m) => [m, { games: [] }])), months);
    const result = await fetchChesscomGames("erik", 20, impl);
    if (result.ok) throw new Error("expected a failure");
    expect(result.failure.kind).toBe("no-games");
    expect(result.failure.message, "the bound was reported as an absence").toContain(
      String(MAX_MONTHS),
    );
  });
});

describe("what the archive mixes in, and must not pass on", () => {
  it("drops a variant, which every layer downstream would read as standard chess", async () => {
    /*
     * The phase rule, the engine and `decisionsFromGame` all assume the standard start and the
     * standard rules. A chess960 game is not a game with a caveat here; it is a game whose every
     * number would be wrong, sitting in the same month as the ordinary ones.
     */
    const { impl } = stub({
      [ARCHIVE]: {
        games: [
          game({ rules: "chess960", url: "https://www.chess.com/game/live/960" }),
          game({ rules: "bughouse", url: "https://www.chess.com/game/live/961" }),
          game(),
        ],
      },
    });
    const result = await fetchChesscomGames("erik", 20, impl);
    if (!result.ok) throw new Error(result.failure.message);
    expect(result.games.map((g) => g.id)).toEqual(["100124500103"]);
  });

  it("names the ending rather than the winner", () => {
    // The loser's result names it; the winner's is "win". A draw puts the same word on both.
    expect(statusFrom({ result: "win" }, { result: "resigned" })).toBe("resigned");
    expect(statusFrom({ result: "timeout" }, { result: "win" })).toBe("timeout");
    expect(statusFrom({ result: "repetition" }, { result: "repetition" })).toBe("repetition");
    expect(statusFrom(undefined, undefined)).toBe("unknown");
  });

  it("takes the opening's name out of the ECO url and leaves the move order behind", () => {
    expect(openingFromEco("https://www.chess.com/openings/Nimzowitsch-Defense-Declined")).toBe(
      "Nimzowitsch Defense Declined",
    );
    expect(
      openingFromEco("https://www.chess.com/openings/Closed-Sicilian-Defense...6.exd5-exd5"),
      "the exact move order was read as part of the name",
    ).toBe("Closed Sicilian Defense");
    expect(openingFromEco(undefined)).toBeNull();
    expect(openingFromEco("https://www.chess.com/something-else")).toBeNull();
  });
});

describe("a game from here carries what the record needs", () => {
  it("keeps the clock, which is the only source of three of the six buckets", () => {
    /*
     * THE ONE THING THAT WOULD HAVE MADE THIS A LESSER SOURCE. Chess.com publishes no [%eval],
     * and that costs nothing -- the import scores every position with the LOCAL engine and reads
     * those annotations from neither site. What it cannot supply for itself is the clock, and
     * without it `secondsTaken` and `clockMsRemaining` have no origin and the three time buckets
     * are structurally dead. This is the real PGN, through the shared parser.
     */
    const clocks = clockSecondsFromPgn(REAL_PGN);
    expect(hasClockData(clocks), "the clock did not survive the format").toBe(true);
    expect(clocks.length).toBeGreaterThan(1);
    const control = parseTimeControl(timeControlHeader(REAL_PGN));
    expect(control, "the time control header was not readable").not.toBeNull();
    expect(control!.incrementSeconds).toBe(1);
  });

  it("hands over milliseconds, so it sorts beside a Lichess game", async () => {
    // `end_time` is seconds at the source and every other date in this app is milliseconds.
    const { impl } = stub({ [ARCHIVE]: { games: [game({ end_time: 1706385345 })] } });
    const result = await fetchChesscomGames("erik", 5, impl);
    if (!result.ok) throw new Error(result.failure.message);
    expect(result.games[0].playedAt).toBe(1706385345000);
  });

  it("says where it came from, so no screen has to assume Lichess", async () => {
    const { impl } = stub({ [ARCHIVE]: { games: [game()] } });
    const result = await fetchChesscomGames("erik", 5, impl);
    if (!result.ok) throw new Error(result.failure.message);
    expect(result.games[0].source).toBe("chesscom");
    expect(result.games[0].pgn, "the PGN was rewritten on the way through").toBe(REAL_PGN);
  });
});

describe("every failure has a name", () => {
  const only = (status: number) =>
    (vi.fn(async () => new Response("", { status })) as unknown) as typeof fetch;

  it("tells an unknown username apart from an empty one", async () => {
    const empty = await fetchChesscomGames("   ", 5, only(200));
    if (empty.ok) throw new Error("expected a failure");
    expect(empty.failure.kind).toBe("empty-username");

    const missing = await fetchChesscomGames("nobody", 5, only(404));
    if (missing.ok) throw new Error("expected a failure");
    expect(missing.failure.kind).toBe("no-such-user");
    expect(missing.failure.message).toContain("Chess.com");
  });

  it("tells a rate limit apart from a refusal apart from a network failure", async () => {
    const limited = await fetchChesscomGames("erik", 5, only(429));
    if (limited.ok) throw new Error("expected a failure");
    expect(limited.failure.kind).toBe("rate-limited");

    const refused = await fetchChesscomGames("erik", 5, only(403));
    if (refused.ok) throw new Error("expected a failure");
    expect(refused.failure.kind).toBe("blocked");

    const offline = (vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown) as typeof fetch;
    const gone = await fetchChesscomGames("erik", 5, offline);
    if (gone.ok) throw new Error("expected a failure");
    expect(gone.failure.kind).toBe("blocked");
    expect(gone.failure.message, "a refusal was reported without a way forward").toContain("PGN");
  });

  it("keeps the games it already has when a later month fails", async () => {
    // One unreachable month with games in hand is not a failed import.
    const older = "https://api.chess.com/pub/player/erik/games/2023/11";
    const impl = (vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.endsWith("/games/archives"))
        return new Response(JSON.stringify({ archives: [older, ARCHIVE] }), { status: 200 });
      if (href === ARCHIVE) return new Response(JSON.stringify({ games: [game()] }), { status: 200 });
      return new Response("", { status: 500 });
    }) as unknown) as typeof fetch;
    const result = await fetchChesscomGames("erik", 20, impl);
    if (!result.ok) throw new Error(result.failure.message);
    expect(result.games).toHaveLength(1);
  });
});
