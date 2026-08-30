// @vitest-environment jsdom
/**
 * R-02: THE TAB CLOSED WHILE THE ENGINE WAS STILL THINKING, AND THE GAME IS STILL THERE.
 *
 * WHAT THIS REPLACES. `/blitz` used to analyse a finished game and only then write it. Every
 * position went through a wasm search at depth 12, which on a phone is tens of seconds for a full
 * game, and until the last one came back nothing had been stored. A player who closed the tab, hit
 * back, or let a backgrounded tab get reclaimed lost the entire game: the moves, both clocks, and
 * the think times -- and the think times are the measurement. They are frozen at commit inside
 * `blitz-game-core.ts` and exist nowhere else; no reconstruction from timestamps can recover them,
 * because the timestamps of a game nobody stored do not exist either.
 *
 * THE LOSS WAS INVISIBLE FROM THE DATA. A game that was never written leaves nothing behind to
 * count, so the dataset does not under-report -- it reports a smaller population and looks
 * complete. Worse, it is not lost at random: the games most likely to be dropped are the long ones
 * (more positions to score) played on slow devices, which is a selection on exactly the axis a
 * calibration study cares about.
 *
 * HOW THE TAB IS CLOSED HERE. The analyser's engine is given a search that never returns, so the
 * component is unmounted at the one moment that used to be fatal: the game is over, the analysis
 * has begun, and no verdict exists. Then the record is read back through a FRESH store, which is
 * what a reload is.
 *
 * WHY THIS IS A GATE AND NOT A REGRESSION TEST. Restore the old ordering and the first assertion
 * fails outright -- with the write behind the analysis, and the analysis never finishing, the store
 * is empty. There is no way to make it pass except by writing the game before the engine starts.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LocalRecordStore } from "@/lib/local-record-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Two engines, and only the second one hangs.
 *
 * INV-11 gives the opponent and the analyser separate instances, which is what makes this possible
 * at all: the opponent has to keep answering or no game gets played, while the analyser has to
 * never answer or there is no moment to close the tab in. Instance 1 is the opponent's, because
 * `Blitz.tsx` constructs it first -- the same assumption `a-blitz-game-somebody-could-actually-play`
 * makes and proves.
 */
const constructed: string[] = [];
const analyserCalls: string[] = [];
/** Resolves the hung searches, for the one test that lets the analysis finish. */
let release: ((scoreCp: number) => void) | null = null;
let hang = true;

vi.mock("@/lib/stockfish", () => ({
  StockfishClient: class {
    private readonly instance: number;
    constructor() {
      constructed.push("client");
      this.instance = constructed.length;
    }
    async analyze(fen: string, _depth: number) {
      const reply = { scoreCp: 0, depth: 1, pv: ["e7e5"], bestMove: "e7e5", fen };
      if (this.instance === 1) return reply;
      analyserCalls.push(fen);
      if (!hang) return reply;
      /*
       * A SEARCH THAT NEVER RETURNS, which is not a contrived failure. It is what a backgrounded
       * tab, a throttled worker, or a device that reclaimed the wasm heap looks like from here:
       * the promise simply never settles, and nothing downstream is ever told.
       */
      return new Promise<typeof reply>((resolve) => {
        release = (scoreCp: number) => resolve({ ...reply, scoreCp });
      });
    }
  },
}));

import Blitz from "@/pages/Blitz";

let clock = 0;
beforeEach(() => {
  clock = 1_000;
  constructed.length = 0;
  analyserCalls.length = 0;
  release = null;
  hang = true;
  localStorage.clear();
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  /* 0.99 > the ask rate: never asked, so no open question can hold the opponent back. */
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const square = (name: string) => document.querySelector(`[data-square="${name}"]`) as HTMLElement;

async function play(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  await user.click(square(from));
  await waitFor(() => expect(square(to).className).toContain("legal-square"));
  await user.click(square(to));
}

function renderBlitz() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });
  return render(
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Blitz />
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

/** Play one move, let the opponent reply, resign. Leaves the analyser mid-search. */
async function playAndResign(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "3+0" }));
  clock = 5_000;
  await play(user, "e2", "e4");
  await waitFor(() => expect(constructed.length).toBeGreaterThan(0));
  clock = 9_000;
  await user.click(screen.getByRole("button", { name: "פרישה" }));
  await waitFor(() => expect(screen.getByText("המשחק נגמר")).toBeTruthy());
}

describe("the tab closed during the analysis", () => {
  it("keeps the game, its decisions and its think times when the engine never answers", async () => {
    const user = userEvent.setup();
    const { unmount } = renderBlitz();
    await playAndResign(user);

    // The analysis has actually begun -- this is the window the old ordering lost the game in.
    await waitFor(() => expect(analyserCalls.length).toBeGreaterThan(0));
    unmount();

    /*
     * A FRESH STORE, WHICH IS WHAT A RELOAD IS. Reading back through the instance the component
     * used would be satisfied by a store that remembers only within its own lifetime, which is the
     * failure this is about.
     */
    const store = new LocalRecordStore();
    await waitFor(async () => expect(await store.listBlitzGames()).toHaveLength(1));

    const [game] = await store.listBlitzGames();
    expect(game.playedAs).toBe("w");
    expect(game.timeControl).toEqual({ initialMs: 180_000, incrementMs: 0 });
    expect(game.outcome).toMatchObject({ kind: "resignation" });
    expect(game.startedAt).toBeTruthy();
    expect(game.finishedAt).toBeTruthy();

    const decisions = (await store.listBlitzDecisions()).filter((d) => d.gameId === game.gameId);
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0].san).toBe("e4");
    /*
     * THE THINK TIME IS THE POINT OF THE WHOLE EXERCISE. It is frozen at commit and reconstructible
     * from nothing, so a game stored without it is a game that measured nothing.
     */
    expect(decisions[0].thinkMs).toBeGreaterThan(0);
    expect(decisions[0].clockBeforeMs).toBeGreaterThan(0);
  });

  it("says the game is UNSCORED rather than storing a verdict nobody produced", async () => {
    /*
     * THE HALF THAT KEEPS THE FIRST ONE HONEST. Storing early is only an improvement if the row is
     * truthful about what it does not have. A null `cpLoss` meant one thing before this change --
     * the evaluator could not answer -- and would now mean two, which is the R2 failure this
     * repository is built around: two different facts sharing one representation, with nothing
     * downstream able to separate them afterwards.
     */
    const user = userEvent.setup();
    const { unmount } = renderBlitz();
    await playAndResign(user);
    await waitFor(() => expect(analyserCalls.length).toBeGreaterThan(0));
    unmount();

    const store = new LocalRecordStore();
    await waitFor(async () => expect(await store.listBlitzGames()).toHaveLength(1));
    const [game] = await store.listBlitzGames();

    expect(game.analysisState).toBe("pending");
    expect(game.analysedAt, "an unscored game carries a time it was scored").toBeNull();
    expect(game.analysis, "an unscored game names an engine that never answered").toBeNull();

    const decisions = (await store.listBlitzDecisions()).filter((d) => d.gameId === game.gameId);
    expect(decisions.every((d) => d.cpLoss === null)).toBe(true);
    expect(decisions.every((d) => d.standingCp === null)).toBe(true);
  });

  it("names the opponent it was actually played against, before any engine has scored it", async () => {
    /*
     * R-04, ASSERTED ON THE PENDING ROW ON PURPOSE. The opponent is a fact about the GAME, known
     * the moment it ends; the analysis is a fact about a later search. Attaching the opponent to
     * the scored write would have made it conditional on an engine finishing -- so every game
     * abandoned mid-analysis would be stored with no opponent, and the rows most likely to lose it
     * are exactly the ones this file is about.
     */
    const user = userEvent.setup();
    const { unmount } = renderBlitz();
    await playAndResign(user);
    await waitFor(() => expect(analyserCalls.length).toBeGreaterThan(0));
    unmount();

    const store = new LocalRecordStore();
    await waitFor(async () => expect(await store.listBlitzGames()).toHaveLength(1));
    const [game] = await store.listBlitzGames();

    expect(game.opponent).not.toBeNull();
    expect(game.opponent?.kind).toBe("engine");
    expect(game.opponent?.engine).toBe("stockfish");
    expect(game.opponent?.depth).toBe(4);
    /* The build is the content hash of the wasm, so it identifies a binary rather than a range. */
    expect(game.opponent?.build).toContain("18-lite-single");
  });

  it("fills the verdict in, with its provenance, when the engine DOES answer", async () => {
    /*
     * THE OTHER END OF THE TWO-PHASE WRITE. A rollback is not achieved by never storing anything,
     * and `pending` is not achieved by never scoring anything: the scored path has to still work,
     * and has to still be ONE game rather than two.
     *
     * R-03 is asserted here rather than in a unit test because provenance is only real if the
     * screen supplies it. `docs/ACTION_PLAN.md` B1 measured 13.61% of decisions flipping verdict
     * between two builds of this engine, so a cp-loss that cannot name its build is a number two
     * different instruments could have produced.
     */
    hang = false;
    const user = userEvent.setup();
    renderBlitz();
    await playAndResign(user);

    const store = new LocalRecordStore();
    await waitFor(async () => {
      const [game] = await store.listBlitzGames();
      expect(game?.analysisState).toBe("complete");
    });

    const games = await store.listBlitzGames();
    expect(games, "the second write created a second game").toHaveLength(1);
    const [game] = games;
    expect(game.analysedAt).toBeTruthy();
    expect(game.analysis?.engine).toBe("stockfish");
    expect(game.analysis?.depth).toBe(12);
    expect(game.analysis?.build).toContain("18-lite-single");
    /* The engine that scored it is the same BUILD as the one it was played against, not the same
     * instance -- INV-11 is about instances, and the provenance is about binaries. */
    expect(game.analysis?.build).toBe(game.opponent?.build);

    const decisions = (await store.listBlitzDecisions()).filter((d) => d.gameId === game.gameId);
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every((d) => d.cpLoss !== null)).toBe(true);
    /* The decisions survived the second write intact: it is an update, not a replacement. */
    expect(decisions[0].san).toBe("e4");
    expect(decisions[0].thinkMs).toBeGreaterThan(0);
  });
});
