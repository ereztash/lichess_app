// @vitest-environment jsdom
/**
 * Being refused and there being nothing to write to are different facts.
 *
 * WHAT WAS REPRODUCED. `ownerProcedure` (server/_core/owner.ts) answers three different ways: it
 * lets the owner through, it returns PRECONDITION_FAILED when the deployment never set
 * OWNER_OPEN_ID, and it returns FORBIDDEN when somebody else is signed in. That distinction is
 * the entire point of that file -- "a server the owner has to configure" and "a browser session"
 * are different problems with different fixes. The client then collapsed all three, plus every
 * network failure, into one boolean and printed one sentence:
 *
 *   "אתם מחוברים, אבל בשרת אין מאגר החלטות מוגדר (DATABASE_URL)."
 *
 * So a person who was REFUSED was told the server had no database. They were not told they had
 * been refused, they were not told whose record it was, and their decisions went quietly into a
 * store in this browser -- which is per-browser, not per-account, so it is not "their" record
 * either. The server's two messages existed and never reached a screen.
 *
 * THIS IS THE SAME CLASS OF DEFECT THE PRODUCT EXISTS TO STOP: an instrument reporting a cause
 * it did not measure. It could not have distinguished a refusal from a missing database, because
 * it never read the code it was handed.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Probe = { data?: { available: boolean }; isError: boolean; error?: unknown };

let authenticated = true;
let probe: Probe = { data: { available: true }, isError: false };

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: authenticated }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { record: { storageAvailable: { useQuery: () => probe } } },
}));

const { useRecordMode } = await import("@/lib/record-api");
const { RecordModeNotice } = await import("@/components/RecordModeNotice");

/** What the tRPC client actually hands a component for a thrown TRPCError. */
const trpcError = (code: string, httpStatus: number, message: string) => ({
  message,
  data: { code, httpStatus },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const modeFor = (p: Probe, signedIn = true) => {
  authenticated = signedIn;
  probe = p;
  return renderHook(() => useRecordMode(), { wrapper }).result.current;
};

beforeEach(() => {
  authenticated = true;
  probe = { data: { available: true }, isError: false };
});

describe("the client reads the reason the server gave", () => {
  it("calls a refusal a refusal, not a missing database", () => {
    const mode = modeFor({
      isError: true,
      error: trpcError("FORBIDDEN", 403, "הרשומה הזו שייכת לחשבון שהגדיר את הפריסה."),
    });
    expect(mode.serverStatus).toBe("not-this-account");
    expect(mode.local, "a refused account still gets a working loop").toBe(true);
  });

  it("calls an unconfigured deployment unconfigured, not a missing database", () => {
    const mode = modeFor({
      isError: true,
      error: trpcError("PRECONDITION_FAILED", 412, "בפריסה הזו לא הוגדר OWNER_OPEN_ID."),
    });
    expect(mode.serverStatus).toBe("no-owner-configured");
  });

  it("still calls a missing database a missing database", () => {
    // The one case the old sentence was right about. It must survive the fix.
    expect(modeFor({ data: { available: false }, isError: false }).serverStatus).toBe("no-database");
  });

  it("does not name a cause for a failure that carries no code", () => {
    // A dropped connection is not a refusal and not a configuration fact. Saying either would be
    // the same defect pointed at a different sentence.
    expect(modeFor({ isError: true, error: new Error("Failed to fetch") }).serverStatus).toBe(
      "unreachable",
    );
  });

  it("reads the http status when the code is absent", () => {
    expect(modeFor({ isError: true, error: { message: "no", data: { httpStatus: 403 } } })
      .serverStatus).toBe("not-this-account");
  });

  it("does not call an unanswered probe a broken server", () => {
    // Before the probe answers, nothing about the server is known. The record stays local
    // because guessing the other way sends the first decision into a store that may reject it.
    const mode = modeFor({ isError: false });
    expect(mode.serverStatus).toBe("unknown");
    expect(mode.local).toBe(true);
  });

  it("says nothing about the server when nobody is signed in", () => {
    expect(modeFor({ isError: false }, false).serverStatus).toBe("signed-out");
  });

  it("uses the server when the server says it can store", () => {
    const mode = modeFor({ data: { available: true }, isError: false });
    expect(mode.serverStatus).toBe("usable");
    expect(mode.local).toBe(false);
  });
});

describe("the reason reaches the screen", () => {
  const notice = (mode: Parameters<typeof RecordModeNotice>[0]) => {
    const { container } = render(<RecordModeNotice {...mode} />);
    return container.textContent ?? "";
  };

  it("tells a refused account it was refused, and does not blame the database", () => {
    const text = notice({ local: true, durability: "persistent", serverStatus: "not-this-account" });
    expect(text, "the refusal is not on screen").toMatch(/חשבון/);
    expect(text, "a refusal reported as a missing database").not.toMatch(/DATABASE_URL/);
  });

  it("tells a refused account the browser record is not their account's record", () => {
    // localStorage is keyed by browser. Falling back to it silently implies a private record
    // that does not exist: anyone else using this browser gets the same one.
    const text = notice({ local: true, durability: "persistent", serverStatus: "not-this-account" });
    expect(text).toMatch(/דפדפן/);
  });

  it("distinguishes the unconfigured deployment from both", () => {
    const text = notice({
      local: true,
      durability: "persistent",
      serverStatus: "no-owner-configured",
    });
    expect(text).toMatch(/OWNER_OPEN_ID/);
    expect(text).not.toMatch(/DATABASE_URL/);
  });

  it("keeps the sentence that was already right", () => {
    const text = notice({ local: true, durability: "persistent", serverStatus: "no-database" });
    expect(text).toMatch(/DATABASE_URL/);
  });

  it("gives every cause its own sentence", () => {
    const causes = [
      "signed-out",
      "unknown",
      "no-database",
      "not-this-account",
      "no-owner-configured",
      "unreachable",
      "server-lost",
    ] as const;
    const said = causes.map((serverStatus) =>
      notice({ local: true, durability: "persistent", serverStatus }),
    );
    expect(new Set(said).size, "two causes share one sentence").toBe(causes.length);
  });

  it("says the session-only warning ahead of every cause, because it is the one that loses data", () => {
    // A tab that will erase the record on refresh outranks whose record it is.
    for (const serverStatus of ["not-this-account", "no-database", "signed-out"] as const) {
      const { container } = render(
        <RecordModeNotice local durability="session-only" serverStatus={serverStatus} />,
      );
      expect(container.textContent).toMatch(/סגירה או רענון/);
      expect(container.querySelector(".record-mode")?.className).toMatch(/session-only/);
    }
  });

  it("renders nothing at all when the record is on the server", () => {
    const { container } = render(
      <RecordModeNotice local={false} durability="persistent" serverStatus="usable" />,
    );
    expect(container.textContent).toBe("");
  });
});
