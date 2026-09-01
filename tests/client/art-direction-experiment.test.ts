import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveArtDirection } from "../../client/src/lib/art-direction-experiment";

describe("the art-direction experiment changes presentation and nothing else", () => {
  it("accepts only the four preregistered conditions and fails to baseline", () => {
    expect(resolveArtDirection("?art=0")).toBe("0");
    expect(resolveArtDirection("?art=1")).toBe("1");
    expect(resolveArtDirection("?art=2")).toBe("2");
    expect(resolveArtDirection("?art=3")).toBe("3");
    expect(resolveArtDirection("")).toBe("0");
    expect(resolveArtDirection("?art=precision")).toBe("0");
    expect(resolveArtDirection("?art=4")).toBe("0");
  });

  it("does not smuggle layout or typography-metric changes into an aesthetic comparison", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/art-direction-experiment.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const forbidden = [
      "display",
      "position",
      "width",
      "height",
      "min-width",
      "max-width",
      "min-height",
      "max-height",
      "margin",
      "padding",
      "gap",
      "grid",
      "flex",
      "order",
      "font-size",
      "font-family",
      "line-height",
      "letter-spacing",
      "transform",
    ];

    for (const property of forbidden) {
      expect(css, `art-direction CSS must not set ${property}`).not.toMatch(
        new RegExp(`(^|[;{]\\s*)${property}\\s*:`, "m"),
      );
    }
  });
});
