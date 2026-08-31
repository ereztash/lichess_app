// @vitest-environment jsdom
/**
 * A LIST OF SIX THINGS WORTH SEEING, ALL SAYING THE SAME SENTENCE.
 *
 * WHAT WAS ON SCREEN. A three-minute game, six expensive moves, and the post-game disclosure read:
 *
 *     6 ההחלטות שכדאי לראות
 *       במהלך Bc4 המהלך היה מחיר גדול.     על השעון: 2:48 · חשבת: 2.7 שניות · המהלך: מחיר גדול
 *       במהלך Nf3 המהלך היה מחיר גדול.     על השעון: 2:56 · חשבת: 1.5 שניות · המהלך: מחיר גדול
 *       במהלך O-O המהלך היה מחיר גדול.     על השעון: 2:45 · חשבת: 1.6 שניות · המהלך: מחיר גדול
 *       ... three more, identical in shape
 *
 * THIRTEEN STATEMENTS OF ONE FACT. Once in each headline, once in each detail line, and once more
 * implied by a summary that called all six worth seeing without saying what for. A reader opening a
 * disclosure is there to choose one of the rows, and nothing on that screen distinguished them
 * except a move name buried mid-sentence.
 *
 * IT IS NOT A WORDING BUG AND THAT IS WHY THIS FILE EXISTS. `eventHeadline` was written for the
 * event that EARNS a sentence -- "כאן אמרת בטוח, והמהלך היה מחיר גדול", which is the thing no game
 * review can produce -- and then applied to the events that do not. `blitzEventsIn`'s own ordering
 * rule says so from the other side: *ordered by what the record could say that an engine could not*.
 * A row with no stated confidence is at the bottom of that order, and it should read like it.
 *
 * WHAT IS ASSERTED. That no two rows are identical, that a fact shared by every row is said once
 * rather than per row, that a list which genuinely holds two bands still reports both, and that the
 * one row with an instrument answer is visibly the one row with an instrument answer.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostGame } from "@/components/PostGame";
import { readBlitzGame } from "@shared/blitz-reading";
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "@shared/confidence";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import type { StoredBlitzDecision, StoredBlitzGame } from "@shared/blitz-record";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

const decision = (ply: number, over: Partial<StoredBlitzDecision> = {}): StoredBlitzDecision => ({
  gameId: "g1",
  ply,
  side: "w",
  san: "Nf3",
  fenBefore: START,
  thinkMs: 1_500,
  clockBeforeMs: 176_000,
  opponentClockBeforeMs: 176_000,
  wasAsked: false,
  samplingProbability: 0.15,
  confidence: null,
  confidenceScale: null,
  confidenceGridVersion: null,
  instrumentationLatencyMs: null,
  cpLoss: 300,
  standingCp: 0,
  ...over,
});

/** The screenshot, as data: five expensive moves nobody was asked about, and one they were. */
const THE_GAME: StoredBlitzDecision[] = [
  decision(3, { san: "Bc4", thinkMs: 2_700, clockBeforeMs: 168_000 }),
  decision(5, { san: "Nf3", thinkMs: 1_500, clockBeforeMs: 176_000 }),
  decision(7, { san: "O-O", thinkMs: 1_600, clockBeforeMs: 165_000 }),
  decision(9, { san: "exd5", thinkMs: 2_200, clockBeforeMs: 178_000 }),
  decision(11, {
    san: "Bg5",
    thinkMs: 1_600,
    clockBeforeMs: 174_000,
    wasAsked: true,
    confidence: 5,
    confidenceScale: CONFIDENCE_LEVELS,
    confidenceGridVersion: CONFIDENCE_GRID_VERSION,
    instrumentationLatencyMs: 700,
  }),
  decision(13, { san: "Nc3", thinkMs: 2_300, clockBeforeMs: 173_000 }),
];

const show = (decisions: StoredBlitzDecision[]) =>
  render(
    <PostGame
      game={game()}
      reading={readBlitzGame(game(), decisions)}
      analysed={decisions.length}
      onSeePosition={vi.fn()}
      onPlayAgain={vi.fn()}
    />,
  );

/** The moves the list shows, in order, so a headline can have its datum removed from it. */
const MOVES = ["Bc4", "Nf3", "O-O", "exd5", "Bg5", "Nc3"];

const rows = () => [...document.querySelectorAll(".post-game__others-list li")];
const headlines = () => rows().map((li) => li.querySelector("button")?.textContent ?? "");
const details = () => rows().map((li) => li.querySelector(".post-game__others-detail")?.textContent ?? "");
const summary = () => document.querySelector(".post-game__others summary")?.textContent ?? "";

describe("the list that said one thing six times", () => {
  it("reaches the list at all, so the assertions below are about something", () => {
    /*
     * THE FLOOR. A fixture that produced no rows would pass every uniqueness assertion below
     * vacuously, which is the failure mode of every "nothing is duplicated" test ever written.
     */
    show(THE_GAME);
    expect(rows().length).toBeGreaterThanOrEqual(5);
  });

  it("gives no two rows the same sentence with a different name dropped into it", () => {
    /*
     * PLAIN UNIQUENESS WOULD HAVE PASSED ON THE BROKEN SCREEN, and writing it that way first is how
     * this nearly became a test that proved nothing. The six headlines differed -- `במהלך Bc4 ...`
     * against `במהלך Nf3 ...` -- because a move name is in them. Six copies of one sentence with a
     * slot filled is exactly the defect, and it is unique as a string.
     *
     * SO THE DATA IS REMOVED AND WHAT IS LEFT IS THE CLAIM. Take the move and the stated word out of
     * each headline; whatever remains is what that row ASSERTS. Two rows asserting the same thing is
     * the failure. A row asserting NOTHING is not: after the fix a decision nobody was asked about
     * renders as its move and no sentence, because with the cost band said once above the list there
     * is nothing left that the record knows and an engine report does not.
     */
    show(THE_GAME);
    const skeletons = rows().map((li, index) => {
      const said = li.querySelector("button")?.textContent ?? "";
      const detail = li.querySelector(".post-game__others-detail")?.textContent ?? "";
      const word = /אמרת: ([^·]+)/.exec(detail)?.[1]?.trim() ?? null;
      let bare = said;
      for (const datum of [MOVES[index], word]) {
        if (datum) bare = bare.split(datum).join("");
      }
      return bare.replace(/["'\s.,]/g, "");
    });
    const claims = skeletons.filter((bare) => bare.length > 0);
    expect(
      new Set(claims).size,
      `rows differ only by a name dropped into one sentence: ${claims.join(" | ")}`,
    ).toBe(claims.length);
  });

  it("says the cost once, above the list, and not in any row", () => {
    /*
     * THE BAND IS THE THING EVERY ROW SHARED, so it belongs in the one place that is rendered once.
     * A word repeated in every row of a list carries no information in any of them.
     */
    show(THE_GAME);
    expect(summary()).toContain("מחיר גדול");
    for (const line of [...headlines(), ...details()]) {
      expect(line, `a row repeats the band the summary already said: ${line}`).not.toContain(
        "מחיר גדול",
      );
    }
  });

  it("stops the summary asserting a value it never names", () => {
    /* "6 ההחלטות שכדאי לראות" -- worth seeing for what? The summary is where that is answerable. */
    show(THE_GAME);
    expect(summary()).not.toBe("6 ההחלטות שכדאי לראות");
    expect(summary()).toMatch(/\d+ החלטות/);
  });

  it("leaves the one row with an instrument answer reading differently from the rest", () => {
    /*
     * THE POINT OF THE WHOLE LIST. Five of these are engine comparisons any game review produces;
     * one of them is a decision the player made a statement about. That difference is the product,
     * and on the screen this replaces it was one word inside six identical sentences.
     */
    show(THE_GAME);
    const stated = headlines().filter((line) => line.includes("אמרת"));
    expect(stated).toHaveLength(1);
    expect(stated[0]).toContain("נוטה");
  });

  it("keeps every band where a list really holds more than one", () => {
    /*
     * NOT A REWORDING, AND THIS IS WHAT SAYS SO. `unsure-and-fine` events are clean by definition,
     * so a list holding one beside an expensive move has two bands to report -- and then the
     * summary names none of them and each row carries its own.
     */
    const asked = (ply: number, over: Partial<StoredBlitzDecision>) =>
      decision(ply, {
        wasAsked: true,
        confidenceScale: CONFIDENCE_LEVELS,
        confidenceGridVersion: CONFIDENCE_GRID_VERSION,
        instrumentationLatencyMs: 700,
        ...over,
      });
    /*
     * TWO PROCESS EVENTS, so one of them can be the LEAD and the other stays in the list beside the
     * engine comparisons. The first fixture here had only one, `readBlitzGame` promoted it out of
     * the list, and what was left shared a band after all -- a test that would have passed while
     * proving nothing about the case it is named for.
     */
    show([
      ...THE_GAME.slice(0, 2),
      asked(15, { san: "Qd2", confidence: 7, cpLoss: 400, standingCp: 0 }),
      asked(17, { san: "Rd1", confidence: 1, cpLoss: 2, standingCp: 0 }),
    ]);
    expect(summary()).not.toContain("מחיר");
    expect(details().every((line) => line.includes("המהלך:"))).toBe(true);
    const bands = new Set(details().map((line) => line.slice(line.indexOf("המהלך:"))));
    expect(bands.size, "the fixture does not actually hold two bands").toBeGreaterThan(1);
  });
});
