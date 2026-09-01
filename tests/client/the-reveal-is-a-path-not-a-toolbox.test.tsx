// @vitest-environment jsdom
/**
 * P1.7: `REVEAL` and `EXPLORE` are two states of one screen, and they now render as two states.
 *
 * WHAT THE REVEAL COLUMN WAS. Nine sections at once: the reveal, the value question, the engine's
 * lines, a rule composer, a drill runner, the whole-game review, the claim panel, the learning
 * queue, the record dashboard and the Lichess layers. Every one is worth having and none of them
 * is what a player opened that screen for -- they came to find out what the decision they just
 * made turned out to be. A column of nine sections does not offer nine things; it offers a search.
 *
 * SO THE MODE IS THE STRUCTURE. `shared/interaction-mode.ts` already separates `REVEAL` -- whose
 * one central thing is "the one thing this decision showed" -- from `EXPLORE`, "the position being
 * looked at". This file holds the screen to that table.
 *
 * WHAT STAYED WITH THE REVEAL, AND WHY IT IS NOT AN EXCEPTION. The rule composer acts on the
 * decision that was just revealed; burying the one thing the product wants a player to do with a
 * finding would break its own loop. A running drill or transfer stays too: a run in progress is
 * `TEST`, not `EXPLORE`, and its progress is not something to go looking for.
 *
 * `EXPLORE` PERMITS EVERYTHING BECAUSE NOTHING IS AT STAKE IN IT. The decision is committed,
 * revealed and stored, and the engine has already spoken -- so nothing on that surface can change
 * what any of it said. That is the property that makes it safe to show all of it at once, and it
 * is the property `MODE_CONTRACT` states.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MODE_CONTRACT } from "@shared/interaction-mode";
import { RecordExplorer, type RecordExplorerProps } from "@/components/RecordExplorer";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const home = read("client/src/pages/Home.tsx");

vi.mock("@/lib/trpc", () => ({
  trpc: {
    lichess: { postGameLayers: { useQuery: () => ({ data: undefined, isLoading: false }) } },
    record: {},
    useUtils: () => ({}),
  },
}));
vi.mock("@/components/ClaimPanel", () => ({
  ClaimPanel: () => <section className="claim-panel">claims</section>,
}));
vi.mock("@/components/LearningQueue", () => ({
  LearningQueue: () => <section className="learning-queue">queue</section>,
}));
vi.mock("@/components/LichessLayersPanel", () => ({
  LichessLayersPanel: () => <section className="lichess-layers">layers</section>,
}));
vi.mock("@/components/AnalysisPanel", () => ({
  AnalysisPanel: () => <aside className="analysis-column">analysis</aside>,
}));

const PROPS: RecordExplorerProps = {
  position: { fen: "8/8/8/8/8/8/8/K6k w - - 0 1", material: { white: 0, black: 0 } },
  engine: { analysis: null, alternative: null, status: "idle" as never, onAnalyze: vi.fn() },
  review: {
    progress: null,
    scores: null,
    error: null,
    orientation: "w",
    totalPlies: 20,
    onRun: vi.fn(),
  },
  record: undefined,
  lichess: { source: "live" as never, enabled: false, onConnect: vi.fn() },
  claims: { onRunDrill: vi.fn(), drillError: undefined },
  learning: { onStart: vi.fn(), busy: false, error: undefined },
};

describe("the toolbox has one door", () => {
  it("is behind a control the player presses, and the control says what is behind it", () => {
    /*
     * NOT A SECOND PRIMARY ACTION. The primary action of a reveal is the next decision and it lives
     * in the header; this is a way to look at the record, at lower weight, and it names itself.
     */
    expect(home).toMatch(/className="explore-toggle"/);
    expect(home).toMatch(/aria-expanded=\{exploring\}/);
    /*
     * BOUNDED, BECAUSE THE SUSPENSE BOUNDARY SITS BETWEEN THEM. The explorer is a lazy
     * chunk -- a surface that renders only on a press has no business in the bytes every
     * arrival downloads -- so `{exploring && (` is followed by a `<Suspense>` and then the
     * component. The span is capped so this cannot quietly start matching across the file.
     */
    expect(home).toMatch(/\{exploring && !runInProgress && \([\s\S]{0,200}?<RecordExplorer/);
  });

  it("closes itself when a new reveal arrives, because a mode is not a preference", () => {
    /*
     * KEYED ON THE REVEALED DECISION AND NOT ON THE STAGE. The stage returns to `deciding` from six
     * different places, and a reset that had to be added to all six is one that gets added to five.
     * A new decision id is exactly the event "there is something new to read".
     */
    expect(home).toMatch(/useEffect\(\(\) => setExploring\(false\), \[revealedDecisionId\]\)/);
  });

  it("is not offered at all while a pre-registered run is under way (P1.12)", () => {
    /*
     * A RUN IN PROGRESS IS `TEST`, NOT `REVEAL`. `MODE_CONTRACT.TEST` forbids prior evidence for
     * the same reason `DECIDE` does: the positions in a drill or a transfer were chosen in advance
     * to test one thing, and a player who opens the record dashboard between position three and
     * position four has been shown their own measurements in the middle of producing more.
     *
     * `EXPLORE` is safe at an ordinary reveal precisely because nothing is at stake there. In a run
     * something is -- the run's own verdict -- which is why the toolbox is absent rather than
     * merely quiet.
     */
    expect(MODE_CONTRACT.TEST.priorEvidence, "TEST would permit a reading of the record").toBe(false);
    expect(MODE_CONTRACT.TEST.producingEvidence).toBe(true);

    /* Both the control and the surface are gated on the same fact, not just the control. */
    expect(home).toMatch(/\{!runInProgress && \(/);
    expect(home).toMatch(/\{exploring && !runInProgress && \(/);
    /* And that fact is a run, named where it is derived rather than inlined at each use. */
    expect(home).toMatch(
      /const runInProgress =\s*learningTransfer !== null \|\| \(drill !== null && drillStage === "running"\)/,
    );
  });

  it("keeps the two things that act on the decision with the decision", () => {
    /*
     * THE COMPOSER AND A RUNNING RUN STAY. One acts on the reveal that is on screen; the other is
     * a set of positions the player agreed to work through, and `TEST` is not `EXPLORE`.
     */
    const explorer = read("client/src/components/RecordExplorer.tsx");
    expect(explorer).not.toMatch(/<LearningRuleComposer/);
    expect(explorer).not.toMatch(/<DrillRunner/);
    expect(home).toMatch(/<LearningRuleComposer/);
    expect(home).toMatch(/<DrillRunner/);
  });
});

describe("what the explorer shows once it is open", () => {
  it("shows every reading at once, which is what makes it one door and not six", async () => {
    const { container } = render(<RecordExplorer {...PROPS} />);
    expect(container.querySelector(".analysis-column")).not.toBeNull();
    expect(container.querySelector(".claim-panel")).not.toBeNull();
    expect(container.querySelector(".lichess-layers")).not.toBeNull();
    expect(screen.getByRole("button", { name: /נתחו את המשחק כולו/ })).toBeTruthy();
  });

  /**
   * THE LEARNING QUEUE IS NOT ON THAT LIST ANY MORE, AND ITS ABSENCE IS THE ASSERTION.
   *
   * It used to be, and this line read `.learning-queue` beside the other three. It came out because
   * `EXPERIMENTAL_LEARNING_ENABLED` is now `=== "true"` -- off unless a deployment asks for it --
   * over `D25 = CONSTRUCT-UNDERIDENTIFIED`, and a default build therefore has three readings here
   * rather than four.
   *
   * DROPPING THE LINE WOULD HAVE LOST THE INVARIANT RATHER THAN MOVED IT, which is why the queue is
   * asserted ABSENT here and the gate is asserted at its source below. A reading that quietly
   * returns to a default build is exactly what this pair now fails on.
   */
  it("does not ship the learning queue in a default build", () => {
    const { container } = render(<RecordExplorer {...PROPS} />);
    expect(container.querySelector(".learning-queue")).toBeNull();
  });

  it("gates both learning surfaces on the opt-in flag, and the flag fails closed", () => {
    /*
     * THE SOURCE, NOT THE RENDER, because a render can only show that the flag is off in this
     * environment. What has to hold is that the constant is `=== "true"`: a deployment that says
     * nothing ships nothing, and a misspelt flag ships nothing rather than everything.
     */
    const features = read("client/src/lib/features.ts");
    expect(features).toContain("EXPERIMENTAL_LEARNING_ENABLED");
    expect(features).toContain('import.meta.env.VITE_EXPERIMENTAL_LEARNING_ENABLED === "true"');
    /*
     * COMMENTS STRIPPED BEFORE THE ABSENCE CHECK, and the reason is the one
     * `what-the-documents-still-say.test.ts` already had to find: that file's header QUOTES the old
     * declaration verbatim, because a reader who cannot see what changed cannot see why. A
     * quotation of what we used to say is not a claim the product makes. What must be gone is the
     * DECLARATION.
     */
    const declared = features.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(declared, "the VERIFIED name is a claim D25 does not support").not.toMatch(
      /VERIFIED_LEARNING_ENABLED/,
    );
    for (const file of ["client/src/pages/Home.tsx", "client/src/components/RecordExplorer.tsx"]) {
      expect(read(file), `${file} renders a learning surface ungated`).toMatch(
        /\{EXPERIMENTAL_LEARNING_ENABLED &&/,
      );
    }
  });

  it("does not run the whole-game review by itself", async () => {
    /*
     * THE SAME R3 RULE THE PAGE HELD, CARRIED ACROSS. A review that started on render would put the
     * engine's verdict about every position on screen because somebody opened a panel.
     */
    const onRun = vi.fn();
    render(<RecordExplorer {...PROPS} review={{ ...PROPS.review, onRun }} />);
    expect(onRun).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /נתחו את המשחק כולו/ }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("matches the contract its mode declares", () => {
    /*
     * THE TABLE AND THE SCREEN, HELD TOGETHER. `EXPLORE` permits prior evidence and engine output
     * and produces no evidence -- which is exactly why a surface that shows all of it at once is
     * safe here and would not be two states earlier.
     */
    expect(MODE_CONTRACT.EXPLORE.priorEvidence).toBe(true);
    expect(MODE_CONTRACT.EXPLORE.engineOutput).toBe(true);
    expect(MODE_CONTRACT.EXPLORE.producingEvidence).toBe(false);
    expect(MODE_CONTRACT.REVEAL.central).not.toBe(MODE_CONTRACT.EXPLORE.central);
  });
});
