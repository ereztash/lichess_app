/**
 * The UX regressions that were shipped, expressed as assertions.
 *
 * Every one of these was live in a build that passed `npm run verify`, because nothing in the
 * suite had ever read the stylesheet or the document head. They were found by driving a real
 * browser and measuring; this file holds the subset that can be checked without one, so the
 * cheap check runs on every commit and the expensive one stays a deliberate act.
 *
 * What this file CANNOT see, and what therefore still needs a browser: computed layout, contrast
 * against actually-painted backgrounds, and whether a scroll container scrolls. Those numbers are
 * in docs/FINDINGS.md with the measurements that produced them.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
const html = readFileSync(resolve(root, "client/index.html"), "utf8");
const timeline = readFileSync(resolve(root, "client/src/components/MoveTimeline.tsx"), "utf8");
const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
/* Comments stripped: this file explains in prose why scrollIntoView is wrong here, and a raw
   grep matches that explanation as though it were the call. */
const timelineCode = timeline.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations inside one selector's first block, comments stripped. */
function block(selector: string): string {
  const start = bare.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in index.css`);
  return bare.slice(start, bare.indexOf("\n}", start));
}
function tokens(selector: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, k, v] of block(selector).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) found.set(k, v.trim());
  return found;
}
/**
 * Every innermost rule in the stylesheet, as (selector list, declarations).
 *
 * `block()` above finds one selector's first block by string search, which cannot see a selector
 * that appears in a comma-separated list -- and the tap floor below is deliberately written as
 * one such list, so that the contract is in one readable place. `[^{}]` on both sides matches
 * innermost rules only, so a rule nested in an @media is found while the @media prelude is not.
 */
function rules(): Array<{ selectors: string[]; body: string }> {
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(",").map((sel) => sel.trim()).filter(Boolean),
    body: m[2],
  }));
}

/** The smallest px value any of these size properties is set to, across one selector's rules. */
function smallestDeclaredSize(selector: string): number | null {
  let smallest: number | null = null;
  for (const rule of rules()) {
    if (!rule.selectors.includes(selector)) continue;
    for (const [, px] of rule.body.matchAll(
      /(?:min-)?(?:height|width|block-size|inline-size):\s*(\d+(?:\.\d+)?)px/g,
    )) {
      const value = Number(px);
      if (smallest === null || value < smallest) smallest = value;
    }
  }
  return smallest;
}

const luminance = (rgb: number[]) => {
  const s = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const hex = (h: string) => {
  const m = h.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`not a 6-digit hex colour: ${h}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
};

describe("the board is sized by its container, not by its glyphs", () => {
  it("gives .board-stage an explicit width", () => {
    // .board-stage is a grid item with `margin-inline: auto`, and an auto inline margin cancels
    // the default `stretch`. Without a width it shrink-to-fits its content -- which for a chess
    // board means the piece FONT decides the board size. Measured 263px of an available 342px on
    // a 390px phone, and 504px of 826px on a desktop that allowed 632px.
    expect(block(".board-stage")).toMatch(/^\s*width:\s*100%;/m);
  });

  it("keeps the height bound that stops the board running off the bottom", () => {
    expect(block(".board-stage")).toMatch(/max-width:\s*min\(100%,\s*calc\(100vh - \d+px\)\)/);
  });
});

describe("the board grid cannot be pushed out of shape by its pieces", () => {
  it("sizes both axes with minmax(0, 1fr), never bare 1fr", () => {
    // `1fr` is `minmax(auto, 1fr)`, and `auto` as a track MINIMUM is min-content -- the glyph.
    // On a viewport too short to give the board 8 glyph-heights the tracks refused to shrink and
    // the squares overflowed the board's own box: at 1280x600, a 332px-wide grid whose squares
    // were 60px each, spilling 154px past its own right edge, and a board measuring 332x493
    // instead of square. The border and the shadow were no longer around anything.
    const b = block(".board-grid");
    expect(b).toMatch(/grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
    expect(b).toMatch(/grid-template-rows:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
    expect(b).not.toMatch(/grid-template-(columns|rows):\s*repeat\(8,\s*1fr\)/);
  });

  it("lets a square shrink below its content", () => {
    const b = block(".board-square");
    expect(b).toMatch(/min-width:\s*0/);
    expect(b).toMatch(/min-height:\s*0/);
  });

  it("sizes the piece from its square, not from the viewport", () => {
    // clamp(29px, 5.2vw, 68px) asked for a 68px glyph inside a 40px square on a wide-but-short
    // window. Every viewport-derived piece size is the same bug waiting to come back.
    expect(block(".piece")).toMatch(/\d+cqmin/);
    expect(bare.match(/\.piece\s*\{[^}]*\}/g)?.join(" ") ?? "").not.toMatch(/\dvw|\dvh/);
  });
});

describe("transient panels do not push the board off the screen", () => {
  it("renders every one of them inside an Overlay", () => {
    // Each panel used to be a block above the board and shoved it down by its own height. On a
    // 1393x681 laptop window that left 52% of the board visible for "new game", 47% for the PGN
    // drawer and 74% for import-by-name. Three buttons, one "the screen is cut".
    // The JSX usage, not the import line.
    for (const panel of ["<NewGameSetup", "<ImportGames", 'className="pgn-drawer"']) {
      const at = home.indexOf(panel);
      expect(at, `${panel} is not rendered any more`).toBeGreaterThan(-1);
      const before = home.slice(Math.max(0, at - 400), at);
      expect(before, `${panel} is not wrapped in an Overlay`).toMatch(/<Overlay\b/);
    }
  });

  it("takes the overlay out of flow entirely", () => {
    expect(block(".panel-backdrop")).toMatch(/position:\s*fixed/);
  });

  it("lets a short window scroll the panel instead of clipping it", () => {
    const shell = block(".panel-shell");
    expect(shell).toMatch(/max-height:/);
    expect(shell).toMatch(/overflow:\s*auto/);
  });
});

describe("colour tokens that flip together", () => {
  const light = tokens(":root");
  const dark = tokens(".dark");

  it("defines a foreground for anything painted on --blue, in both palettes", () => {
    // White over the dark theme's pale --blue measured 2.36:1 where 16px text needs 4.5:1.
    expect(light.get("--on-blue")).toBeTruthy();
    expect(dark.get("--on-blue")).toBeTruthy();
    expect(light.get("--on-blue")).not.toBe(dark.get("--on-blue"));
  });

  it("paints every blue-backed control with --on-blue rather than a literal white", () => {
    for (const sel of [".primary-control", ".rail-button.prominent", ".move-cell.active"]) {
      const b = block(sel);
      expect(b, `${sel} still hard-codes a foreground`).toMatch(/color:\s*var\(--on-blue\)/);
      expect(b, `${sel} still hard-codes white`).not.toMatch(/color:\s*white/);
    }
  });

  it("casts shadows with a colour that is dark in BOTH themes", () => {
    // --ink-rgb is near-white in the dark palette, so a shadow drawn from it rendered 87x
    // brighter than the page: a pale slab offset down and right from the board.
    const darkPaper = luminance(hex(dark.get("--paper")!));
    const darkShadow = luminance(dark.get("--shadow-rgb")!.split(",").map((n) => Number(n.trim())));
    expect(darkShadow).toBeLessThan(darkPaper);
    expect(block(".board-grid")).toMatch(/box-shadow:[^;]*var\(--shadow-rgb\)/);
    expect(block(".board-grid")).not.toMatch(/box-shadow:[^;]*var\(--ink-rgb\)/);
  });

  it("colours board coordinates by the square they sit on", () => {
    // Inheriting the page ink put a light label on a light square (1.70:1) in the dark theme.
    expect(light.get("--coord-on-light")).toBeTruthy();
    expect(light.get("--coord-on-dark")).toBeTruthy();
    expect(bare).toMatch(/\.light-square \.rank-label[\s\S]{0,80}var\(--coord-on-light\)/);
    expect(bare).toMatch(/\.dark-square \.rank-label[\s\S]{0,80}var\(--coord-on-dark\)/);
  });
});

describe("the mobile tool rail", () => {
  it("puts every tool on one row, whatever number of them render", () => {
    /*
     * This used to assert a hard-coded column count against the number of `rail-button` strings
     * in Home.tsx, and it was right until a tool started rendering conditionally: the saved-reading
     * entry appears only once a scan has been kept, so the rail holds five OR six. No fixed number
     * satisfies both -- five orphans the sixth onto its own row, six leave a dead cell when there
     * is no reading. What the original assertion protected is the intent kept here.
     */
    const railButtons = (readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8")
      .match(/className="rail-button[^"]*"/g) || []).length;
    expect(railButtons, "no rail buttons found at all").toBeGreaterThan(1);
    const mobile = bare.slice(bare.indexOf("@media (max-width: 680px)"));
    const block = mobile.match(/\.control-rail \{[\s\S]*?\}/)?.[0] ?? "";
    expect(block, "no mobile rail block found").toBeTruthy();
    // A track per child that exists, sized from the container -- so one row at any count.
    expect(
      block,
      "the mobile rail is back on a hand-maintained column count, which one of the two rail states will get wrong",
    ).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(0,\s*1fr\)\)/);
    expect(block, "columns may wrap to a second row").toMatch(/grid-auto-flow:\s*column/);
  });
});

describe("readings keep their subject", () => {
  it("wraps the bucket scope instead of truncating it", () => {
    // nowrap + ellipsis cut every long bucket label at BOTH 390px and 1440px. The scope says what
    // the number is about; a reading whose subject is elided is not a reading.
    const b = block(".bucket-scope");
    expect(b).not.toMatch(/white-space:\s*nowrap/);
    expect(b).not.toMatch(/text-overflow:\s*ellipsis/);
  });
});

describe("the document head", () => {
  it("does not block pinch-zoom", () => {
    // maximum-scale=1 shipped, which is WCAG 1.4.4 -- and this is an app whose central object is
    // a board that is 342px wide on a phone.
    expect(html).not.toMatch(/maximum-scale/);
    expect(html).not.toMatch(/user-scalable\s*=\s*no/);
  });

  it("is titled for the product that exists", () => {
    expect(html).not.toMatch(/Chess Studio/);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });
});

describe("icon-only controls have names", () => {
  it("labels the four navigation buttons in the move timeline", () => {
    // Only the icon-only ones: a move cell carries its SAN as its accessible name already.
    const ICONS = ["SkipBack", "ChevronLeft", "ChevronRight", "SkipForward"];
    const unlabelled: string[] = [];
    for (const icon of ICONS) {
      // The <button ...> that immediately wraps this icon.
      const at = timeline.indexOf(`<${icon} `);
      expect(at, `${icon} is not rendered any more`).toBeGreaterThan(-1);
      const openTag = timeline.lastIndexOf("<button", at);
      const tag = timeline.slice(openTag, timeline.indexOf(">", openTag) + 1);
      if (!/aria-label=/.test(tag)) unlabelled.push(icon);
    }
    expect(unlabelled, `icon-only buttons with no accessible name: ${unlabelled.join(", ")}`).toEqual([]);
  });
});

describe("keeping the active move in view does not move the page", () => {
  it("adjusts the rail's own scrollLeft", () => {
    expect(timelineCode).toMatch(/\.scrollLeft\s*\+?=/);
  });

  it("does not use scrollIntoView", () => {
    // scrollIntoView walks up EVERY scrollable ancestor, so bringing the active move into view
    // scrolled the document: measured 122px down on a desktop and 646px on a phone at load, which
    // opened the app below its own header with most of the board above the fold. This regression
    // was introduced while fixing the rail and caught by measuring, not by reading.
    expect(timelineCode).not.toMatch(/scrollIntoView/);
  });
});

describe("keyboard focus is visible", () => {
  it("declares a focus-visible ring", () => {
    // The browser default on this palette was a 1px auto outline, and every control in the
    // decision loop is reachable by keyboard.
    expect(bare).toMatch(/:focus-visible\s*\{[^}]*outline:\s*\d+px solid/);
  });
});

describe("a dialog has to be opaque", () => {
  /*
   * The self-check panel shipped transparent: it declared no background, and .panel-shell did
   * not either, so the chessboard showed through the dialog and the report was unreadable over
   * the pieces. Every panel before it happened to declare its own surface, which is why nothing
   * caught the omission.
   *
   * The fix moved the surface onto the shell, so this asserts it there -- that is the one place
   * that covers panels not yet written.
   */
  it("gives .panel-shell an opaque surface, so no panel can forget one", () => {
    const shell = block(".panel-shell");
    expect(shell).toMatch(/background:\s*var\(--surface\)/);
  });

  it("keeps the backdrop's own dimming, which is not a substitute for it", () => {
    // A translucent scrim over the board is not a surface: it dims what shows through without
    // hiding it, which is exactly what the unreadable rows looked like.
    expect(block(".panel-backdrop")).toMatch(/background:\s*rgba\(0,\s*0,\s*0,\s*0\.\d+\)/);
  });
});

describe("the control that records a decision is always reachable", () => {
  /*
   * Measured on the shipped build: on a 390x844 phone the submit button sat at y=1302 and the
   * confidence row at y=1217, both far below the fold in a document that scrolls. The player
   * chose a move and had no way to know a button existed. Adding the read options pushed the
   * same button off a 1393x681 laptop too (y=644 -> y=859).
   *
   * After: y=628 on the laptop and y=813 on the phone, both above the fold, and independent of
   * how many options a field offers -- which is why this is asserted as `sticky` rather than as
   * a height.
   */
  it("pins the submit button to the bottom rather than relying on the panel being short", () => {
    const submit = block(".commitment-submit");
    expect(submit).toMatch(/position:\s*sticky/);
    expect(submit).toMatch(/bottom:\s*\d/);
  });

  it("gives it an opaque ground, because the panel scrolls underneath it", () => {
    // `background: transparent` was the shipped value, which over a scrolling panel would put
    // option chips through the middle of the button.
    expect(block(".commitment-submit")).toMatch(/background:\s*var\(--surface\)/);
  });
});

/**
 * THE TAP FLOOR.
 *
 * Control height in this stylesheet used to be emergent -- whatever font-size plus padding
 * happened to add up to -- and three of the controls the decision loop runs through came out
 * under the 44px AAA target (WCAG 2.5.5) with the number written down in the source: the read
 * chips at `min-height: 32px`, the header's icon buttons at 38px square, and the timeline's step
 * buttons at `width: 32px`. `.depth-row button` already carried `min-width: 44px`, so the number
 * was in the codebase; it was simply not applied anywhere else.
 *
 * This file cannot measure a painted box, and does not claim to. What it can do is hold the
 * floor to being DECLARED -- which is the change: a size that is stated can be checked, and a
 * size that emerges from padding cannot.
 */
describe("controls a finger lands on have a declared minimum", () => {
  /** The controls the decision loop and its panels are driven through. */
  const GUARDED = [
    ".read-chip",
    ".confidence-row button",
    ".commitment-submit",
    ".read-write-toggle",
    ".primary-control",
    ".icon-control",
    ".ghost-control",
    ".layer-action",
    ".board-note button",
    ".drawer-actions button",
    ".timeline-controls button",
    ".depth-row button",
    ".context-dismiss",
    ".context-why summary",
    // The verified-learning controls, which landed from a branch that predated the floor and
    // shipped at 32px and 38px. A floor the app's newest code sits under is decorative.
    ".learning-choice button",
    ".mechanism-picker button",
    ".learning-rule-actions button",
    ".learning-save",
    // The import scan and its stop button. Measured in Chromium at 390px before they were added
    // to the floor rule: 312x36 and 37.1x22.5 -- the stop button under it on both axes, and it is
    // the only way out of a scan that takes tens of seconds.
    ".import-scan",
    ".import-progress button",
  ];

  it("names the floor once, at 44px or more", () => {
    const floor = tokens(":root").get("--tap-floor");
    expect(floor, "no --tap-floor token").toBeTruthy();
    expect(Number(floor!.replace("px", ""))).toBeGreaterThanOrEqual(44);
  });

  it("applies it to every control in the decision loop, on both axes", () => {
    // Both, because 2.5.5 is 44x44. A height-only floor passed a 44x22.6 disclosure control.
    const covered = new Set(
      rules()
        .filter(
          (rule) =>
            /min-height:\s*var\(--tap-floor\)/.test(rule.body) &&
            /min-width:\s*var\(--tap-floor\)/.test(rule.body),
        )
        .flatMap((rule) => rule.selectors),
    );
    for (const selector of GUARDED) {
      expect(covered.has(selector), `${selector} is not held to the tap floor`).toBe(true);
    }
  });

  it("lets none of them declare a size under the floor", () => {
    // The regression itself: 32px chips, a 38px square icon button, a 32px-wide step button.
    for (const selector of GUARDED) {
      const smallest = smallestDeclaredSize(selector);
      if (smallest === null) continue;
      expect(smallest, `${selector} declares ${smallest}px, under the 44px floor`)
        .toBeGreaterThanOrEqual(44);
    }
  });

  it("leaves the board squares out of it", () => {
    /*
     * A square is sized by the board and the board by the viewport, and the grid contract above
     * requires `min-height: 0` on it so a square can shrink below its glyph. A floor here would
     * fight that rule and spill the squares out of the board -- the 332x493 failure again.
     *
     * Checked against the floor rule's own selector list, not against `.board-square`'s block:
     * the first version of this assertion read the block, so adding `.board-square` to the list
     * left it green. That is the failure this control was written to catch.
     */
    const covered = new Set(
      rules()
        .filter((rule) => /min-height:\s*var\(--tap-floor\)/.test(rule.body))
        .flatMap((rule) => rule.selectors),
    );
    expect(covered.has(".board-square"), "the tap floor was applied to a board square").toBe(false);
    expect(block(".board-square")).toMatch(/min-height:\s*0/);
  });
});

/**
 * REDUCED MOTION.
 *
 * There was no `prefers-reduced-motion` block in the stylesheet at all. Small surface -- one
 * transition and one spinner -- but a stylesheet that never asks cannot honour the answer.
 */
describe("the reduced-motion setting is read", () => {
  const query = "@media (prefers-reduced-motion: reduce)";
  const reduced = () => {
    const at = bare.indexOf(query);
    expect(at, "no prefers-reduced-motion block in index.css").toBeGreaterThan(-1);
    // To the closing brace of the @media, which is the first `\n}` at column zero after it.
    return bare.slice(at, bare.indexOf("\n}", bare.lastIndexOf("}", bare.indexOf(query, at) + 1)) + 2);
  };

  it("neutralises transitions and animations", () => {
    const b = bare.slice(bare.indexOf(query));
    expect(b).toMatch(/transition-duration:\s*0[^;]*!important/);
    expect(b).toMatch(/animation-duration:\s*0[^;]*!important/);
  });

  it("does not leave the loading spinner frozen mid-turn", () => {
    /*
     * The copy-paste reduced-motion rule sets `animation-iteration-count: 1`, which stops a
     * spinner after one rotation and leaves a static glyph on screen -- indistinguishable from a
     * hang, on the one indicator whose entire job is to say the opposite. The blanket rule is
     * kept; the spinner is exempted from it by name.
     */
    const b = bare.slice(bare.indexOf(query));
    const spin = b.slice(b.indexOf(".spin"));
    expect(b).toContain(".spin");
    expect(spin).toMatch(/animation-iteration-count:\s*infinite/);
  });

  it("does not hard-code a smooth scroll past the setting", () => {
    /*
     * `scroll-behavior: auto` in CSS does NOT reach this: the CSSOM spec gives the `behavior`
     * option of scrollIntoView precedence over the property, so a literal `behavior: "smooth"`
     * in a call stays smooth however the user has their system configured.
     */
    const commitment = readFileSync(
      resolve(root, "client/src/components/CommitmentScreen.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(commitment).not.toMatch(/behavior:\s*["']smooth["']/);
    expect(commitment).toMatch(/scrollIntoViewRespectingMotion/);
  });
});
