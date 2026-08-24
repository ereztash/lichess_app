// @vitest-environment jsdom
/**
 * The opening screen has to be a game.
 *
 * This is the test that was missing for a whole day of "I cannot play". The application opened
 * on ply 12 of a canned demo PGN, with `source: "imported"` and no opponent. In that state:
 *
 *   - a board click cannot play a move, because while deciding an interaction only PROPOSES;
 *   - the opponent effect never runs, because it is gated on `source === "live"`;
 *   - so nothing the player clicked ever moved, and nobody ever answered.
 *
 * Measured in a real browser against the production build before the fix: 32 pieces on screen,
 * 18 half-moves already in the timeline, e2 empty and a pawn already on e4, zero legal-move
 * highlights when a piece was selected, no opponent. Every existing test passed throughout,
 * because every existing test checked a component in isolation or grepped a source file, and
 * the defect was in which state the page starts in.
 *
 * So these assertions render the actual page and look at the actual board.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import superjson from "superjson";
import { ThemeProvider } from "../../client/src/contexts/ThemeContext";
import Home from "../../client/src/pages/Home";
import { PIECES } from "@/lib/game-data";
import { trpc } from "../../client/src/lib/trpc";

/*
 * No server in a unit test, and that is the configuration this matters most in: a deployment
 * with no database and no OAuth portal is the one the player is using. Every tRPC call fails,
 * auth resolves to signed-out, and the record runs locally -- exactly the production path.
 */
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no server in this test")));
});

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });
  return render(
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" switchable>
          <Home />
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

const square = (name: string) => screen.getByRole("gridcell", { name });
/*
 * "white pawn" and "black pawn", not a glyph.
 *
 * These assertions used to compare the rendered character against "\u2659" and "\u265F", which
 * was a legitimate way to say "a WHITE pawn is on e2" only while the two colours used different
 * code points. They share one silhouette now (lib/game-data.ts), so the character no longer
 * carries the side and comparing it would quietly weaken the test into "some pawn is on e2".
 * The colour class is where that fact lives, so the helper reports both halves.
 */
const pieceOn = (name: string) => {
  const piece = square(name).querySelector(".piece");
  if (!piece) return null;
  const colour = piece.classList.contains("piece-w") ? "white" : "black";
  const type = Object.entries(PIECES.w).find(([, glyph]) => glyph === piece.textContent)?.[0];
  return `${colour} ${type ?? piece.textContent}`;
};

describe("the board the application opens on", () => {
  it("is the starting position, not the middlegame of somebody else's demo", () => {
    renderHome();
    // A white pawn on e2 and an empty e4 is the whole difference between move 1 and ply 12.
    expect(pieceOn("e2")).toBe("white p");
    expect(pieceOn("e4")).toBeNull();
    expect(pieceOn("d7")).toBe("black p");
    expect(document.querySelectorAll(".piece")).toHaveLength(32);
  });

  it("has no moves behind it", () => {
    renderHome();
    // A timeline with eighteen half-moves in it belongs to a game the player did not play.
    expect(document.querySelectorAll(".move-cell").length).toBe(0);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("עמדת פתיחה");
  });

  it("responds to a piece being selected", async () => {
    renderHome();
    await userEvent.click(square("e2"));
    // Two legal pawn pushes. Zero was the observed number before, because e2 held nothing.
    await waitFor(() => expect(document.querySelectorAll(".legal-square")).toHaveLength(2));
  });

  it("takes a move as a proposal and says so", async () => {
    renderHome();
    await userEvent.click(square("e2"));
    await userEvent.click(square("e4"));
    // The pawn deliberately does NOT move yet -- that is the commit-then-reveal protocol, and it
    // is the one thing here that was never broken. What matters is that the click registered.
    await waitFor(() => expect(document.querySelector(".chosen-marker")).toBeTruthy());
    expect(pieceOn("e2")).toBe("white p");
    expect(screen.getByText(/e2e4 נבחר/)).toBeTruthy();
  });

  it("tells the player who is on the other side", () => {
    renderHome();
    // "Choose a move and write your read" is true of an imported position too. Naming the
    // opponent is what makes the screen a game rather than an exercise.
    expect(screen.getByText(/Stockfish/)).toBeTruthy();
  });
});

describe("the two facts the opponent depends on", () => {
  /*
   * Source-level on purpose, and labelled as such. The opponent replies from an effect that
   * loads the 7MB engine, so jsdom cannot observe the reply; what it CAN do is pin the two
   * initial values the effect is gated on, both of which were wrong. The reply itself was
   * verified in a browser -- see the note in docs/FINDINGS.md.
   */
  const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const code = home.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("starts in a live game, because the opponent effect returns early otherwise", () => {
    expect(code).toMatch(/useState<AnalysisSource>\("live"\)/);
    expect(code).not.toMatch(/useState<AnalysisSource>\("imported"\)/);
  });

  it("starts with an opponent, because a null one means nobody moves", () => {
    // `useState<Opponent | null>(null)` is the exact line that made the opening screen unplayable.
    expect(code).not.toMatch(/useState<Opponent \| null>\(null\)/);
    expect(code).toMatch(/useState<Opponent \| null>\(\{/);
  });

  it("makes no claim about anyone's level", () => {
    // Option 1 was taken without the rating claim: a depth is a depth (R1). Nothing in this
    // build measures which rating a search depth plays at, so nothing may say one.
    expect(code).not.toMatch(/rating|דירוג ה?שחקן|רמת ה?שחקן/i);
  });
});
