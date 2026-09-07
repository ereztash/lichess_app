// @vitest-environment jsdom
/**
 * The quiet-window arm, and the property that makes it safe to have in the tree.
 *
 * `research/ux-measurement/DESIGN_DECISION.md` returns `NO WINNER -- FIELD REQUIRED`, so no
 * architecture ships. What ships is one ARM of one experiment, off by default, and the whole of
 * its value is that it can go the other way: if a quiet window RAISES abandonment inside `DECIDE`,
 * the context ribbon is `ACTION-NECESSARY` after all and the surface ledger's row is wrong.
 *
 * WHAT THIS FILE HOLDS, and it is deliberately not "the flag works".
 *
 *   1. Off, the ribbon is byte-for-byte what it is today, in EVERY state. A flag whose off-path
 *      differs from the shipped product is not an arm, it is a rewrite with a switch on it.
 *   2. The flag is opt-in at the `=== "true"` level, which is `client/src/lib/features.ts`'s own
 *      rule after `VERIFIED_LEARNING` shipped default-on against a verdict that did not support
 *      it. A misspelt flag must fail closed.
 *   3. The arm reads `producingEvidence` and nothing else. If it ever came to read the record, the
 *      stage, or anything the detector measures, it would be an intervention rather than a
 *      suppression.
 *
 * The flag is a build-time `import.meta.env` value, so it cannot be toggled at runtime here. What
 * IS assertable without a second build is the shape: the module's predicate, and that the
 * component's own suppression is a function of the prop.
 */
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContextRibbon } from "@/components/ContextRibbon";
import { QUIET_EVIDENCE_WINDOW_ENABLED } from "@/lib/features";
import { trpc } from "@/lib/trpc";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";

const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no server in this test")));
});

const ribbon = (producingEvidence: boolean) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });
  return render(
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ContextRibbon producingEvidence={producingEvidence} />
      </QueryClientProvider>
    </trpc.Provider>,
  ).container;
};

describe("an arm that ships nothing until somebody turns it on", () => {
  it("is off in this build, which is what a deployment that says nothing gets", () => {
    expect(QUIET_EVIDENCE_WINDOW_ENABLED).toBe(false);
  });

  it("fails closed, so a misspelt or absent value is off rather than on", () => {
    const features = source("client/src/lib/features.ts");
    expect(
      features,
      "the quiet-window flag is on-unless-switched-off, which is the default features.ts already reversed once",
    ).toContain('import.meta.env.VITE_QUIET_EVIDENCE_WINDOW_ENABLED === "true"');
    expect(features).not.toMatch(/VITE_QUIET_EVIDENCE_WINDOW_ENABLED\s*!==/);
  });

  it("renders the same ribbon in both states while the flag is off", () => {
    /*
     * The arm's off-path must be the shipped product. Compared as markup rather than by eye,
     * because "it looks the same" is how a flag acquires a second behaviour nobody registered.
     */
    expect(ribbon(true).innerHTML).toBe(ribbon(false).innerHTML);
  });

  it("suppresses from the one expression that also stamps the row", () => {
    /*
     * The ribbon used to read the flag itself. It reads `quietWindowExposure` now, which is the
     * same call `buildCommitEvent` is handed -- so the screen and the row cannot disagree about
     * which arm a decision was produced under. `GATE-QUIET-WINDOW-LINEAGE` holds this against the
     * whole tree; this holds it against the file the arm actually lives in.
     */
    const ribbonSource = source("client/src/components/ContextRibbon.tsx");
    expect(ribbonSource).toContain("quietWindowExposure(");
    expect(ribbonSource).toContain('exposure === "context-ribbon-suppressed"');
    expect(
      ribbonSource,
      "the ribbon decided the arm a second time, from the flag",
    ).not.toMatch(/QUIET_EVIDENCE_WINDOW_ENABLED\s*&&/);
  });

  it("suppresses AFTER every hook, so the two arms differ in pixels and not in behaviour", () => {
    /*
     * MEASURED ON THE TWO BUILT ARMS, at 1440x900: exactly three surfaces disappear -- `למה?`,
     * `.context-loop` and `.context-loop-basis` -- in exactly the seven `makingEvidence` states.
     * `01-ARRIVE` and `09-REVEAL` are identical, which is the arm being scoped to the window.
     *
     * WHAT THAT LEAVES TO PROTECT, and it is the thing a later "optimisation" would break. The
     * guard is the LAST decision this component makes, so every hook above it still runs in both
     * arms: `data-input` still reaches the stylesheet, the usage is still persisted, and both
     * record queries are still warm for the reveal. An early return moved above the hooks would
     * make the arms differ in fetching and in side effects as well as in pixels, which is a second
     * treatment nobody asked for and which no screenshot would show.
     */
    const ribbonSource = source("client/src/components/ContextRibbon.tsx");
    const guard = ribbonSource.indexOf('exposure === "context-ribbon-suppressed"');
    expect(guard, "the suppression guard is gone").toBeGreaterThan(0);
    for (const hook of ["useDecisionCount(", "useRecordReading(", "useLoopPosition(", "persistUsage("]) {
      const at = ribbonSource.indexOf(hook);
      expect(at, `${hook} is gone from the ribbon`).toBeGreaterThan(0);
      expect(at, `${hook} runs only in the visible arm: the arms differ in more than pixels`).toBeLessThan(guard);
    }
  });

  it("reads nothing the detector measures, which is what keeps it a suppression", () => {
    /*
     * `shared/detector.ts` buckets on time taken, phase and clock. A surface that appeared or
     * disappeared conditionally on any of them would be a treatment applied to one arm of the
     * measurement -- which `client/src/lib/declared-tensions.ts` records having done once, with
     * the exposure recorded nowhere.
     */
    const ribbonSource = source("client/src/components/ContextRibbon.tsx");
    for (const variable of ["secondsTaken", "clockMsRemaining", "classifyPhase"]) {
      expect(ribbonSource, `the ribbon reads ${variable}`).not.toContain(variable);
    }
  });

  it("does not lean on the protocol version, because a build flag can move without a commit", () => {
    /*
     * THIS ASSERTION USED TO SAY THE OPPOSITE, and the correction is the point. It pinned the
     * version at 4 on the theory that turning the arm on would require a bump. It could not have:
     * `VITE_QUIET_EVIDENCE_WINDOW_ENABLED` moves between two deployments of ONE commit, so both
     * arms would carry the same version, the same `gitSha` and the same protocol. A version number
     * cannot express a condition that changes without the source changing.
     *
     * The version is 5 now for a different reason entirely -- the four repairs in
     * `research/ux-measurement/WORK_PLAN.md` -- and the arm does not depend on it in either
     * direction. What separates an ON row from an OFF row is `quiet_window_exposure`, which is
     * carried on the decision itself.
     */
    expect(CURRENT_PROTOCOL_VERSION).toBe(5);
    const atom = source("shared/decision-atom.ts");
    expect(
      atom,
      "the arm's lineage is not on the row, so two deployments of one commit would be one population",
    ).toContain("quiet_window_exposure");
  });
});
