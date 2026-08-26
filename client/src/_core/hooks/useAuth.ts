import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

/**
 * Who is signed in -- and the guarantee that nothing of the last person survives the change.
 *
 * WHY THE CACHE IS CLEARED HERE. `ownerProcedure` stops the SERVER handing one account's record
 * to another. It says nothing about the browser. Every `record.*` response sits in the
 * react-query cache keyed by procedure and input, never by who was signed in, and react-query
 * serves cached data instantly while it revalidates -- keeping the last value it had when the
 * revalidation fails. So a 403 on the refetch does not remove what is already on screen.
 *
 * On a shared machine that reads: A signs in, opens their record, signs out; B signs in and sees
 * A's `stated_unknown` -- the sentence A wrote about what they did not understand, before anyone
 * told them the answer -- with no request to the server involved at all.
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  /*
   * IDENTITY, NOT THE LOGOUT MUTATION, IS WHAT THE CLEARING HANGS OFF.
   *
   * Logout is not the only way the person at the keyboard changes: a session can expire and
   * somebody else can sign in on the same tab, and then no `logout` ever ran. A fix attached only
   * to that mutation leaves exactly the same data exposed by a slightly longer route.
   *
   * `undefined` while the query is still loading is deliberately NOT an identity: treating it as
   * one would clear the cache on first paint of every session, refetching the whole record for
   * nothing.
   */
  const openId = me.data?.openId ?? null;
  const lastOpenId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (me.isLoading) return;
    const previous = lastOpenId.current;
    lastOpenId.current = openId;
    if (previous === undefined || previous === openId) return;
    queryClient.clear();
  }, [me.isLoading, openId, queryClient]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      /*
       * Cleared here as well as in the effect above, and the order matters: the refetch below
       * repopulates `auth.me`, and clearing after it would throw away the answer that says nobody
       * is signed in. Belt and braces on purpose -- this is the path a user deliberately takes to
       * leave a shared machine, and it should not depend on an effect firing.
       */
      queryClient.clear();
      await me.refetch();
    },
  });

  return {
    user: me.data ?? null,
    loading: me.isLoading,
    isAuthenticated: Boolean(me.data),
    logout: () => logoutMutation.mutateAsync(),
  };
}
