import { trpc } from "@/lib/trpc";

export function useAuth() {
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
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
