// @vitest-environment jsdom
/**
 * The commitment screen (section 4.1).
 *
 * The DOM assertion here is SUPPLEMENTARY to GATE-COMMIT, not a replacement for it. Section 5 is
 * explicit that a DOM-only check passes while the answer sits in the props, which is why the
 * gate itself asserts on the network payload. This catches a different failure: engine output
 * reaching the markup.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { answerEveryStep, openStep } from "../fixtures/commitment-steps";
import type { PositionUnderDecision } from "@/lib/decision-session";

const POSITION: PositionUnderDecision = {
  gameId: "g",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  ply: 7,
  clockMsRemaining: null,
  // Anchor: the purpose where the confidence question IS put. The `play` case has its own file.
  purpose: "anchor",
};

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

describe("nothing from the engine is present while deciding", () => {
  it("renders no evaluation, depth, or principal variation anywhere in the DOM", () => {
    const { container } = renderScreen({ chosenMove: "g8f6" });
    const markup = container.innerHTML;
    for (const forbidden of ["Stockfish", "עומק", "scoreCp", "bestMove", "קו עיקרי", "+0."]) {
      expect(markup, `commitment screen leaked "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe("an incomplete decision cannot be recorded", () => {
  it("does not call onCommit and names what is missing", async () => {
    const onCommit = vi.fn();
    renderScreen({ onCommit });
    /*
     * The submit button no longer carries one fixed label. While the decision is incomplete it
     * reads "חסר: <the missing thing>", so that the requirement is visible BEFORE a click rather
     * than only after one -- the silence was what "I cannot complete the move" turned out to
     * mean. The assertion below is unchanged: an incomplete decision is still not recorded.
     */
    await userEvent.click(screen.getByRole("button", { name: /חסר:|רשמו את ההחלטה/ }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/חסרים 4 פרטים/)).toBeInTheDocument();
  });

  it("still refuses when only `unknown` is blank", async () => {
    const onCommit = vi.fn();
    renderScreen({ onCommit, chosenMove: "g8f6" });
    // The read is stated by tapping now, not by typing. What is asserted is unchanged: a
    // decision missing one of its four parts is still not recorded.
    openStep("known");
    await userEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    openStep("confidence");
    await userEvent.click(screen.getByRole("button", { name: /ביטחון 3/ }));
    await userEvent.click(screen.getByRole("button", { name: /חסר:|רשמו את ההחלטה/ }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/לא נאמר מה אי אפשר להעריך/)).toBeInTheDocument();
    // The label names the one thing standing in the way, rather than a count to go hunting for.
    expect(screen.getByRole("button", { name: /חסר:/ }).textContent).toMatch(/אי אפשר להעריך/);
  });
});

describe("a complete decision is recorded with its timing", () => {
  it("passes the draft and a measured seconds_taken to onCommit", async () => {
    const onCommit = vi.fn();
    renderScreen({ onCommit, chosenMove: "g8f6", candidatesConsidered: ["g8f6", "f8e7"] });
    answerEveryStep({ known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 4 });
    await userEvent.click(screen.getByRole("button", { name: /רשמו את ההחלטה/ }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [draft, seconds] = onCommit.mock.calls[0];
    expect(draft).toMatchObject({
      chosenMove: "g8f6",
      knownTags: ["המרכז פתוח"],
      unknownTags: ["לא יודע איך הוא יענה"],
      confidence: 4,
      candidatesConsidered: ["g8f6", "f8e7"],
    });
    expect(seconds).toBeGreaterThanOrEqual(0);
  });
});

describe("PENDING ACTION LOCK (section 4.3)", () => {
  it("disables the submit control while the write is in flight", () => {
    renderScreen({ pending: true, chosenMove: "g8f6" });
    expect(screen.getByRole("button", { name: /רושם החלטה/ })).toBeDisabled();
  });
});

describe("a failed write is visible", () => {
  it("shows the error rather than appearing to have succeeded", () => {
    renderScreen({ error: { message: "אין חיבור למאגר ההחלטות" } });
    expect(screen.getByRole("alert").textContent).toContain("אין חיבור למאגר ההחלטות");
  });

  it("keeps a technical detail, behind a disclosure that ships closed", () => {
    /*
     * LocalRecordStore's invariant messages are English -- "append-only: already revealed" --
     * and this screen is the one that has to say a decision was NOT recorded. Leading with that
     * text puts English at the top of a Hebrew screen; deleting it leaves a failure nobody can
     * report. Same resolution as ErrorBoundary's stack trace.
     */
    const { container } = renderScreen({
      error: { message: "ההחלטה לא נרשמה", detail: "append-only: already revealed" },
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("append-only: already revealed");
    const details = container.querySelector("details");
    expect(details, "the detail is not inside a <details>").toBeTruthy();
    expect(details!.hasAttribute("open"), "the disclosure ships open").toBe(false);
    // Hebrew first: the summary and the message precede the raw text in the alert.
    expect(alert.textContent!.indexOf("ההחלטה לא נרשמה")).toBeLessThan(
      alert.textContent!.indexOf("append-only"),
    );
  });

  it("renders no disclosure when the record layer wrote for the player", () => {
    const { container } = renderScreen({ error: { message: "אין חיבור למאגר ההחלטות" } });
    expect(container.querySelector("details")).toBeNull();
  });
});

/**
 * The tension layer, on the screen.
 *
 * `tests/client/declared-tensions.test.ts` covers which drafts state a tension. What matters
 * here is the two properties that let it live on this screen at all: it does not block, and it
 * does not bring the engine with it.
 */
describe("a question about the player's own declarations", () => {
  /** Two reads that cannot both describe one position, then a confidence. */
  const stateAContradiction = async () => {
    openStep("known");
    await userEvent.click(screen.getByRole("button", { name: "המרכז סגור" }));
    await userEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    openStep("unknown");
    await userEvent.click(screen.getByRole("button", { name: "לא יודע איך הוא יענה" }));
    openStep("confidence");
    await userEvent.click(screen.getByRole("button", { name: /ביטחון 5/ }));
  };

  it("asks about it, with the selections that produced the question", async () => {
    renderScreen({ chosenMove: "g8f6" });
    await stateAContradiction();
    const aside = screen.getByRole("status", { name: "שאלה על ההצהרה שלך" });
    expect(aside).toHaveTextContent("המרכז סגור");
    expect(aside).toHaveTextContent("המרכז פתוח");
    // R1's shape: never the sentence without what produced it.
    expect(aside).toHaveTextContent(/שתי קריאות/);
  });

  it("records the decision anyway", async () => {
    // The tension is a question, not a fifth `draftProblem`. A decision that states one is a
    // complete decision, and the record wants it as it stands rather than tidied up first.
    const onCommit = vi.fn();
    renderScreen({ chosenMove: "g8f6", onCommit });
    await stateAContradiction();
    expect(screen.getByRole("status", { name: "שאלה על ההצהרה שלך" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /רשמו את ההחלטה/ }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("shows one question, never a list of them", async () => {
    // Three of these can be true at once. A panel of all three is the dashboard the product
    // exists to not be.
    renderScreen({ chosenMove: "g8f6" });
    await stateAContradiction();
    openStep("unknown");
    await userEvent.click(screen.getByRole("button", { name: "לא מכיר את העמדה הזו" }));
    await userEvent.click(screen.getByRole("button", { name: "לא יודע מה התוכנית הנכונה" }));
    expect(screen.getAllByRole("status", { name: "שאלה על ההצהרה שלך" })).toHaveLength(1);
  });

  it("brings nothing from the engine with it", async () => {
    const { container } = renderScreen({ chosenMove: "g8f6" });
    await stateAContradiction();
    for (const forbidden of ["Stockfish", "עומק", "scoreCp", "bestMove", "ס״פ", "+0."]) {
      expect(container.innerHTML, `the tension layer leaked "${forbidden}"`).not.toContain(
        forbidden,
      );
    }
  });

  it("stays quiet on an ordinary decision", async () => {
    renderScreen({ chosenMove: "g8f6" });
    answerEveryStep({ known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 3 });
    expect(screen.queryByRole("status", { name: "שאלה על ההצהרה שלך" })).toBeNull();
  });
});
