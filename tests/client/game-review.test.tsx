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
import { makingEvidence } from "@/lib/decision-session";
import { DECISION_STAGES } from "@shared/decision-stage";
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
    /*
     * THE GUARD IS THE SURFACE NOW. The review used to sit in `Home.tsx` behind
     * `stage === "revealed" && (`; P1.7 moved it into `RecordExplorer`, which `Home` renders in one
     * place -- after the branch that separates the evidence-producing stages from the reveal, and
     * behind a control the player presses. So the guard is not a condition wrapping a component in
     * a 2,400-line file; it is the only place the component exists.
     *
     * AND `focus` IS THAT CONDITION, ASSERTED RATHER THAN SPELLED OUT. `makingEvidence(stage)` is
     * false in exactly one stage, so the branch below it IS `stage === "revealed"` -- checked
     * against the function instead of against a string this file would have to keep in step.
     */
    expect(home.indexOf("<GameReview"), "the review is back in the page").toBe(-1);
    const explorer = readFileSync(
      resolve(process.cwd(), "client/src/components/RecordExplorer.tsx"),
      "utf8",
    );
    expect(explorer).toMatch(/<GameReview/);

    const branch = home.indexOf(") : focus ? (");
    const rendered = home.indexOf("<RecordExplorer");
    expect(branch, "the focus branch is gone").toBeGreaterThan(-1);
    expect(rendered, "the explorer renders before the reveal").toBeGreaterThan(branch);
    /*
     * BOUNDED, BECAUSE THE SUSPENSE BOUNDARY SITS BETWEEN THEM. The explorer is a lazy
     * chunk -- a surface that renders only on a press has no business in the bytes every
     * arrival downloads -- so `{exploring && (` is followed by a `<Suspense>` and then the
     * component. The span is capped so this cannot quietly start matching across the file.
     */
    expect(home).toMatch(/\{exploring && \([\s\S]{0,200}?<RecordExplorer/);

    for (const stage of DECISION_STAGES) {
      expect(makingEvidence(stage), stage).toBe(stage !== "revealed");
    }
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
