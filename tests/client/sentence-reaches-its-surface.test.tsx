// @vitest-environment jsdom
/**
 * The sentence names a surface. Until this existed, it did not say where the surface was.
 *
 * `loopPosition()` has told the player, on every render, that "ייבוא משחקים שכבר שיחקת יכול לקצר
 * את זה" -- while the import sat four controls down a tool rail with nothing connecting the two.
 * `LoopStrip`'s founding rule was "it carries no action of its own, and leaves the doing to the
 * surface that already owns it", and that rule was being read as "and does not say which surface
 * that is", which is a different and much worse thing. A sentence that names a place and then
 * makes you hunt for it is a sentence that costs more than it gives.
 *
 * SO: AN ADDRESS, NOT AN ACTION, and every test here is on one side of that line.
 *
 *   - an address OPENS the surface named in the sentence, in the same words, and stops;
 *   - an action would import, start a drill, or otherwise change the record from a description
 *     of the record.
 *
 * The second would be the ribbon acting on the thing it is describing, which is the shape the
 * product refuses everywhere else. Nothing below clicks a drill or runs a scan.
 *
 * AND MOSTLY THERE IS NO ADDRESS. Five of the seven positions point at the board -- "עוד 12
 * החלטות בדלי אחד" is answered by deciding on the position already in front of you -- and a link
 * to the board you are looking at is furniture. The tests hold that too, because a link that
 * appears on every visit because a full stop looks unfinished is the failure mode here.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ContextRibbon } from "@/components/ContextRibbon";
import { loopPosition, type LoopInputs, type LoopPosition } from "@/lib/loop-position";

const root = resolve(__dirname, "../..");
const code = (path: string) =>
  readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/*
 * The ribbon reads the record through three hooks that need a tRPC context, an auth context and a
 * query client. The subject here is what one <aside> renders, so the hooks are stubbed and the
 * position is driven directly -- `loop-position.ts` is exercised on its own above.
 */
const loopStub = vi.hoisted(() => ({
  value: { position: null as LoopPosition | null, loading: false },
}));
vi.mock("@/lib/use-loop-position", () => ({ useLoopPosition: () => loopStub.value }));
vi.mock("@/lib/record-api", () => ({
  useDecisionCount: () => ({ data: { decisions: 12 }, refetch: () => {} }),
  useRecordReading: () => ({ data: { scored: 5 } }),
}));

const at = (overrides: Partial<LoopInputs> = {}): LoopPosition =>
  loopPosition({
    drill: null,
    recorded: 0,
    scored: 0,
    claimGrade: null,
    scoredStillNeeded: 0,
    narrowedTo: null,
    ...overrides,
  });

describe("which sentences name a surface, and which point at the board", () => {
  it("gives the ordinary wait the import it already mentions", () => {
    const position = at({ recorded: 10, scored: 8, scoredStillNeeded: 52 });
    expect(position.headline, "the sentence stopped naming the import").toMatch(/ייבוא/);
    expect(position.action, "the sentence names the import and still cannot reach it").not.toBeNull();
    expect(position.action!.target).toBe("import");
  });

  it("gives an open hypothesis the panel that owns the drill button", () => {
    const position = at({ claimGrade: "hypothesis", scored: 60 });
    expect(position.headline).toMatch(/דריל/);
    expect(position.action!.target).toBe("claim");
  });

  it("gives no address to the five positions whose answer is the board", () => {
    /*
     * Each of these is answered by deciding on the position already on screen, or is an outcome
     * that no surface changes. A link here would be a control that exists because the sentence
     * looked unfinished without one.
     */
    const boardAnswers: Array<[string, LoopPosition]> = [
      ["a drill in progress", at({ drill: { completed: 2, total: 6 } })],
      ["a replicated claim", at({ claimGrade: "replicated", scored: 60 })],
      ["a refuted claim", at({ claimGrade: "refuted", scored: 60 })],
      ["an unreadable record", at({ scoredStillNeeded: null })],
      ["a narrowed search", at({ scoredStillNeeded: 12, narrowedTo: "פתיחה" })],
      ["the floor met with nothing above threshold", at({ scored: 60, scoredStillNeeded: 0 })],
    ];
    for (const [name, position] of boardAnswers) {
      expect(position.action, `${name} grew an address it does not need`).toBeNull();
    }
  });

  it("names the surface in the label, never the outcome", () => {
    /*
     * "ייבוא לפי שם משתמש" is where you are going. "קצרו את ההמתנה" would be a promise about what
     * happens when you get there -- and an import only narrows anything if one of its buckets is
     * separable, which is not knowable before the scan runs.
     */
    const labels = [
      at({ recorded: 10, scored: 8, scoredStillNeeded: 52 }).action!.label,
      at({ claimGrade: "hypothesis", scored: 60 }).action!.label,
    ];
    for (const label of labels) {
      expect(label, `"${label}" promises an outcome`).not.toMatch(/קצר|תקצר|ישפר|כדאי|מומלץ/);
    }
    expect(labels[0]).toMatch(/ייבוא/);
    expect(labels[1]).toMatch(/דפוסים|טענה/);
  });
});

describe("the ribbon renders the address, and only when something can receive it", () => {
  const withImport = at({ recorded: 10, scored: 8, scoredStillNeeded: 52 });

  it("renders the link when there is an address and a host that owns it", () => {
    loopStub.value = { position: withImport, loading: false };
    render(<ContextRibbon onGoTo={vi.fn()} />);
    expect(screen.getByRole("button", { name: withImport.action!.label })).toBeTruthy();
  });

  it("renders no link when the host owns no surfaces", () => {
    /*
     * The sentence is the point and must survive without a host that can route. A ribbon that
     * grew a dead control rather than rendering one line short would be worse than the gap.
     */
    loopStub.value = { position: withImport, loading: false };
    render(<ContextRibbon />);
    expect(screen.getByText(withImport.headline)).toBeTruthy();
    expect(screen.queryByRole("button", { name: withImport.action!.label })).toBeNull();
  });

  it("renders no link for a position that has no address", () => {
    const silent = at({ scored: 60, scoredStillNeeded: 0 });
    loopStub.value = { position: silent, loading: false };
    render(<ContextRibbon onGoTo={vi.fn()} />);
    expect(screen.getByText(silent.headline)).toBeTruthy();
    // "הבנתי" only renders with a gap notice, and there is none here: so, no buttons at all.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("hands over the target and does nothing else", async () => {
    const goTo = vi.fn();
    loopStub.value = { position: withImport, loading: false };
    render(<ContextRibbon onGoTo={goTo} />);
    await userEvent.click(screen.getByRole("button", { name: withImport.action!.label }));
    expect(goTo).toHaveBeenCalledTimes(1);
    expect(goTo).toHaveBeenCalledWith("import");
  });

  it("never renders the address without the basis that produced the sentence", () => {
    // R1, which does not stop applying because a line became clickable.
    loopStub.value = { position: withImport, loading: false };
    const { container } = render(<ContextRibbon onGoTo={vi.fn()} />);
    expect(container.querySelector(".context-loop-goto")).toBeTruthy();
    expect(container.querySelector(".context-loop-basis")?.textContent).toBe(withImport.basis);
  });

  it("does not import, drill or otherwise touch the record from the ribbon", () => {
    const ribbon = code("client/src/components/ContextRibbon.tsx");
    for (const forbidden of ["useImport", "mutate", "analyze", "beginDrill", "runDrill"]) {
      expect(ribbon, `the ribbon acts on the record via ${forbidden}`).not.toMatch(
        new RegExp(`\\b${forbidden}\\b`),
      );
    }
  });
});

describe("the host actually owns both surfaces the addresses name", () => {
  const home = code("client/src/pages/Home.tsx");

  it("opens the position door on the import room rather than on its menu", () => {
    /*
     * The sentence says "ייבוא משחקים". Landing on a four-item menu that the player then has to
     * read and click through would be the link arriving one door short of what it promised.
     */
    expect(home).toMatch(/target === "import"[\s\S]{0,120}openPositionSource\("username"\)/);
  });

  it("addresses the claim panel by an id the claim panel actually carries", () => {
    /*
     * An id referenced from one file and set in another is exactly the pair that drifts. Both
     * sides are asserted here, and the panel sets it on all three of its branches -- a player who
     * follows the link while the record is still answering must land on the panel that is going
     * to hold the answer.
     */
    expect(home).toMatch(/getElementById\("claim-panel"\)/);
    const panel = code("client/src/components/ClaimPanel.tsx");
    const anchored = panel.match(/id="claim-panel"/g) ?? [];
    const sections = panel.match(/<section[^>]*className="claim-panel"/g) ?? [];
    expect(sections.length, "the claim panel stopped rendering a section").toBeGreaterThan(0);
    expect(anchored.length, "a claim-panel branch cannot be addressed").toBe(sections.length);
  });

  it("moves the keyboard as well as the scroll", () => {
    // A smooth scroll leaves a keyboard user exactly where they were, which is not an address.
    expect(home).toMatch(/scrollIntoView/);
    expect(home).toMatch(/\.claim-run-drill"\)\?\.focus\(\)/);
  });

  it("goes to the surface without starting anything on arrival", () => {
    const handler = home.slice(home.indexOf("onGoTo={"), home.indexOf("onGoTo={") + 900);
    expect(handler, "the ribbon's handler starts a drill").not.toMatch(/beginDrill|setDrill\(/);
    expect(handler, "the ribbon's handler runs a scan").not.toMatch(/mutateAsync|\.click\(\)/);
  });
});
