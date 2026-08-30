// @vitest-environment jsdom
/**
 * The whole-game review.
 *
 * Two things are load-bearing and the rest is chart plumbing:
 *
 * R3 -- the review must not be reachable before a decision in this game has been committed and
 * revealed. Analysis on load is the machine speaking first, which is the one thing this product
 * exists not to do, and it is exactly what porting a dashboard invites.
 *
 * R1 -- every figure carries the count it came from. "45% accuracy" over five moves and over
 * eighty are different statements.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameReview } from "../../client/src/components/GameReview";

// Real Stockfish output, from docs/MEASUREMENTS.md: the Blackburne Shilling trap.
const SCORES = [37, 41, 35, 37, 46, 15, 96, 14, -39, -407, -406];

describe("the review as rendered", () => {
  it("states the count behind every rate (R1)", () => {
    render(<GameReview evalScores={SCORES} playerColor="w" totalPlies={10} />);
    /*
     * Five White moves were scored, and the accuracy figure has to say so. It used to say it in
     * a sibling <span> -- honest by adjacency, enforceable by nothing -- and now goes through
     * `Score`, which renders the provenance as "n=5" and cannot be called without the count.
     * Same R1 property, structurally instead of by convention.
     */
    const score = screen.getByText(/ציון דיוק/).closest(".value-triple");
    expect(score, "the score is not rendered through Value").toBeTruthy();
    expect(score!.textContent, "the score does not carry its n").toContain("n=5");
    // Several figures on this screen carry n=5; that is R1 working, not a duplicate.
    expect(screen.getAllByText("n=5").length).toBeGreaterThan(1);
  });

  it("names the classification in text, not only in colour", () => {
    render(<GameReview evalScores={SCORES} playerColor="w" totalPlies={10} />);
    // The blunder at ply 9 must be readable without seeing any colour at all.
    expect(screen.getByText("בלאנדר")).toBeTruthy();
  });

  it("refuses to review a game too short to measure", () => {
    render(<GameReview evalScores={[20, 15]} playerColor="w" totalPlies={2} />);
    expect(screen.getByText(/קצר מכדי למדוד/)).toBeTruthy();
  });

  it("says out loud that one game licenses no claim about the player", () => {
    render(<GameReview evalScores={SCORES} playerColor="w" totalPlies={10} />);
    expect(screen.getByText(/לא אומרת דבר על השחמט שלך/)).toBeTruthy();
  });
});

describe("the R3 gate", () => {
  // jsdom gives import.meta.url an http scheme, so resolve from the project root instead.
  const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("renders the review only at reveal, never on load", () => {
    const gate = home.indexOf('stage === "revealed" && (');
    const review = home.indexOf("<GameReview");
    expect(gate).toBeGreaterThan(-1);
    // The component appears INSIDE the guard, not before it.
    expect(review).toBeGreaterThan(gate);
  });

  it("never starts the review by itself", () => {
    // runGameReview must be reached from a click and from nothing else. An effect that called it
    // would put the engine's verdict on screen before the player had committed to anything.
    const calls = [...home.matchAll(/runGameReview/g)].length;
    expect(calls).toBe(2); // the definition and the onClick
    expect(home).not.toMatch(/useEffect\([^)]*runGameReview/);
  });

  it("keeps recharts out of the initial module graph", () => {
    // Same weight mistake the engine import was. A static import here would ship ~100KB of chart
    // library to a screen that has not decided anything yet.
    expect(home).not.toMatch(/^import .*recharts/m);
    /* `lazyChunk` is `lazy` with the stale-deploy case handled; what this asserts is that the
       import is still dynamic, which is what keeps recharts out of the initial graph. */
    expect(home).toMatch(/lazy(?:Chunk)?\(\(\)\s*=>\s*\n?\s*import\("@\/components\/GameReview"\)/);
  });
});
