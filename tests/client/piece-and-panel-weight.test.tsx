// @vitest-environment jsdom
/**
 * Two reports about the same thing: how much attention the screen costs before it has told the
 * player anything.
 *
 *   "the black pieces are filled and the white ones hollow -- it takes longer to notice them,
 *    and it may cost attention"
 *   "the side you have to mark the decision on looks really bad, too flooded with information"
 *
 * Both are about weight rather than content. Nothing is removed for either of them: the board
 * still shows thirty-two pieces and the panel still offers all eighteen reads, in the player's
 * own words, at the full tap floor. What changes is how hard the screen makes you work to see
 * what is on it -- which on a product whose whole claim is a measurement of the player's
 * attention is not a cosmetic question.
 *
 * The numbers here were taken from the built page in Chromium at 1440x950, and the contrast
 * ratios are computed from the declared tokens rather than eyeballed. Both are in
 * docs/MEASUREMENTS.md.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { ChessBoard } from "@/components/ChessBoard";
import { PIECES } from "@/lib/game-data";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS } from "@/lib/read-options";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const root = resolve(__dirname, "../..");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
/* Comments stripped: this stylesheet explains its own history in prose, and a raw grep for a
   declaration matches the paragraph describing the one that was removed. */
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector: string): string {
  const at = bare.indexOf(`${selector} {`);
  expect(at, `no ${selector} rule in index.css`).toBeGreaterThan(-1);
  return bare.slice(at, bare.indexOf("\n}", at));
}
/** Every innermost rule, as (selector list, declarations). */
function rules(): Array<{ selectors: string[]; body: string }> {
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(",").map((s) => s.trim()).filter(Boolean),
    body: m[2],
  }));
}
/** A token's value in the light block and then in `.dark`. */
function themed(name: string): [string, string] {
  const all = [...bare.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))].map((m) => m[1].trim());
  expect(all.length, `${name} is not declared in both themes`).toBeGreaterThanOrEqual(2);
  return [all[0], all[1]];
}

/* ---- WCAG contrast, computed ------------------------------------------------------------- */

const channel = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (value: string): number[] => {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const fn = value.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (fn) return fn[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
  throw new Error(`not a colour this test can read: ${value}`);
};
const luminance = (c: number[]) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** What an rgba() ring actually is once painted: composited into the square under it. */
const composite = (value: string, over: number[]) => {
  const parts = value.trim().match(/^rgba\(([^)]+)\)$/i);
  if (!parts) throw new Error(`not an rgba(): ${value}`);
  const [r, g, b, a] = parts[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [r, g, b].map((c, i) => a * c + (1 - a) * over[i]);
};

/* =========================================================================================== */

describe("one silhouette per piece, both colours", () => {
  it("gives White and Black the same glyph for every type", () => {
    /*
     * The Unicode chess block pairs an outlined glyph with a filled one -- U+2654..U+2659 against
     * U+265A..U+265F -- and the shipped table used the pairing as the font intended it. That made
     * a rook two shapes to learn for one piece, on a screen the player is meant to read fast, and
     * no physical set or major board does it that way. The pairing was a property of the font,
     * not a decision anyone made here.
     */
    for (const type of Object.keys(PIECES.w)) {
      expect(PIECES.w[type], `White's ${type} is still a different shape from Black's`).toBe(
        PIECES.b[type],
      );
    }
  });

  it("uses the FILLED glyphs, so the shared shape is the solid one", () => {
    // "Both the same" is also true if both go hollow, which would put the thin outlined shape on
    // every square instead of none of them. The direction is the fix, not just the agreement.
    for (const [type, glyph] of Object.entries(PIECES.w)) {
      const point = glyph.codePointAt(0)!;
      expect(point, `${type} is the outlined code point`).toBeGreaterThanOrEqual(0x265a);
      expect(point).toBeLessThanOrEqual(0x265f);
    }
  });

  it("carries the side in a class, which is now the ONLY visual channel there is", () => {
    /*
     * The load-bearing one. With a shared silhouette, nothing but colour separates the sides, and
     * colour comes from `.piece-w` / `.piece-b`. If the class stops being emitted the board does
     * not degrade -- it becomes a board where both armies look identical.
     */
    render(
      <ChessBoard
        board={new Chess().board()}
        orientation="w"
        legalTargets={[]}
        onSelect={() => {}}
        onMove={() => {}}
      />,
    );
    const white = document.querySelector('[data-square="e2"] .piece');
    const black = document.querySelector('[data-square="e7"] .piece');
    expect(white!.textContent, "e2 and e7 no longer share a silhouette").toBe(black!.textContent);
    expect(white!.className, "the white pawn is not marked as White's").toContain("piece-w");
    expect(black!.className, "the black pawn is not marked as Black's").toContain("piece-b");
    expect(document.querySelectorAll(".piece-w")).toHaveLength(16);
    expect(document.querySelectorAll(".piece-b")).toHaveLength(16);
  });

  it("keeps the two fills a lightness apart, not a hue apart", () => {
    /*
     * Why a shared shape is allowed at all. The sides are separated by LIGHTNESS, which survives
     * every form of colour blindness and greyscale printing; a hue-only pair would not, and would
     * make this change a 1.4.1 failure rather than a legibility fix.
     */
    const white = themed("--piece-light");
    const black = themed("--piece-dark");
    for (const i of [0, 1]) {
      expect(
        contrast(rgb(white[i]), rgb(black[i])),
        `${i === 0 ? "light" : "dark"} theme: the two armies are not far enough apart in lightness`,
      ).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("the ring is what separates a piece from the square under it", () => {
  /*
   * MEASURED, all eight (piece, square, theme) cells, from the declared tokens:
   *
   *   light theme  white on light 1.37   white on dark 6.71   black on light 11.36  black on dark 2.32
   *   dark theme   white on light 1.86   white on dark 7.03   black on light  8.18  black on dark 2.16
   *
   * Two of those are effectively invisible as fills, and always were -- the outline ring is what
   * the eye traces on a matching square, in the old hollow rendering as much as this one. Going
   * solid does not change any of these eight numbers. What it does is make the ring the whole
   * story on the two weak cells, which is why the rings are asserted here rather than trusted.
   */
  const SQUARES = ["--light-square", "--dark-square"] as const;
  const PIECE_INK = { "--piece-light": "--piece-light-shadow", "--piece-dark": "--piece-dark-shadow" };

  it("leaves every piece with at least one channel above 3:1 on every square", () => {
    /*
     * Not "every ring clears 3:1": a white piece on a dark square has a fill at 6.71 and a ring
     * at 1.86, and demanding a strong ring there would draw a black halo round a piece nobody was
     * struggling to see. The rule is that fill OR ring carries the boundary, per cell.
     *
     * This is the assertion that caught the real defect. At the shipped alphas the black piece on
     * a DARK square had fill 2.32 and ring 2.04 in the light theme, and 2.16 / 2.17 in the dark
     * -- both channels weak at once, on the one cell where they had to cover for each other. It
     * is the weakest cell on the board and nothing had ever measured it.
     */
    const failures: string[] = [];
    for (const themeIndex of [0, 1]) {
      const theme = themeIndex === 0 ? "light theme" : "dark theme";
      for (const squareToken of SQUARES) {
        const square = rgb(themed(squareToken)[themeIndex]);
        for (const [fillToken, ringToken] of Object.entries(PIECE_INK)) {
          const fill = rgb(themed(fillToken)[themeIndex]);
          const ring = composite(themed(ringToken)[themeIndex], square);
          const best = Math.max(contrast(fill, square), contrast(ring, square));
          if (best < 3)
            failures.push(
              `${theme}: ${fillToken} on ${squareToken} — fill ${contrast(fill, square).toFixed(2)}, ring ${contrast(ring, square).toFixed(2)}`,
            );
        }
      }
    }
    expect(failures, `a piece is invisible on a square:\n${failures.join("\n")}`).toEqual([]);
  });

  it("keeps drawing the ring all the way round rather than to one side", () => {
    // A single offset shadow leaves three sides of the glyph touching the square directly. With
    // no interior detail left to fall back on, a partial ring is a partial outline.
    for (const selector of [".piece", ".piece-w"]) {
      const offsets = [...block(selector).matchAll(/(-?\d)px (-?\d)px 0/g)].map((m) => m[0]);
      expect(offsets, `${selector} no longer rings the glyph on all four corners`).toHaveLength(4);
    }
  });
});

/* =========================================================================================== */

/** What counts as part of the decision panel: every class CommitmentScreen renders. */
const owned = (s: string) =>
  s.startsWith(".commitment") || s.startsWith(".confidence-row") || s.includes(".read-");

describe("the type scale is the document's, not one panel's", () => {
  /*
   * MEASURED on the built panel at 1440x950, before: a 330px column holding 39 text nodes, 154
   * words, 28 elements carrying a border or a fill, and TEN distinct font sizes -- 8.96, 9, 10,
   * 10.24, 11, 11.68, 12.16, 14.72, 16 and 16.32px. Ten steps across 330px is not a hierarchy;
   * it is ten things each claiming to be slightly more important than the last, and the eye
   * ranks none of them. After: five sizes, 25 boxed elements, the same 39 text nodes and the
   * same 154 words. Nothing was hidden or reworded -- only weighted.
   *
   * THAT FIX GOVERNED ONE COMPONENT OUT OF FORTY, and the rest of the stylesheet went its own
   * way. Measured across index.css afterwards: 141 size declarations off the scale, TWENTY-THREE
   * distinct sizes inside the 8-18px band, sixteen of them rem fractions between 0.60 and 0.86 --
   * sixteen steps inside four and a fifth pixels. On the first screen that rendered as fourteen
   * sizes and four font families. After the sweep: seven sizes, three families, and the only two
   * off the scale are glyphs rather than text (the brand knight, and a piece sized to its square).
   */
  const SCALE = [
    "--panel-display",
    "--panel-heading",
    "--panel-title",
    "--panel-data",
    "--panel-body",
    "--panel-label",
    "--panel-fine",
  ];

  it("declares the scale once, at document level", () => {
    const rootBlock = block(":root");
    for (const step of SCALE) expect(rootBlock, `${step} is not declared`).toContain(`${step}:`);
    /*
     * Seven steps, each with a job, and the count is the guard.
     *
     * It used to be five, with the note "a sixth is how ten happened the first time" -- which was
     * right about the risk and wrong about the scope. Five ranks describe one 330px panel; a
     * document has a page title and a section heading above anything the panel owns, and forcing
     * both down to --panel-title flattens the page rather than ordering it. Two were added FOR
     * those two jobs and the assertion moved with them. An eighth still needs a reason, and
     * "this element wants to be slightly bigger" is not one.
     */
    expect([...rootBlock.matchAll(/--panel-[a-z]+:/g)]).toHaveLength(SCALE.length);
    // In :root and NOT in .dark: these are sizes. Only colour varies by theme, and a scale that
    // could be redefined per theme is a scale that will be.
    expect(block(".dark")).not.toContain("--panel-");
  });

  it("sets no font size ANYWHERE in the stylesheet that does not come from it", () => {
    /*
     * The assertion that would have caught the 141. Its predecessor below checks only rules whose
     * selectors belong to the commitment panel, which is exactly why the discipline stopped at
     * the panel's edge: nothing was watching the other thirty-nine components, and they drifted
     * to twenty-three sizes without a single test going red.
     *
     * Two exemptions, both drawings rather than text, both documented at their declaration:
     * `.brand-mark` is the knight glyph sized to the mark it draws, and `.piece` is sized in
     * `cqmin` so it tracks the square under it. A type scale ranks text; neither is text.
     *
     * `em` IS IN THE PATTERN NOW, and it was not. `.value-triple .value-fraction` carried
     * `font-size: 0.72em` and slipped both checks -- this one because the unit list named px, rem
     * and pt, and the panel-scoped one below (whose list does include em) because the selector is
     * outside the panel. It rendered at 7.92px, the smallest text in the product. A unit missing
     * from a list is the same hole as a selector missing from a list, which is the finding the
     * `--on-blue` check above is built around.
     */
    const offScale: string[] = [];
    for (const rule of rules()) {
      if (rule.selectors.some((s) => s.startsWith(".brand-mark") || s.includes(".piece"))) continue;
      for (const [, prop, value] of rule.body.matchAll(/(?:^|;)\s*(font-size|font)\s*:\s*([^;]+)/g)) {
        if (value.includes("var(--panel-")) continue;
        if (/\d+(\.\d+)?(px|rem|em|pt)(?![a-z])/.test(value))
          offScale.push(`${rule.selectors.join(", ")} { ${prop}: ${value.trim()} }`);
      }
    }
    expect(
      offScale,
      `a size outside the scale, and the scale is the document's:\n${offScale.join("\n")}`,
    ).toEqual([]);
  });

  it("uses one monospace family, not two doing the same job", () => {
    /*
     * `.commitment-move` rendered a UCI move in ui-monospace while every other coordinate and
     * number in the product rendered in DM Mono -- two typefaces for one job, on one screen,
     * differing by whatever the operating system happened to supply.
     */
    expect(bare).not.toMatch(/font-family:\s*ui-monospace/);
  });

  it("declares it there rather than on the panel, because one of its classes escapes", () => {
    /*
     * The reason, recorded because it is the kind of thing a later tidy-up reverses. The scale
     * was scoped to `.commitment-screen` first, which reads better and is wrong: PreregisterBridge
     * renders `.commitment-error` OUTSIDE that panel, where a scoped token resolves to nothing --
     * and an unresolved font-size paints at the browser default with no error anywhere. That is
     * the `--edge: var(--edge)` failure in a new shape, and it is why this is a :root token.
     */
    const users = execFileSync("grep", ["-rl", "commitment-error", "client/src"], {
      cwd: root,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter((f) => f.endsWith(".tsx"))
      .sort();
    expect(users.length, "commitment-error is rendered by one component now").toBeGreaterThan(1);
    expect(block(".commitment-error")).toContain("var(--panel-body)");
  });

  it("sets no font size inside the panel that does not come from it", () => {
    /*
     * The rule the ten sizes broke, expressed so it cannot be broken again quietly. Every rule
     * whose selector belongs to the commitment panel or its read fields is checked, including
     * ones inside a media query, and a raw px/rem anywhere in a `font` or `font-size` fails.
     */
    const raw: string[] = [];
    for (const rule of rules()) {
      if (!rule.selectors.some(owned)) continue;
      for (const [, prop, value] of rule.body.matchAll(/(?:^|;)\s*(font-size|font)\s*:\s*([^;]+)/g))
        if (/\d+(\.\d+)?(px|rem|em|pt)/.test(value))
          raw.push(`${rule.selectors.join(", ")} { ${prop}: ${value.trim()} }`);
    }
    expect(raw, `a size inside the panel is off the scale:\n${raw.join("\n")}`).toEqual([]);
  });

  it("does not put the smallest text in the product on a label that explains a number", () => {
    // `.confidence-row button small` shipped at 0.56rem -- 8.96px, smaller than anything else on
    // any screen -- and it holds the WORD for each confidence level. The digit is the terse half;
    // the word is the half a new player reads to find out what a 3 means.
    const fine = Number(block(":root").match(/--panel-fine:\s*(\d+)px/)![1]);
    expect(fine).toBeGreaterThanOrEqual(10);
    expect(block(".confidence-row button small")).toContain("var(--panel-fine)");
  });
});

describe("the panel has three text colours, not nine opacities", () => {
  /*
   * MEASURED with axe-core 4 in Chromium at 1350x940, light theme, with the panel open: SEVEN
   * nodes failing 1.4.3, all of them live before this work and none of them ever seen, because
   * every earlier axe run in this repo was dark-theme only -- where the same alphas happen to
   * land above the line. The kicker at 4.47, the character counter at 3.63, the blocked-summary
   * at 3.79, and the required mark and field hint at 4.24 and 4.37, those two because a legend
   * at `opacity: 0.86` dimmed children that were already dimmed once.
   *
   * Nine opacities is nine greys nobody picked, exactly as ten font sizes was ten weights nobody
   * picked. Re-measured after: zero violations, both themes.
   */
  /*
   * `--on-blue` LEFT THE PANEL AND TWO PAIRS ARRIVED. The panel's filled things -- the submit,
   * the open step's index, a selected chip -- used to be filled with the engine's hue and
   * therefore carried its foreground. They are the ACT and the CHOICE now, and each carries its
   * own declared pair (see the semantic layer in index.css and `GATE-TWO-HANDS`). The list is
   * still exhaustive, which is the whole of what this assertion is for.
   */
  const PALETTE = [
    "var(--ink)",
    "var(--muted)",
    "var(--warn)",
    "var(--on-action)",
    "var(--on-selected)",
    "inherit",
    "currentColor",
  ];

  it("dims no text with an alpha", () => {
    const dimmed: string[] = [];
    for (const rule of rules()) {
      if (!rule.selectors.some(owned)) continue;
      // The pending lock is the one exception, and a different mechanism: it dims a whole filled
      // control, background included, while the write is in flight. A disabled control is also
      // outside 1.4.3. Named here so the exception is a decision rather than an oversight.
      if (rule.selectors.some((sel) => sel.includes(":disabled"))) continue;
      if (/opacity:/.test(rule.body)) dimmed.push(rule.selectors.join(", "));
    }
    expect(dimmed, `text in the panel is dimmed with an alpha:\n${dimmed.join("\n")}`).toEqual([]);
  });

  it("colours it from the three declared tokens and nothing else", () => {
    // A raw hex here is the same defect as an alpha in a slower form: a colour nobody measured,
    // which no test can find later because it is not named anywhere.
    const strays: string[] = [];
    for (const rule of rules()) {
      if (!rule.selectors.some(owned)) continue;
      for (const [, value] of rule.body.matchAll(/(?:^|;)\s*color:\s*([^;]+)/g))
        if (!PALETTE.includes(value.trim())) strays.push(`${rule.selectors.join(", ")} { color: ${value.trim()} }`);
    }
    expect(strays, `a colour in the panel is off the palette:\n${strays.join("\n")}`).toEqual([]);
  });

  it("keeps all three readable on the panel's own surface, in both themes", () => {
    // --muted is also held by accessibility-audit.test.ts, for a different reason. --warn was
    // held nowhere, and it is the colour the panel's refusals are written in.
    for (const i of [0, 1]) {
      const surface = rgb(themed("--surface")[i]);
      for (const token of ["--ink", "--muted", "--warn"]) {
        expect(
          contrast(rgb(themed(token)[i]), surface),
          `${i === 0 ? "light" : "dark"} theme: ${token} is unreadable on --surface`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("the read chips are a ground, not eighteen boxes", () => {
  it("draws no border, because the one it had was under 1.4.11 anyway", () => {
    /*
     * The border measured 1.78:1 against the panel in the light theme and 2.24:1 in the dark --
     * already below the 3:1 WCAG 1.4.11 asks of a control boundary, while still being numerous
     * enough to read as a wall. It bought no conformance and cost all the clutter. Raising it to
     * 0.50 would have conformed by drawing eighteen STRONGER boxes; a declared ground carries the
     * chip instead, and the state contrast below is what conforms.
     */
    const chip = block(".read-chip");
    // Every border-ish declaration on the chip, listed. `border-radius` is deliberately present
    // and is spared by the lookahead; anything else that draws an edge shows up here by name.
    const borders = [...chip.matchAll(/(border(?!-radius)[a-z-]*)\s*:\s*([^;]+)/g)].map(
      (m) => `${m[1]}: ${m[2].trim()}`,
    );
    expect(borders, "a border came back on the chips").toEqual(["border: 0"]);
    expect(chip).toContain("background: var(--chip)");
  });

  it("separates selected from unselected by more than 3:1, in both themes", () => {
    /*
     * What 1.4.11 actually requires of a toggle: not that it have a box, but that its two states
     * be distinguishable. This is the assertion that lets the border go.
     */
    for (const i of [0, 1]) {
      const ground = rgb(themed("--chip")[i]);
      const selected = rgb(themed("--blue")[i]);
      expect(
        contrast(ground, selected),
        `${i === 0 ? "light" : "dark"} theme: a selected chip does not separate from an unselected one`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the label readable on both grounds, at 4.5:1", () => {
    // 1.4.3 for the text itself, which the ground change could quietly have cost. Checked against
    // BOTH states: a chip is read as often after it is picked as before.
    for (const i of [0, 1]) {
      expect(contrast(rgb(themed("--ink")[i]), rgb(themed("--chip")[i]))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(themed("--on-blue")[i]), rgb(themed("--blue")[i]))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("neutralises the stuck hover to the chip's own ground, not to the border it no longer has", () => {
    // A touch device leaves :hover applied to the last thing tapped. On a read chip that used to
    // be neutralised by restoring a border colour; with the border gone that rule would have
    // silently stopped doing anything, leaving a tapped-and-unselected chip looking hovered.
    let seen = 0;
    for (const rule of rules()) {
      // The two neutralisers only -- `:not(.selected)` is what marks them. The plain
      // `.read-chip:hover` rule they override is the pointer affordance, and it SHOULD move the
      // ground; neutralising it to `--chip` is the whole point of these two.
      if (!rule.selectors.some((s) => s.includes(".read-chip:hover:not(.selected)"))) continue;
      expect(rule.body, `${rule.selectors.join(", ")} still neutralises a border`).toContain(
        "background: var(--chip)",
      );
      seen += 1;
    }
    // Both of them: `@media (hover: none)` misses a touchscreen laptop, and the attribute misses
    // whatever context-engine.ts has not classified yet. Neither is trusted alone.
    expect(seen, "a hover neutraliser went missing").toBe(2);
  });

  it("states no option on the player's behalf and hides none of them", () => {
    /*
     * The constraint every attempt at a shorter panel has had to respect. Two obvious ways to
     * shrink it -- put half the chips behind a "more" control, or shorten the labels -- both cost
     * something real: what a player is able to say about a position, and what the record then
     * holds. Weight was the only thing free to change, and later the four steps became an
     * accordion, which changes when an option is on screen and not whether it exists.
     *
     * NARROWED, and the reason is a false positive worth recording. This read
     * `not.toMatch(/\.slice\(/)` over the whole file, and went red on `STEPS.slice(from)` --
     * ordering the four steps, nowhere near an option list. A guard that fails on the wrong
     * `.slice` teaches its next reader to delete it. It names the arrays it is actually about
     * now, and the assertion below checks the thing itself rather than the spelling of it.
     */
    const commitment = readFileSync(resolve(root, "client/src/components/CommitmentScreen.tsx"), "utf8");
    expect(commitment).not.toMatch(
      /KNOWN_OPTIONS\.slice|UNKNOWN_OPTIONS\.slice|options\.slice|options\.filter|showAll|showMore/,
    );
  });

  it("renders every option that exists, in both fields", () => {
    /*
     * The behavioural half, which no rewording of the source can fool: both read steps are
     * opened the way a player opens them, and every label in both lists has to be there. A
     * collapsed step is `hidden`, so this counts what is in the DOM -- what a step holds when it
     * is open is exactly the whole list.
     */
    render(
      <CommitmentScreen
        /*
         * A purpose the read fields are always asked on. They are drawn now -- asked on the same
         * decisions the confidence question is -- so a position with no purpose falls to the draw,
         * and this fixture's board and ply happen to be one the draw passes over. The chips would
         * be absent for a reason that has nothing to do with what this test is about.
         */
        position={{ gameId: "g", fen: START, ply: 0, clockMsRemaining: null, purpose: "drill" } as never}
        chosenMove="e2e4"
        candidatesConsidered={["e2e4"]}
        onCommit={() => {}}
        pending={false}
      />,
    );
    const labels = [...document.querySelectorAll(".read-chip")].map((c) => c.textContent);
    for (const option of [...KNOWN_OPTIONS, ...UNKNOWN_OPTIONS]) {
      expect(labels, `"${option.label}" is not on the panel`).toContain(option.label);
    }
    expect(labels).toHaveLength(KNOWN_OPTIONS.length + UNKNOWN_OPTIONS.length);
  });
});

describe("the pre-commit screen says what is missing without saying anything failed", () => {
  /*
   * THE FRAME WENT FIRST AND THE COLOUR WENT SECOND, and the second half is the interesting one.
   *
   * Two small red-bordered rectangles sat at the top of a panel on which nothing had gone wrong
   * yet, in the same red as the panel's one real refusal three fields below. Two alarms of
   * different severity rendered identically is section 4.5, and the frame went for that.
   *
   * What the frame's removal left behind was the same defect with less ink. Measured on a cold
   * `DECIDE` at 1440x900 on the build before this: the ONLY saturated colour on the screen was
   * `--warn`, on `.required-mark` and on the submit's dashed edge -- an alarm about something the
   * player had not yet had the chance to do, on the one screen whose contract is that it must
   * read as RECORDING rather than judging. `WARNING != FAILURE` and `UNCERTAINTY != WEAKNESS`.
   *
   * The word still says required, at the same rank, in the same place. What is gone is the claim
   * that something has gone wrong.
   */
  it("says the word, with no frame and no failure colour", () => {
    const mark = block(".required-mark");
    expect(mark, "the box is back around the required mark").not.toMatch(/border:/);
    expect(mark, "a field that has not been filled in has not failed").not.toContain(
      "var(--warn)",
    );
    expect(mark, "the word lost its rank as well as its alarm").toContain("var(--muted)");
  });

  it("keeps the not-ready submit out of the failure hue, and dashed so the state still reads", () => {
    const submit = block(".commitment-submit.not-ready");
    expect(submit, "the control that has not been used yet is drawn as a failure").not.toContain(
      "var(--warn)",
    );
    expect(submit, "not-ready stopped being distinguishable from ready").toMatch(/dashed/);
  });

  it("still paints the real failures in the failure hue, so this did not drain the token", () => {
    /*
     * THE OTHER HALF, AND WITHOUT IT THE THREE ABOVE ARE SATISFIED BY DELETING `--warn`. These
     * four are failures: an import that refused, an engine that could not start, a self-check
     * row that did not pass, a layer that errored. They keep the colour.
     */
    for (const selector of [
      ".import-failure",
      ".reveal-failure",
      ".self-check-row.fail",
      ".layer-error",
    ]) {
      expect(block(selector), `${selector} stopped saying it failed`).toContain("var(--warn)");
    }
  });
});
