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

const fetchUserGames = vi.fn();
vi.mock("@/lib/lichess-public", () => ({
  fetchUserGames: (...args: unknown[]) => fetchUserGames(...args),
}));
// The engine is never reached in these tests -- nothing presses scan -- but the module must not
// load: importing stockfish.ts pulls 7MB of wasm into the graph and GATE-COMMIT forbids it here.
vi.mock("@/lib/import-run", () => ({ runImportDiagnostic: vi.fn() }));

const { ImportGames } = await import("@/components/ImportGames");

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
