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
    /*
     * THE ACQUISITION EVIDENCE LAYER, ADDED TO THIS LIST DELIBERATELY AND WITH ITS REASON.
     *
     * Each of these WRITES. `Home` emits the funnel's stages, `RevealPanel` emits which branch it
     * rendered -- from the same `theOneThing` value it renders, so the trial and the screen can
     * never disagree -- and `ValueReconstruction` puts the one qualitative question and stores the
     * answer. The rule this file exists for is unchanged and is asserted separately below: the
     * interface may not REACT to the log. The three narrow reads that exist -- has this event
     * fired, how many reveals, how many visits -- are about the protocol, not the player, and the
     * chess is identical whatever they return.
     *
     * What is NOT on this list and must never be: anything under `shared/`, and anything that
     * decides which position to serve, which reveal to show, or what to say.
     */
    "client/src/pages/Home.tsx",
    "client/src/components/RevealPanel.tsx",
    "client/src/components/ValueReconstruction.tsx",
    /*
     * THE FRONT DOOR, ADDED FOR ONE OF THE THREE READS THIS FILE ALREADY SANCTIONS.
     *
     * `Record.tsx` calls `visitsOnRecord()` and does exactly one thing with the answer: it stops
     * repeating an explanation to somebody who has already seen it (master plan §13). That is the
     * "how many visits" read named above -- about the protocol, not the player -- and the chess is
     * identical whatever it returns: no position, no reveal, no measurement and no sentence about
     * the player's play depends on it.
     *
     * WHAT IT MAY NOT GROW INTO is the reason this note is here rather than a bare string. The
     * moment this page reads an ATTEMPT, a funnel stage or a completion count, it is adapting to
     * how far along the player is, and the count read is not a licence for the rest of the log.
     */
    "client/src/pages/Record.tsx",
    /*
     * THE SHADOW, WHICH WRITES AND USES EXACTLY ONE OF THE THREE SANCTIONED READS.
     *
     * `next-action-shadow.ts` records what `deriveNextAction` WOULD have proposed beside what the
     * screen actually offers, so the derivation can be watched disagreeing with the product before
     * it is given any of it. It calls `trialEventSeen` for idempotency -- the "has this event
     * fired" read named above -- and nothing else out of the log.
     *
     * IT IS A LIB AND NOT A SCREEN, WHICH IS THE PART THAT NEEDED THOUGHT. A helper that writes the
     * log on a screen's behalf is exactly the shape of routing around this guard, and the
     * difference here is that its return value reaches no interface at all: the case below asserts
     * that `ResumeScreen` calls it as a STATEMENT and never binds the result. An entry added to
     * this list without a check for the thing it could become would be the list weakening itself.
     */
    "client/src/lib/next-action-shadow.ts",
    /*
     * THE ERROR SINK, WHICH WRITES ONE EVENT AND READS NOTHING.
     *
     * `error-sink.ts` records `failure_observed` -- a code from a closed list, its class, the
     * surface -- so a visit that stopped after `worker-refused` stops being the same row as a visit
     * that stopped for no reason. It calls `recordTrialEvent` and no read at all: it cannot know how
     * far along the player is, and nothing it does reaches a screen. The other thing it does with
     * the same five fields is send them to the same origin, which is the one transmission this
     * ledger permits and docs/OBSERVABILITY.md states; a code is not a decision.
     */
    "client/src/lib/error-sink.ts",
    /*
     * THE CONTINUATION EVENT'S ONE WRITER, AND WHY IT IS ON THIS LIST RATHER THAN IN `Home`.
     *
     * `O-2` makes `next_decision_started` the trial's most contestable definition, and it was an
     * effect in the middle of a 2,400-line component. `R-13`'s ratchet forced it out and
     * `GATE-CONTINUATION-IS-A-MOVE` now scans `client/src` for a second writer, so the file has to
     * be somewhere a scan can point at. It reads `revealsPresented` and `trialEventSeen` to decide
     * whether the event has already been recorded, which is the ledger answering a question about
     * ITSELF -- not the ledger telling a screen what to show. Nothing it returns reaches a render.
     */
    "client/src/lib/continuation-event.ts",
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

  /**
   * THE MODULE THE RESUME SCREEN USES INSTEAD, held to the same shape as the rule it sits beside.
   *
   * The first version of the resume screen read `previousVisitStartedAt()` out of the trial log to
   * answer "what changed since last time", and the assertion above fired on it. The replacement is
   * `client/src/lib/last-seen.ts`: one timestamp, written by the screen that reads it, feeding one
   * navigational sentence.
   *
   * THIS CASE EXISTS BECAUSE THAT IS ALSO WHAT ROUTING AROUND A GUARD LOOKS LIKE. The difference is
   * real -- nothing it returns can reach a measurement -- and a difference nobody checks is a
   * difference that lasts until the next commit. So the same import-graph assertion applies: one
   * screen, and nothing under `shared/`.
   */
  it("keeps the resume screen's own memory to one screen, and out of the measurements", () => {
    const importers = ["client/src", "shared", "server"]
      .flatMap((dir) => sources(resolve(root, dir)))
      .filter((file) => /from\s+["'][^"']*last-seen/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replaceAll("\\", "/"));

    expect(importers).toEqual(["client/src/components/ResumeScreen.tsx"]);
  });

  it("lets the shadow write, and never lets its answer reach a screen", () => {
    /*
     * THE RULE THIS FILE IS ABOUT IS "the interface may not REACT to the log", and a derivation
     * that ran beside a screen would be the most natural thing in the world to start rendering.
     * This is the check that says it has not: the call is a statement, its value is dropped, and
     * nothing else in the product calls it.
     */
    const shadow = readFileSync(resolve(root, "client/src/lib/next-action-shadow.ts"), "utf8");
    /*
     * The only read it takes from the log, and the ones it must never take.
     *
     * IT IS `trialEventSeenOn` AND THE SURFACE IS NOT DECORATION. Deduplicating by name alone meant
     * whichever screen rendered first wrote its row and every other surface was silently absent --
     * a ledger that looked like agreement with two thirds of the product missing from it.
     */
    expect(shadow).toMatch(/trialEventSeenOn\("next_action_shadow", surface\)/);
    expect(shadow, "the shadow reads more of the log than idempotency").not.toMatch(
      /trialEventEverSeen|previousVisitStartedAt|visitsOnRecord|progressReport|readUsage/,
    );

    const callers = ["client/src", "shared", "server"]
      .flatMap((dir) => sources(resolve(root, dir)))
      .filter((file) => /useNextActionShadow/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .filter((file) => file !== "client/src/lib/next-action-shadow.ts");
    expect(callers).toEqual(["client/src/components/ResumeScreen.tsx"]);

    const resume = readFileSync(resolve(root, "client/src/components/ResumeScreen.tsx"), "utf8");
    expect(resume, "the resume screen never calls the shadow at all").toMatch(
      /\n\s*useNextActionShadow\(/,
    );
    expect(resume, "the resume screen is listening to the shadow").not.toMatch(
      /(?:const|let|var|=)\s*[^;\n]*useNextActionShadow\(/,
    );
  });

  it("is not reachable from the shared measurements at all", () => {
    const shared = sources(resolve(root, "shared"))
      .filter((file) => /progress-record/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file));
    expect(shared, "a measurement module can see where players stopped").toEqual([]);
  });
});
