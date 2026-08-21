// @vitest-environment jsdom
/**
 * The provenance-carrying value component (section 4.4).
 *
 * R1: a claim is never wider than the measurement that produced it. These tests assert that the
 * measurement is visible in the rendered output, not merely available to the code.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotMeasured, Rate, Value } from "@/components/Value";

describe("Rate always renders its denominator", () => {
  it("distinguishes 100% from one game from 52% from three hundred", () => {
    const { container: one } = render(<Rate value={1} of={1} />);
    const { container: many } = render(<Rate value={156} of={300} />);

    expect(one.textContent).toContain("100%");
    expect(one.textContent).toContain("(1/1)");
    expect(many.textContent).toContain("52%");
    expect(many.textContent).toContain("(156/300)");

    // The whole point: these must not read the same.
    expect(one.textContent).not.toEqual(many.textContent);
  });

  it("renders an explicit absence rather than a percentage of nothing", () => {
    const { container } = render(<Rate value={0} of={0} />);
    expect(container.textContent).toContain("אין נתונים");
    expect(container.textContent).not.toContain("%");
  });
});

describe("Value carries its provenance to the pixel", () => {
  it("shows engine depth and source alongside the number", () => {
    render(
      <Value provenance={{ kind: "engine", source: "local_sf18", depth: 18 }}>+0.31</Value>,
    );
    expect(screen.getByText("+0.31")).toBeInTheDocument();
    expect(screen.getByText(/עומק 18/)).toBeInTheDocument();
    expect(screen.getByText(/Stockfish 18/)).toBeInTheDocument();
  });

  it("distinguishes a cloud evaluation from a local one", () => {
    const { container } = render(
      <Value provenance={{ kind: "engine", source: "lichess_cloud", depth: 40 }}>+0.31</Value>,
    );
    expect(container.textContent).toContain("ענן Lichess");
    expect(container.textContent).not.toContain("Stockfish");
  });

  it("marks a stale engine value visibly, rather than showing it as current", () => {
    const { container } = render(
      <Value provenance={{ kind: "engine", source: "local_sf18", depth: 18, stale: true }}>
        +0.31
      </Value>,
    );
    expect(container.textContent).toContain("לא מעודכן");
    expect(container.querySelector(".value-stale")).not.toBeNull();
  });

  it("never renders a claim without its grade and n", () => {
    const { container } = render(
      <Value provenance={{ kind: "claim", n: 27, grade: "hypothesis" }}>27/31</Value>,
    );
    expect(container.textContent).toContain("השערה");
    expect(container.textContent).toContain("n=27");
  });

  it("an absence states why, and shows no number", () => {
    const { container } = render(<NotMeasured reason="אין הערכת ענן לעמדה זו" />);
    expect(container.textContent).toContain("אין הערכת ענן לעמדה זו");
    expect(container.textContent).toContain("—");
  });
});
