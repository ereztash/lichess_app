// @vitest-environment jsdom
/**
 * The record cache must not outlive the account that filled it.
 *
 * THE LEAK THIS CLOSES. `ownerProcedure` stops the SERVER handing one account's record to
 * another, and that is where the reproduction was. It says nothing about the BROWSER. Every
 * `record.*` response sits in the react-query cache keyed only by its procedure and input --
 * never by who was signed in -- and `logout` refetched `auth.me` and nothing else.
 *
 * So on a shared machine: A signs in, reads their record, signs out; B signs in. React-query
 * serves cached data instantly while it revalidates, and on a failed revalidation it keeps
 * showing the last value it had. B sees A's `stated_unknown` -- the sentence A wrote about what
 * they did not understand, before anyone told them the answer -- with no request to the server
 * involved at all.
 *
 * That last part is why the server fix does not cover this. A 403 on the refetch does not remove
 * what is already on screen.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const logoutMutate = vi.fn().mockResolvedValue(undefined);
const refetch = vi.fn().mockResolvedValue(undefined);
let currentUser: { openId: string } | null = { openId: "player-a" };

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      me: { useQuery: () => ({ data: currentUser, isLoading: false, refetch }) },
      logout: {
        useMutation: ({ onSuccess }: { onSuccess?: () => Promise<void> | void }) => ({
          mutateAsync: async () => {
            currentUser = null;
            await logoutMutate();
            await onSuccess?.();
          },
        }),
      },
    },
  },
}));

const { useAuth } = await import("@/_core/hooks/useAuth");

/** A cache holding exactly what the leak would expose: another person's private sentence. */
const PRIVATE = "לא הבנתי למה הרגל הזה תקוע";

function seeded() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData([["record", "atom"], { input: { decision_id: "d-1" }, type: "query" }], {
    known: "המרכז פתוח",
    unknown: PRIVATE,
  });
  client.setQueryData([["record", "count"], { type: "query" }], { decisions: 42 });
  return client;
}

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

const holdsPrivateData = (client: QueryClient) =>
  JSON.stringify(client.getQueryCache().getAll().map((q) => q.state.data)).includes(PRIVATE);

describe("signing out empties the record cache", () => {
  it("leaves nothing of the previous account behind", async () => {
    currentUser = { openId: "player-a" };
    const client = seeded();
    expect(holdsPrivateData(client), "the fixture did not seed anything").toBe(true);

    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(client) });
    await result.current.logout();

    await waitFor(() => expect(holdsPrivateData(client)).toBe(false));
    expect(client.getQueryCache().getAll().length).toBe(0);
  });

  it("still tells the server, rather than only clearing locally", async () => {
    /*
     * The control. Clearing the cache without ending the session would look identical on this
     * machine and leave the cookie live -- a fix that hides the symptom and keeps the hole.
     */
    currentUser = { openId: "player-a" };
    logoutMutate.mockClear();
    const client = seeded();
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(client) });
    await result.current.logout();
    expect(logoutMutate).toHaveBeenCalledTimes(1);
  });

  it("clears BEFORE re-reading who is signed in, not after", async () => {
    /*
     * ORDER, PINNED. Both calls sit in the same `onSuccess` and either sequence looks correct in
     * a diff: the refetch repopulates `auth.me`, so clearing after it discards the very answer
     * that says nobody is signed in -- and the next render asks the server all over again.
     *
     * Written because two positive controls walked through here untouched. Swapping the order,
     * and removing the refetch altogether, both changed nothing this file could see: `auth.me` is
     * mocked, so neither call was ever observed. A test that cannot see a call is not covering it.
     */
    currentUser = { openId: "player-a" };
    refetch.mockClear();
    const client = seeded();
    const clearing = vi.spyOn(client, "clear");
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(client) });
    await result.current.logout();

    expect(refetch, "signing out stopped re-reading the session").toHaveBeenCalled();
    expect(clearing).toHaveBeenCalled();
    expect(
      clearing.mock.invocationCallOrder[0],
      "the cache was cleared after the refetch, discarding its answer",
    ).toBeLessThan(refetch.mock.invocationCallOrder[0]);
  });
});

describe("a change of account empties it too", () => {
  it("clears when a different person is signed in without an explicit sign-out", async () => {
    /*
     * Logout is not the only way the identity changes. A session can expire and a second person
     * can sign in on the same tab, and then no `logout` ever ran -- so a fix that hangs only off
     * that mutation leaves the same data exposed by a slightly longer route.
     */
    currentUser = { openId: "player-a" };
    const client = seeded();
    const { rerender } = renderHook(() => useAuth(), { wrapper: wrapper(client) });

    currentUser = { openId: "player-b" };
    rerender();

    await waitFor(() => expect(holdsPrivateData(client)).toBe(false));
  });

  it("does NOT clear while the same person stays signed in", async () => {
    /*
     * The control that keeps the product usable. A hook that cleared on every render would pass
     * every test above and destroy the cache continuously -- refetching the whole record on each
     * paint, which reads as a slow app rather than as a bug.
     */
    currentUser = { openId: "player-a" };
    const client = seeded();
    const { rerender } = renderHook(() => useAuth(), { wrapper: wrapper(client) });
    rerender();
    rerender();
    expect(holdsPrivateData(client)).toBe(true);
  });
});
