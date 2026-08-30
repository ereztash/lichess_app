// @vitest-environment jsdom
/**
 * A deploy is not a crash, and the screen that said it was.
 *
 * REPORTED FROM A REAL SCREEN, then reproduced in Chromium. A build gives every chunk a content
 * hash; a new build makes the old hashes stop existing; a tab that was already open still holds
 * the old `index.html` and still points at them. The next lazily-imported chunk 404s and
 * `React.lazy` rejects:
 *
 *   TypeError: Failed to fetch dynamically imported module: /assets/RecordDashboard-BdDAKmeV.js
 *
 * Driven by serving 404 for every non-entry chunk under an open page: the crash screen came up on
 * the record dashboard, saying "משהו נשבר במסך הזה" about a build that was perfectly healthy.
 *
 * Every push does this to everyone who has the app open, and there are five of these boundaries.
 *
 * WHAT IS ASSERTED HERE, and it is two separate things: that a missing chunk reloads once and
 * only once, and that a module which fails for its OWN reasons is never swallowed into a reload
 * -- because a reload would hide a real bug and then hit it again.
 */
import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, lazyChunk } from "@/lib/lazy-chunk";
import ErrorBoundary from "@/components/ErrorBoundary";

/** What a browser actually throws when the file is gone. Three engines, three wordings. */
const CHUNK_ERRORS = [
  "Failed to fetch dynamically imported module: http://x/assets/RecordDashboard-BdDAKmeV.js",
  "error loading dynamically imported module: http://x/assets/GameReview-abc.js",
  "Importing a module script failed.",
];

function Ok() {
  return <p>loaded</p>;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("a missing chunk is recognised for what it is", () => {
  it.each(CHUNK_ERRORS)("matches %s", (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it("does not match a fault inside the module itself", () => {
    /*
     * THE HALF THAT KEEPS THIS FROM HIDING BUGS. A component that throws while evaluating -- a
     * bad import, a null dereference at module scope -- produces its own error, and reloading on
     * it would replace a readable crash screen with a page that breaks again in the same place.
     */
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'n')"))).toBe(
      false,
    );
    expect(isChunkLoadError(new Error("boom"))).toBe(false);
  });
});

describe("the page reloads once, and then stops", () => {
  it("retries the import before reloading anything", async () => {
    /*
     * A blip costs one retry and no reload. Only a chunk that is genuinely gone gets the heavier
     * remedy, which is the one that interrupts the player.
     */
    const reload = vi.fn();
    let attempts = 0;
    const Lazy = lazyChunk(async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError(CHUNK_ERRORS[0]);
      return { default: Ok };
    }, reload);
    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy />
      </Suspense>,
    );
    await waitFor(() => expect(screen.getByText("loaded")).toBeTruthy());
    expect(attempts).toBe(2);
    expect(reload, "a transient failure took the page down and back").not.toHaveBeenCalled();
  });

  it("reloads when the chunk is really gone", async () => {
    const reload = vi.fn();
    const Lazy = lazyChunk(async () => {
      throw new TypeError(CHUNK_ERRORS[0]);
    }, reload);
    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy />
      </Suspense>,
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    // And it stays on the fallback rather than flashing a crash screen the reload is about to fix.
    expect(screen.getByText("loading")).toBeTruthy();
  });

  it("does not reload a second time, so a broken deploy cannot loop forever", async () => {
    /*
     * THE BOUND THAT MAKES THIS SAFE. If the chunk is missing for any other reason -- a deploy
     * half out, a proxy eating it, an extension -- reloading on every failure is an infinite
     * refresh, which is worse than the crash screen it replaces: the player cannot even read the
     * error. The second failure is passed through, and the boundary is then telling the truth.
     */
    const reload = vi.fn();
    const failing = async (): Promise<{ default: typeof Ok }> => {
      throw new TypeError(CHUNK_ERRORS[0]);
    };
    const First = lazyChunk(failing, reload);
    render(
      <Suspense fallback={<p>loading</p>}>
        <First />
      </Suspense>,
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    // The page "reloaded": same session, same mark, and the chunk is still missing.
    const Second = lazyChunk(failing, reload);
    render(
      <ErrorBoundary>
        <Suspense fallback={<p>loading</p>}>
          <Second />
        </Suspense>
      </ErrorBoundary>,
    );
    await waitFor(() => expect(screen.getByRole("heading")).toBeTruthy());
    expect(reload, "the app reloaded itself twice for one missing chunk").toHaveBeenCalledTimes(1);
  });

  it("forgets the reload once a chunk loads, so a later failure gets its own", async () => {
    const reload = vi.fn();
    const Broken = lazyChunk(async (): Promise<{ default: typeof Ok }> => {
      throw new TypeError(CHUNK_ERRORS[0]);
    }, reload);
    render(
      <Suspense fallback={null}>
        <Broken />
      </Suspense>,
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    const Working = lazyChunk(async () => ({ default: Ok }), reload);
    render(
      <Suspense fallback={null}>
        <Working />
      </Suspense>,
    );
    await waitFor(() => expect(screen.getByText("loaded")).toBeTruthy());
    expect(
      sessionStorage.getItem("decision-lab.chunk-reload"),
      "a successful load left the mark standing, so the next failure gets no reload",
    ).toBeNull();
  });

  it("passes a real module fault straight to the boundary", async () => {
    const reload = vi.fn();
    const Lazy = lazyChunk(async (): Promise<{ default: typeof Ok }> => {
      throw new TypeError("Cannot read properties of undefined (reading 'anchor')");
    }, reload);
    render(
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Lazy />
        </Suspense>
      </ErrorBoundary>,
    );
    await waitFor(() => expect(screen.getByText("משהו נשבר במסך הזה")).toBeTruthy());
    expect(reload, "a genuine bug was hidden behind a refresh").not.toHaveBeenCalled();
  });
});

describe("the boundary says which of the two things happened", () => {
  const boundary = (error: Error) => {
    function Throws(): never {
      throw error;
    }
    return render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>,
    ).container;
  };

  it("tells a player whose build was replaced that it was replaced", () => {
    /*
     * "משהו נשבר" is a false statement about a healthy build AND it hides the one thing that
     * fixes it. This sentence is the truth and it names the remedy the button already performs.
     */
    const text = boundary(new TypeError(CHUNK_ERRORS[0])).textContent ?? "";
    expect(text).toContain("האפליקציה התעדכנה בזמן שהייתם כאן");
    expect(text, "a healthy build was described as broken").not.toContain("משהו נשבר במסך הזה");
    expect(text).toContain("טעינה מחדש");
  });

  it("keeps the honest sentence for a real fault", () => {
    const text = boundary(new TypeError("Cannot read properties of undefined")).textContent ?? "";
    expect(text).toContain("משהו נשבר במסך הזה");
    expect(text).not.toContain("האפליקציה התעדכנה");
  });

  it("keeps the record's promise on both, because it is true on both", () => {
    for (const error of [new TypeError(CHUNK_ERRORS[0]), new Error("boom")]) {
      expect(boundary(error).textContent).toContain("הרשומה נכתבת בכל החלטה");
    }
  });

  it("still hands over the stack, which is what makes a report actionable", () => {
    expect(boundary(new TypeError(CHUNK_ERRORS[0])).querySelector("pre")).not.toBeNull();
  });
});
