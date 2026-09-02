// @vitest-environment jsdom
/**
 * The front door, and what it must refuse to put on it.
 *
 * THE DIFFERENTIATION IS REAL AND UNSHOWABLE ON DAY ONE, and both halves of that sentence drive
 * this file. Real: Chess.com Insights, Lichess Insights, Aimchess, Chessable, DecodeChess and
 * Noctie were all checked and not one captures what the player believed before the engine
 * answered. Unshowable: a calibration gap needs a confidence stated before the reveal, which no
 * import, rating or finished game carries. The thing that makes the record impossible to copy is
 * the same thing that makes the first visit empty.
 *
 * So the interesting assertions here are NEGATIVE. It is easy to fill an empty page with
 * something -- a zeroed headline, bucket rows at 0/30, the imported accuracy promoted one heading
 * up. Each of those turns "we have not measured you yet" into "here is your measurement", which
 * is the one thing this product exists not to do.
 *
 * AND THE CLASSIFICATION IS A WALL, not a sort order. Decisions carrying a stated confidence and
 * imported games without one are two different measurements. The second is move accuracy against
 * an engine and can never become the first, however many games it covers -- so they get separate
 * containers with separate headings, and the test holds that they never merge.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readCounterfactuals } from "@shared/counterfactual-reading";
import { readVariables } from "@shared/bucket-variable";
import { crossVariables } from "@shared/crossing";
import { calibrationScore } from "@shared/calibration-score";
import { splitHalfStability } from "@shared/stability";
import { metacognitiveSensitivity } from "@shared/sensitivity";
import { effortFollowsDoubt } from "@shared/control";
import type { RecordReading } from "@shared/record-service";

const root = resolve(__dirname, "../..");
const code = (path: string) =>
  readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const state = vi.hoisted(() => ({
  reading: { data: undefined as RecordReading | undefined, isLoading: false, isError: false },
  importReading: { reading: null as unknown, loading: false },
  /*
   * The claim, read by the Outcome Summary the page now renders above the dashboard. Empty by
   * default and deliberately so: every case in this file is about what an EMPTY record may show,
   * and a summary handed a claim here would be the page asserting a finding these tests exist to
   * forbid. The summary's own states have their own file.
   */
  claim: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    errorMessage: "",
  },
}));
vi.mock("@/lib/record-api", () => ({
  useRecordReading: () => state.reading,
  useImportReading: () => state.importReading,
  useClaimView: () => state.claim,
}));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
/* The dashboard and the import panel have their own tests; what is under test is the page. */
vi.mock("@/components/RecordDashboard", () => ({
  RecordDashboard: () => <div data-testid="dashboard">dashboard</div>,
}));
vi.mock("@/components/ImportDiagnostic", () => ({
  ImportDiagnosticPanel: () => <div data-testid="import-panel">import</div>,
}));

const { default: Record } = await import("@/pages/Record");

/*
 * NO `as unknown as RecordReading`, and the double cast it replaces was doing real damage. It let
 * `overall` and `mix` be written as `{}` -- so the component under test received a summary and a
 * mix whose every field was undefined -- and it let the reading go on compiling when the type
 * gained the anchor fields, so the page crashed at render instead of failing at the line that
 * was wrong. A fixture that lies about its shape is not a fixture.
 */
const withRecord = (scored: number): RecordReading => ({
  scored,
  awaitingReveal: 0,
  withoutConfidence: 0,
  counterfactual: readCounterfactuals([]),
  profile: { variables: readVariables([]), crossing: crossVariables([]) },
  overall: { n: scored, meanConfidence: 0.6, accuracyRate: 0.5, gap: 0.1, gapVariance: 0.2 },
  calibration: calibrationScore([]),
  anchor: calibrationScore([]),
  anchorAnswered: [],
  stability: splitHalfStability([]),
  sensitivity: metacognitiveSensitivity([]),
  // No band beside an unreadable number: the literature's median is a persuasive thing to
  // misread as your own result.
  sensitivityReference: null,
  control: effortFollowsDoubt([]),
  buckets: [],
  confidence: [],
  mix: {
    n: 0,
    counts: {
      "chose-past-it": 0,
      "confident-and-wrong": 0,
      outplayed: 0,
      "trusted-it-too-little": 0,
    },
    silent: 0,
    eligible: 0,
  },
});

const keptReading = {
  username: "erez281",
  games: 20,
  scanned_at: "2026-08-25T12:55:00.000Z",
  diagnostic: {},
};

function mount(over: Partial<typeof state> = {}) {
  state.reading = { data: undefined, isLoading: false, isError: false };
  state.importReading = { reading: null, loading: false };
  Object.assign(state, over);
  return render(<Record />);
}

describe("an empty record does not pretend to be a measurement", () => {
  it("renders no figure about the player at all", () => {
    const { container } = mount();
    /*
     * The strongest form of "nothing was measured": no percentage anywhere on the page. A zeroed
     * gap, an 0/60 counter and a bucket row at 0% would each pass a softer assertion and each
     * turn a silence into a reading.
     */
    expect(container.textContent, "a percentage on a page with nothing behind it").not.toMatch(/%/);
    expect(container.querySelector("[data-testid='dashboard']")).toBeNull();
  });

  it("shows no bucket rows counting toward a number", () => {
    const { container } = mount();
    // A progress bar toward a threshold is the streak mechanic in a lab coat, and streaks are on
    // the product's refusal list.
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(container.textContent).not.toMatch(/30|60/);
  });

  it("offers the one action that starts measuring, and asks for what it needs", () => {
    mount();
    expect(screen.getByRole("button", { name: /קחו אותי לעמדה/ })).toBeTruthy();
    expect(screen.getByLabelText(/Lichess/)).toBeTruthy();
  });

  it("does not offer a control it will refuse to act on", () => {
    /*
     * With no username there is nothing to fetch, so the button is disabled -- and it has to
     * LOOK disabled, or the one thing on an otherwise empty page that reads as ready to press is
     * the thing that will not respond. Section 4.5: distinct states must not render alike.
     *
     * THIS USED TO ASSERT `opacity`, WHICH IS THE MECHANISM AND NOT THE REQUIREMENT -- and the
     * mechanism was wrong. `opacity: 0.45` fades the foreground against whatever is behind it,
     * and measured on the built front door in Chromium it put `קחו אותי לעמדה` at **2.85:1**
     * against the 4.5:1 that WCAG 1.4.3 asks. The one act on the page was simultaneously the
     * quietest thing on it and the only text failing contrast. A test that names one
     * implementation cannot tell a correct one from an illegible one.
     *
     * So it asserts the requirement instead, in two halves: the state is DECLARED (a rule exists
     * for it), and it is declared with a colour pair rather than a fade. `--muted` on `--chip`
     * measures 4.59:1 in the light palette and 4.80:1 in the dark, and both flip with the theme,
     * which an opacity cannot.
     */
    mount();
    const start = screen.getByRole("button", { name: /קחו אותי לעמדה/ }) as HTMLButtonElement;
    expect(start.disabled, "an empty username is treated as actionable").toBe(true);
    const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
    const disabled = css.match(
      /\.first-decision-form \.primary-control:disabled\s*\{([^}]*)\}/,
    )?.[1];
    expect(disabled, "a disabled control renders identically to an enabled one").toBeTruthy();
    expect(disabled, "the disabled state sets no ground of its own").toMatch(/background:/);
    expect(disabled, "the disabled state sets no foreground of its own").toMatch(/color:/);
    expect(
      disabled,
      "a fade, not a declared pair: opacity composites the label into whatever is behind it and " +
        "measured 2.85:1 on the built page",
    ).not.toMatch(/opacity/);
  });

  it("says the position is picked without looking at how the move went", () => {
    /*
     * Stated to the player BEFORE they start, not in the source only. If the app chose the
     * position where they blundered, the demonstration would be staged rather than measured --
     * so the promise not to is part of the screen.
     */
    mount();
    expect(screen.getByText(/בלי להסתכל על מה שיצא מהמהלך/)).toBeTruthy();
  });

  it("does not ask for a username it already has", () => {
    mount({ importReading: { reading: keptReading, loading: false } });
    expect(screen.getByLabelText<HTMLInputElement>(/Lichess/).value).toBe("erez281");
  });
});

describe("two measurements, two containers", () => {
  it("keeps imported accuracy out of the layer that can carry a calibration gap", async () => {
    const { container } = mount({
      reading: { data: withRecord(12), isLoading: false, isError: false },
      importReading: { reading: keptReading, loading: false },
    });
    const layers = container.querySelectorAll(".record-layer");
    expect(layers, "the two measurements share one container").toHaveLength(2);

    const [committed, imported] = Array.from(layers);
    // Awaited because the dashboard is behind a Suspense boundary -- it is code-split so that the
    // front door does not ship a charting library to a page that usually renders no chart.
    expect(await within(committed as HTMLElement).findByTestId("dashboard")).toBeTruthy();
    expect(within(imported as HTMLElement).getByTestId("import-panel")).toBeTruthy();
    // Neither may hold the other's panel: that is the whole point of the wall.
    expect(within(committed as HTMLElement).queryByTestId("import-panel")).toBeNull();
    expect(within(imported as HTMLElement).queryByTestId("dashboard")).toBeNull();
  });

  it("says out loud that the imported layer is not calibration and cannot become it", () => {
    mount({
      reading: { data: withRecord(12), isLoading: false, isError: false },
      importReading: { reading: keptReading, loading: false },
    });
    expect(screen.getByText(/לא מדידת כיול ולא תהפוך לאחת/)).toBeTruthy();
  });

  it("shows the imported layer even with an empty record, still walled off", () => {
    /*
     * The common case for a new player: 555 imported decisions and nothing committed. The pile
     * of numbers is real and belongs on the page -- behind its own heading, where it cannot be
     * read as a calibration reading.
     */
    const { container } = mount({ importReading: { reading: keptReading, loading: false } });
    expect(screen.getByTestId("import-panel")).toBeTruthy();
    expect(container.querySelectorAll(".record-layer")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /קחו אותי לעמדה/ })).toBeTruthy();
  });

  it("does not lead with the signed over/under-confidence headline", () => {
    /*
     * Measured this afternoon: under four defensible mappings of the same five confidence words
     * that number runs from -4.4% to +17.3% ON IDENTICAL DATA. It stays inside the dashboard,
     * where it carries its n and its caveats, and off the front door until the scale is fixed.
     */
    const page = code("client/src/pages/Record.tsx");
    expect(page, "the page renders the gap headline itself").not.toMatch(
      /SignedProportion|overall\.gap/,
    );
  });
});

describe("the record is the front door", () => {
  it("routes / to the record and the board to /play", () => {
    const app = code("client/src/App.tsx");
    expect(app).toMatch(/path="\/"\s+component=\{Record\}/);
    expect(app).toMatch(/path="\/play"\s+component=\{Home\}/);
  });

  it("leaves a way back to the board once there is a record, and to the record from the board", () => {
    expect(screen.queryByText("ללוח")).toBeNull();
    mount({ reading: { data: withRecord(12), isLoading: false, isError: false } });
    expect(screen.getByRole("button", { name: "ללוח" })).toBeTruthy();
    /*
     * THE CHAIN IS TWO FILES NOW, and both halves are held.
     *
     * The lockup was inline in `Home.tsx`, which is why this could read one file. It is a shared
     * component because the game route had no header, no brand and no way back at all -- a mark
     * that exists on one route out of three is a decoration, not an identity. Asserting only the
     * call site would pass over a component that renders nothing; asserting only the component
     * would pass over a board that never mounts it.
     */
    const home = code("client/src/pages/Home.tsx");
    expect(home, "the board is a dead end").toMatch(/<BrandLockup[\s\S]{0,60}navigate\("\/"\)/);
    const lockup = code("client/src/components/BrandLockup.tsx");
    expect(lockup, "the lockup does not render the lockup").toMatch(/className="brand-lockup"/);
    expect(lockup, "the lockup does not call what it was given").toMatch(/onClick=\{onNavigate\}/);
  });

  it("does not offer the bare board on a cold record, and is still not a dead end (P1.6)", () => {
    /*
     * `ללוח` IS A BARE `navigate("/play")`, AND THIS PAGE ALREADY KNOWS WHERE THAT LANDS. Its own
     * note, twenty lines above the control: the opening position of a new live game is one where
     * NO reveal branch can fire, because `theOneThing` needs either a centipawn loss at or over
     * the material threshold or a stated confidence, and the starting position gives a loss of
     * zero. That is why `FirstDecision` exists.
     *
     * So on an empty record the control was a second door at the same weight as the one the screen
     * deliberately built, leading to the one first experience this product knows says nothing.
     *
     * NOT A DEAD END, WHICH IS THE HALF THAT MATTERS -- and the assertion is here rather than in
     * the case above because removing a control is only correct while something better remains.
     * Both routes below hand over a position and navigate to the board.
     */
    mount();
    expect(screen.queryByRole("button", { name: "ללוח" })).toBeNull();
    expect(screen.getByRole("button", { name: "עמדה מהסט המשותף" })).toBeTruthy();
    expect(document.querySelector(".first-decision-form")).not.toBeNull();
  });

  it("does not ship a charting library to a page that renders no chart", () => {
    /*
     * MEASURED, not guessed. Importing `RecordDashboard` statically here folded recharts into the
     * entry bundle and took it from 586kB to 964kB -- paid by every single arrival, including the
     * overwhelmingly common one where the record is empty and the chart never renders. This is
     * the front door; it has more reason to defer that than `Home` does, and `Home` already does.
     */
    const page = code("client/src/pages/Record.tsx");
    expect(page, "the dashboard is imported eagerly by the front door").not.toMatch(
      /^import \{[^}]*RecordDashboard/m,
    );
    /* `lazyChunk` is `lazy` with the stale-deploy case handled; the import is still dynamic,
       which is the property that keeps the chart library off this page. */
    expect(page).toMatch(/lazy(?:Chunk)?\(\s*\(\)\s*=>\s*import\("@\/components\/RecordDashboard"\)/);
  });

  it("hands the position over through the store the board already restores from", () => {
    // Rather than a route parameter: the board reads `readPosition()` on mount already, so the
    // first decision arrives by the same path a returning player's game does.
    const page = code("client/src/pages/Record.tsx");
    expect(page).toMatch(/writePosition\(/);
    expect(page).toMatch(/navigate\("\/play"\)/);
  });
});

/**
 * THE NOTICE IS FOR THE PERSON WHO RECEIVES THE BINARIES, not the person who reads the repository.
 *
 * This build conveys a 7.3 MB GPL-3.0 engine and nine OFL font files to whoever loads the page,
 * and for the whole life of the repository nothing travelled with them. A `THIRD_PARTY_NOTICES.md`
 * in the source tree does not fix that: the people the licences are about never see it.
 *
 * So the assertions are about the LINK BEING LIVE, not about the paragraph existing. A licence
 * link that 404s conveys nothing, and it is the failure mode a renamed file produces silently --
 * `GATE-NOTICE` checks the repository side, and this checks that the page points at it.
 */
describe("the licences travel with the thing they license", () => {
  const linkTargets = () => {
    mount({ reading: { data: withRecord(0), isLoading: false, isError: false } });
    return [...screen.getByRole("contentinfo").querySelectorAll("a")].map((anchor) => ({
      text: anchor.textContent ?? "",
      href: anchor.getAttribute("href") ?? "",
      lang: anchor.getAttribute("lang"),
      dir: anchor.getAttribute("dir"),
    }));
  };

  it("names each conveyed component and links to the licence text served with it", () => {
    const links = linkTargets();
    expect(links.map((link) => link.text)).toEqual([
      "Stockfish",
      "Noto Sans Hebrew",
      "DM Mono",
    ]);
    expect(links.map((link) => link.href)).toEqual([
      "/licenses/stockfish/COPYING.txt",
      "/licenses/fonts/noto-sans-hebrew/OFL.txt",
      "/licenses/fonts/dm-mono/OFL.txt",
    ]);
  });

  it("points every one of them at a file that exists to be served", () => {
    for (const link of linkTargets()) {
      const served = resolve(root, "client/public", link.href.replace(/^\//, ""));
      expect(readFileSync(served, "utf8").length, `${link.href} is served empty`).toBeGreaterThan(
        1000,
      );
    }
  });

  it("marks the Latin names as Latin, inside a Hebrew document", () => {
    // Three names in Latin script inside `lang="he" dir="rtl"`. Without `lang` a screen reader
    // reads them with Hebrew phonetics; without `dir` the punctuation around them lands on the
    // wrong side. Same rule the rest of this product's LTR islands follow.
    for (const link of linkTargets()) {
      expect(link.lang, `${link.text} is not declared as Latin script`).toBe("en");
      expect(link.dir).toBe("ltr");
    }
  });
});

describe("a bank answer is a measurement the front door counts", () => {
  /*
   * THE REGRESSION THE ROUTE BELOW INTRODUCED, caught in a browser walk rather than by a test.
   *
   * `scored` is the descriptive population -- free play and the handoff -- and the evidence policy
   * files a bank answer as `separate`. So a player whose only decision was a bank answer had
   * `scored === 0`, and this page used that number to decide whether to offer them their first
   * decision: one decision committed, revealed, a reveal branch fired, and the door asked again.
   */
  it("shows the record rather than the first-decision screen once the bank has an answer", () => {
    const base = withRecord(0);
    const { container } = mount({
      reading: {
        data: { ...base, anchor: { ...base.anchor, n: 1 } },
        isLoading: false,
        isError: false,
      },
    });
    expect(
      container.textContent,
      "a player who answered the shared set was asked for a first decision",
    ).not.toContain("ההחלטה הראשונה");
  });

  it("still shows it when genuinely nothing has been measured", () => {
    // Both halves zero. The gate has to stay closed here or it is no gate.
    const base = withRecord(0);
    expect(
      mount({ reading: { data: base, isLoading: false, isError: false } }).container.textContent,
    ).toContain("ההחלטה הראשונה");
  });
});

describe("the arrival with no account has a route to a decision that measures something", () => {
  /*
   * THE ROUTE THAT DID NOT EXIST, AND THE TWO REASONS IT HAD TO.
   *
   * The cold front door offered exactly one action -- hand over a username -- plus `ללוח` in the
   * header, a bare `navigate("/play")`. Walked in Chromium from an empty profile, `ללוח` lands on
   * the opening position of a new live game, and that position can produce no reveal at all:
   * `theOneThing` needs a centipawn loss at or over the material threshold or a stated
   * confidence, and the starting position offers neither. The first thing the product said to an
   * account-less arrival was that it had nothing to say.
   *
   * The bank is the set of positions that exist to be decided on. It was already served, through
   * this exact handoff, by `AnchorRunControl` -- which the page renders only when `scored > 0`,
   * that is, only after the state this screen means "not yet". No capability is added here. A
   * gate is removed from in front of the one route that works.
   */
  it("hands over a bank position, through the same store the front door's own handoff uses", async () => {
    localStorage.clear();
    state.reading = { data: undefined, isLoading: false, isError: false };
    mount();
    fireEvent.click(screen.getByRole("button", { name: /עמדה מהסט המשותף/ }));
    await waitFor(() => expect(localStorage.getItem("decision-lab.position.v1")).toBeTruthy());
    const stored = JSON.parse(localStorage.getItem("decision-lab.position.v1")!);
    expect(stored.gameId, "the handoff is not a bank position").toMatch(/^anchor-/);
    /*
     * `null`, and it is the field that keeps the two names apart. An anchor is always asked on
     * its own purpose; stamping it `first` as well would put two purposes on one decision, and
     * `decisionPurposeFor` ranks `anchor` above `first` precisely because the bank is what is
     * being measured there.
     */
    expect(stored.firstDecisionPly).toBeNull();
    expect(stored.revealTiming).toBe("per-decision");
    expect(stored.sans.length, "a bank position with no game behind it").toBeGreaterThan(0);
  });

  it("keeps the player's own game as the first offer, and the bank as the second", () => {
    /*
     * ORDER IS THE CLAIM. A position from a game they played is the better first decision -- the
     * note under the form says why -- so the bank is offered below it and named for what it is,
     * rather than competing for the same press.
     */
    state.reading = { data: undefined, isLoading: false, isError: false };
    const { container } = mount();
    const text = container.textContent ?? "";
    expect(text.indexOf("קחו אותי לעמדה")).toBeGreaterThan(-1);
    expect(text.indexOf("עמדה מהסט המשותף")).toBeGreaterThan(text.indexOf("קחו אותי לעמדה"));
  });

  it("serves both routes from one handoff, so they cannot disagree about what a bank decision is", () => {
    // Two callers, one function. A second transcription is a second chance to drift.
    const page = code("client/src/pages/Record.tsx");
    expect(page.match(/handOverBankPosition/g)?.length, "the handoff was transcribed twice").toBe(3);
    expect(page.match(/gameId: `anchor-/g)?.length).toBe(1);
  });
});
