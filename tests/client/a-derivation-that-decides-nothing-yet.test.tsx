// @vitest-environment jsdom
/**
 * SHADOW MODE: the derivation runs, the screen does not listen, and the disagreement is recorded.
 *
 * WHY A SCREEN DOES NOT SIMPLY START USING IT. `shared/next-action.ts` claims to know what a player
 * should do next. This repository does not let a claim of that shape act on a player until
 * something could have shown it wrong -- §23's rule about coaching, applied to the product's own
 * navigation. So the derivation runs beside `ResumeScreen`, writes what it WOULD have said to the
 * trial ledger, and the screen goes on offering exactly what it offered before.
 *
 * THE DISAGREEMENT THIS IS ACTUALLY FOR. `readResume` maps `nothing-scored` -- games stored, engine
 * has not run -- to "play another game", and the screen's one action starts a game whatever the
 * blocker is. The derivation says wait, because playing grows the backlog that is the blocker. This
 * file asserts the shadow records that difference rather than acting on it.
 *
 * AND WHY `blind` IS PART OF THE RECORD. The front door cannot see a half-finished drill: that
 * state lives in `Home.tsx`'s component and does not survive navigating away. A disagreement caused
 * by a missing input is not the same finding as one caused by the screen being wrong, and a shadow
 * that did not separate them would be a list nobody could read.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { ResumeScreen } from "@/components/ResumeScreen";
import { LocalRecordStore } from "@/lib/local-record-store";
import { clearProgress } from "@/lib/progress-record";
import { RESUME_BLIND_SPOTS, RESUME_OFFERS, resumeProductState } from "@/lib/next-action-shadow";
import { deriveNextAction } from "@shared/next-action";
import type { BlitzReading } from "@shared/blitz-reading";
import type { StoredBlitzGame } from "@shared/blitz-record";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import { BLITZ_SAMPLING_POLICY_VERSION } from "@shared/blitz-instrument";

const reading = (over: Partial<BlitzReading> = {}): BlitzReading =>
  ({
    games: { stored: 4, scored: 0 },
    decisions: { stored: 40, readable: 0, excluded: [] },
    standing: { may: false, because: "nothing-scored", readable: 0, needs: null },
    spoken: null,
    ...over,
  }) as unknown as BlitzReading;

const game = (gameId: string, analysisState: StoredBlitzGame["analysisState"]): StoredBlitzGame =>
  ({
    gameId,
    playedAs: "w",
    timeControl: { initialMs: 180_000, incrementMs: 0 },
    outcome: { kind: "resignation", loser: "w" },
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:03:00.000Z",
    analysisState,
    analysedAt: null,
    analysis: null,
    opponent: null,
    protocolVersion: CURRENT_PROTOCOL_VERSION,
    samplingPolicyVersion: BLITZ_SAMPLING_POLICY_VERSION,
  }) as unknown as StoredBlitzGame;

const stateFrom = (over: Parameters<typeof resumeProductState>[0]) => resumeProductState(over);

beforeEach(() => {
  localStorage.clear();
  clearProgress();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no server in this test")));
});

describe("what the front door can and cannot supply", () => {
  it("counts pending games rather than subtracting scored from stored", () => {
    /*
     * `stored - scored` FOLDS THREE STATES INTO ONE. `refused` and `legacy-unknown` are not work
     * the queue will ever do, and counting them as a backlog would make the shadow propose a wait
     * that nothing would ever end.
     */
    const state = stateFrom({
      reading: reading(),
      games: [game("a", "pending"), game("b", "refused"), game("c", "legacy-unknown"), game("d", "complete")],
      decisionsOnRecord: 12,
      record: undefined,
    });
    expect(state.pendingAnalyses).toBe(1);
  });

  it("says the queue is not running rather than guessing that it is", () => {
    /*
     * A BACKLOG IS NOT A PASS. Whether the runner is mid-search is a fact about a subscription this
     * screen does not hold, and reporting `true` because games are pending would be the shadow
     * inventing an input -- the one thing it must not do.
     */
    expect(
      stateFrom({ reading: reading(), games: [game("a", "pending")], decisionsOnRecord: 1, record: undefined })
        .analysisRunning,
    ).toBe(false);
  });

  it("leaves every input it cannot see null, and names all four", () => {
    const state = stateFrom({ reading: reading(), games: [], decisionsOnRecord: 0, record: undefined });
    expect(state.drill).toBeNull();
    expect(state.transfer).toBeNull();
    expect(state.unseenEvent).toBeNull();
    expect(state.untestedRule).toBeNull();
    expect([...RESUME_BLIND_SPOTS].sort()).toEqual(
      ["drill", "transfer", "unseenEvent", "untestedRule"].sort(),
    );
  });

  it("carries the standing through untouched, so the derivation reads the record's own answer", () => {
    const standing = { may: false, because: "too-few-readable", readable: 9, needs: null } as const;
    const state = stateFrom({
      reading: reading({ standing }),
      games: [],
      decisionsOnRecord: 30,
      record: undefined,
    });
    expect(state.blitzStanding).toBe(standing);
  });
});

describe("the disagreement it exists to record", () => {
  it("proposes waiting where the screen offers another game", () => {
    /*
     * THE WHOLE POINT, AS AN ASSERTION. Games are stored and unscored; the screen's action starts a
     * game, which grows the backlog that is the blocker. The derivation says wait, and since LAW 4's
     * queue that is a thing that actually finishes.
     */
    const state = stateFrom({
      reading: reading(),
      games: [game("a", "pending"), game("b", "pending")],
      decisionsOnRecord: 20,
      record: undefined,
    });
    const action = deriveNextAction(state);
    expect(action).toMatchObject({ kind: "wait-analysis", games: 2 });
    expect(action.kind === "play-blitz" || action.kind === "play-first-decision").toBe(false);
    expect(RESUME_OFFERS).toBe("play");
  });

  it("agrees with the screen where the blocker really is answered by playing", () => {
    /* A shadow that disagreed everywhere would be measuring its own mapping, not the screen. */
    const state = stateFrom({
      reading: reading({ standing: { may: false, because: "too-few-readable", readable: 9, needs: null } }),
      games: [game("a", "complete")],
      decisionsOnRecord: 20,
      record: undefined,
    });
    expect(deriveNextAction(state).kind).toBe("play-blitz");
  });
});

function renderResume() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });
  return render(
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ResumeScreen returning onPlay={() => undefined} />
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

/** The ledger, as the report reads it. */
const ledger = () => JSON.parse(localStorage.getItem("decision-lab.progress") ?? "{}");
const shadowRows = () =>
  (ledger().visits ?? []).flatMap(
    (v: { events?: { name: string }[] }) =>
      (v.events ?? []).filter((e) => e.name === "next_action_shadow"),
  );

describe("on the screen, it changes nothing", () => {
  it("still offers the screen's own action and says nothing about the proposal", async () => {
    const store = new LocalRecordStore();
    await store.saveBlitzRecord({
      game: game("g1", "pending"),
      decisions: [
        {
          gameId: "g1",
          ply: 1,
          side: "w",
          san: "e4",
          fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          thinkMs: 1200,
          clockBeforeMs: 180_000,
          opponentClockBeforeMs: 180_000,
          confidence: null,
          confidenceScale: null,
          confidenceGridVersion: null,
          instrumentationLatencyMs: null,
          cpLoss: null,
          standingCp: null,
          wasAsked: false,
          samplingProbability: 0.15,
        },
      ],
    } as never);

    const { container } = renderResume();
    await waitFor(() => expect(container.querySelector(".resume")).toBeTruthy());

    /*
     * THE SCREEN IS UNTOUCHED. One action, and it is the screen's own -- not the proposal's. A
     * shadow that had leaked into the DOM would show up here as a second control or a changed one.
     */
    expect(container.querySelectorAll(".finding__action").length).toBeLessThanOrEqual(1);
    expect(screen.queryByText(/wait-analysis|next-action|shadow/i)).toBeNull();
  });

  it("writes exactly one row per visit, whatever the screen re-renders", async () => {
    /*
     * THE LEDGER IS A RING IN `localStorage` AND THIS SCREEN RE-RENDERS ON EVERY QUERY SETTLE. A
     * row per render would evict the funnel events the ledger exists for, which would make the
     * shadow cost the trial its own data.
     */
    const { rerender, container } = renderResume();
    await waitFor(() => expect(shadowRows().length).toBe(1));
    rerender(<div />);
    renderResume();
    await waitFor(() => expect(container).toBeTruthy());
    expect(shadowRows().length).toBe(1);
  });

  it("records what it proposed, what the screen offered, and what it could not see", async () => {
    renderResume();
    await waitFor(() => expect(shadowRows().length).toBe(1));
    const [row] = shadowRows();
    expect(row.surface).toBe("resume");
    expect(row.offered).toBe(RESUME_OFFERS);
    expect(typeof row.proposed).toBe("string");
    expect(typeof row.agrees).toBe("boolean");
    expect([...row.blind].sort()).toEqual([...RESUME_BLIND_SPOTS].sort());
  });

  it("records a proposal even on an empty record, where the screen renders nothing at all", async () => {
    /*
     * THE RENDERS WORTH SHADOWING MOST are the ones where this screen decides to show nothing --
     * a reading still fetching, a record with no games. The derivation answers `none` to the first,
     * which is the whole reason `none` exists, and a hook called below an early return would never
     * see it.
     */
    await waitFor(() => expect(shadowRows().length).toBe(0));
    renderResume();
    await waitFor(() => expect(shadowRows().length).toBe(1));
    expect(shadowRows()[0].proposed.length).toBeGreaterThan(0);
  });
});
