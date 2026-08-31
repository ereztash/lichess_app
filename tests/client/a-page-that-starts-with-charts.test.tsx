// @vitest-environment jsdom
/**
 * §25 AND §26: the record ordered by what it is worth to a decision, and charts only where the
 * question is visual.
 *
 * WHAT WAS WRONG WITH THE PAGE, and it was not that anything on it was false. A returning player
 * arrived at a calibration decomposition, six bucket rows, a discrimination area, an effort
 * correlation, a split-half check and a reliability chart -- all true, none of them an answer, and
 * the parts that could not be read rendered as individual cells saying "not enough data", one per
 * panel, with no way to tell which of them the player could do anything about.
 *
 * THE ASSERTION THAT MATTERS IS THE ONE ABOUT DEAD ENDS. A bucket eight decisions short and a
 * bucket over a record that holds no clock at all are both unreadable, and only one of them is a
 * wait. Telling somebody to keep playing to fix the second is advice that cannot work, and
 * `BucketReading` has carried `unmeasurableReason` for exactly that distinction since it was
 * written, with nothing reading it.
 *
 * §26 IS ASSERTED AS AN ABSENCE, over the source rather than over a render: no donut, no radial
 * bar, no progress ring. A chart is for a question that is genuinely visual -- how think time moves
 * through a game, where on the clock the expensive decisions sit. It is not for one number.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhatIsUnclear } from "@/components/WhatIsUnclear";
import { WhatIsUnderTest } from "@/components/WhatIsUnderTest";
import {
  UNCLEAR_SENTENCE,
  WAITING_HELPS,
  UNCLEAR_CAUSES,
  whatIsUnclear,
  whatIsUnderTest,
  type Unclear,
} from "@shared/record-order";
import { MIN_STABILITY_HALF } from "@shared/stability";
import { GRADE_WORD, type Claim } from "@shared/claim";
import type { RecordReading } from "@shared/record-dashboard";

const root = resolve(__dirname, "../..");

const summary = (n: number) => ({ n, meanConfidence: 0.6, accuracyRate: 0.5, gap: 0.1, gapVariance: 0.2 });

const bucket = (over: Partial<RecordReading["buckets"][number]> = {}) => ({
  key: "fast-under-45s",
  scope: "החלטות תחת פחות מ-45 שניות",
  inside: summary(40),
  outside: summary(40),
  measurable: true,
  versusPopulation: { points: 3, standardError: 1, separated: true },
  shortBy: 0,
  unmeasurableReason: null,
  ...over,
}) as RecordReading["buckets"][number];

const reading = (over: Partial<RecordReading> = {}): RecordReading =>
  ({
    overall: summary(80),
    counterfactual: { probed: { accurate: 0, n: 0 }, "not-probed": { accurate: 0, n: 0 } },
    profile: { variables: [], crossing: [] },
    calibration: {},
    anchor: {},
    anchorAnswered: [],
    stability: { n: [40, 40], gap: [0.1, 0.1], difference: 0, standardError: 0.1, z: 0, readable: true },
    sensitivity: { n: 80, split: [40, 40], auroc2: 0.6, curve: [], standardError: 0.1, reason: "ok", readable: true },
    sensitivityReference: null,
    control: { n: 80, rho: 0.2, standardError: 0.1, reason: "ok", readable: true },
    buckets: [bucket()],
    confidence: [],
    scored: 80,
    awaitingReveal: 0,
    withoutConfidence: 0,
    ...over,
  }) as unknown as RecordReading;

const claim = (over: Partial<Claim> = {}): Claim => ({
  claim_id: "c1",
  statement: "כשנשאר מעט זמן, הביטחון גבוה מהתוצאה",
  scope: "החלטות תחת פחות מ-45 שניות",
  supporting_decision_ids: ["d1"],
  n: 40,
  grade: "hypothesis",
  refutation_condition: "אם הפער לא יהיה גדול יותר בבדיקה קדימה — הופרך.",
  predicts_overconfidence: true,
  prospective_tests: [],
  graded_under: null,
  created_at: "2026-01-01T00:00:00.000Z",
  last_evaluated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("a page that starts with charts", () => {
  describe("what is still unclear, and whether waiting fixes it", () => {
    it("separates a wait from a dead end, which the page could not do before", () => {
      /*
       * THE ASSERTION THIS FILE EXISTS FOR. Two unreadable buckets, identical on screen before this
       * section existed: one is eight decisions away, the other is over a record that holds no
       * clock and will never fill.
       */
      const items = whatIsUnclear(
        reading({
          buckets: [
            bucket({ key: "a", scope: "קרוב", measurable: false, shortBy: 8, unmeasurableReason: "too-few" }),
            bucket({
              key: "b",
              scope: "בלי שעון",
              measurable: false,
              shortBy: 30,
              unmeasurableReason: "no-clock-data",
            }),
          ],
        }),
      );
      const byScope = new Map(items.map((i) => [i.what, i]));
      expect(byScope.get("קרוב")).toMatchObject({
        because: "too-few-in-bucket",
        needs: 8,
        waitingHelps: true,
      });
      expect(byScope.get("בלי שעון")).toMatchObject({
        because: "no-clock-recorded",
        needs: null,
        waitingHelps: false,
      });
    });

    it("puts the waits first, nearest first, so the list is in the order a player can act on", () => {
      const items = whatIsUnclear(
        reading({
          buckets: [
            bucket({ key: "far", scope: "רחוק", measurable: false, shortBy: 20, unmeasurableReason: "too-few" }),
            bucket({ key: "dead", scope: "מת", measurable: false, shortBy: 5, unmeasurableReason: "no-clock-data" }),
            bucket({ key: "near", scope: "קרוב", measurable: false, shortBy: 3, unmeasurableReason: "too-few" }),
          ],
        }),
      );
      expect(items.map((i) => i.what)).toEqual(["קרוב", "רחוק", "מת"]);
    });

    it("reports a readable bucket with no baseline as unclear, and as a dead end", () => {
      /*
       * The split CAN be measured; what it cannot do is say whether the number is about this player
       * or about chess. `versusPopulation`'s own note is blunt -- the middlegame is 12.6 points less
       * accurate for EVERYONE -- so a bucket with no baseline is a figure that must not be read in
       * the second person, and no amount of play changes that.
       */
      const items = whatIsUnclear(reading({ buckets: [bucket({ versusPopulation: null })] }));
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ because: "no-population-baseline", waitingHelps: false });
    });

    it("counts the split-half shortfall in whole decisions, not in half-decisions", () => {
      /*
       * A record needs `MIN_STABILITY_HALF` in EACH half, and decisions arrive into the record
       * rather than into a half. Reporting the raw gap would be a promise the next five decisions
       * cannot keep.
       */
      const short = MIN_STABILITY_HALF - 5;
      const items = whatIsUnclear(reading({ stability: { ...reading().stability, n: [short, short] } as never }));
      const halves = items.find((i) => i.because === "halves-too-short");
      expect(halves?.needs).toBe(10);
    });

    it("says a record with too few of one outcome needs different positions, not more of them", () => {
      const items = whatIsUnclear(
        reading({ sensitivity: { ...reading().sensitivity, reason: "too-few-inaccurate" } as never }),
      );
      const item = items.find((i) => i.because === "too-few-inaccurate");
      expect(item).toBeDefined();
      expect(UNCLEAR_SENTENCE["too-few-inaccurate"]).toContain("עמדות קשות יותר");
    });

    it("returns nothing when every split is readable, rather than claiming everything is clear", () => {
      expect(whatIsUnclear(reading())).toEqual([]);
    });

    it("publishes a sentence and a waiting verdict for every cause", () => {
      // A seventh cause added without either is a screen that renders `undefined`, far from the edit.
      for (const cause of UNCLEAR_CAUSES) {
        expect(UNCLEAR_SENTENCE[cause], `no sentence for ${cause}`).toBeTruthy();
        expect(typeof WAITING_HELPS[cause], `no waiting verdict for ${cause}`).toBe("boolean");
      }
    });
  });

  describe("what the section renders", () => {
    const items: Unclear[] = [
      { what: "קרוב", because: "too-few-in-bucket", needs: 8, waitingHelps: true },
      { what: "בלי שעון", because: "no-clock-recorded", needs: null, waitingHelps: false },
    ];

    it("draws a wait and a dead end as different things, not just different words", () => {
      render(<WhatIsUnclear items={items} />);
      const rows = document.querySelectorAll(".unclear__item");
      expect(rows).toHaveLength(2);
      expect([...rows].map((r) => r.getAttribute("data-waiting"))).toEqual(["true", "false"]);
    });

    it("says plainly that the dead ends will not open", () => {
      render(<WhatIsUnclear items={items} />);
      expect(screen.getByText("אלה לא ייפתחו מעוד משחקים:")).toBeTruthy();
    });

    it("keeps the count out of the sentence, so the sentence cannot go stale", () => {
      render(<WhatIsUnclear items={items} />);
      expect(document.querySelector(".unclear__needs")?.textContent).toBe("עוד 8 החלטות");
      expect(document.querySelector(".unclear__because")?.textContent).not.toMatch(/\d/);
    });

    it("renders nothing rather than announcing that everything is clear", () => {
      const { container } = render(<WhatIsUnclear items={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("what is being tested now", () => {
    it("shows only a hypothesis, never a settled claim", () => {
      expect(whatIsUnderTest(claim({ grade: "hypothesis" }))).not.toBeNull();
      expect(whatIsUnderTest(claim({ grade: "replicated" }))).toBeNull();
      expect(whatIsUnderTest(claim({ grade: "refuted" }))).toBeNull();
      expect(whatIsUnderTest(null)).toBeNull();
    });

    it("shows what would END it, which is what makes it a test", () => {
      /*
       * Naming the claim does not answer "what is being tested". Saying what result would end it
       * the other way does, and it is the only thing separating a test from a search for
       * confirmation. Stored before the test runs (R5) precisely so it can be shown during it.
       */
      render(<WhatIsUnderTest test={whatIsUnderTest(claim())} />);
      expect(screen.getByText("מה יפריך את זה")).toBeTruthy();
      expect(screen.getByText(/הופרך/)).toBeTruthy();
    });

    it("wears the hypothesis mark and never a finding's word", () => {
      render(<WhatIsUnderTest test={whatIsUnderTest(claim())} />);
      const mark = document.querySelector(".evidence-mark");
      expect(mark?.getAttribute("data-authority")).toBe("hypothesis");
      expect(within(document.body).queryByText(GRADE_WORD.replicated.he)).toBeNull();
    });

    it("prints zero forward tests as a state rather than hiding the row", () => {
      render(<WhatIsUnderTest test={whatIsUnderTest(claim())} />);
      expect(screen.getByText("עוד לא")).toBeTruthy();
    });
  });

  describe("charts only where the question is visual (§26)", () => {
    function sources(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...sources(full));
        else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
      }
      return out;
    }

    it("draws no donut, no pie, no radial bar and no progress ring, anywhere", () => {
      /*
       * ASSERTED AS AN ABSENCE OVER THE SOURCE, because the failure is a chart that gets ADDED, and
       * a render test can only see the screens it renders. Every one of these exists in recharts
       * and every one of them encodes a single number as an angle -- which is the least readable
       * encoding there is, for the one quantity that needs no encoding at all.
       */
      const forbidden = ["PieChart", "RadialBar", "RadialBarChart", "Pie ", "<Pie"];
      const offenders: string[] = [];
      for (const file of sources(resolve(root, "client/src"))) {
        const text = readFileSync(file, "utf8");
        for (const name of forbidden) if (text.includes(name)) offenders.push(`${file}: ${name}`);
      }
      expect(offenders).toEqual([]);
    });
  });
});
