// @vitest-environment jsdom
/**
 * Two kinds of friction, and neither is fixed by the app knowing more.
 *
 * THE SLOT THAT WAS EMPTY. `ContextRibbon` is a reserved place at the top of the page for telling
 * a player something before they ask, and its own comment said what it actually did: "It renders
 * nothing at all on an ordinary visit, which is almost every visit" -- it fired only after a
 * three-day gap. Meanwhile `loopPosition()` was computing, on every render, the single sentence
 * that says which of record/detect/drill/grade is live and what stands between here and the next
 * one. That sentence rendered inside `LoopStrip`, beside the record, which after the panel took
 * that column is y=1368 on a 390x844 phone -- five hundred pixels below the fold.
 *
 * THE THINGS THE APP HAD AND FORGOT. The Lichess account is in the kept reading; the import field
 * opened with `useState("")` every time. The loaded game vanished with the tab, so every return
 * started at the opening position with five buttons offering to fetch one.
 *
 * THE LINE, and every test here is on one side of it. Routing to a state the record already holds
 * is allowed: the same record produces the same sentence, deterministically, from counts that are
 * on screen elsewhere anyway. Ranking options by predicted value is the recommendation engine the
 * product refuses. Nothing here reads what the detector measures -- time, phase, clock -- and the
 * ribbon says so out loud in its own disclosure.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContextRibbon } from "@/components/ContextRibbon";
import { ImportGames } from "@/components/ImportGames";
import { loopPosition } from "@/lib/loop-position";
import { clearPosition, readPosition, writePosition } from "@/lib/session-position";

/*
 * The ribbon reads the record through three hooks that need a tRPC context, an auth context and a
 * query client. Mounting all three to assert what one <aside> renders would be testing the
 * harness; the hooks are stubbed and the component is the subject.
 *
 * `useLoopPosition` is stubbed rather than driven because its own inputs are covered where they
 * live -- `loop-position.ts` has its own tests, and the assertion here is about whether the
 * sentence reaches the screen at all, which is precisely what was wrong.
 */
const loopStub = vi.hoisted(() => ({
  value: { position: { step: "record", headline: "עוד 60 החלטות מדודות.", basis: "0 מתוך 0" }, loading: false },
}));
vi.mock("@/lib/use-loop-position", () => ({ useLoopPosition: () => loopStub.value }));
vi.mock("@/lib/record-api", () => ({
  useDecisionCount: () => ({ data: { decisions: 12 }, refetch: () => {} }),
  useRecordReading: () => ({ data: { scored: 5 } }),
}));

const root = resolve(__dirname, "../..");
const emptyLine = () => ({ scoreCp: 0, depth: 0, pv: [], fen: "" });

/**
 * A file with its comments removed, which is the only thing worth asserting against.
 *
 * The first version of the assertions below read the raw source and went red on the components'
 * own doc comments -- LoopStrip's note explaining that `position.headline` MOVED OUT matched a
 * pattern asserting the strip does not render it. A source test that a paragraph of prose can
 * fail is not testing the code. `piece-and-panel-weight.test.tsx` already strips comments out of
 * the stylesheet for exactly this reason.
 */
const code = (path: string) =>
  readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

beforeEach(() => localStorage.clear());

describe("the sentence the app already computed reaches the top of the page", () => {
  it("is rendered by the ribbon and no longer by the strip", () => {
    /*
     * Relocation, not duplication. `LoopStrip`'s own note refuses "a fourth copy of any of
     * those", and two copies is where four starts -- so the rail keeps the picture and the ribbon
     * takes the sentence. Asserted against the sources because the two components are the whole
     * point: one of them must have it and the other must not.
     */
    const ribbon = code("client/src/components/ContextRibbon.tsx");
    const strip = code("client/src/components/LoopStrip.tsx");
    expect(ribbon, "the ribbon does not render the loop position").toMatch(
      /position\.headline/,
    );
    expect(strip, "the strip still renders the sentence as well").not.toMatch(/position\.headline/);
    // And the rail stayed where the record is.
    expect(strip).toMatch(/stepStates\(position\.step\)/);
  });

  it("derives both surfaces from one hook, so they cannot drift", () => {
    const ribbon = code("client/src/components/ContextRibbon.tsx");
    const strip = code("client/src/components/LoopStrip.tsx");
    for (const [name, source] of [["ribbon", ribbon], ["strip", strip]] as const) {
      expect(source, `the ${name} computes the position itself`).toMatch(/useLoopPosition/);
      expect(source, `the ${name} calls loopPosition directly`).not.toMatch(/loopPosition\(/);
    }
  });

  it("carries the basis with the sentence, never without it", () => {
    // R1. A distance with nothing behind it is a claim; `loopPosition` returns both for exactly
    // this reason and a surface that dropped one would be reporting the wrong half.
    const ribbon = code("client/src/components/ContextRibbon.tsx");
    expect(ribbon).toMatch(/context-loop-basis/);
    expect(ribbon).toMatch(/position\.basis/);
  });

  it("routes, and does not rank", () => {
    /*
     * The constraint, expressed where it can fail. `loopPosition` is a pure function of counts:
     * the same record gives the same sentence every time. If it ever became a ranking over what
     * would help most, this is the assertion that should have stopped it.
     */
    const inputs = {
      drill: null,
      recorded: 12,
      scored: 7,
      awaitingReveal: 5,
      withoutConfidence: 0,
      readElsewhere: 0,
      claimGrade: null,
      scoredStillNeeded: 53,
      narrowedTo: null,
    };
    expect(loopPosition(inputs)).toEqual(loopPosition({ ...inputs }));
    // And nothing the detector buckets on reaches it: no time, no phase, no clock.
    expect(Object.keys(inputs)).not.toContain("secondsTaken");
    expect(Object.keys(inputs)).not.toContain("phase");
    expect(Object.keys(inputs)).not.toContain("clockMsRemaining");
  });

  it("puts the sentence on screen on an ORDINARY visit, which is almost every visit", () => {
    /*
     * The defect, as a render. Nothing was stored for a previous visit, so the return-gap line
     * does not fire -- which used to mean the whole ribbon returned null and the reserved slot at
     * the top of the page stayed blank.
     */
    render(<ContextRibbon />);
    expect(
      screen.getByText("עוד 60 החלטות מדודות."),
      "the slot is empty again on an ordinary visit",
    ).toBeInTheDocument();
    expect(document.querySelector(".context-loop-basis")?.textContent).toBe("0 מתוך 0");
  });

  it("says nothing about the record while it is still being read, and holds the slot anyway", () => {
    /*
     * R2 UNCHANGED, THE BLANK FRAME REPLACED. A record still loading is not a record with nothing
     * in it, and a guessed position is worse than a blank first frame -- so no sentence about the
     * player, and no basis line, until the record answers.
     *
     * What changed is what "blank" means. Rendering NOTHING here was measured to cost CLS 0.066 on
     * `/play`: this ribbon appearing above the board dropped `section.workbench` 98 pixels after
     * paint. The slot is now held at the height it will fill, with the same sentence the front
     * door uses while it reads. Nothing is claimed that has not been measured; the space is
     * reserved for a claim that is certainly coming, because `loopPosition` returns a position for
     * every one of its states and cannot return null.
     */
    const previous = loopStub.value;
    try {
      loopStub.value = { position: null, loading: true } as never;
      render(<ContextRibbon />);
      const ribbon = document.querySelector(".context-ribbon");
      expect(ribbon, "the slot is not held, so the board moves when it fills").not.toBeNull();
      expect(ribbon).toHaveClass("is-reading");
      expect(ribbon?.getAttribute("aria-busy")).toBe("true");
      // Nothing derived from a record that has not answered.
      expect(document.querySelector(".context-loop-basis")).toBeNull();
      expect(screen.queryByText(/החלטות מדודות/)).toBeNull();
    } finally {
      // Restored in `finally`: a leak here used to fail the NEXT test rather than this one.
      loopStub.value = previous;
    }
  });

  it("keeps the sentence when the return notice is dismissed", async () => {
    /*
     * The gap line is a notice and closes; the loop position is standing orientation and does
     * not. "הבנתי" used to close the whole ribbon, which was right when the ribbon was only ever
     * a notice.
     */
    localStorage.setItem(
      "decision-lab-usage-v1",
      JSON.stringify({ lastVisitAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), visitCount: 4 }),
    );
    render(<ContextRibbon />);
    const dismiss = screen.getByRole("button", { name: "הבנתי" });
    expect(document.querySelector(".context-reorientation")).not.toBeNull();
    await userEvent.click(dismiss);
    expect(document.querySelector(".context-reorientation")).toBeNull();
    expect(
      screen.getByText("עוד 60 החלטות מדודות."),
      "dismissing the notice closed the position too",
    ).toBeInTheDocument();
  });

  it("keeps the gap notice dismissible and the position not", () => {
    /*
     * "הבנתי" used to close the whole ribbon, which was right when the ribbon was only a notice.
     * Closing the one line that says what the record is waiting for would be closing the thing
     * this slot is now for, so dismissal applies to the return-gap line alone.
     */
    const ribbon = code("client/src/components/ContextRibbon.tsx");
    expect(ribbon).toMatch(/reorientation\s*&&\s*\(\s*\n?\s*<button[^>]*context-dismiss/);
    expect(ribbon, "dismissing still hides the loop position").not.toMatch(
      /if \(!presentation\?\.reorientation \|\| dismissed\) return null/,
    );
  });
});

describe("the import field is filled from the record that already holds the account", () => {
  const setup = (props: Partial<Parameters<typeof ImportGames>[0]> = {}) =>
    render(
      <ImportGames
        onLoad={vi.fn()}
        onClose={vi.fn()}
        analyze={async () => emptyLine() as never}
        {...props}
      />,
    );

  it("opens with the account of the last kept reading", () => {
    setup({ lastUsername: "erez281" });
    expect(screen.getByPlaceholderText("lichess username")).toHaveValue("erez281");
  });

  it("opens empty when nothing has ever been scanned", () => {
    // Section 4.5: "no reading yet" and "a reading from erez281" are different states, and a
    // placeholder standing in for a real value would be the product inventing one.
    setup();
    expect(screen.getByPlaceholderText("lichess username")).toHaveValue("");
  });

  it("fills in when the reading arrives late, because the record is read asynchronously", () => {
    const { rerender } = setup();
    expect(screen.getByPlaceholderText("lichess username")).toHaveValue("");
    rerender(
      <ImportGames
        onLoad={vi.fn()}
        onClose={vi.fn()}
        analyze={async () => emptyLine() as never}
        lastUsername="erez281"
      />,
    );
    expect(screen.getByPlaceholderText("lichess username")).toHaveValue("erez281");
  });

  it("never rewrites a field the player has started typing in", async () => {
    /*
     * The one that matters. The reading resolves asynchronously, so a naive effect would replace
     * a half-typed account mid-word -- the interface overriding a person, which is worse than an
     * empty field. Prefilling is a convenience and loses every argument with an actual keystroke.
     */
    const { rerender } = setup();
    await userEvent.type(screen.getByPlaceholderText("lichess username"), "magnus");
    rerender(
      <ImportGames
        onLoad={vi.fn()}
        onClose={vi.fn()}
        analyze={async () => emptyLine() as never}
        lastUsername="erez281"
      />,
    );
    expect(screen.getByPlaceholderText("lichess username")).toHaveValue("magnus");
  });

  it("stays an ordinary field, so a second account is just typed over", async () => {
    setup({ lastUsername: "erez281" });
    const field = screen.getByPlaceholderText("lichess username");
    await userEvent.clear(field);
    await userEvent.type(field, "someone-else");
    expect(field).toHaveValue("someone-else");
  });
});

describe("the game survives the tab", () => {
  const game = {
    sans: ["e4", "e5", "Nf3"],
    ply: 2,
    source: "live" as const,
    orientation: "w" as const,
    opponent: { playerColor: "w" as const, depth: 4 as never },
    gameId: "live-123",
    // The arm is part of the position now: a game resumed into the other one is a different
    // condition, and the record stores which was in force per decision.
    revealTiming: "per-decision" as const,
    measurementProtocol: null,
    protocolVersion: null,
    analysisTiming: null,
    firstDecisionPly: null,
  };

  it("comes back after the store is reconstructed, which is what closing the tab does", () => {
    writePosition(game);
    const back = readPosition();
    expect(back, "the position did not survive").not.toBeNull();
    expect(back!.sans).toEqual(["e4", "e5", "Nf3"]);
    expect(back!.ply).toBe(2);
    expect(back!.gameId, "a resumed game must stay the same game on the record").toBe("live-123");
  });

  it("stamps when it was saved, rather than letting the caller choose", () => {
    const at = new Date("2026-08-25T12:00:00.000Z");
    writePosition(game, at);
    expect(readPosition()!.savedAt).toBe(at.toISOString());
  });

  it("returns null before anything was ever saved", () => {
    expect(readPosition()).toBeNull();
  });

  it("refuses a stored shape it does not understand rather than half-restoring it", () => {
    /*
     * A blob from an older or newer build is not a position. Returning a partial one would put a
     * board on screen that nobody can account for, and the caller has the same thing to do about
     * every failure here: start fresh.
     *
     * EVERY CASE IS ONE FIELD WRONG, and the first version of this test was not. It spread
     * `game`, which is the WRITE shape and carries no `savedAt` -- so all seven cases were
     * rejected on a missing timestamp and none of them ever reached the guard it was named after.
     * A control that coerced the `ply` guard away survived because of it. The complete stored
     * object is built here first, and the positive case below proves it really does parse.
     */
    const stored = { ...game, savedAt: "2026-08-25T12:00:00.000Z" };
    localStorage.setItem("decision-lab.position.v1", JSON.stringify(stored));
    expect(readPosition(), "the valid shape does not parse, so nothing below tests a guard")
      .not.toBeNull();

    for (const [label, bad] of [
      ["not json", "{"],
      ["null", "null"],
      ["a bare string", '"position"'],
      ["moves that are not moves", JSON.stringify({ ...stored, sans: [1, 2] })],
      ["a ply that is not a number", JSON.stringify({ ...stored, ply: "two" })],
      ["a fractional ply", JSON.stringify({ ...stored, ply: 1.5 })],
      ["a source nothing declares", JSON.stringify({ ...stored, source: "telepathy" })],
      ["an orientation that is not a colour", JSON.stringify({ ...stored, orientation: "sideways" })],
      ["an empty game id", JSON.stringify({ ...stored, gameId: "" })],
      ["no saved-at", JSON.stringify({ ...game })],
      ["an opponent that is not one", JSON.stringify({ ...stored, opponent: { playerColor: "q", depth: 4 } })],
    ] as const) {
      localStorage.setItem("decision-lab.position.v1", bad);
      expect(readPosition(), `restored something from ${label}`).toBeNull();
    }
  });

  it("can be forgotten", () => {
    writePosition(game);
    clearPosition();
    expect(readPosition()).toBeNull();
  });

  it("stores the moves and not the snapshots", () => {
    /*
     * chess.js derives the position from the moves, so storing both would be two sources of truth
     * for one board and a stored FEN that disagreed with its own move list would be unresolvable.
     */
    writePosition(game);
    const raw = localStorage.getItem("decision-lab.position.v1")!;
    expect(raw).not.toMatch(/fen/i);
    expect(raw).not.toMatch(/rnbqkbnr/);
  });

  it("does not restore a half-answered decision", () => {
    /*
     * R2, and the reason this is a refusal rather than an omission. The seconds-taken clock starts
     * when a position is presented; a draft resumed an hour later would carry an hour of thinking
     * time into the record as if it had been measured.
     */
    expect(code("client/src/lib/session-position.ts")).not.toMatch(
      /draft|confidence|knownTags|unknownTags/,
    );
  });

  it("is not written while a drill or a transfer owns the board", () => {
    // Neither is a game to come back to: restoring one would resume a test the record has already
    // moved past.
    expect(code("client/src/pages/Home.tsx")).toMatch(/if \(drill \|\| learningTransfer\) return;/);
  });

  it("restores once, and never fights the player afterwards", () => {
    const home = code("client/src/pages/Home.tsx");
    expect(home).toMatch(/const restored = useRef\(false\)/);
    expect(home).toMatch(/if \(restored\.current\) return;\s*\n\s*restored\.current = true;/);
  });
});

/**
 * The resumed transfer run picks up where the record is.
 *
 * Asserted against the source because the alternative is mounting the board, an engine worker and
 * a store to observe one `useState` call. The claim is narrow and the wiring is the whole of it:
 * `beginLearningTransfer` returns `observed` with a resumed transfer, and the client must use it
 * rather than resetting to zero.
 */
describe("a transfer run resumes where it stopped", () => {
  it("seeds the index and the counter from the record, not from zero", () => {
    /*
     * Scoped to the block that installs the transfer. `closeLearningTransfer` also resets the
     * index to 0 and is right to -- it is tearing the run down, not starting one -- so a
     * whole-file assertion would be red for the wrong reason.
     */
    const home = code("client/src/pages/Home.tsx");
    const install = home.slice(home.indexOf("setLearningTransfer(response.transfer)"));
    const block = install.slice(0, install.indexOf("setLearningTransferVerdict"));
    expect(block, "the resumed run restarts at position 0").not.toMatch(
      /setLearningTransferIndex\(0\)/,
    );
    expect(block).toMatch(/setLearningTransferIndex\(response\.observed\)/);
    expect(block).toMatch(/setLearningTransferObservations\(response\.observed\)/);
  });

  it("retries the drill completion, which is what makes its repair branch reachable", () => {
    /*
     * `finishDrill` repairs a claim whose grade write was lost -- and only if something calls it
     * again. This catch sets the stage to "done", where `DrillRunner` renders an error paragraph
     * and no control: the verdict block is gated on `verdict`, the abandon button on
     * briefing|running, and the drill id lives only in React state. Without the retry the repair
     * branch could not run at all.
     */
    const home = code("client/src/pages/Home.tsx");
    expect(home).toMatch(/retryOnce\(\(\) => completeDrillMutation\.mutateAsync\(drillPayload\)\)/);
    // Built once and sent twice: a rebuilt payload is a different question.
    expect(home).toMatch(/const drillPayload = \{ drill_id: drill\.drill_id/);
  });

  it("puts the reveal-timing arm back on the board it was restored onto", () => {
    /*
     * The arm is an experimental condition, and it was the one field the handoff did not carry:
     * a deferred game resumed as a coached one, and the record ended up holding a single game
     * whose halves say different things about which condition was in force.
     *
     * `session-position` refuses a stored position that cannot name its arm -- that half has its
     * own tests. This is the other half: the board must actually apply it. A first version of this
     * change stored and parsed the arm and quietly did not restore it, and every test still passed.
     */
    const home = code("client/src/pages/Home.tsx");
    const restore = home.slice(home.indexOf("const saved = readPosition()"));
    const block = restore.slice(0, restore.indexOf("gameId.current = saved.gameId"));
    expect(block, "the restored game keeps whatever arm the board happened to default to").toMatch(
      /setRevealTiming\(saved\.revealTiming\)/,
    );
    /*
     * And written back with the game, so the next reload reads it rather than the default.
     *
     * SCOPED TO THE CALL RATHER THAN MATCHED BY ADJACENCY. This asserted that `revealTiming` was
     * followed immediately by `gameId`, which made it a test of field ORDER: adding any field
     * between them broke it while the arm was still written back correctly. What it is about is
     * that the write-back carries the arm, and that is what it now says.
     */
    const write = home.slice(home.indexOf("writePosition({", home.indexOf("if (drill || learningTransfer) return;")));
    const call = write.slice(0, write.indexOf("});"));
    expect(call, "the write-back does not carry the arm").toContain("revealTiming,");
    expect(call).toContain("gameId: gameId.current");
  });

  it("is served by the service, so the client is not guessing", () => {
    const service = code("shared/record-service.ts");
    // Returned beside the resumed transfer, from the rows themselves.
    expect(service).toMatch(/observed: \(await store\.listLearningTransferObservations\(/);
  });
});
