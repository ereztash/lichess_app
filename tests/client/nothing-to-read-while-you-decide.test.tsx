// @vitest-environment jsdom
/**
 * LAW 1: while the player is producing evidence, nothing may show them prior evidence.
 *
 * WHY THIS IS A VALIDITY TEST AND NOT A LAYOUT PREFERENCE. The measurement this product exists to
 * make is a calibration gap: `confidence - accuracy`, where the confidence is STATED on this
 * screen, in the commitment panel. The screen also rendered `<ClaimPanel>` on the same branch --
 * findings about the player's own past decisions, including their calibration. A confidence stated
 * beside a panel describing that player's calibration is not a measurement of what they believed.
 * It is a measurement of what they believed after being told, and nothing downstream can separate
 * the two afterwards, because both produce a row that looks identical.
 *
 * THE WORST OF IT WAS THE COUNTERFACTUAL STAGE, and it was reached by accident rather than by
 * decision. The analysis column branched on `deciding`, which is `"deciding" || "committing"` --
 * so at `"committed"`, the stage where the probe asks "what would you have played instead?", the
 * chain fell through to the REVEAL column and rendered all of it: the analysis panel, the record
 * dashboard, the Lichess layers. The product asked a player to name an alternative with a panel of
 * their own accuracy rates beside the question.
 *
 * THE ARGUMENT WAS ALREADY IN `Home.tsx`, one branch away, applied to exactly one condition -- a
 * game the player had asked the engine to stay silent through:
 *
 *   REPLACES the claim panel and the learning queue for the duration, rather than joining them.
 *   Both of those are readings of the record, and a screen that offers readings while promising
 *   the engine is silent is offering the player a way around the condition they chose.
 *
 * Correct, and never generalised. Every decision this product measures is that condition.
 *
 * WHAT COUNTS AS A FEEDBACK SURFACE, drawn explicitly because a rule with a fuzzy subject is not a
 * rule. A feedback surface shows a FINDING, VERDICT, RATE OR RECOMMENDATION about the player's own
 * past decisions. `LoopStrip` and `ContextRibbon` are not: they say where in the loop the record
 * is and what stands between here and the next step, which is a fact about the record's size and
 * not about how well the player decides. They stay.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import superjson from "superjson";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Home from "@/pages/Home";
import { trpc } from "@/lib/trpc";
import { engineMayRun, makingEvidence, type SessionStage } from "@/lib/decision-session";
import { PROBE_STAGE } from "@shared/counterfactual-stage";

/* Every stage the machine declares. A stage added later and left out here fails the partition. */
const STAGES: SessionStage[] = ["deciding", "committing", "committed", "revealed", "blocked"];

/**
 * Every reading of the record that may not be on screen mid-evidence, by the selector that finds
 * it. Named individually rather than as "anything in the analysis column", because the column also
 * holds the instrument and the point is which of the two is which.
 */
const FEEDBACK_SURFACES: Record<string, string> = {
  "the claim panel": ".claim-panel",
  "the learning queue": ".learning-queue",
  "the record dashboard": ".record-dashboard",
  "the Lichess layers": ".lichess-layers",
  "the engine's analysis column": ".analysis-column",
  "the whole-game review": ".game-review",
  "the evaluation bar": ".eval-bar",
};

beforeEach(() => {
  localStorage.clear();
  /*
   * No server, which is the configuration this matters most in: it is the deployment a player is
   * actually using. Every tRPC call fails, auth resolves to signed-out, the record runs locally.
   */
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
        <ThemeProvider defaultTheme="light" switchable>
          <Home />
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

describe("the stage boundary, as a fact about the modules", () => {
  it("is true in every stage but the reveal, the counterfactual included", () => {
    expect(makingEvidence("deciding")).toBe(true);
    expect(makingEvidence("committing")).toBe(true);
    expect(makingEvidence(PROBE_STAGE)).toBe(true);
    expect(makingEvidence("revealed")).toBe(false);
  });

  it("is the exact complement of the stage the engine may speak in", () => {
    /*
     * NOT A COINCIDENCE AND NOT AN ALIAS. The moment the engine is allowed to speak is the moment
     * the record is allowed to; before it, both are the product talking to a player whose answer
     * it has not finished collecting. They are two functions because they could legitimately
     * diverge -- and this assertion is what makes that divergence something somebody has to do on
     * purpose rather than something that happens.
     */
    for (const stage of STAGES) {
      expect(makingEvidence(stage), stage).toBe(!engineMayRun(stage));
    }
  });

  it("defaults a stage nobody has classified to hiding prior evidence", () => {
    /*
     * FAIL CLOSED, ASSERTED. An allowlist would let a stage added later show the claim panel by
     * default, and the cost of that default is a contaminated measurement that looks exactly like
     * a clean one. `blocked` is the stage nothing sets today; it is still mid-evidence.
     */
    expect(makingEvidence("blocked")).toBe(true);
    expect(makingEvidence("a-stage-added-next-year" as SessionStage)).toBe(true);
  });
});

describe("the DOM while a decision is open", () => {
  it("puts the instrument on screen, so the assertions below are not about a blank page", async () => {
    const { container } = renderHome();
    await waitFor(() => expect(container.querySelector(".commitment-submit")).toBeTruthy());
    expect(container.querySelectorAll(".board-square").length).toBe(64);
  });

  it.each(Object.keys(FEEDBACK_SURFACES))("does not show %s", async (name) => {
    const { container } = renderHome();
    await waitFor(() => expect(container.querySelector(".commitment-submit")).toBeTruthy());
    expect(
      container.querySelector(FEEDBACK_SURFACES[name]),
      `${name} is on screen while the player is stating how sure they are`,
    ).toBeNull();
  });

  it("offers exactly one primary action", async () => {
    /*
     * LAW 2, MEASURED RATHER THAN ARGUED. The primary action of this state is recording the
     * decision. The header's continuation control is gated on a stored reveal, and the rail's
     * four controls -- every one of which discards the position under decision -- are gone.
     */
    const { container } = renderHome();
    await waitFor(() => expect(container.querySelector(".commitment-submit")).toBeTruthy());
    const primary = container.querySelectorAll(".commitment-submit, .primary-control");
    expect(primary.length, `${primary.length} primary actions on screen`).toBe(1);
  });

  it("has put the toolbox away, rather than greying it out", async () => {
    /*
     * ABSENT AND NOT DISABLED. A disabled control still says "there is a thing here you could be
     * doing", which is the whole of what this removes. The rail is four ways to abandon the
     * position being measured, at the same weight as each other and as the submit.
     */
    const { container } = renderHome();
    await waitFor(() => expect(container.querySelector(".commitment-submit")).toBeTruthy());
    expect(container.querySelector(".control-rail")).toBeNull();
    expect(container.querySelectorAll(".rail-button").length).toBe(0);
  });
});

/**
 * WHAT THE RENDER ABOVE CANNOT REACH, and it is three of the seven.
 *
 * `LearningQueue`, `RecordDashboard` and `LichessLayersPanel` each need something a serverless
 * jsdom render has no way to produce -- a feature flag, a record reading, an authenticated Lichess
 * account -- so their absence in the DOM is not evidence of anything: they would be absent from a
 * page that had never heard of LAW 1. Left as DOM assertions alone they would be four green lines
 * that could never go red, which is worse than no assertion at all, because it reads as coverage.
 *
 * So they are held structurally instead: there is exactly one of each in the page, and it is on
 * the far side of the branch that separates the evidence-making stages from the reveal.
 */
describe("the surfaces a serverless render cannot reach", () => {
  const home = readFileSync(resolve(__dirname, "../../client/src/pages/Home.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  /* The branch itself: everything after it is the reveal column, everything before is not. */
  const split = home.indexOf(") : focus ? (");

  it("has a branch to be on one side of", () => {
    expect(split, "the focus branch is gone -- these assertions mean nothing without it").toBeGreaterThan(0);
    expect(home.match(/\) : focus \? \(/g) ?? []).toHaveLength(1);
  });

  /*
   * THEY ARE NOT IN THE PAGE ANY MORE, WHICH IS A STRONGER FACT THAN BEING LATE IN IT.
   *
   * P1.7 moved all four into `RecordExplorer`, which `Home` renders in one place: inside the branch
   * below, and behind a control the player has to press. So "after the reveal" is no longer a
   * position in a file that a merge could move -- it is the only place the component exists.
   */
  const explorer = readFileSync(
    resolve(__dirname, "../../client/src/components/RecordExplorer.tsx"),
    "utf8",
  );

  it.each([["LearningQueue"], ["RecordDashboard"], ["LichessLayersPanel"], ["ClaimPanel"]])(
    "keeps <%s> out of the page entirely, and inside the explorer",
    (component) => {
      const tag = new RegExp(`<${component}[\\s/>]`, "g");
      expect(
        [...home.matchAll(tag)],
        `<${component}> is back in Home.tsx, where a merge can move it above the branch`,
      ).toHaveLength(0);
      expect([...explorer.matchAll(tag)], `<${component}> is in neither file`).toHaveLength(1);
    },
  );

  it("renders the explorer once, after the branch, and only when it is asked for", () => {
    const uses = [...home.matchAll(/<RecordExplorer[\s/>]/g)].map((m) => m.index!);
    expect(uses, "the explorer is rendered more than once, or not at all").toHaveLength(1);
    expect(uses[0], "the explorer renders while the player is producing evidence").toBeGreaterThan(
      split,
    );
    /* And behind the toggle, not merely below it: `EXPLORE` is a mode the player enters. */
    /*
     * BOUNDED, BECAUSE THE SUSPENSE BOUNDARY SITS BETWEEN THEM. The explorer is a lazy
     * chunk -- a surface that renders only on a press has no business in the bytes every
     * arrival downloads -- so `{exploring && (` is followed by a `<Suspense>` and then the
     * component. The span is capped so this cannot quietly start matching across the file.
     */
    expect(home).toMatch(/\{exploring && !runInProgress && \([\s\S]{0,200}?<RecordExplorer/);
  });

  it("keeps the toolbox behind the same branch, by the same reading", () => {
    const rail = home.indexOf('<aside className="control-rail">');
    expect(rail, "the control rail is gone entirely").toBeGreaterThan(0);
    expect(home, "the rail renders unconditionally again").toMatch(/\{!focus && \(/);
  });
});

describe("what is still on screen, because it is not feedback about the player", () => {
  it("keeps the loop position, which says where the record is and not how well it went", async () => {
    /*
     * THE LINE THIS FILE DRAWS, ASSERTED FROM THE OTHER SIDE. A test that only ever removes things
     * is satisfied by a blank page, and "no feedback surfaces" would be trivially true of one.
     * `LoopStrip` reports which of record/detect/drill/grade is live -- a fact about how many
     * decisions exist, which the player cannot be influenced ABOUT by seeing, because it says
     * nothing about the decision they are making.
     */
    const { container } = renderHome();
    await waitFor(() => expect(container.querySelector(".commitment-submit")).toBeTruthy());
    await waitFor(() => expect(container.querySelector(".loop-strip")).toBeTruthy());
  });
});
