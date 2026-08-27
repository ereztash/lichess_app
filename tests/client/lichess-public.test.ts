/**
 * Importing games by username, with no credential.
 *
 * The point of these tests is that every failure has a *name*. A module that returns "could not
 * load" for a missing user, a rate limit, and a blocked request has erased the difference between
 * three problems with three different fixes.
 */
import { describe, expect, it, vi } from "vitest";
import { fetchUserGames } from "../../client/src/lib/lichess-public";

function ndjson(...rows: unknown[]) {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}

const FINISHED = {
  id: "abc123",
  status: "mate",
  speed: "blitz",
  rated: true,
  createdAt: 1700000000000,
  opening: { name: "Sicilian Defense" },
  players: {
    white: { user: { name: "alice" }, rating: 1800 },
    black: { user: { name: "bob" }, rating: 1750 },
  },
  pgn: '[Event "Rated blitz game"]\n\n1. e4 c5 2. Nf3 *',
};

function respondWith(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("importing games by username", () => {
  it("reads finished games without sending any credential", async () => {
    const spy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(ndjson(FINISHED), { status: 200 }),
    );
    const result = await fetchUserGames("alice", 5, spy as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.games[0]).toMatchObject({ id: "abc123", white: "alice", black: "bob" });

    // No Authorization header, no cookies, no token anywhere in the request.
    const init = spy.mock.calls[0][1];
    expect(JSON.stringify(init?.headers)).not.toMatch(/authorization/i);
  });

  it("refuses to import a game that is still being played", async () => {
    // The fair-play guard depends on unfinished games never reaching the analysis layers.
    const live = { ...FINISHED, id: "live1", status: "started" };
    const result = await fetchUserGames("alice", 5, respondWith(ndjson(live)));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.failure.kind).toBe("no-games");
  });

  it("keeps the finished games when a live one is mixed in", async () => {
    const live = { ...FINISHED, id: "live1", status: "started" };
    const result = await fetchUserGames("alice", 5, respondWith(ndjson(live, FINISHED)));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.games.map((g) => g.id)).toEqual(["abc123"]);
  });

  it.each([
    [404, "no-such-user"],
    [429, "rate-limited"],
    [500, "source-error"],
  ])("names the cause behind HTTP %i as %s", async (status, kind) => {
    const result = await fetchUserGames("alice", 5, respondWith("", status));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.failure.kind).toBe(kind);
  });

  it("distinguishes a blocked request from an empty result", async () => {
    const rejecting = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const result = await fetchUserGames("alice", 5, rejecting);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.failure.kind).toBe("blocked");
    // It also points at the fallback that does work.
    expect(result.failure.message).toContain("PGN");
  });

  it("does not call Lichess at all for an empty username", async () => {
    const spy = vi.fn();
    const result = await fetchUserGames("   ", 5, spy as unknown as typeof fetch);
    expect(spy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.failure.kind).toBe("empty-username");
  });

  it("caps the request size instead of pulling an unbounded archive", async () => {
    const spy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(ndjson(FINISHED), { status: 200 }),
    );
    await fetchUserGames("alice", 5000, spy as unknown as typeof fetch);
    const url = spy.mock.calls[0][0];
    expect(new URL(url).searchParams.get("max")).toBe("50");
  });
});
