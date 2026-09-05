// @vitest-environment jsdom
/**
 * A NOTE THAT SAYS DECISIONS ARE NOT AVERAGED INTO "THE NUMBERS HERE", ABOVE NUMBERS THEY ARE IN.
 *
 * WHAT WAS MEASURED. Two seeded records, walked on the built app at 1440x900. On a record of 35
 * per-decision plus 30 end-of-game decisions, all inside one `section.record-dashboard`:
 *
 *   y=1363  "עוד 35 החלטות מדודות שלכם נרשמו בתנאי מדידה אחרים ... ולכן אינן ממוצעות לתוך
 *            המספרים כאן."
 *   y=1491  three denominators reading n=30
 *   y=2741  five denominators reading n=65
 *
 * 65 = 30 + 35. The thirty-five the sentence says are not averaged in are in the five numbers
 * thirteen hundred pixels below it, in the same section. The other seeded record, 120 under one
 * engine build against 20 under another, showed the same shape at n=120 and n=140.
 *
 * THE ARITHMETIC IS NOT THE DEFECT AND IS NOT TOUCHED. `record-service.ts` flattens the described
 * strata for the branch mix and argues it in place: the mix is a per-decision tally carrying its
 * own denominator, *"not a comparison between decisions, which is the only operation a stratum
 * boundary forbids"*. That is right. What was undefended is the word `כאן` in a sentence rendered
 * at the top of a section whose lower half is pooled.
 *
 * AND PROXIMITY CANNOT DISAMBIGUATE IT, which is what makes this a defect rather than a reading.
 * The identical phrase `המספרים כאן` appears two paragraphs earlier, in the stale-regime note, and
 * there it can only mean the whole panel -- its own docblock says *"every number on this screen
 * reads as current"*. One phrase, two referents, eight lines apart.
 *
 * WHAT THE REPAIR MAY NOT DO. Delete the sentence: it exists because a reading whose `n` shrank has
 * to be able to say what it left out. Or blur it into a caution: the last case here is a record
 * with nothing set aside, and it must carry no such sentence at all.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import type { ScoredDecision } from "@shared/detector";
import { readRecord } from "@shared/record-dashboard";
import type { OneThingMix } from "@shared/reveal";
import { RecordDashboard } from "@/components/RecordDashboard";

vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

const decision = (i: number): ScoredDecision => ({
  decision_id: `d${i}`,
  fen: "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12",
  confidence: normaliseConfidence(5, CONFIDENCE_LEVELS),
  accurate: i % 2 === 0,
  secondsTaken: 20,
  clockMsRemaining: null,
  phase: "middlegame",
});

/** A tally over BOTH strata, which is what the panel actually renders lower down. */
const pooled = (n: number): OneThingMix => ({
  n,
  counts: { "chose-past-it": Math.floor(n / 4), "confident-and-wrong": Math.floor(n / 4), outplayed: Math.floor(n / 4), "trusted-it-too-little": 0 },
  silent: n - 3 * Math.floor(n / 4),
  eligible: Math.floor(n / 2),
  withheld: 0,
});

/** 30 decisions in the read regime, 35 set aside, and a branch tally over all 65. */
const readingWithSetAside = () =>
  readRecord(
    Array.from({ length: 30 }, (_, i) => decision(i)),
    pooled(65),
    undefined,
    undefined,
    undefined,
    0,
    [{ id: "end-of-game/legacy@legacy/sf18", n: 35 }],
  );

const readingWithNothingSetAside = () =>
  readRecord(Array.from({ length: 30 }, (_, i) => decision(i)), pooled(30));

const noteFor = (container: HTMLElement) =>
  [...container.querySelectorAll("p.dash-note")]
    .map((p) => p.textContent ?? "")
    .find((t) => t.includes("בתנאי מדידה אחרים")) ?? null;

describe("a sentence the numbers below it contradict", () => {
  it("does not claim the set-aside decisions are out of every number in the panel", () => {
    const { container } = render(<RecordDashboard reading={readingWithSetAside()} />);
    const note = noteFor(container);
    expect(note, "the set-aside note did not render at all").not.toBeNull();
    expect(
      note,
      "the note still claims the decisions are out of `המספרים כאן`, and the branch tally below it is over all of them",
    ).not.toContain("לתוך המספרים כאן");
  });

  it("names the blocks where those decisions ARE counted, by their RENDERED headings", () => {
    /*
     * Bounding the claim is half of it. A reader told a number excludes their decisions, who then
     * meets a bigger denominator in the same section, has been left to reconcile two true statements
     * with nothing connecting them.
     *
     * READ OFF THE SCREEN, NOT OFF A LITERAL, and that is this case's whole discrimination. The
     * first version asserted the note against a hard-coded string; changing `MixBlock`'s rendered
     * heading to something else left every one of 2,496 tests green while the note went on naming a
     * heading that was no longer there -- which is precisely what hoisting the constant was supposed
     * to prevent. An assertion against a literal cannot see a rename; an assertion against the
     * rendered heading can.
     */
    const { container } = render(<RecordDashboard reading={readingWithSetAside()} />);
    const note = noteFor(container) ?? "";
    const headings = [...container.querySelectorAll(".mix-block .dash-title, .counterfactual-panel__title")]
      .map((h) => (h.textContent ?? "").trim())
      .filter(Boolean);
    expect(headings.length, "neither pooled block rendered a heading to point at").toBeGreaterThan(0);
    for (const heading of headings) {
      expect(note, `the note does not name the rendered heading "${heading}"`).toContain(heading);
    }
  });

  it("says why the n below is bigger, rather than leaving two denominators unreconciled", () => {
    /*
     * The defect this file is named for, in its second form. Narrowing the claim to
     * `מדדי הדיוק והכיול` was still false: `readCounterfactuals` runs over every described stratum,
     * and the counterfactual block prints a figure labelled `דיוק` over exactly the decisions the
     * note says are excluded. The sentence now claims the reading of ONE regime, which is what it
     * is, and says the pooled blocks are pooled.
     */
    const { container } = render(<RecordDashboard reading={readingWithSetAside()} />);
    const note = noteFor(container) ?? "";
    expect(note, "the note still claims a category of measures rather than this regime's reading").not.toContain(
      "מדדי הדיוק והכיול",
    );
    expect(note).toContain("משטר המדידה שמוצג");
  });

  it("still says the decisions are not waiting and not under another heading", () => {
    /*
     * The clause that distinguishes this state from `readElsewhere`, where bank, drill and imported
     * decisions really are read under a heading of their own. Losing it would collapse two states
     * the record deliberately keeps apart.
     */
    const { container } = render(<RecordDashboard reading={readingWithSetAside()} />);
    expect(noteFor(container)).toContain("אינן ממתינות");
  });

  it("POSITIVE CONTROL: a record with nothing set aside carries no such sentence", () => {
    /*
     * Without this the repair is indistinguishable from adding a qualification to every reading,
     * which is the failure `unreadableShare` is rendered conditionally to avoid: a caution on a
     * reading that needs none teaches a reader to discount all of them.
     */
    const { container } = render(<RecordDashboard reading={readingWithNothingSetAside()} />);
    expect(noteFor(container)).toBeNull();
  });

  it("POSITIVE CONTROL: the count of what was set aside is still on the screen", () => {
    /*
     * The sentence exists because a reading whose `n` shrank has to be able to say what it left
     * out. A repair that bounded the claim by dropping the number would have removed the reason.
     */
    const { container } = render(<RecordDashboard reading={readingWithSetAside()} />);
    expect(noteFor(container)).toContain("35");
  });
});
