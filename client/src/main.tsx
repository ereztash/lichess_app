// FIRST, and it must stay first -- see the file for why.
import "./zod-jitless";
import { trpc } from "@/lib/trpc";
import { attachWindowFailureListeners, reportApiFailure } from "@/lib/error-sink";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

/*
 * EVERY API FAILURE IS COUNTED BY ITS CLASS, and nothing else about it leaves this tab.
 *
 * `console.error` keeps the full object where the player can inspect it; `reportApiFailure` sends
 * the class -- auth, precondition, upstream, internal, unreachable -- and the surface, so an
 * operator can see a burst of `api-internal` after a deploy without any user writing in.
 */
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    reportApiFailure(error, "app");
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    reportApiFailure(error, "app");
    console.error("[API Mutation Error]", error);
  }
});

/* What nothing else caught: an uncaught exception or rejection, reported as a code and nothing more. */
attachWindowFailureListeners();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      /*
       * THE `manus-cookie` BEARER BLOCK IS GONE. It read a sessionStorage key nothing in this
       * repository ever wrote and sent it as `Authorization: Bearer`: dead scaffolding from the
       * template this app started as, and a latent path for a session token to live somewhere any
       * script on the origin can read. The session is the HttpOnly cookie and nothing else.
       */
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);
