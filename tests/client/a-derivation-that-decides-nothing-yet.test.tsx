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
import { UNIMPLEMENTED_INPUTS, offeredAct, productStateFor } from "@/lib/next-action-shadow";
import { actFor, agreesWith, BLINDABLE_INPUTS } from "@shared/next-action";
import { PRIMARY_ACTIONS, primaryAction } from "@shared/primary-action";
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

type StateInput = Parameters<typeof productStateFor>[0];
/*
 * `claim` DEFAULTS TO `undefined` AND THAT IS THE READING, not a convenience. `undefined` is what
 * react-query holds before the claim query resolves, and `claimStateOf` answers `unread` to it --
 * so a case that says nothing about the claim is a case about a front door whose claim view has not
 * come back, which is the state every one of these assertions was written in.
 */
import {
  COMMITMENT_UNREAD,
  type LiveLearningCommitment,
} from "../../shared/continuation";

/** An open run, spelled once: five states means a literal is no longer a two-field object. */
const activeDrill = (runId: string, done: number, total: number): LiveLearningCommitment => ({
  state: "active",
  kind: "drill",
  run: { kind: "drill", runId, resumeWith: runId, done, total },
  restore: { ok: true },
});

const stateFrom = (
  over: Omit<StateInput, "analysisRunning" | "claim" | "continuation"> & {
    analysisRunning?: boolean;
    claim?: StateInput["claim"];
    continuation?: StateInput["continuation"];
  },
) =>
  /*
   * `COMMITMENT_UNREAD` IS THE DEFAULT AND IT MEANS UNOBSERVED, which is the state every surface was
   * permanently in before this reading existed. A test that wants the run branch reachable has to
   * hand over a reading, which is the point: there is no longer a way to be silently blind.
   *
   * IT IS A READING AND NOT `undefined`, and that is the whole of §16 at the type level. The hook
   * cannot answer "no data"; it answers `unknown` with a reason, so no caller ever has to decide
   * for itself what an absent value meant.
   */
  productStateFor({
    analysisRunning: false,
    claim: undefined,
    continuation: COMMITMENT_UNREAD,
    ...over,
  });

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

  it("takes whether the queue is running from the caller instead of making it up", () => {
    /*
     * A BACKLOG IS NOT A PASS, AND THIS FIELD USED TO BE HARD-CODED `false` WITH A COMMENT SAYING
     * the front door did not subscribe to the runner. `ResumeScreen` called `useBlitzAnalysis()`
     * three lines above the call to this function. It did subscribe.
     *
     * The defect is not academic: `wait-analysis` carries `scoring` to the player, and it is the
     * difference between "eleven games are waiting" and "eleven are waiting and one is being scored
     * right now". Every shadow row written before this said the second was never true.
     */
    const inputs = {
      reading: reading(),
      games: [game("a", "pending")],
      decisionsOnRecord: 1,
      record: undefined,
    };
    expect(stateFrom({ ...inputs, analysisRunning: false }).analysisRunning).toBe(false);
    expect(stateFrom({ ...inputs, analysisRunning: true }).analysisRunning).toBe(true);
    const derived = deriveNextAction(stateFrom({ ...inputs, analysisRunning: true }));
    expect(derived).toMatchObject({ kind: "wait-analysis", scoring: true });
  });

  it("says it did not read a run, rather than saying there is no run", () => {
    /*
     * THE DISTINCTION THE WHOLE MIGRATION TURNS ON. These four fields used to be `null` on every
     * surface, and `null` already meant "there is no drill" -- so a screen that had never asked
     * asserted, on every shadow row it ever wrote, that no drill was running.
     */
    const state = stateFrom({ reading: reading(), games: [], decisionsOnRecord: 0, record: undefined });
    expect(state.drill.observed).toBe(false);
    expect(state.transfer.observed).toBe(false);
    expect(state.untestedRule.observed).toBe(false);
    /* And the one that stays blind on purpose, because nothing in the product writes it. */
    expect(state.unseenEvent.observed).toBe(false);
    /* Renamed: the list did not change, what it MEANS did. See `UNIMPLEMENTED_INPUTS`. */
    expect([...UNIMPLEMENTED_INPUTS]).toEqual(["unseenEvent"]);
    expect(state.unseenEvent.observed === false && state.unseenEvent.unimplemented).toBe(true);
  });

  it("carries a run it WAS given, and reports an empty record as an observed absence", () => {
    const withRun = stateFrom({
      reading: reading(),
      games: [],
      decisionsOnRecord: 0,
      record: undefined,
      continuation: {
        drill: activeDrill("d1", 3, 8),
        transfer: { state: "none", kind: "transfer" },
        untestedRule: null,
      },
    });
    expect(withRun.drill).toEqual({ observed: true, value: { drillId: "d1", done: 3, total: 8 } });
    /* Observed, and not a drill: the record was read and the active run is not one. */
    expect(withRun.transfer).toEqual({ observed: true, value: null });
    expect(deriveNextAction(withRun)).toMatchObject({ kind: "continue-drill", drillId: "d1" });

    const empty = stateFrom({
      reading: reading(),
      games: [],
      decisionsOnRecord: 0,
      record: undefined,
      continuation: {
        drill: { state: "none", kind: "drill" },
        transfer: { state: "none", kind: "transfer" },
        untestedRule: null,
      },
    });
    expect(empty.drill).toEqual({ observed: true, value: null });
    expect(empty.untestedRule).toEqual({ observed: true, value: null });
  });

  it("proposes the player's own untested rule above the instrument's claim", () => {
    const state = stateFrom({
      reading: reading(),
      games: [],
      decisionsOnRecord: 4,
      record: undefined,
      continuation: {
        drill: { state: "none", kind: "drill" },
        transfer: { state: "none", kind: "transfer" },
        untestedRule: "rule-7",
      },
    });
    expect(deriveNextAction(state)).toEqual({ kind: "test-hypothesis", ruleId: "rule-7" });
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
    /*
     * AND THE SCREEN AGREES WITH IT BY GOING QUIET. `wait-analysis` maps to no act at all, so a
     * screen rendering no primary control is the correct answer here rather than a missing one --
     * which is exactly what P1.5 made the front door do on `nothing-scored`.
     */
    expect(actFor("wait-analysis")).toBeNull();
    expect(agreesWith("wait-analysis", null)).toBe(true);
    expect(agreesWith("wait-analysis", "play-blitz")).toBe(false);
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
        <ResumeScreen returning standDown={false} offer={null} onTakeOffer={() => undefined} />
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

  it("writes no row while the claim reading is still in flight", async () => {
    /*
     * THE RACE A REVIEWER FOUND ON THE COMMIT THAT ADDED THE FIFTH READING, and it is the third
     * time this file has had one. The gate was `!blitz.data` and nothing waited on the claim, so
     * the two queries could settle in either order: `blitzRecordReading` reads `listBlitzGames`
     * and `listBlitzDecisions`, `currentClaim` begins at `listAtoms`, and neither touches the
     * other's rows. Holding `listAtoms` open is therefore not a contrivance -- it is the ordering
     * the product can actually produce, driven from the one method that separates them.
     *
     * WHY ONE FRAME MATTERS HERE AND WOULD NOT ELSEWHERE. The shadow writes ONCE: `written` is set
     * on the first non-null proposal and `trialEventSeenOn` dedupes for the whole surface. So a row
     * taken during that window is the only row the visit ever has, and a record holding a candidate
     * would be recorded as `return-record` or `play-blitz` permanently -- a disagreement about the
     * assembly wearing the shape of a disagreement about the screen, which is precisely what `D22`
     * fixed twice before and named.
     *
     * THE SCREEN RENDERS IN THAT WINDOW, which is what makes it observable: `ResumeScreen` returns
     * null on the BLITZ reading alone, so `.resume` is on the page while the claim is still coming.
     */
    let release: () => void = () => undefined;
    const held = new Promise((resolve) => {
      release = () => resolve([]);
    });
    const atoms = vi
      .spyOn(LocalRecordStore.prototype, "listAtoms")
      .mockReturnValue(held as never);

    const { container } = renderResume();
    await waitFor(() => expect(container.querySelector(".resume")).toBeTruthy());
    expect(
      shadowRows().length,
      "a proposal was recorded from a claim state that had not arrived",
    ).toBe(0);

    release();
    await waitFor(() => expect(shadowRows().length).toBe(1));
    atoms.mockRestore();
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
    /*
     * WHATEVER THE MARKUP SAYS, INCLUDING NOTHING. `offered` was the constant `"play"` -- a word in
     * no vocabulary, recorded whether or not the screen rendered a control. It is now read off
     * `data-primary-action`, so it is either one of the closed acts or `null`.
     */
    expect(row.offered === null || PRIMARY_ACTIONS.includes(row.offered)).toBe(true);
    expect(row.agrees).toBe(agreesWith(row.proposed, row.offered));
    expect(typeof row.proposed).toBe("string");
    expect(typeof row.agrees).toBe("boolean");
    /*
     * WHAT IT COULD NOT SEE, FROM THE DERIVATION RATHER THAN FROM A TABLE.
     *
     * `blind` used to be a per-surface constant naming four inputs on every row -- including rows
     * where those inputs ranked BELOW the branch that fired. It is now the prefix that actually
     * outranked this proposal, so it is a subset of the blindable inputs and every member of it
     * outranks the answer. In this test the record is empty and unsigned-in, so the continuation
     * read fails and the READABLE inputs above the proposal are named.
     *
     * `unseenEvent` IS NOT AMONG THEM, AND THIS ASSERTION USED TO REQUIRE THAT IT WAS. Nothing in
     * this product can produce a seen-set, so nothing can produce an unseen event, so nothing can
     * outrank an answer from that branch. Naming it here asserted that something might have -- and
     * because it sits at branch 4, that phantom competitor made eight of the eleven kinds
     * permanently unsound, which is precisely why no surface could ever act on the policy.
     * `shared/next-action.ts` now separates "unread" from "unimplementable"; only the first is
     * blindness. No seen-set was built and `review-event` is still unreachable.
     */
    expect(row.blind.every((input: string) => (BLINDABLE_INPUTS as readonly string[]).includes(input))).toBe(true);
    expect(row.blind).not.toContain("unseenEvent");
    /*
     * AND HERE IT IS EMPTY, WHICH IS THE WHOLE MIGRATION IN ONE ROW. The local record store
     * resolves for this empty record, so drill, transfer and the untested rule are all genuinely
     * READ and reported as observed absences. The only thing left on this row used to be
     * `unseenEvent` -- an input nothing can produce -- and it alone made the proposal unsound and
     * therefore unusable by any surface. With the phantom gone the row is sound, which is what
     * lets a screen act on it instead of merely logging it.
     */
    expect(row.blind).toEqual([]);
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
