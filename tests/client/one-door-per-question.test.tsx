// @vitest-environment jsdom
/**
 * One door per question, and the count of questions is three -- not one.
 *
 * THE DIAGNOSIS THIS FILE CAME FROM WAS WRONG ON ITS OWN FACTS. It said the rail's five buttons
 * "answer one question" and should collapse into one control. They do not. Sorted by what they
 * actually do:
 *
 *   משחק חדש / טעינת PGN / ייבוא לפי שם / קובץ   ->  "give me a different position"
 *   Lichess                                       ->  "connect my account"        (an OAuth start)
 *   קריאה שמורה                                    ->  "reopen a measurement"      (a kept scan)
 *
 * So four collapse and two do not, and the tests below hold that line in both directions: the
 * four must be behind one door, and the other two must NOT be. A door labelled "a different
 * position" with a login behind it is a control that says something other than what it does, and
 * that is the failure this codebase spends its gates on -- it would have been a regression
 * wearing the shape of the fix.
 *
 * THE BLUE CAME OFF. `משחק חדש` was `rail-button prominent`: a filled blue button, permanently
 * the loudest thing on the page. What it offers is discarding the position on the board -- and
 * the app hands you a live game at the opening position on arrival, so it is never the required
 * first step. The loudest control on a screen for measuring decisions was an invitation to throw
 * away the decision you were about to make.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  POSITION_SOURCES,
  PositionSourceMenu,
  type PositionSourceId,
} from "@/components/PositionSource";

const root = resolve(__dirname, "../..");
/**
 * A file with its comments removed.
 *
 * These components explain in prose what they no longer do -- `PositionSource.tsx` lists the old
 * rail labels in order to say which of them collapsed -- and a raw grep matches the explanation
 * as though it were the code. `piece-and-panel-weight.test.tsx` strips the stylesheet for the
 * same reason.
 */
const code = (path: string) =>
  readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const home = code("client/src/pages/Home.tsx");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("the four ways to get a position are one door", () => {
  it("lists every source, and loses none of them to the collapse", () => {
    /*
     * The point of the change is fewer controls, and the cheapest way to get fewer controls is
     * to drop one. All four were reachable from the rail before; all four must be reachable now.
     */
    expect(POSITION_SOURCES.map((entry) => entry.id).sort()).toEqual([
      "file",
      "new",
      "pgn",
      "username",
    ]);
  });

  it("renders one option per source, with no 'show more' hiding any of them", async () => {
    const chosen = vi.fn();
    const { container } = render(<PositionSourceMenu onChoose={chosen} onClose={vi.fn()} />);
    /*
     * Scoped to the options rather than to every button in the panel: the heading carries a
     * close control, and counting that as a fifth source would make this assertion pass for the
     * wrong reason the first time any chrome is added.
     */
    const options = container.querySelectorAll(".position-source-option");
    expect(options, "the menu renders a different number of options than there are sources").toHaveLength(
      POSITION_SOURCES.length,
    );
    for (const source of POSITION_SOURCES) {
      expect(screen.getByText(source.label), `${source.id} is not on the menu`).toBeTruthy();
      // R1's habit applied to a chooser: never a name without what it gets you.
      expect(screen.getByText(source.detail), `${source.id} is offered without saying what it is`).toBeTruthy();
    }
  });

  it("reports which source was chosen, and chooses nothing on the player's behalf", async () => {
    const chosen = vi.fn();
    render(<PositionSourceMenu onChoose={chosen} onClose={vi.fn()} />);
    expect(chosen, "the menu picked a source before anyone clicked").not.toHaveBeenCalled();
    await userEvent.click(screen.getByText("ייבוא לפי שם משתמש"));
    expect(chosen).toHaveBeenCalledTimes(1);
    expect(chosen).toHaveBeenCalledWith<[PositionSourceId]>("username");
  });

  it("says what it is, in the frame its sibling panels use", () => {
    /*
     * `Overlay` puts its label in `aria-label` and renders no heading, so a panel that does not
     * carry its own is unlabelled for anyone looking at it. The other three panels reachable from
     * this door have always had one.
     */
    const { container } = render(<PositionSourceMenu onChoose={vi.fn()} onClose={vi.fn()} />);
    const heading = container.querySelector(".drawer-heading");
    expect(heading, "the menu opens without saying what it is").toBeTruthy();
    expect(heading!.textContent).toMatch(/עמדה אחרת/);
  });

  it("offers a way out that does not depend on knowing about Escape", async () => {
    const closed = vi.fn();
    render(<PositionSourceMenu onChoose={vi.fn()} onClose={closed} />);
    await userEvent.click(screen.getByRole("button", { name: "סגור" }));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("says out loud that the position on the board survives the panel", () => {
    render(<PositionSourceMenu onChoose={vi.fn()} onClose={vi.fn()} />);
    /*
     * A panel offering four ways to replace something implies that replacing it is expected. The
     * position you already have is the fifth option and the only free one, so it is stated.
     */
    expect(screen.getByText(/העמדה שעל הלוח נשארת/)).toBeTruthy();
  });

  it("does not rank the sources, or mark one of them as the one to pick", () => {
    const source = code("client/src/components/PositionSource.tsx");
    // A recommendation engine is the product's standing refusal; a "recommended" chip is one.
    expect(source).not.toMatch(/recommended|מומלץ|suggested|\bbest\b/i);
    expect(source, "an option is being sorted by something").not.toMatch(/\.sort\(|\.filter\(/);
    expect(source, "an option is singled out with its own class").not.toMatch(
      /position-source-option [^"]*\$\{/,
    );
  });
});

describe("what did NOT collapse, because it is not the same question", () => {
  it("keeps the account connection out of the position door", () => {
    const ids = POSITION_SOURCES.map((entry) => entry.id) as string[];
    expect(ids, "an OAuth login is being offered as a way to get a position").not.toContain("lichess");
    const source = code("client/src/components/PositionSource.tsx");
    expect(source, "the position menu knows about signing in").not.toMatch(/startLogin|isAuthenticated/);
    // It stayed in the rail as its own entry rather than disappearing.
    expect(home, "the Lichess entry was lost").toMatch(/openLichess/);
  });

  it("keeps the saved reading out of it too", () => {
    const ids = POSITION_SOURCES.map((entry) => entry.id) as string[];
    expect(ids).not.toContain("reading");
    expect(home, "the saved reading entry was lost").toMatch(/setShowReading/);
    /*
     * The reading renders only once a scan is behind it -- a button that opens an empty panel is
     * a button that lies about what the record holds. That predates this change and survives it.
     */
    expect(home).toMatch(/importReading\.reading && \(/);
  });

  it("names the import's second effect, because it has one", () => {
    /*
     * Three of the four sources only load a position. `username` also runs a scan that produces a
     * reading and can narrow the detector's search from 60 revealed decisions to 40. A chooser
     * that presented it as merely a fourth way to load a game would be understating it.
     */
    const username = POSITION_SOURCES.find((entry) => entry.id === "username")!;
    expect(username.detail).toMatch(/קריאה/);
    expect(username.detail).toMatch(/סוג/);
  });
});

describe("the rail stops being six controls at one weight", () => {
  it("offers the position sources through one entry rather than four", () => {
    const railButtons = home.match(/className="rail-button[^"]*"/g) ?? [];
    /*
     * Three entries, one per question, and the third renders conditionally. Asserted as a range
     * rather than an exact count because the saved-reading entry appears only once a scan has
     * been kept -- the same reason the mobile rail cannot use a fixed column count.
     */
    expect(railButtons.length, "the rail is back to a control per source").toBeLessThan(4);
    expect(railButtons.length, "the rail lost an entry it needs").toBeGreaterThan(1);
    expect(home, "the one door is missing its label").toMatch(/עמדה אחרת/);
  });

  it("no longer paints a rail control as the page's primary action", () => {
    expect(home, "a rail button is prominent again").not.toMatch(/rail-button prominent/);
    expect(
      css,
      "the prominent rail style is still in the stylesheet, ready for the next control to pick up",
    ).not.toMatch(/\.rail-button\.prominent\s*\{/);
  });

  it("keeps the three overlays from becoming three again", () => {
    /*
     * `showNewGame`, `showPgn` and `showImport` were three independent booleans, and every rail
     * button that opened one had to remember to close the other two. One piece of state cannot
     * forget.
     */
    for (const flag of ["showNewGame", "showPgn", "showImport"]) {
      expect(home, `${flag} is back`).not.toMatch(new RegExp(`\\b${flag}\\b`));
    }
    expect(home).toMatch(/showPositionSource/);
    expect(home).toMatch(/positionChoice/);
  });

  it("sends the file source straight to the picker instead of rendering a room for it", () => {
    /*
     * "קובץ" is an OS file dialog. A room whose only content is a button that opens one is a
     * second click for nothing, and cancelling the dialog would strand the player on a blank
     * panel -- so the menu stays underneath.
     */
    expect(home).toMatch(/choice === "file"[\s\S]{0,120}fileRef\.current\?\.click\(\)/);
    expect(home, "the file source renders a panel of its own").not.toMatch(
      /positionChoice === "file" &&/,
    );
  });
});
