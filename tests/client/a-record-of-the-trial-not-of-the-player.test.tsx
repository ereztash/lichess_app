// @vitest-environment jsdom
/**
 * Where a visit stopped, and the line that keeps it from becoming telemetry.
 *
 * Nothing in this application measured the application. A tester who fills three of the four
 * steps and leaves is, in every record kept, identical to a tester who never opened the screen --
 * so a five-person trial could report "three of five stopped" and nothing about where. That is
 * the one thing a trial of that size cannot afford not to see, because five people is one attempt.
 *
 * THE LINE. Section 4.1 forbids the INTERFACE REACTING to how fast, how sure or how far along a
 * player is: an interface that reacts enters the measurement, and "under 45 seconds" stops being
 * a fact about the player and becomes a fact about the player and what the screen did to them at
 * second forty. Where somebody stopped is not a decision variable, and this file holds three
 * things that keep it from becoming one:
 *
 *   - the log is WRITTEN AND NEVER READ, asserted over the import graph rather than intended;
 *   - it holds no move, no FEN, no confidence value and no typed text;
 *   - it derives nothing -- no rate, no average -- because a completion rate here would be this
 *     module making a claim about the person.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { beginVisit, clearProgress, progress, progressReport } from "@/lib/progress-record";
import { answerEveryStep, openStep } from "../fixtures/commitment-steps";
import type { PositionUnderDecision } from "@/lib/decision-session";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
const POSITION: PositionUnderDecision = { gameId: "g", fen: FEN, ply: 7, clockMsRemaining: null, purpose: "anchor" };

const renderScreen = (overrides: Partial<Parameters<typeof CommitmentScreen>[0]> = {}) =>
  render(
    <CommitmentScreen
      position={POSITION}
      chosenMove={null}
      candidatesConsidered={[]}
      onCommit={vi.fn()}
      pending={false}
      {...overrides}
    />,
  );

/** Every attempt across every visit, in order. */
const attempts = () => progress().flatMap((visit) => visit.attempts);

beforeEach(() => {
  clearProgress();
  beginVisit(new Date("2026-08-27T08:00:00.000Z"));
});

describe("a visit that stopped somewhere says where", () => {
  it("records what was answered and what was open when the screen went away", () => {
    const { unmount } = renderScreen({ chosenMove: "g8f6" });
    openStep("known");
    fireEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    openStep("unknown");
    unmount();

    expect(attempts()).toHaveLength(1);
    const [attempt] = attempts();
    expect(attempt.outcome).toBe("left");
    expect(attempt.done, "the steps that were answered were not recorded").toEqual([
      "chosenMove",
      "known",
    ]);
    expect(attempt.open, "the step they were sitting on was not recorded").toBe("unknown");
  });

  it("separates a player who was stopped from one who wandered off", () => {
    /*
     * THE MOST INFORMATIVE NUMBER HERE. Pressing record on an incomplete draft is a player who
     * WANTED to finish, which reads nothing like a player who drifted away, and the two would be
     * one row without this. A refusal does not end the attempt -- they are still on the screen.
     */
    const { unmount } = renderScreen({ chosenMove: "g8f6" });
    const record = screen.getByRole("button", { name: /חסר/ });
    fireEvent.click(record);
    fireEvent.click(record);
    expect(attempts(), "a refusal ended the attempt").toHaveLength(0);
    unmount();
    expect(attempts()[0].refusals, "the refused attempts were not counted").toBe(2);
    expect(attempts()[0].outcome).toBe("left");
  });

  it("records a completed decision as completed", () => {
    const onCommit = vi.fn();
    renderScreen({ chosenMove: "g8f6", onCommit });
    answerEveryStep({ known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 5 });
    fireEvent.click(screen.getByRole("button", { name: /רשמו את ההחלטה|רשמו/ }));

    expect(onCommit).toHaveBeenCalled();
    expect(attempts()).toHaveLength(1);
    expect(attempts()[0].outcome).toBe("recorded");
    expect(attempts()[0].done).toEqual(["chosenMove", "known", "unknown", "confidence"]);
  });
});

describe("what the log is not allowed to hold", () => {
  it("carries no move, no position, no confidence value and no words", () => {
    /*
     * UNMOUNTED FIRST, and the reason is a positive control that stayed green. The first version
     * of this case answered every step and then read the log -- which at that moment held an
     * OPEN attempt and therefore nothing at all, so a mutation that copied the FEN onto every
     * attempt passed it. An assertion over an empty log asserts nothing; the attempt has to be
     * closed before there is anything to inspect.
     */
    const { unmount } = renderScreen({ chosenMove: "g8f6" });
    answerEveryStep({ known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 6 });
    unmount();
    expect(attempts(), "nothing was written, so this case would assert over nothing").toHaveLength(
      1,
    );
    const written = JSON.stringify(progress()) + "\n" + progressReport();
    for (const forbidden of ["g8f6", FEN, "rnbq", "המרכז פתוח", "לא יודע איך הוא יענה"])
      expect(written, `the trial log kept "${forbidden}"`).not.toContain(forbidden);
    // The confidence LEVEL, which is the variable the whole product measures.
    expect(written, "the trial log kept a stated confidence").not.toMatch(/ביטחון\s*6|"confidence":\s*6/);
  });

  it("derives nothing about the person from what it counted", () => {
    // A completion RATE would be this module grading the player, in a file built not to.
    const { unmount } = renderScreen({ chosenMove: "g8f6" });
    answerEveryStep({ known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 4 });
    unmount();
    expect(attempts()).toHaveLength(1);
    expect(progressReport()).not.toMatch(/%|ממוצע|שיעור/);
  });
});

describe("nothing reads it back", () => {
  /**
   * The rule as an assertion over the import graph.
   *
   * "It is only written" is a promise a later commit breaks by accident -- one `progress()` call
   * inside a component that wants to be helpful, and the interface is reacting to how far along
   * the player is. Three files may import it: the root that opens a visit, the screen that closes
   * an attempt, and the drawer that hands the log to a person. Anything else, and especially
   * anything under `shared/` where the measurements live, is the defect.
   */
  const root = resolve(__dirname, "../..");
  const ALLOWED = new Set([
    "client/src/App.tsx",
    "client/src/components/CommitmentScreen.tsx",
    "client/src/components/SelfCheck.tsx",
    "client/src/lib/progress-record.ts",
  ]);

  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sources(full));
      else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
    }
    return out;
  }

  it("is imported only by the root, the screen that writes it, and the drawer that hands it over", () => {
    const importers = ["client/src", "shared", "server"]
      .flatMap((dir) => sources(resolve(root, dir)))
      .filter((file) => /from\s+["'][^"']*progress-record/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replaceAll("\\", "/"));

    for (const file of importers)
      expect(ALLOWED.has(file), `${file} imports the trial log, which nothing may read`).toBe(true);
  });

  it("is not reachable from the shared measurements at all", () => {
    const shared = sources(resolve(root, "shared"))
      .filter((file) => /progress-record/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file));
    expect(shared, "a measurement module can see where players stopped").toEqual([]);
  });
});
