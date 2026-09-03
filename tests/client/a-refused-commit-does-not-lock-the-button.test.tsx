// @vitest-environment jsdom
/**
 * One gesture, one commit; and a commit that was refused does not lock the button.
 *
 * TWO DEFECTS, ONE GUARD. The stranger journey found that two clicks in one gesture wrote two
 * decisions, because `disabled={pending}` arrives a render late. The guard that fixed it was a ref
 * released when `pending` cleared -- and the adversarial review found the second defect in the
 * fix: two refusal paths in `Home.onCommit` set the stage to committing and straight back in one
 * synchronous run, React batches the two, `pending` never turns true, and the guard held for as
 * long as the position did. A player who then fixed the refusal could never commit that position.
 *
 * So the guard is released when `onCommit` SETTLES, whatever `pending` does, and this file holds
 * both halves at the component, where the guard lives.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "../../client/src/components/CommitmentScreen";
import { answerEveryStep } from "../fixtures/commitment-steps";

const position = { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ply: 0, purpose: "anchor" };
const answers = { known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 3 };

function ready(onCommit: Parameters<typeof CommitmentScreen>[0]["onCommit"]) {
  const view = render(
    <CommitmentScreen
      position={position as never}
      chosenMove="e2e4"
      candidatesConsidered={["e2e4"]}
      onCommit={onCommit}
      pending={false}
    />,
  );
  answerEveryStep(answers);
  return { view, button: () => screen.getByRole("button", { name: /רשמו את ההחלטה/ }) };
}

describe("the record button", () => {
  it("commits once when pressed twice in the same tick, before any re-render", () => {
    const onCommit = vi.fn(() => new Promise<void>(() => {}));
    const { button } = ready(onCommit);
    const b = button();
    fireEvent.click(b);
    fireEvent.click(b);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("can commit again after a refusal that never turned `pending` on", async () => {
    /* Home's refusal paths: the promise resolves at once and `pending` stays false throughout. */
    const onCommit = vi.fn(async () => undefined);
    const { button } = ready(onCommit);
    fireEvent.click(button());
    expect(onCommit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    fireEvent.click(button());
    expect(onCommit, "the guard stayed up after the refusal settled").toHaveBeenCalledTimes(2);
  });

  it("can commit again after `onCommit` threw synchronously", async () => {
    const onCommit = vi.fn(() => {
      throw new Error("refused before anything was written");
    });
    const { button } = ready(onCommit);
    fireEvent.click(button());
    /* The release rides a short promise chain; a macrotask is enough for it to have settled. */
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(button());
    expect(onCommit).toHaveBeenCalledTimes(2);
  });
});
