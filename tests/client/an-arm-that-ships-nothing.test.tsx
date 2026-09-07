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

  it("suppresses on the prop and on the flag together, never on either alone", () => {
    const ribbonSource = source("client/src/components/ContextRibbon.tsx");
    expect(ribbonSource).toContain("QUIET_EVIDENCE_WINDOW_ENABLED && producingEvidence");
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

  it("does not bump the protocol version, because no arm has been run", () => {
    /*
     * Turning the flag on changes the stimulus, and `shared/measurement-protocol.ts` is
     * unambiguous that a protocol whose rules change is two populations -- so a build that sets
     * the flag must also bump. Bumping HERE would split the record for an arm nobody has run.
     */
    expect(
      CURRENT_PROTOCOL_VERSION,
      "the protocol version moved. If that was for another reason, update this line and read the " +
        "comment above it; if it was for the quiet-window arm, the arm is shipping and this test is right",
    ).toBe(4);
  });
});
