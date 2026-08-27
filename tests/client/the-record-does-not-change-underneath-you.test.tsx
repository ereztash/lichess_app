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

const { useRecordMode, forgetConfirmedServerRecords, markKeptLocally, forgetKeptLocalRecords } =
  await import("@/lib/record-api");
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
  forgetKeptLocalRecords();
  user = { openId: "player-a" };
});

/**
 * THE OTHER DIRECTION, WHICH THIS FILE DID NOT COVER.
 *
 * The latch is written only on success and read only for the usable → failure transition, so
 * failure → usable is unguarded. A signed-in session whose probe fails once records into
 * localStorage **under an explicit on-screen promise that it is doing so** ("ההחלטות נשמרות
 * בדפדפן הזה בינתיים") — and when the probe recovers, every read and every write moves back to
 * the server, with no notice and no merge. `RecordModeNotice` returns null the moment the status
 * is `usable`, so even the explanation disappears.
 *
 * The decisions are not deleted: `LocalRecordStore` keeps one browser-wide key and any later
 * local-mode session renders them. What is true is that they are **invisible whenever the server
 * is healthy**, and no migration or merge code exists anywhere in `client/src/lib`.
 *
 * This file's own note already states the rule and states it symmetrically: the record must not
 * change underneath you. It was enforced in one direction.
 */
describe("a record this session wrote here stays here", () => {
  it("does not move to the server when the probe recovers mid-session", () => {
    // Signed in, probe down: the product promises the decisions are being kept in this browser.
    expect(mode(DROPPED).local).toBe(true);
    markKeptLocally("player-a");

    const recovered = mode(UP);
    expect(recovered.local, "the record silently moved to the server mid-session").toBe(true);
    expect(recovered.serverStatus).toBe("kept-local");
  });

  it("keeps saying so, rather than removing the explanation when the server comes back", () => {
    // The notice returns null on `usable`; a recovered probe would take the sentence away with it.
    mode(DROPPED);
    markKeptLocally("player-a");
    const { container } = render(
      <RecordModeNotice local durability="persistent" serverStatus={mode(UP).serverStatus} />,
    );
    expect(container.textContent, "the flip is silent").toBeTruthy();
    expect(container.textContent).toContain("בדפדפן הזה");
  });

  it("does not latch an account that never wrote here, so a healthy session is unaffected", () => {
    // The half that keeps this from being a blanket "always local". A flag that is always on is
    // not a flag.
    expect(mode(UP).local).toBe(false);
    expect(mode(UP).serverStatus).toBe("usable");
  });

  it("is keyed by account, like the latch it mirrors", () => {
    mode(DROPPED);
    markKeptLocally("player-a");
    // The next person at this keyboard has written nothing here in this session.
    expect(mode(UP, { openId: "player-b" }).local).toBe(false);
  });
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
