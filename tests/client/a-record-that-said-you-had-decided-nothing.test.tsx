// @vitest-environment jsdom
/**
 * The empty state has THREE causes, and the fix that found the second one missed the third.
 *
 * `RecordDashboard` prints "עוד לא נחשפה אף החלטה, ולכן אין מה למדוד" whenever `scored === 0`.
 * `scored` is not the revealed count -- it is the DESCRIPTIVE population's revealed-and-scored
 * count -- and that has now told a player they had decided nothing twice, for two different
 * reasons:
 *
 *   1. A decision revealed with no stated confidence. Found by walking an empty profile; fixed by
 *      carrying `withoutConfidence` and branching on it.
 *   2. A decision revealed WITH a stated confidence, in another population. `shared/evidence-
 *      policy.ts` files an `anchor` decision as `separate` from `descriptive-history` -- correctly,
 *      the shared bank has its own denominator -- so it is scored, in `reading.anchor`, and
 *      counted by neither `awaitingReveal` nor `withoutConfidence`. Both are computed over the
 *      described atoms in `recordReading`. The branch falls through to the sentence again.
 *
 * MEASURED, NOT REASONED. Chromium at 1440x900 and 390x844, clean profile, three complete bank
 * decisions, the explorer opened from the reveal. One screen then carried, top to bottom:
 *
 *     y= 108   עוד 60 החלטות מדודות ... 3 נמדדו ונקראות בחלק אחר של הרשומה
 *     y= 233   נרשמו 4 החלטות. זה עדיין תיאור של ההחלטות האלה, לא של השחקן.
 *     y=1870   מהלכים שנרשמו 3 נרשמו
 *     y=2089   עוד לא נחשפה אף החלטה, ולכן אין מה למדוד.
 *
 * Four numbers for one player -- 3, 4, 3, 0 -- and the last one contradicts the first, on a screen
 * that is itself the third reveal. `docs/neta/harness/m-the-door.mjs` reproduces it.
 *
 * THIS IS THE `N-3` OWNER DECISION, ON THE SURFACE IT NAMES. "Every completed measured decision
 * must be acknowledged on the record surface. Bank/shared-set decisions remain outside the
 * personal-game denominator and must be labelled as such. The zero-decision state and the
 * measured-but-not-yet-eligible state must not share the same primary message." That was built on
 * the front door -- `blitz-words.ts`, `resume-reading.ts`, `loop-position.ts`. This panel is the
 * record surface too, and it was missed.
 *
 * NO DENOMINATOR MOVES HERE. `scored` still excludes bank decisions, `anchor` still carries them
 * under its own heading, `MIN_BUCKET_N` and the detector are untouched. What changes is which
 * sentence a state that already exists is allowed to print.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { EVIDENCE_POLICY } from "@shared/evidence-policy";
import { classifyPhase } from "@shared/phase";
import { RecordDashboard } from "@/components/RecordDashboard";

vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

/** The sentence under test, verbatim from the component. */
const NOTHING_REVEALED = "עוד לא נחשפה אף החלטה";

let seq = 0;
const nextId = () => `33333333-3333-4333-8333-${String(++seq).padStart(12, "0")}`;

/** One complete bank decision: committed with a stated confidence, then revealed. */
async function bankDecision(store: MemoryRecordStore, index: number) {
  const fen = ANCHOR_POSITIONS[index % ANCHOR_POSITIONS.length].fen;
  const id = nextId();
  await service.commitDecision(store, {
    decision_id: id,
    entry_state: { game_id: `anchor-${index}`, fen, ply: 22, phase: classifyPhase(fen, 22), clock_ms_remaining: null },
    purpose: "anchor",
    drill_id: null,
    transfer_id: null,
    known: "המרכז סגור",
    unknown: "לא יודע איך הוא יענה",
    known_parts: { tapped: ["המרכז סגור"], typed: "" },
    unknown_parts: { tapped: [], typed: "לא יודע איך הוא יענה" },
    decision: "e7e5",
    bounded_action: {
      seconds_taken: 14,
      confidence: 4,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: ["e7e5"],
    },
    probe: null,
    reveal_timing: "per-decision",
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    result: null,
    feedback: null,
  });
  await service.reveal(store, id, {
    engine_eval_cp: 40,
    engine_best_move: "e7e5",
    engine_depth: 18,
    engine_source: "local_sf18",
    engine_build: "sf18-test-build",
    cp_loss: 0,
  });
  return id;
}

describe("a record that has bank decisions in it has not decided nothing", () => {
  it("reaches the state: scored 0, no wait, no missing question, and three scored in the bank", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 3; i += 1) await bankDecision(store, i);
    const reading = await service.recordReading(store);

    expect(reading.scored, "a bank decision entered the personal denominator").toBe(0);
    expect(reading.awaitingReveal, "a revealed decision was reported as awaiting the engine").toBe(0);
    expect(
      reading.withoutConfidence,
      "the bank always asks the confidence question, so this cannot be the cause here",
    ).toBe(0);
    expect(reading.anchor.n, "the three decisions are scored, in the bank's own reading").toBe(3);
  });

  it("does not tell that player no decision has been revealed", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 3; i += 1) await bankDecision(store, i);
    const reading = await service.recordReading(store);
    const { container } = render(<RecordDashboard reading={reading} />);
    expect(container.textContent ?? "").not.toContain(NOTHING_REVEALED);
  });

  it("says instead where those decisions were read, which is the N-3 labelling rule", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 3; i += 1) await bankDecision(store, i);
    const reading = await service.recordReading(store);
    const { container } = render(<RecordDashboard reading={reading} />);
    const text = container.textContent ?? "";
    expect(text, "the count of decisions the player actually took is absent").toContain("3");
    expect(text, "and the population they were read in is not named").toMatch(/הסט המשותף|בנק/);
  });

  /*
   * THE POSITIVE CONTROL. Without this the fix above is indistinguishable from deleting the
   * sentence: a record with nothing in it must still say there is nothing in it, in those words.
   */
  it("still says it to a record that really is empty", async () => {
    const store = new MemoryRecordStore();
    const reading = await service.recordReading(store);
    expect(reading.scored).toBe(0);
    expect(reading.anchor.n).toBe(0);
    const { container } = render(<RecordDashboard reading={reading} />);
    expect(container.textContent ?? "").toContain(NOTHING_REVEALED);
  });

  /*
   * THE COUNT MEANS "READ SOMEWHERE ELSE", AND ONLY `separate` MEANS THAT.
   *
   * `readElsewhere` was first written as `allAtoms.length - atoms.length`, which is the same
   * number today and would go on being the same number silently after it stopped being true. The
   * sentence it feeds points the player at another section of the record; `refused` -- which the
   * `discovery` consumer uses five times -- means read nowhere, and would point them at a section
   * that does not hold their decision. This holds the two apart at the policy rather than at the
   * arithmetic, so the day a context is refused here the count drops on its own.
   */
  it("counts only decisions some other heading actually reads", () => {
    const cells = Object.entries(EVIDENCE_POLICY["descriptive-history"]);
    expect(cells.length, "a context was added and this test did not see it").toBeGreaterThan(4);
    for (const [context, admission] of cells) {
      expect(
        ["admitted", "separate"],
        `${context} is ${admission.kind}: the readElsewhere count must stop including it`,
      ).toContain(admission.kind);
    }
  });

  /*
   * AND THE SECOND CAUSE STILL HAS ITS OWN SENTENCE, so this is not a blanket replacement of the
   * branch that was added to fix cause 1.
   */
  it("keeps the no-confidence sentence for the state that produces it", async () => {
    const reading = { ...(await service.recordReading(new MemoryRecordStore())), withoutConfidence: 2 };
    const { container } = render(<RecordDashboard reading={reading} />);
    const text = container.textContent ?? "";
    expect(text).toContain("לא נרשמה עם ביטחון מוצהר");
    expect(text).not.toContain(NOTHING_REVEALED);
  });
});
