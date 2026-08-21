/**
 * These tests pin the seven behaviours where server/lichess.ts (the file the client takes its
 * TYPES from) diverged from api/[...path].ts (the file that actually ran in production).
 *
 * Every divergence ran in the same direction: production was worse than the types promised.
 * Unifying the router is therefore NOT a behaviour-preserving refactor -- it gives the runtime
 * behaviours it did not have. These tests are what makes that claim checkable.
 */
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLichessGamePgn,
  getLichessStudyPgn,
  getPostGameLayers,
  getRecentLichessGames,
} from "../../server/lichess";

const ok = (body: string, status = 200) => new Response(body, { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.LICHESS_API_TOKEN = "test-token";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LICHESS_API_TOKEN;
});

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof TRPCError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw, but it resolved");
}

describe("divergence 1: explorer reads NDJSON as a stream", () => {
  it("resolves from the first record without waiting for the stream to end", async () => {
    // A stream that emits one record and then stays open. An implementation that buffers the
    // whole body (`await response.text()`) never resolves here and the test times out.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"white":1,"draws":0,"black":0,"moves":[]}\n'));
        // deliberately never closed
      },
    });
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("explorer")
          ? new Response(stream, { status: 200 })
          : ok(JSON.stringify({ depth: 20, pvs: [] })),
      ),
    );

    const layers = await getPostGameLayers({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", source: "imported" });
    expect(layers.master.white).toBe(1);
  }, 3000);
});

describe("divergence 2 + 4: study fallback and empty-body handling", () => {
  it("retries unauthenticated when the token is rejected, so public studies still load", async () => {
    fetchMock
      .mockResolvedValueOnce(ok("", 401)) // token rejected
      .mockResolvedValueOnce(ok("[Event \"Public study\"]\n\n1. e4 *")); // anonymous retry

    const pgn = await getLichessStudyPgn("https://lichess.org/study/abcd1234");
    expect(pgn).toContain("Public study");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retry must not carry the rejected Authorization header.
    expect(fetchMock.mock.calls[1][1]?.headers).not.toHaveProperty("Authorization");
  });

  it("throws NOT_FOUND on an empty study body instead of returning an empty string", async () => {
    fetchMock.mockResolvedValue(ok("   "));
    expect(await codeOf(() => getLichessStudyPgn("abcd1234"))).toBe("NOT_FOUND");
  });

  it("rejects a malformed study reference", async () => {
    expect(await codeOf(() => getLichessStudyPgn("!!!not-an-id!!!"))).toBe("BAD_REQUEST");
  });
});

describe("divergence 3: gamePgn empty-body handling", () => {
  it("throws NOT_FOUND on an empty game body instead of returning an empty string", async () => {
    fetchMock.mockResolvedValue(ok(""));
    expect(await codeOf(() => getLichessGamePgn("abcd1234"))).toBe("NOT_FOUND");
  });

  it("rejects a malformed game id before making a request", async () => {
    expect(await codeOf(() => getLichessGamePgn("../etc/passwd"))).toBe("BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("divergence 5 + 6: cloud-eval status mapping", () => {
  const layers = () =>
    getPostGameLayers({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", source: "imported" });
  const explorerThen = (cloudStatus: number) =>
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("explorer")
          ? ok('{"white":0,"draws":0,"black":0,"moves":[]}')
          : ok("", cloudStatus),
      ),
    );

  it("maps 429 to TOO_MANY_REQUESTS, not a generic gateway error", async () => {
    explorerThen(429);
    expect(await codeOf(layers)).toBe("TOO_MANY_REQUESTS");
  });

  it("maps 401 to UNAUTHORIZED, not a generic gateway error", async () => {
    explorerThen(401);
    expect(await codeOf(layers)).toBe("UNAUTHORIZED");
  });

  it("treats 404 as 'no cloud evaluation exists', which is a valid answer", async () => {
    explorerThen(404);
    await expect(layers()).resolves.toMatchObject({ cloud: null });
  });
});

describe("divergence 7: recentGames clamps max in depth", () => {
  it("clamps above the ceiling even when the caller bypasses zod validation", async () => {
    fetchMock.mockResolvedValue(ok(""));
    await getRecentLichessGames("someone", 5000);
    expect(String(fetchMock.mock.calls[0][0])).toContain("max=30");
  });

  it("clamps below the floor", async () => {
    fetchMock.mockResolvedValue(ok(""));
    await getRecentLichessGames("someone", -7);
    expect(String(fetchMock.mock.calls[0][0])).toContain("max=1");
  });
});

describe("fair-play guard (do not touch: section 7)", () => {
  it.each(["live", "demo"] as const)("refuses Lichess layers during a %s game", async (source) => {
    expect(
      await codeOf(() => getPostGameLayers({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", source })),
    ).toBe("FORBIDDEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
