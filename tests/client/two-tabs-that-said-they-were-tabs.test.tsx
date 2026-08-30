// @vitest-environment jsdom
/**
 * The tab strip in the game review, found by a gate rather than by a person.
 *
 * `GATE-KEYBOARD` was written for the board and for `Overlay`, and on its first run against real
 * code it named a third instance nobody had looked at: `review-tabs` declared `role="tablist"`,
 * its two buttons declared `role="tab"`, and the component handled no key. Same defect, smaller.
 * The role tells assistive technology that the arrow keys move between tabs; nothing moved.
 *
 * It was also incomplete in a way the gate cannot see: no `aria-controls`, so a reader had no way
 * to get from a tab to the thing it opens, and no `role="tabpanel"`, so what it opened was not
 * announced as a panel belonging to anything.
 *
 * The APG pattern is implemented here rather than the roles being deleted, because tabs are the
 * honest semantic: two views of the same analysis, one at a time.
 */
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameReview } from "../../client/src/components/GameReview";

/** The same fixture `game-review.test.tsx` uses, so the two agree about what a review is. */
const SCORES = [37, 41, 35, 37, 46, 15, 96, 14, -39, -407, -406];

const review = () => render(<GameReview evalScores={SCORES} playerColor="w" totalPlies={10} />);
const tabs = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[role="tab"]')];
const selected = (c: HTMLElement) =>
  c.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("id");

describe("the tab strip is one tab stop", () => {
  it("puts exactly one tab in the tab order, the selected one", () => {
    const { container } = review();
    const strip = tabs(container);
    expect(strip.length).toBeGreaterThanOrEqual(2);
    expect(strip.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(strip.find((t) => t.getAttribute("tabindex") === "0")).toBe(
      strip.find((t) => t.getAttribute("aria-selected") === "true"),
    );
  });
});

describe("the arrow keys move between the tabs", () => {
  it("moves forward and wraps", () => {
    const { container } = review();
    const strip = tabs(container);
    expect(selected(container)).toBe("review-tab-curve");
    strip[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(selected(container)).toBe("review-tab-loss");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(selected(container)).toBe("review-tab-curve");
  });

  it("moves backward and wraps the other way", () => {
    const { container } = review();
    tabs(container)[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(selected(container)).toBe("review-tab-loss");
  });

  it("takes Home and End to the ends of the strip", () => {
    const { container } = review();
    tabs(container)[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(selected(container)).toBe("review-tab-loss");
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(selected(container)).toBe("review-tab-curve");
  });

  it("moves DOM focus with the selection, not just the attribute", () => {
    const { container } = review();
    tabs(container)[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("id")).toBe("review-tab-loss");
  });

  it("leaves other keys alone", () => {
    const { container } = review();
    tabs(container)[0].focus();
    const event = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(selected(container)).toBe("review-tab-curve");
  });
});

describe("a tab is connected to the thing it opens", () => {
  it("points at a panel that exists and names it back", () => {
    /*
     * The half the gate cannot see. Without `aria-controls` a reader has no route from the tab to
     * the panel, and without `aria-labelledby` the panel does not say which tab it belongs to --
     * so the strip announced two tabs governing nothing.
     */
    const { container } = review();
    const open = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
    const panelId = open.getAttribute("aria-controls")!;
    expect(panelId).toBeTruthy();
    const panel = container.querySelector(`#${panelId}`)!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("role")).toBe("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(open.getAttribute("id"));
  });

  it("renders exactly one panel, the selected one", () => {
    const { container } = review();
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    fireEvent.keyDown(tabs(container)[0], { key: "ArrowRight" });
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(1);
    expect(panels[0].getAttribute("id")).toBe("review-panel-loss");
  });
});
