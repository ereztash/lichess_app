// @vitest-environment jsdom
/**
 * §12, §13 AND §28: the second visit is not a landing page.
 *
 * THE FINDING BEHIND THIS FILE, in the owner's words: he had seen the entry screen dozens of times
 * and had almost never read it. The response the plan draws from that is not "write it better" --
 * it is that a product must not depend on anyone reading it, which makes the returning screen a
 * different screen rather than the same one with better copy.
 *
 * SO THE ASSERTIONS ARE ABOUT WHAT IS GONE AND WHAT REPLACED IT. The explanation a returning player
 * has already seen must not be on the page; three answers must be, and they must be short enough to
 * take in at a glance -- §28's acceptance criterion is that no paragraph is required, and a
 * character budget is the only version of that a test can hold.
 *
 * THE BUDGET IS A BUDGET AND NOT A MEASUREMENT, and it is written down as one. It is derived from a
 * reading-speed estimate rather than from anything this repository has measured, exactly like the
 * bundle budget it is modelled on, and like that one it exists so the number is on the record
 * rather than in somebody's taste.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { ResumeScreen } from "@/components/ResumeScreen";
import { MIN_BUCKET_N } from "@shared/detector";
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "@shared/confidence";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import { readBlitz } from "@shared/blitz-reading";
import type { StoredBlitzDecision, StoredBlitzGame } from "@shared/blitz-record";

/**
 * HOW MANY CHARACTERS A RETURNING PLAYER MAY BE ASKED TO READ.
 *
 * DERIVED, NOT MEASURED, and the difference is stated because everything else in this repository
 * carrying a threshold carries a measurement with it. Hebrew prose is read at roughly 200 words a
 * minute and averages about five characters a word, so five seconds is about 850 characters. §28
 * asks for three ANSWERS in seconds and not for a five-second read, so the ceiling sits well under
 * that: a player who spends their whole glance budget reading has none of it left to decide with.
 *
 * WHAT THE FOUR STATES ACTUALLY MEASURE, at the commit that set this:
 *
 *     an empty record             116
 *     a thin record               148
 *     nothing separated           146
 *     a record with a finding     307
 *
 * 400 IS THE WORST CASE PLUS ONE SENTENCE. Not a round number chosen for comfort -- the four
 * numbers above are what the screen says today, and a ceiling that left room for three more
 * sentences would not be holding anything.
 *
 * IT MAY RISE ONLY WITH A NEW STATE THAT NEEDS NAMING, in the commit that adds it, the way the
 * bundle budget rises -- not the `Home.tsx` rule, which may only fall. The difference is that a
 * fifty-sixth piece of state is never the right answer, and a genuinely new evidence level on this
 * screen (there is no `tested` claim to show yet) legitimately needs a sentence of its own. What is
 * forbidden is raising it because the existing sentences grew.
 *
 * THIS BUDGET CAUGHT TWO REAL DEFECTS, which is the argument for it existing at all. The
 * finding state rendered its sentence TWICE -- headline and example were the same function -- and
 * the empty state ended with "this is not a reason to change anything in your play", 62 characters
 * of non-sequitur on a card reporting that no game had been played. Neither is a wording judgement;
 * both were visible the moment somebody printed what the budget was counting.
 */
const GLANCE_BUDGET_CHARS = 400;

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const MIDDLE = "r2q1rk1/pp2bppp/2n1bn2/2pp4/3P4/2NBPN2/PPQ2PPP/R1B2RK1 w - - 0 12";

const game = (over: Partial<StoredBlitzGame> = {}): StoredBlitzGame => ({
  gameId: "g1",
  playedAs: "w",
  timeControl: { initialMs: 180_000, incrementMs: 0 },
  outcome: { kind: "resignation", loser: "b" },
  startedAt: "2026-08-30T12:00:00.000Z",
  finishedAt: "2026-08-30T12:03:00.000Z",
  measurementProtocol: "instrumented-blitz",
  protocolVersion: CURRENT_PROTOCOL_VERSION,
  analysisTiming: "after-play",
  samplingPolicyVersion: 1,
  askRate: 0.15,
  analysisState: "complete",
  analysedAt: "2026-08-30T12:03:20.000Z",
  analysis: { engine: "stockfish", build: "18-lite-aaaa", depth: 12 },
  opponent: { kind: "engine", engine: "stockfish", build: "18-lite-aaaa", depth: 4 },
  ...over,
});

const decision = (
  gameId: string,
  ply: number,
  over: Partial<StoredBlitzDecision> = {},
): StoredBlitzDecision => ({
  gameId,
  ply,
  side: "w",
  san: "e4",
  fenBefore: START,
  thinkMs: 1200,
  clockBeforeMs: 180_000,
  opponentClockBeforeMs: 180_000,
  wasAsked: true,
  samplingProbability: 0.15,
  confidence: 5,
  confidenceScale: CONFIDENCE_LEVELS,
  confidenceGridVersion: CONFIDENCE_GRID_VERSION,
  instrumentationLatencyMs: 800,
  cpLoss: 10,
  standingCp: 40,
  ...over,
});

/** A record with a real effect in `fast-under-45s`, confident on both sides so it is comparable. */
const plantedRun = (gameId: string, n: number): StoredBlitzDecision[] =>
  Array.from({ length: n }, (_, i) => {
    const fast = i % 2 === 0;
    const wrong = fast ? i % 5 !== 0 : i % 4 === 1;
    return decision(gameId, i + 1, {
      thinkMs: fast ? 1_000 : 60_000,
      confidence: fast ? 7 : 6,
      cpLoss: wrong ? 400 : 5,
      standingCp: 20,
      fenBefore: MIDDLE,
    });
  });

/** A thin record: readable, and nowhere near a split. */
const thinRun = (gameId: string, n: number): StoredBlitzDecision[] =>
  Array.from({ length: n }, (_, i) =>
    decision(gameId, i + 1, { thinkMs: i % 2 === 0 ? 1_000 : 60_000, confidence: (i % 7) + 1 }),
  );

/**
 * THE HOOK IS STUBBED AT THE MODULE BOUNDARY rather than driven through a store.
 *
 * What this file is about is what the SCREEN says for a given reading, and building each reading by
 * writing games into a local store would make every assertion depend on the write path as well --
 * which is tested elsewhere, at length, and which would turn a wording regression into a mystery
 * about persistence. The readings themselves come from the real `readBlitz`.
 */
const reading = vi.hoisted(() => ({
  current: undefined as ReturnType<typeof Object> | undefined,
  loading: false,
}));

vi.mock("@/lib/blitz-reading-api", () => ({
  useBlitzReading: () => ({ data: reading.current, isLoading: reading.loading }),
}));

/**
 * The screen's own memory of when it last showed a reading.
 *
 * STUBBED RATHER THAN WRITTEN THROUGH `localStorage`, because what is under test is the sentence,
 * and driving it through storage would make every case here depend on jsdom's storage as well. The
 * module's own read-and-write behaviour has one job and is asserted where it lives.
 */
/**
 * The claim view, for the one field this screen reads out of it.
 *
 * `N-3`: the record surface says how many decisions it holds outside the personal-game
 * population, and `readElsewhere` is where that count comes from. Stubbed here because the case
 * that matters for the glance budget is the one where it is NOT zero, and an unstubbed query
 * returns undefined and renders the empty-record sentence forever.
 */
const claim = vi.hoisted(() => ({ readElsewhere: 0 }));

/*
 * PARTIAL, because `next-action-shadow` reads `useDecisionCount` and `useRecordReading` from the
 * same module and this screen mounts it. Replacing the module wholesale removed them and the
 * suite failed to import before a single case ran.
 */
vi.mock("@/lib/record-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/record-api")>()),
  useClaimView: () => ({ data: { readElsewhere: claim.readElsewhere }, isLoading: false }),
}));

const seen = vi.hoisted(() => ({ at: null as string | null, remembered: [] as string[] }));

vi.mock("@/lib/last-seen", () => ({
  lastSeenReading: () => seen.at,
  rememberReadingSeen: (at?: string) => seen.remembered.push(at ?? "now"),
}));

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

const show = (returning: boolean) => {
  const onPlay = vi.fn();
  const view = render(
    <trpc.Provider client={trpcClient} queryClient={client}>
      <QueryClientProvider client={client}>
        <ResumeScreen returning={returning} onPlay={onPlay} />
      </QueryClientProvider>
    </trpc.Provider>,
  );
  return { ...view, onPlay };
};

/** Everything a reader sees without opening anything. */
const glance = (): string => {
  const section = document.querySelector(".resume");
  if (!section) return "";
  const clone = section.cloneNode(true) as HTMLElement;
  for (const closed of clone.querySelectorAll("details:not([open])")) {
    /* A closed disclosure is in the document and is not on screen. §15's whole mechanism. */
    closed.remove();
  }
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
};

beforeEach(() => {
  claim.readElsewhere = 0;
  reading.current = undefined;
  reading.loading = false;
  seen.at = null;
  seen.remembered = [];
});
afterEach(() => {
  client.clear();
});

describe("a screen nobody reads twice", () => {
  describe("who sees it", () => {
    it("renders nothing on a first visit", () => {
      reading.current = { ...readBlitzOf([game()], plantedRun("g1", MIN_BUCKET_N * 4)) };
      show(false);
      expect(document.querySelector(".resume")).toBeNull();
    });

    it("renders nothing while the reading is still being fetched", () => {
      /*
       * "Still fetching" is not "nothing here yet". Rendering the shortfall here would tell a
       * returning player with forty games that they had never played, for as long as the request
       * took -- and that is the sentence they would act on.
       */
      reading.loading = true;
      show(true);
      expect(document.querySelector(".resume")).toBeNull();
    });

    it("renders on a return, even when the record is empty", () => {
      // §13's "not enough has accumulated yet" is a state the screen renders, not a reason to hide.
      reading.current = readBlitzOf([], []);
      show(true);
      expect(document.querySelector(".resume")).not.toBeNull();
      expect(glance()).toContain("עוד לא שיחקת");
    });
  });

  describe("the three answers", () => {
    it("says what changed, what is known, and what is next", async () => {
      reading.current = readBlitzOf([game()], plantedRun("g1", MIN_BUCKET_N * 4));
      show(true);
      const text = glance();
      /* What changed: nothing, because no `since` is supplied by the store in this fixture. */
      expect(text).toContain("החלטות תחת פחות מ-45 שניות");
      /* What is known: counts on both sides, never a percentage. */
      expect(text).toMatch(/\d+ מתוך \d+/);
      /* What is next: exactly one action, and it says what it is for. */
      expect(screen.getAllByRole("button").filter((b) => !b.closest("details"))).toHaveLength(1);
    });

    it("never prints a percentage", () => {
      /*
       * §6 AND §10. "6 of 9 against 2 of 11" rather than "66.7% against 18.2%" -- the second is
       * more precise, less understood, and spuriously precise at these sizes anyway.
       */
      reading.current = readBlitzOf([game()], plantedRun("g1", MIN_BUCKET_N * 4));
      show(true);
      expect(glance()).not.toMatch(/\d+(\.\d+)?\s*%/);
    });

    it("carries a real number of games in the shortfall, from the gate that is blocking", () => {
      reading.current = readBlitzOf([game(), game({ gameId: "g2" })], [
        ...thinRun("g1", 6),
        ...thinRun("g2", 6),
      ]);
      show(true);
      expect(glance()).toMatch(/עוד \d+ משחקים לפחות יאפשרו בדיקה ראשונה/);
    });

    it("says the engine has not run when the engine has not run", () => {
      const pending = game({ analysisState: "pending", analysedAt: null, analysis: null });
      reading.current = readBlitzOf(
        [pending],
        thinRun("g1", 20).map((d) => ({ ...d, cpLoss: null, standingCp: null })),
      );
      show(true);
      expect(glance()).toContain("המנוע עוד לא עבר");
      /* And it does NOT tell them the record is too thin, which is the other, wrong answer. */
      expect(glance()).not.toContain("עוד לא הצטבר מספיק");
    });

    it("does not answer an unscored record with another game (P1.5)", () => {
      /*
       * THE ONE BLOCKER PLAYING DOES NOT ANSWER. The games are stored and the engine has not been
       * over them; another game adds to the backlog that IS the blocker. The screen offered one
       * anyway -- "שחק עוד משחק" -- because every blocker had to fill in a button label.
       *
       * IT ONLY BECAME HONEST TO SAY "WAIT" WHEN WAITING STARTED WORKING. Before the analysis queue
       * (LAW 4), leaving the blitz screen cancelled the search, so a pending game was one nothing
       * would ever finish.
       */
      const pending = game({ analysisState: "pending", analysedAt: null, analysis: null });
      reading.current = readBlitzOf(
        [pending],
        thinRun("g1", 20).map((d) => ({ ...d, cpLoss: null, standingCp: null })),
      );
      show(true);
      expect(document.querySelector(".finding__action")).toBeNull();
      expect(glance()).not.toContain("שחק עוד משחק");
      /* And it says what is happening instead, with the count that is the diagnosis. */
      expect(document.querySelector(".resume__waiting")?.textContent).toContain("ממתין לניתוח");
    });

    it("still offers a game for the blockers that a game really does answer", () => {
      /*
       * THE OTHER HALF, WITHOUT WHICH THE CASE ABOVE IS SATISFIED BY REMOVING EVERY BUTTON. A thin
       * record is answered by playing, and it must still say so.
       */
      reading.current = readBlitzOf([game()], thinRun("g1", 6));
      show(true);
      expect(document.querySelector(".finding__action")).not.toBeNull();
      expect(document.querySelector(".resume__waiting")).toBeNull();
    });

    it("says nothing separated when nothing separated, rather than calling it a shortage", () => {
      reading.current = readBlitzOf([game()], thinRun("g1", MIN_BUCKET_N * 4));
      show(true);
      expect(glance()).toContain("אף אחת מהן לא הפרידה");
      expect(glance()).not.toContain("עוד לא הצטבר מספיק");
    });
  });

  describe("what changed since last time", () => {
    it("says how many games arrived, and how many of them were analysed", () => {
      seen.at = "2026-08-30T11:00:00.000Z";
      reading.current = readBlitzOf(
        [game({ gameId: "g1" }), game({ gameId: "g2", finishedAt: "2026-08-30T12:30:00.000Z" })],
        [...thinRun("g1", 4), ...thinRun("g2", 4)],
      );
      show(true);
      expect(glance()).toContain("2 משחקים חדשים מאז הפעם הקודמת, וכולם נותחו.");
    });

    it("says NOTHING when nothing arrived, rather than reporting a zero", () => {
      /*
       * "0 new games" is a sentence whose only content is a zero, and it costs a returning player
       * a line of their glance budget to learn that nothing happened -- which they can see from the
       * absence of the line.
       */
      seen.at = "2027-01-01T00:00:00.000Z";
      reading.current = readBlitzOf([game()], thinRun("g1", 8));
      show(true);
      expect(glance()).not.toContain("מאז הפעם הקודמת");
    });

    it("says nothing at all on a first arrival, which is not the same as nothing new", () => {
      seen.at = null;
      reading.current = readBlitzOf([game()], thinRun("g1", 8));
      show(true);
      expect(glance()).not.toContain("מאז הפעם הקודמת");
    });

    it("separates games that arrived from games that were analysed, when they differ", () => {
      // The gap between the two IS the message: it is what a broken analysis path looks like.
      seen.at = "2026-08-30T11:00:00.000Z";
      const pending = game({
        gameId: "g2",
        finishedAt: "2026-08-30T12:30:00.000Z",
        analysisState: "pending",
        analysedAt: null,
        analysis: null,
      });
      reading.current = readBlitzOf(
        [game({ gameId: "g1" }), pending],
        [...thinRun("g1", 4), ...thinRun("g2", 4).map((d) => ({ ...d, cpLoss: null, standingCp: null }))],
      );
      show(true);
      expect(glance()).toContain("2 משחקים חדשים מאז הפעם הקודמת, 1 מהם נותחו.");
    });

    it("stamps itself as seen only once the reading is actually on screen", () => {
      /*
       * A screen that marked itself seen and then failed to render would lose the player's
       * "what changed" line permanently, for a visit where they were shown nothing.
       */
      reading.loading = true;
      show(true);
      expect(seen.remembered).toHaveLength(0);
    });
  });

  describe("the glance budget", () => {
    it.each([
      ["an empty record", () => readBlitzOf([], []), 0],
      ["a thin record", () => readBlitzOf([game()], thinRun("g1", 8)), 0],
      ["a record with a finding", () => readBlitzOf([game()], plantedRun("g1", MIN_BUCKET_N * 4)), 0],
      ["a record where nothing separated", () => readBlitzOf([game()], thinRun("g1", MIN_BUCKET_N * 4)), 0],
      /*
       * `N-3`: an empty blitz record that nonetheless holds decisions, which is what every cold
       * arrival looks like the moment they answer the bank position the front door hands them.
       * It is the longest of the five sentences, so it is the one the budget has to survive.
       */
      ["a record holding decisions it does not count", () => readBlitzOf([], []), 12],
    ])("stays inside the budget on %s", (_name, build, elsewhere) => {
      claim.readElsewhere = elsewhere;
      reading.current = build();
      show(true);
      const text = glance();
      expect(text.length, `the resume screen asked for ${text.length} characters`).toBeLessThanOrEqual(
        GLANCE_BUDGET_CHARS,
      );
    });

    it("actually renders the sentence the case above is budgeting for", () => {
      /*
       * Without this, the budget case is vacuous: a screen that ignored `readElsewhere` would
       * render the short empty-record sentence, stay well inside 400 characters, and pass.
       */
      claim.readElsewhere = 12;
      reading.current = readBlitzOf([], []);
      show(true);
      expect(glance()).toContain("12 החלטות");
      expect(glance()).not.toContain("עוד לא שיחקת כאן משחק, אז אין עדיין מה למדוד");
    });

    it("keeps the instrumentation behind the disclosure, not in the glance", async () => {
      reading.current = readBlitzOf([game()], plantedRun("g1", MIN_BUCKET_N * 4));
      show(true);
      const why = document.querySelector(".finding__why") as HTMLDetailsElement;
      expect(why.open).toBe(false);
      expect(glance()).not.toContain("החלטות שאפשר לקרוא");
      /* And it IS there, one click away, with its denominators. R1 is satisfied, not skipped. */
      await waitFor(() => expect(why.textContent).toContain("החלטות שאפשר לקרוא"));
    });
  });

  describe("what it may not do", () => {
    it("refuses to prescribe from a retrospective description", () => {
      /*
       * §23. Everything this screen can find is `recurred` -- the region was chosen after seeing
       * the data -- so the card must carry its own restraint line and the action must be a request
       * for a measurement rather than advice about chess.
       */
      reading.current = readBlitzOf([game()], plantedRun("g1", MIN_BUCKET_N * 4));
      show(true);
      expect(document.querySelector(".finding__restraint")).not.toBeNull();
      expect(document.querySelector(".evidence-mark")?.getAttribute("data-authority")).toBe(
        "recurred",
      );
    });
  });
});

/** The real reading, over fixtures, so no assertion here rests on a hand-written projection. */
function readBlitzOf(games: StoredBlitzGame[], decisions: StoredBlitzDecision[]) {
  return { reading: readBlitz(games, decisions), games };
}
