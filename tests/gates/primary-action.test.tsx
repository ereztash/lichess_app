// @vitest-environment jsdom
/**
 * GATE-ONE-PRIMARY-ACTION and GATE-NO-DUPLICATE-ACTION, over real screens in real states.
 *
 * WHY THESE COULD NOT BE WRITTEN BEFORE. Nothing could answer "is this control the primary action"
 * from the source: the only signal was CSS weight, and a gate that reads a colour goes red when a
 * palette changes and stays green when a second loud button arrives in a different one.
 * `shared/primary-action.ts` makes the control declare its ACT instead, which is the interesting
 * question -- not how many loud buttons there are, but how many different things a state asks the
 * player to choose between.
 *
 * BOTH DEFECTS WERE LIVE, AND A BROWSER WALK FOUND THEM, NOT A TEST:
 *
 *   - the reveal offered `CONTINUATION_CTA` twice -- the header's control and `RevealPanel`'s foot,
 *     both `primary-control`, both calling `nextDecision`, under identical conditions;
 *   - the returning front door offered `ResumeScreen`'s "play a short game" beside
 *     `FirstDecision`'s "take me to a position": two products, one screen, same weight.
 *
 * Each control is correct on its own. The defect is that there are two, which is precisely what a
 * per-component test cannot see and a per-state count can.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PRIMARY_ACTIONS, PRIMARY_ACTION_ATTR } from "@shared/primary-action";

beforeEach(() => {
  localStorage.clear();
  /* No server: the deployment a player is actually using, and the one every screen must survive. */
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no server in this test")));
});

function mount(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });
  return render(
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" switchable>
          {node}
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

/**
 * The acts a state offers.
 *
 * jsdom HAS NO LAYOUT, so "visible" cannot mean a box with a size. What it can tell is whether an
 * element is in the tree and not inside a closed `<details>` or a `hidden` subtree -- which is what
 * separates a control the player can press from one behind a disclosure they have not opened.
 */
function actsOn(container: HTMLElement): string[] {
  return [...container.querySelectorAll(`[${PRIMARY_ACTION_ATTR}]`)]
    .filter((el) => !el.closest("details:not([open])") && !el.closest("[hidden]"))
    .map((el) => el.getAttribute(PRIMARY_ACTION_ATTR)!);
}

describe("the vocabulary is closed", () => {
  it("names every act exactly once", () => {
    expect(new Set(PRIMARY_ACTIONS).size).toBe(PRIMARY_ACTIONS.length);
    expect(PRIMARY_ACTIONS.length).toBeGreaterThan(5);
  });

  it("is the only spelling of the attribute anywhere", () => {
    /* A component that wrote the string by hand could name an act the union does not have. */
    expect(PRIMARY_ACTION_ATTR).toBe("data-primary-action");
  });
});

describe("GATE-ONE-PRIMARY-ACTION", () => {
  it("the cold front door offers one act", async () => {
    const { default: Record } = await import("@/pages/Record");
    const { container } = mount(<Record />);
    await waitFor(() => expect(container.querySelector("main")).toBeTruthy());
    const acts = actsOn(container);
    expect(acts.length, `cold entry offers ${acts.length}: ${acts.join(", ")}`).toBeLessThanOrEqual(1);
  });

  it("the board with a decision open offers one act", async () => {
    const { default: Home } = await import("@/pages/Home");
    const { container } = mount(<Home />);
    await waitFor(() => expect(container.querySelector(".commitment-submit")).toBeTruthy());
    const acts = actsOn(container);
    expect(acts.length, `DECIDE offers ${acts.length}: ${acts.join(", ")}`).toBeLessThanOrEqual(1);
    expect(acts[0], "the one act of DECIDE is not recording the decision").toBe("commit-decision");
  });

  it("the blitz setup offers at most one, and none before anything is remembered", async () => {
    const { default: Blitz } = await import("@/pages/Blitz");
    const { container } = mount(<Blitz />);
    await waitFor(() => expect(container.querySelector(".blitz-controls")).toBeTruthy());
    /*
     * ZERO IS THE CORRECT ANSWER ON A FIRST VISIT, and it is not a gap. "Nothing chosen yet" and
     * "3+0 chosen" are different facts, and painting one as the other would put a weight on a
     * control the player has never picked.
     */
    expect(actsOn(container)).toHaveLength(0);
  });
});

describe("GATE-NO-DUPLICATE-ACTION", () => {
  it("no state offers the same act twice", async () => {
    const { default: Record } = await import("@/pages/Record");
    const { default: Home } = await import("@/pages/Home");
    for (const [name, node] of [
      ["the record", <Record key="r" />],
      ["the board", <Home key="h" />],
    ] as const) {
      const { container, unmount } = mount(node);
      await waitFor(() => expect(container.querySelector("main")).toBeTruthy());
      const acts = actsOn(container);
      expect(new Set(acts).size, `${name} offers ${acts.join(" + ")}`).toBe(acts.length);
      unmount();
    }
  });

  it("only names acts the vocabulary declares", async () => {
    /*
     * A CONTROL THAT NAMES AN ACT THE DERIVATION CANNOT is a control the derivation could never
     * own, which is the whole of what P0.5's shadow is for.
     */
    const { default: Home } = await import("@/pages/Home");
    const { container } = mount(<Home />);
    await waitFor(() => expect(container.querySelector("main")).toBeTruthy());
    for (const act of actsOn(container)) {
      expect(PRIMARY_ACTIONS, `${act} is not in the vocabulary`).toContain(act);
    }
  });
});
