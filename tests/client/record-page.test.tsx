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
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
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
}));
vi.mock("@/lib/record-api", () => ({
  useRecordReading: () => state.reading,
  useImportReading: () => state.importReading,
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
     */
    mount();
    const start = screen.getByRole("button", { name: /קחו אותי לעמדה/ }) as HTMLButtonElement;
    expect(start.disabled, "an empty username is treated as actionable").toBe(true);
    const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
    expect(css, "a disabled control renders identically to an enabled one").toMatch(
      /\.first-decision-form \.primary-control:disabled\s*\{[^}]*opacity/,
    );
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

  it("leaves a way back to the board from the record, and to the record from the board", () => {
    expect(screen.queryByText("ללוח")).toBeNull();
    mount();
    expect(screen.getByRole("button", { name: "ללוח" })).toBeTruthy();
    const home = code("client/src/pages/Home.tsx");
    expect(home, "the board is a dead end").toMatch(/className="brand-lockup"[\s\S]{0,80}navigate\("\/"\)/);
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
    expect(page).toMatch(/lazy\(\s*\(\)\s*=>\s*import\("@\/components\/RecordDashboard"\)/);
  });

  it("hands the position over through the store the board already restores from", () => {
    // Rather than a route parameter: the board reads `readPosition()` on mount already, so the
    // first decision arrives by the same path a returning player's game does.
    const page = code("client/src/pages/Record.tsx");
    expect(page).toMatch(/writePosition\(/);
    expect(page).toMatch(/navigate\("\/play"\)/);
  });
});
