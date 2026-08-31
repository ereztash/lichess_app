// @vitest-environment jsdom
/**
 * POSITIVE CONTROL for GATE-ONE-PRIMARY-ACTION and GATE-NO-DUPLICATE-ACTION. Expected to FAIL.
 *
 * IT IS NOT A CONTRIVED SCREEN. Both halves are the product as it stood before the walk that found
 * them, reduced to their markup:
 *
 *   - `TwoProducts` is the returning front door: the resume screen's "play a short game" beside
 *     `FirstDecision`'s "take me to a position", at the same weight, naming two different products.
 *   - `SameActTwice` is the reveal: `CONTINUATION_CTA` in the header and again at the foot of the
 *     panel, both `primary-control`, both calling `nextDecision`.
 *
 * The predicate is the gate's own, run over these instead of over the real screens. A control with
 * its own weaker predicate proves nothing.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRIMARY_ACTION_ATTR, primaryAction } from "@shared/primary-action";

function actsOn(container: HTMLElement): string[] {
  return [...container.querySelectorAll(`[${PRIMARY_ACTION_ATTR}]`)]
    .filter((el) => !el.closest("details:not([open])") && !el.closest("[hidden]"))
    .map((el) => el.getAttribute(PRIMARY_ACTION_ATTR)!);
}

function TwoProducts() {
  return (
    <main>
      <button className="finding__button" {...primaryAction("play-blitz")}>
        שחק משחק קצר
      </button>
      <button className="primary-control" {...primaryAction("play-first-decision")}>
        קחו אותי לעמדה
      </button>
    </main>
  );
}

function SameActTwice() {
  return (
    <main>
      <button className="primary-control" {...primaryAction("next-decision")}>
        לבדוק אם זה חוזר
      </button>
      <button className="primary-control reveal-continue" {...primaryAction("next-decision")}>
        לבדוק אם זה חוזר
      </button>
    </main>
  );
}

describe("GATE-ONE-PRIMARY-ACTION control", () => {
  it("notices a state that offers two different products at once", () => {
    const { container } = render(<TwoProducts />);
    const acts = actsOn(container);
    expect(acts.length, `the front door offers ${acts.join(" + ")}`).toBeLessThanOrEqual(1);
  });
});

describe("GATE-NO-DUPLICATE-ACTION control", () => {
  it("notices one action rendered twice", () => {
    const { container } = render(<SameActTwice />);
    const acts = actsOn(container);
    expect(new Set(acts).size, `the reveal offers ${acts.join(" + ")}`).toBe(acts.length);
  });
});
