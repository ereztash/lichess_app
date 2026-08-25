// @vitest-environment jsdom
/**
 * Which palette a player meets first, and why the answer could not previously change.
 *
 * Every colour token in index.css was written for a paper-and-ink lab notebook, and so was every
 * measurement recorded beside it -- the paper ground, the 1.30:1 chip against the surface, the
 * wooden board. The app shipped defaulting to DARK, where that board is the only saturated
 * object on a near-black page and reads as pasted in from a different application.
 *
 * THE DEFAULT WAS ALSO UNCHANGEABLE, which is the part worth a test. The effect that applies the
 * theme also WROTE it to localStorage, on every mount -- so the first visit persisted whatever
 * the default happened to be that day, and from then on "the stored preference" was
 * indistinguishable from a choice the player had actually made. Flipping the default would have
 * reached nobody who had ever loaded the page.
 *
 * Section 4.5, in storage: an unanswered question and an answered one must not look the same.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

const root = resolve(__dirname, "../..");

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

const mount = (props: Partial<React.ComponentProps<typeof ThemeProvider>> = {}) =>
  render(
    <ThemeProvider switchable {...props}>
      <Probe />
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("a player who has never chosen gets the palette the tokens were written for", () => {
  it("opens light, and leaves no trace claiming that was a choice", async () => {
    mount();
    expect(screen.getByRole("button").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(
      localStorage.getItem("theme"),
      "mounting wrote a preference the player never expressed",
    ).toBeNull();
  });

  it("still opens light on the second visit, which is where this used to break", async () => {
    // No clear() between the two mounts: the whole point is that the first one wrote nothing
    // for the second to read back as a preference.
    mount().unmount();
    mount();
    expect(screen.getAllByRole("button").at(-1)!.textContent).toBe("light");
  });

  it("mounts light in the app itself, not only in this harness", () => {
    // The provider's own default and the app's prop are two different values, and it is the
    // app's that a visitor meets.
    const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
    expect(app).toMatch(/<ThemeProvider\s+defaultTheme="light"/);
  });
});

describe("a choice is remembered, and only a choice", () => {
  it("persists the theme when the player toggles it", async () => {
    mount();
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("honours a stored choice over the default", () => {
    localStorage.setItem("theme", "dark");
    mount();
    expect(screen.getByRole("button").textContent).toBe("dark");
  });

  it("writes nothing at all when the theme is not switchable", () => {
    // A fixed-theme mount has no choice to record, so it must not manufacture one.
    mount({ switchable: false, defaultTheme: "dark" });
    expect(localStorage.getItem("theme")).toBeNull();
  });
});
