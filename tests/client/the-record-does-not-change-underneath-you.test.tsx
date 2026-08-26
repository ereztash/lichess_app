// @vitest-environment jsdom
/**
 * A record that is on the server stays on the server, even when the server stops answering.
 *
 * A FAILURE MODE THIS BRANCH INTRODUCED. Until `isAvailable()` measured a live connection it read
 * an environment variable, and an environment variable does not change while somebody is playing
 * -- so `useRecordMode` could not flip mid-session. Now it can. `storageAvailable` is a query with
 * `retry: false`, and react-query's `refetchOnReconnect` default is **on**, so the probe re-runs
 * exactly when the network has just been flaky and one failed attempt is enough.
 *
 * WHAT THE FLIP DOES. Every read hook -- claim, reading, count, learning rules -- switches source
 * in the same render, and the player watches their record shrink to whatever this browser happens
 * to hold. The next commit then goes to localStorage while the earlier ones are on the server, so
 * the record is genuinely split across two stores, and nothing on screen said so.
 *
 * R2 IS ALREADY WRITTEN DOWN FOR THIS: "a record that could not be READ must not render as a
 * record with nothing in it." Rendering it as a DIFFERENT, smaller record is the same violation
 * with a worse ending, because this one also accepts writes.
 *
 * SO THE FALLBACK IS DIRECTIONAL. Starting local and staying local is the product working as
 * designed. Starting on the server and silently landing local is data loss wearing the costume of
 * a graceful degradation. Once the server has held this account's record in this session, losing
 * it is an error to report, not a store to swap.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Probe = { data?: { available: boolean }; isError: boolean; error?: unknown };

let user: { openId: string } | null = { openId: "player-a" };
let probe: Probe = { data: { available: true }, isError: false };

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user, isAuthenticated: Boolean(user) }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: { record: { storageAvailable: { useQuery: () => probe } } },
}));

const { useRecordMode, forgetConfirmedServerRecords } = await import("@/lib/record-api");
const { RecordModeNotice } = await import("@/components/RecordModeNotice");

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

/** One render of the hook, with the probe and the signed-in account set first. */
const mode = (next: Probe, as: { openId: string } | null = { openId: "player-a" }) => {
  user = as;
  probe = next;
  return renderHook(() => useRecordMode(), { wrapper }).result.current;
};

const UP: Probe = { data: { available: true }, isError: false };
const REFUSED: Probe = { isError: true, error: { data: { code: "FORBIDDEN", httpStatus: 403 } } };
const DROPPED: Probe = { isError: true, error: new Error("Failed to fetch") };
const NO_DB: Probe = { data: { available: false }, isError: false };

beforeEach(() => {
  forgetConfirmedServerRecords();
  user = { openId: "player-a" };
});

describe("the fallback runs one way only", () => {
  it("does not move a server-backed record into this browser when the probe fails", () => {
    expect(mode(UP).local, "the fixture never reached the server path").toBe(false);
    const after = mode(DROPPED);
    expect(after.local, "the record silently switched stores mid-session").toBe(false);
    expect(after.serverStatus).toBe("server-lost");
  });

  it("treats a database that stopped answering the same way", () => {
    // `available: false` after a success is the SAME event as an error: the store that was
    // holding this record is not holding it now.
    mode(UP);
    expect(mode(NO_DB).serverStatus).toBe("server-lost");
    expect(mode(NO_DB).local).toBe(false);
  });

  it("still starts local when the server never held the record", () => {
    /*
     * THE DIRECTION THAT MUST SURVIVE. A latch that also caught the cold start would break the
     * whole reason the local path exists -- a deployment with no database has to work.
     */
    const cold = mode(NO_DB);
    expect(cold.local).toBe(true);
    expect(cold.serverStatus).toBe("no-database");
  });

  it("still names a refusal a refusal when the server never held the record", () => {
    expect(mode(REFUSED).serverStatus).toBe("not-this-account");
    expect(mode(REFUSED).local).toBe(true);
  });

  it("recovers by itself when the server comes back", () => {
    mode(UP);
    expect(mode(DROPPED).serverStatus).toBe("server-lost");
    expect(mode(UP).serverStatus, "a recovered server stayed reported as lost").toBe("usable");
  });
});

describe("the latch belongs to an account, not to the browser", () => {
  it("does not carry one account's confirmation over to the next person", () => {
    /*
     * Same tab, different person. If the latch were global, B's first failed probe would report
     * "your server record is unreachable" about a record B has never had, and -- worse -- would
     * keep B off the local path that is B's correct destination.
     */
    mode(UP, { openId: "player-a" });
    const b = mode(DROPPED, { openId: "player-b" });
    expect(b.serverStatus).toBe("unreachable");
    expect(b.local).toBe(true);
  });

  it("does not carry it over to nobody signed in at all", () => {
    mode(UP, { openId: "player-a" });
    const out = mode({ isError: false }, null);
    expect(out.serverStatus).toBe("signed-out");
    expect(out.local).toBe(true);
  });

  it("remembers the same account across a blip and back", () => {
    mode(UP, { openId: "player-a" });
    mode(DROPPED, { openId: "player-b" });
    expect(
      mode(DROPPED, { openId: "player-a" }).serverStatus,
      "another account's session cleared the first account's latch",
    ).toBe("server-lost");
  });
});

describe("losing the server record is said out loud", () => {
  it("is on screen even though the record did not move to this browser", () => {
    /*
     * The notice renders on `local`, and this state is deliberately NOT local -- so without this
     * it would be the one failure the player is told nothing about, while every panel shows an
     * error and the reason sits nowhere.
     */
    const { container } = render(
      <RecordModeNotice local={false} durability="persistent" serverStatus="server-lost" />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toBe("");
    expect(text, "the reason the panels are empty is not given").toMatch(/שרת/);
  });

  it("does not tell the player their decisions are being kept here instead", () => {
    // They are not. Saying so would be the reassurance that makes the split record invisible.
    const { container } = render(
      <RecordModeNotice local={false} durability="persistent" serverStatus="server-lost" />,
    );
    expect(container.textContent ?? "").not.toMatch(/נשמרות בדפדפן הזה|נשמרת בדפדפן הזה/);
  });

  it("still renders nothing when the server is holding the record normally", () => {
    const { container } = render(
      <RecordModeNotice local={false} durability="persistent" serverStatus="usable" />,
    );
    expect(container.textContent).toBe("");
  });
});
