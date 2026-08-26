/**
 * The markup the browser will actually build is the markup React rendered.
 *
 * `<p>` holds PHRASING content only. Give one a `<details>` and the parser closes the paragraph
 * and re-parents the child, so the DOM differs from the tree React produced -- and React reports
 * a hydration mismatch. That is what was happening on `.commitment-error`, the panel whose whole
 * job is to be trustworthy when everything else has failed, and it was the surface generating a
 * console error of its own.
 *
 * A SCAN, not a test of the one component that had it. The next one will be somewhere else.
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { findInvalidParagraphs, sourceFiles } from "../../scripts/gate-scan";

const root = resolve(__dirname, "../..");

describe("no paragraph in the render path holds content a parser would evict", () => {
  it("finds none across every client component", () => {
    const findings = findInvalidParagraphs(sourceFiles(resolve(root, "client/src")));
    expect(
      findings.map((f) => `${f.file.replace(root + "/", "")}:${f.line} ${f.text}`),
      "invalid nesting: the browser will re-parent these and React will warn on hydration",
    ).toEqual([]);
  });

  it("recognises the shape it exists for", () => {
    /*
     * The scanner's own positive control, inline. A scanner that silently matches nothing reports
     * a clean render path exactly as loudly as a working one does, and this repo has already been
     * caught by a check that could not fail.
     */
    const fixture = resolve(root, "tests/fixtures/render/FlowInParagraph.tsx");
    expect(findInvalidParagraphs([fixture]).length).toBeGreaterThan(0);
  });
});
