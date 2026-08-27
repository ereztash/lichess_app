// @vitest-environment jsdom
/**
 * The first thing a player is asked to do, and where it used to be.
 *
 * MEASURED in a browser on the built app, before this change:
 *
 *   1440x900   the panel was 952px tall inside a 900px window, so the record button sat at the
 *              very edge and the strip under it naming what was missing was clipped at every
 *              standard laptop height.
 *   390x844    the board began at y=240 and the panel at y=937, so the record button needed
 *              113px of scroll and the move field 264px. The page was 2.5 screens tall, and the
 *              first 223px of it were a wordmark that wrapped onto two lines and a rail of five
 *              tools nobody needs before their first decision.
 *
 * All four requirements opened at once. A player met a board, and the question the board is for
 * was somewhere below it.
 *
 * The four are an accordion now: one open, the rest collapsed to a header carrying the step's
 * name and its answer. THE CONSTRAINT THIS HAD TO RESPECT is the one two earlier attempts at a
 * shorter panel were refused for -- no option may be removed and none may go behind a "more"
 * control, because that is what a player is able to say about a position and what the record then
 * holds. Nothing here removes anything: every step is a button and every option is one tap away.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS } from "@/lib/read-options";
import { openStep, STEP } from "../fixtures/commitment-steps";

const root = resolve(__dirname, "../..");
const POSITION = {
  gameId: "g",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ply: 0,
  clockMsRemaining: null,
  // Anchor: the purpose where the confidence question IS put. `as never` below casts past the
  // type, so a missing `purpose` here is invisible to tsc and shows up as a vanished step.
  purpose: "anchor",
};

const panel = (props: Partial<Parameters<typeof CommitmentScreen>[0]> = {}) =>
  render(
    <CommitmentScreen
      position={POSITION as never}
      chosenMove={null}
      candidatesConsidered={[]}
      onCommit={vi.fn()}
      pending={false}
      {...props}
    />,
  );

const heads = () => [...document.querySelectorAll<HTMLElement>(".step-head")];
const openBodies = () => document.querySelectorAll(".step-body:not([hidden])");

describe("one question is open, and the rest of the shape is still visible", () => {
  it("opens exactly one step", () => {
    panel();
    expect(openBodies()).toHaveLength(1);
  });

  it("shows all four headers from the first frame", () => {
    /*
     * The difference between an accordion and a wizard, and the reason this is not a wizard. A
     * player who cannot see how many questions are left is in the same position as one scrolling
     * a 952px panel: they do not know how much of the decision is in front of them.
     */
    panel();
    const labels = heads().map((h) => h.textContent ?? "");
    for (const name of Object.values(STEP)) {
      expect(labels.some((l) => l.includes(name)), `no header for "${name}"`).toBe(true);
    }
    expect(heads()).toHaveLength(4);
  });

  it("marks what is required on the collapsed headers, not only when they are open", () => {
    // What is required has to be knowable before the click. Three of the four are marked; the
    // move is stated on the board and has no mark of its own.
    panel();
    expect(screen.getAllByText("חובה")).toHaveLength(3);
  });

  it("opens the first unanswered step, which with no move is the move", () => {
    panel();
    expect(heads()[0].getAttribute("aria-expanded")).toBe("true");
  });
});

describe("nothing is hidden -- it is one tap away", () => {
  it("keeps every option of both read fields in the DOM at all times", () => {
    /*
     * The load-bearing one. `hidden` takes a collapsed step out of the accessible tree along with
     * the visual layout, which is correct -- announcing a step that is not on screen is worse
     * than collapsing it -- so this counts what the panel HOLDS, and the walk below checks that
     * opening a step brings all of it back.
     */
    panel();
    const labels = [...document.querySelectorAll(".read-chip")].map((c) => c.textContent);
    expect(labels).toHaveLength(KNOWN_OPTIONS.length + UNKNOWN_OPTIONS.length);
  });

  it("brings every option back when its step is opened", () => {
    panel({ chosenMove: "e2e4" });
    for (const [step, options] of [
      ["known", KNOWN_OPTIONS],
      ["unknown", UNKNOWN_OPTIONS],
    ] as const) {
      openStep(step);
      for (const option of options) {
        expect(
          screen.getByRole("button", { name: option.label }),
          `"${option.label}" is unreachable with its step open`,
        ).toBeInTheDocument();
      }
    }
  });

  it("lets a completed step be reopened and changed", () => {
    // A stepper you cannot walk backwards through is a form that traps you in its own order.
    panel({ chosenMove: "e2e4" });
    openStep("known");
    fireEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    openStep("confidence");
    openStep("known");
    const chip = screen.getByRole("button", { name: "המרכז פתוח" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("a collapsed step says what was answered", () => {
  it("shows the move on the header once it is on the board", () => {
    panel({ chosenMove: "e2e4" });
    const moveHead = heads().find((h) => h.textContent?.includes(STEP.move))!;
    expect(moveHead.textContent).toContain("e2e4");
  });

  it("shows the confidence as the number AND the word it was chosen by", () => {
    // The digit alone is the terse half. A collapsed step that reads "4" says less than the
    // control the player used, which read "4 בטוח".
    panel({ chosenMove: "e2e4" });
    openStep("confidence");
    fireEvent.click(screen.getByRole("button", { name: /ביטחון 4/ }));
    const head = heads().find((h) => h.textContent?.includes(STEP.confidence))!;
    expect(head.textContent).toMatch(/4/);
    expect(head.textContent).toMatch(/בטוח/);
  });

  it("shows nothing where nothing has been answered", () => {
    // Section 4.5: unanswered and answered must not read alike, and an unanswered step showing a
    // placeholder value is the version of that mistake this panel could make.
    panel();
    const head = heads().find((h) => h.textContent?.includes(STEP.confidence))!;
    expect(head.querySelector(".step-answer")?.textContent).toBe("");
  });
});

describe("the move step advances by itself, and the read steps do not", () => {
  it("moves on when a move arrives from the board", () => {
    /*
     * Choosing a move is ONE act and cannot be added to, so nothing is cut short by moving on.
     * It also arrives from the board rather than from this panel, so the step has to notice.
     */
    const { rerender } = panel();
    expect(heads()[0].getAttribute("aria-expanded")).toBe("true");
    rerender(
      <CommitmentScreen
        position={POSITION as never}
        chosenMove="e2e4"
        candidatesConsidered={["e2e4"]}
        onCommit={vi.fn()}
        pending={false}
      />,
    );
    expect(heads()[0].getAttribute("aria-expanded")).toBe("false");
    expect(heads()[1].getAttribute("aria-expanded")).toBe("true");
  });

  it("does NOT move on when one chip is tapped", () => {
    /*
     * The deliberate inconsistency, and the reason for it. Both read steps are multi-select and
     * their own hint says "choose as many as you like". Advancing on the first tap would make one
     * tap the normal amount -- the interface shaping the record rather than holding it, which is
     * exactly what got a count beside the candidate moves refused.
     */
    panel({ chosenMove: "e2e4" });
    openStep("known");
    fireEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    const knownHead = heads().find((h) => h.textContent?.includes(STEP.known))!;
    expect(
      knownHead.getAttribute("aria-expanded"),
      "the panel moved on after one chip, which prices a second one",
    ).toBe("true");
    // The second chip is still right there.
    fireEvent.click(screen.getByRole("button", { name: "מלך חשוף" }));
    expect(screen.getByRole("button", { name: "מלך חשוף" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("moves on when the player says so", () => {
    panel({ chosenMove: "e2e4" });
    openStep("known");
    fireEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    fireEvent.click(screen.getByRole("button", { name: "הבא" }));
    const unknownHead = heads().find((h) => h.textContent?.includes(STEP.unknown))!;
    expect(unknownHead.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("a refused record opens the step that is missing", () => {
  it("takes the player to the field rather than scrolling them past it", () => {
    /*
     * The original report was "I still cannot complete the move": the button stayed enabled, the
     * click set a flag, and the messages rendered below the fold. The answer used to be a scroll.
     * With one step open the answer is the step itself.
     */
    panel({ chosenMove: "e2e4" });
    openStep("confidence");
    fireEvent.click(screen.getByRole("button", { name: /חסר:/ }));
    const knownHead = heads().find((h) => h.textContent?.includes(STEP.known))!;
    expect(knownHead.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelectorAll(".commitment-field.has-problem").length).toBeGreaterThan(0);
  });

  it("still names the one thing standing in the way, on the button", () => {
    panel({ chosenMove: "e2e4" });
    expect(screen.getByRole("button", { name: /חסר:/ }).textContent).toMatch(/קוראים בעמדה/);
  });
});

describe("the panel is a bounded shape, not a variable one", () => {
  it("bounds the open step rather than the list inside it", () => {
    /*
     * With the second step open its body measured 421px -- ten chips wrapping into five rows --
     * which put steps 3 and 4 at y=898 and y=958 in a 900px window. Capping the BODY keeps every
     * option and every header; capping the list would have removed what a player can say.
     */
    const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
    const body = css.slice(css.indexOf(".step-body {"));
    expect(body).toMatch(/max-block-size:\s*min\(/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });

  it("puts the record button after the last step, not between them", () => {
    panel({ chosenMove: "e2e4" });
    const nodes = [...document.querySelectorAll(".commitment-step, .commitment-submit")];
    expect(nodes.at(-1)).toHaveClass("commitment-submit");
  });
});
