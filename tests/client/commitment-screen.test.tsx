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
import type { PositionUnderDecision } from "@/lib/decision-session";

const POSITION: PositionUnderDecision = {
  gameId: "g",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  ply: 7,
  clockMsRemaining: null,
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
    await userEvent.type(screen.getByLabelText(/מה אתם כן יכולים לקרוא/), "מרכז פתוח");
    await userEvent.click(screen.getByRole("button", { name: /ביטחון 3/ }));
    await userEvent.click(screen.getByRole("button", { name: /חסר:|רשמו את ההחלטה/ }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/לא נכתב מה אי אפשר להעריך/)).toBeInTheDocument();
    // The label names the one thing standing in the way, rather than a count to go hunting for.
    expect(screen.getByRole("button", { name: /חסר:/ }).textContent).toMatch(/אי אפשר להעריך/);
  });
});

describe("a complete decision is recorded with its timing", () => {
  it("passes the draft and a measured seconds_taken to onCommit", async () => {
    const onCommit = vi.fn();
    renderScreen({ onCommit, chosenMove: "g8f6", candidatesConsidered: ["g8f6", "f8e7"] });
    await userEvent.type(screen.getByLabelText(/מה אתם כן יכולים לקרוא/), "מרכז פתוח");
    await userEvent.type(screen.getByLabelText(/מה אתם לא יכולים להעריך/), "לא יודע אם d5 עובד");
    await userEvent.click(screen.getByRole("button", { name: /ביטחון 4/ }));
    await userEvent.click(screen.getByRole("button", { name: /רשמו את ההחלטה/ }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [draft, seconds] = onCommit.mock.calls[0];
    expect(draft).toMatchObject({
      chosenMove: "g8f6",
      known: "מרכז פתוח",
      unknown: "לא יודע אם d5 עובד",
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
    renderScreen({ error: "אין חיבור למאגר ההחלטות" });
    expect(screen.getByRole("alert").textContent).toContain("אין חיבור למאגר ההחלטות");
  });
});
