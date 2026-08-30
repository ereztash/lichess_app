// @vitest-environment jsdom
/**
 * `aria-modal="true"` is a promise, and nothing was keeping it.
 *
 * The attribute tells assistive technology that everything outside this node is not there. The
 * panel set it, handled Escape, and moved focus to its first control -- and then let Tab walk
 * straight out the back, into a page the screen reader had already been told did not exist. It
 * read out controls it would not announce, on a document it had stopped describing. That is worse
 * than an untrapped dialog with no `aria-modal`, which at least does not lie about itself.
 *
 * The second half is quieter and hurts more often: closing the panel dropped focus on the floor.
 * A keyboard user who opened a tool, used it and closed it was returned to the top of the
 * document, with no way back to where they were except to Tab through everything again.
 *
 * WHAT THESE MEASURE. jsdom does not implement sequential focus navigation, so a real Tab press
 * moves nothing here -- which is exactly why this component needs a handler rather than relying on
 * the browser, and why the handler's own effect IS observable: it calls `.focus()`. Every
 * assertion below reads `document.activeElement` after dispatching the key the handler reads.
 * `tests/layout/board-tab-order.layout.test.tsx` is where a real browser's traversal is measured.
 */
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Overlay } from "../../client/src/components/Overlay";

const tab = (shift = false) => fireEvent.keyDown(document, { key: "Tab", shiftKey: shift });
const escape = () => fireEvent.keyDown(document, { key: "Escape" });

describe("focus goes into the panel", () => {
  it("lands on the first control", () => {
    render(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <button>ראשון</button>
        <button>שני</button>
      </Overlay>,
    );
    expect(document.activeElement?.textContent).toBe("ראשון");
  });

  it("finds a control the old three-tag selector could not", () => {
    /*
     * It was `input, textarea, button`, which is not a list of focusable things -- it is a list of
     * three of them. A panel whose first control is a link or a select had focus land somewhere
     * else, or nowhere.
     */
    render(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <a href="#somewhere">קישור</a>
        <button>כפתור</button>
      </Overlay>,
    );
    expect(document.activeElement?.textContent).toBe("קישור");
  });

  it("holds focus itself when the panel has no controls at all", () => {
    const { container } = render(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <p>אין כאן על מה ללחוץ</p>
      </Overlay>,
    );
    expect(document.activeElement).toBe(container.querySelector(".panel-shell"));
  });

  it("skips a disabled control rather than focusing something unusable", () => {
    render(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <button disabled>כבוי</button>
        <button>דלוק</button>
      </Overlay>,
    );
    expect(document.activeElement?.textContent).toBe("דלוק");
  });
});

describe("Tab cannot leave the panel", () => {
  const open = () =>
    render(
      <>
        <button id="outside">מחוץ לפאנל</button>
        <Overlay label="בדיקה" onClose={() => undefined}>
          <button>ראשון</button>
          <input aria-label="אמצעי" />
          <button>אחרון</button>
        </Overlay>
      </>,
    );

  it("wraps from the last control back to the first", () => {
    const { getByText } = open();
    getByText("אחרון").focus();
    expect(document.activeElement?.textContent).toBe("אחרון");
    tab();
    expect(document.activeElement?.textContent).toBe("ראשון");
  });

  it("wraps backwards from the first control to the last", () => {
    open();
    tab(true);
    expect(document.activeElement?.textContent).toBe("אחרון");
  });

  it("does not intercept a Tab in the middle of the panel", () => {
    /*
     * The trap must only act at the two ends. Preventing every Tab would freeze focus on whatever
     * it happened to be on, which is a worse dialog than an open one.
     */
    const { container } = open();
    const middle = container.querySelector("input")!;
    middle.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(middle);
  });

  it("pulls focus back in when it is already outside", () => {
    /*
     * Focus can arrive outside without a Tab -- returning from the browser's own chrome, or a
     * script elsewhere calling focus(). A handler bound to the panel would never see the key. This
     * one is on the document, so the next Tab recovers.
     */
    const { container } = open();
    container.querySelector<HTMLElement>("#outside")!.focus();
    tab();
    expect(document.activeElement?.textContent).toBe("ראשון");
  });

  it("pulls it back to the LAST control on a backwards Tab", () => {
    const { container } = open();
    container.querySelector<HTMLElement>("#outside")!.focus();
    tab(true);
    expect(document.activeElement?.textContent).toBe("אחרון");
  });

  it("refuses to let Tab out of a panel with nothing to focus", () => {
    render(
      <>
        <button id="outside">מחוץ לפאנל</button>
        <Overlay label="בדיקה" onClose={() => undefined}>
          <p>אין כאן על מה ללחוץ</p>
        </Overlay>
      </>,
    );
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("still closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Overlay label="בדיקה" onClose={onClose}>
        <button>ראשון</button>
      </Overlay>,
    );
    escape();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

/** A trigger that opens the panel, so "where focus came from" is a real element and not a fixture. */
function PanelFromAButton({ label = "פתח" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Overlay label="בדיקה" onClose={() => setOpen(false)}>
          <button onClick={() => setOpen(false)}>סגור</button>
        </Overlay>
      )}
    </>
  );
}

describe("focus comes back out", () => {
  it("returns to the control that opened the panel", () => {
    const { getByText } = render(<PanelFromAButton />);
    const trigger = getByText("פתח");
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement?.textContent).toBe("סגור");

    escape();
    expect(document.activeElement).toBe(trigger);
  });

  it("survives an opener that has been removed, and says where focus actually lands", () => {
    /*
     * REWRITTEN AFTER A CONTROL CAUGHT IT. This first asserted only that unmounting did not throw,
     * which is true whether or not the restore is guarded -- so the control that removed the guard
     * stayed green and the test was proving nothing.
     *
     * What is asserted now is the real behaviour: focusing a detached node is a no-op, so focus
     * ends up on <body>. That is not a failure to prevent, it is where focus goes when the thing
     * it should return to no longer exists. Recording it is worth more than a guard that reads
     * like safety and does nothing, which is why the guard itself was deleted.
     */
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <button>בפנים</button>
      </Overlay>,
    );
    opener.remove();
    expect(() => unmount()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });

  it("does NOT restore mid-life when the parent hands it a new onClose", () => {
    /*
     * The subtle one, and the reason focus capture and the key listener are two effects rather
     * than one. The listener has to be rebuilt whenever `onClose` changes identity. If capture
     * shared those dependencies, any parent re-render producing a fresh closure would restore
     * focus to the opener while the dialog was still on screen -- and then re-capture whatever had
     * focus by then as the new "opener", so the real one was lost for good.
     */
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const { rerender, unmount } = render(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <button>בפנים</button>
      </Overlay>,
    );
    expect(document.activeElement?.textContent).toBe("בפנים");

    // A new closure every render, which is what a parent component normally produces.
    rerender(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <button>בפנים</button>
      </Overlay>,
    );
    expect(document.activeElement?.textContent).toBe("בפנים");

    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it("does not touch the opener at all until it closes", () => {
    /*
     * THE ASSERTION THAT ACTUALLY CATCHES A MERGED EFFECT, and it took two controls to find.
     *
     * The first attempt checked where focus ENDED UP after a re-render, and a merged version
     * passes it: React runs the cleanup before re-running the effect, so focus goes trigger ->
     * "בפנים" and lands back where it started, and the second capture reads the trigger correctly
     * because the cleanup had just focused it. Every end-state assertion is blind to this.
     *
     * What is not blind to it is COUNTING. A merged effect calls `trigger.focus()` once per
     * re-render; a split one never calls it until the dialog closes. The cost of the merged
     * version is exactly that transient -- invisible on screen, and announced out loud by a screen
     * reader every time the parent re-renders.
     */
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const focused = vi.spyOn(trigger, "focus");

    const { rerender, unmount } = render(
      <Overlay label="בדיקה" onClose={() => undefined}>
        <button>בפנים</button>
      </Overlay>,
    );
    for (let i = 0; i < 3; i += 1) {
      rerender(
        <Overlay label="בדיקה" onClose={() => undefined}>
          <button>בפנים</button>
        </Overlay>,
      );
    }
    expect(focused, "focus was pulled back to the opener while the dialog was open").not.toHaveBeenCalled();

    unmount();
    expect(focused).toHaveBeenCalledOnce();
    trigger.remove();
  });
});
