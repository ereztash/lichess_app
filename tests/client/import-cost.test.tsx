// @vitest-environment jsdom
/**
 * What a scan costs and what it buys, stated BEFORE the button that starts it.
 *
 * Both facts existed in the product and both arrived too late to inform the decision. The duration
 * rendered only inside the progress block -- after the wait had already begun -- and what a scan
 * buys was never stated on this screen at all, only on the diagnostic that appears at the end.
 * Someone deciding whether to spend the time had neither number in front of them.
 *
 * These tests assert ORDER as well as presence. Text that exists somewhere on the page but below
 * the control it describes is the same defect in a different place.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_BUCKET_N, PREREGISTERED_THRESHOLDS } from "@shared/detector";
import type { ImportedGame } from "@/lib/game-source";

const fetchUserGames = vi.fn();
vi.mock("@/lib/lichess-public", () => ({
  fetchUserGames: (...args: unknown[]) => fetchUserGames(...args),
}));
// The engine is never reached in these tests -- nothing presses scan -- but the module must not
// load: importing stockfish.ts pulls 7MB of wasm into the graph and GATE-COMMIT forbids it here.
vi.mock("@/lib/import-run", () => ({ runImportDiagnostic: vi.fn() }));

const { ImportGames, ratingSeries } = await import("@/components/ImportGames");

/*
 * Nothing in this file presses scan, so the engine is never called. It throws rather than
 * resolving: a test that quietly started a real analysis would be measuring something else.
 */
const neverAnalyses = () => {
  throw new Error("the engine must not be reached from these tests");
};

const game = (id: string) => ({
  id,
  white: "player",
  black: "other",
  whiteRating: 1500,
  blackRating: 1500,
  status: "resign",
  speed: "rapid",
  rated: true,
  playedAt: 0,
  opening: null,
  pgn: "1. e4 e5",
});

beforeEach(() => {
  fetchUserGames.mockReset();
  // The real signature returns a discriminated result, not a bare array.
  fetchUserGames.mockResolvedValue({ ok: true, games: [game("a"), game("b"), game("c")] });
});

/** Search for a username, which is what puts the scan button on screen. */
async function searchFor(name = "player") {
  const user = userEvent.setup();
  render(<ImportGames onClose={() => {}} onLoad={() => {}} analyze={neverAnalyses} />);
  await user.type(screen.getByPlaceholderText("lichess username"), name);
  await user.click(screen.getByRole("button", { name: /חפש/ }));
  await waitFor(() => expect(screen.getByText(/נתחו את/)).toBeTruthy());
  return user;
}

describe("the scan says what it costs before it is started", () => {
  it("quotes the measured duration, not an invented estimate for this run", async () => {
    await searchFor();
    const cost = document.querySelector(".import-cost")!;
    expect(cost, "no cost note before the scan button").toBeTruthy();
    // The one measurement in docs/MEASUREMENTS.md, quoted rather than extrapolated per game.
    expect(cost.textContent).toContain("971");
    expect(cost.textContent).toContain("43");
  });

  it("says the phone is unmeasured rather than guessing a multiplier", async () => {
    await searchFor();
    // docs/MEASUREMENTS.md: nothing in it was measured on a handset, and the import is the one
    // screen that asks the user to wait. Inventing a number here would be R2 with a stopwatch.
    expect(document.querySelector(".import-cost")!.textContent).toMatch(/בטלפון.*לא נמדד/s);
  });

  it("puts the cost ABOVE the button, where it can still change the decision", async () => {
    await searchFor();
    const cost = document.querySelector(".import-cost")!;
    const button = document.querySelector(".import-scan")!;
    expect(
      cost.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the cost note is not before the button it describes",
    ).toBeTruthy();
  });
});

describe("and what it buys, in the units the wait is counted in", () => {
  it("names both floors from the constants, so the sentence cannot drift", async () => {
    await searchFor();
    const buys = document.querySelector(".import-buys")!;
    expect(buys.textContent).toContain(String(PREREGISTERED_THRESHOLDS.minBucketN * 2));
    expect(buys.textContent).toContain(String(MIN_BUCKET_N * 2));
  });

  it("states it as a condition, and says what happens when the condition fails", async () => {
    /*
     * An import narrows the live search only when one of its buckets separates from the next by
     * two standard errors, and most will not. A screen promising the shortcut would be claiming
     * to know what a scan finds before running it -- and the failure case has to be on screen too,
     * or "nothing separated" reads as the scan having gone wrong.
     */
    await searchFor();
    const buys = document.querySelector(".import-buys")!.textContent ?? "";
    expect(buys).toMatch(/אם יימצא/);
    expect(buys).toMatch(/אם שום סוג לא נבדל/);
  });

  it("shows neither note before a search, when there is nothing to scan", async () => {
    // The cost of a scan is not a fact about an empty screen. Rendering it before a username has
    // returned any games would be describing a button that does not exist yet.
    render(<ImportGames onClose={() => {}} onLoad={() => {}} analyze={neverAnalyses} />);
    expect(document.querySelector(".import-cost")).toBeNull();
    expect(document.querySelector(".import-buys")).toBeNull();
  });
});

/*
 * THE NUMBER THE PRODUCT ASKED FOR, WAS GIVEN, AND THREW AWAY.
 *
 * `whiteRating` and `blackRating` were parsed at the boundary by both adapters and read by
 * nothing: a grep of the whole repository found zero consumers. Every import fetched a player's
 * rating from Lichess or Chess.com and dropped it on the floor. This holds the series that stops
 * it, and holds the three judgements inside it, because each one is a way to produce a series that
 * is quietly wrong rather than absent.
 */
describe("the rating the import already fetched is kept", () => {
  const game = (over: Partial<ImportedGame>): ImportedGame => ({
    id: "g", white: "erez", black: "someone", whiteRating: 1600, blackRating: 1800,
    status: "resign", speed: "blitz", timeControl: { initialMs: 180_000, incrementMs: 0 },
    rated: true, playedAt: Date.parse("2026-01-02T00:00:00Z"), opening: null, pgn: "",
    source: "lichess", ...over,
  });

  it("takes the player's own side, whichever colour they had", () => {
    /*
     * A player is white in some of their games and black in the others. Reading one side's number
     * produces a series that is half theirs and half their opponents', which looks like a series.
     */
    expect(ratingSeries([game({})], "erez")[0].value).toBe(1600);
    expect(ratingSeries([game({ white: "someone", black: "erez" })], "erez")[0].value).toBe(1800);
  });

  it("leaves a gap where the site gave no rating, rather than writing a zero", () => {
    // A gap in a series is a gap. A zero is a claim that somebody was rated zero.
    expect(ratingSeries([game({ whiteRating: null })], "erez")).toEqual([]);
    expect(ratingSeries([game({ rated: false })], "erez")).toEqual([]);
  });

  it("orders oldest first and carries the site, because two sites are two scales", () => {
    const series = ratingSeries(
      [game({ playedAt: Date.parse("2026-03-01T00:00:00Z"), whiteRating: 1650 }),
       game({ playedAt: Date.parse("2026-01-01T00:00:00Z"), whiteRating: 1600, source: "chesscom" })],
      "erez",
    );
    expect(series.map((r) => r.value)).toEqual([1600, 1650]);
    expect(series.map((r) => r.source)).toEqual(["chesscom", "lichess"]);
  });

  it("matches the account case-insensitively, which is how both sites hand names back", () => {
    expect(ratingSeries([game({ white: "Erez" })], "  erez ")[0].value).toBe(1600);
  });
});
