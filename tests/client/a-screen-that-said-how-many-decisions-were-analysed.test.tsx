// @vitest-environment jsdom
/**
 * §24: the screen after a game stops reporting its own plumbing.
 *
 * WHAT IT SAID. "X החלטות נותחו אחרי המשחק." True, and a description of what the product did to
 * itself. A player finishing a three-minute game learns from it that some number of positions went
 * through an engine, which is not a thing they can do anything with, and is the only thing the
 * screen offered.
 *
 * WHAT DECIDES THE HEADLINE NOW IS NOT SIZE. A game whose worst moment is a 900-centipawn blunder
 * gets "I found nothing worth concluding from this game alone"; a game whose worst moment is a
 * 200-centipawn move the player called "בטוח" gets a headline about that move. Beside a cp-loss
 * column that ordering looks broken, and it is the product: the first is what Game Review has given
 * players for a decade, and the second reads something that exists nowhere but in this record.
 *
 * THE ASSERTIONS BELOW ARE ABOUT WHAT IS ON SCREEN AND WHAT IS ONE CLICK AWAY, because that is the
 * only difference §15 is making. Nothing is deleted. The count, the engine, the depth, the ask rate
 * and the raw centipawns are all still rendered -- inside a closed `<details>`, where R1 is
 * satisfied and nobody is compelled to read them.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostGame } from "@/components/PostGame";
import { readBlitzGame, type WatchedBucket } from "@shared/blitz-reading";
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "@shared/confidence";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import { AUTHORITY } from "@shared/evidence-authority";
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
  thinkMs: 1_400,
  clockBeforeMs: 34_000,
  opponentClockBeforeMs: 40_000,
  wasAsked: true,
  samplingProbability: 0.15,
  confidence: 6,
  confidenceScale: CONFIDENCE_LEVELS,
  confidenceGridVersion: CONFIDENCE_GRID_VERSION,
  instrumentationLatencyMs: 800,
  cpLoss: 10,
  standingCp: 20,
  ...over,
});

/** Said "בטוח", and the move cost material. The record holds something the engine does not. */
const confidentAndCostly = decision(7, { confidence: 6, cpLoss: 220, standingCp: 20 });
/** A far bigger blunder with nothing stated about it. An ordinary engine comparison. */
const plainBlunder = decision(11, {
  confidence: null,
  confidenceScale: null,
  confidenceGridVersion: null,
  cpLoss: 900,
  standingCp: 0,
  san: "Qh5",
});

const show = (
  decisions: StoredBlitzDecision[],
  g: StoredBlitzGame = game(),
  watching?: WatchedBucket,
) => {
  const seePosition = vi.fn();
  const playAgain = vi.fn();
  const view = render(
    <PostGame
      game={g}
      reading={readBlitzGame(g, decisions, watching)}
      analysed={decisions.length}
      onSeePosition={seePosition}
      onPlayAgain={playAgain}
    />,
  );
  return { ...view, seePosition, playAgain };
};

const card = () => screen.getByRole("heading", { level: 2 }).closest(".finding") as HTMLElement;

describe("a screen that said how many decisions were analysed", () => {
  describe("what decides the headline", () => {
    it("leads with the stated confidence, NOT with the bigger blunder", () => {
      /*
       * THE ASSERTION THE WHOLE FILE EXISTS FOR. 900 centipawns against 220, and the 220 wins,
       * because the 220 is the one the record can say something about.
       *
       * IT TAKES BOTH MECHANISMS TO BREAK IT, which is worth writing down rather than discovering
       * later. `readBlitzGame` picks the lead by finding the first `process` event and
       * `blitzEventsIn` sorts process ahead of engine, so either one alone still produces the right
       * headline on this fixture. Belt and braces is not the intent -- the sort orders the LIST and
       * the find picks the LEAD, and they happen to agree here. `a-record-that-explains-its-own-
       * silence` gates each separately; this one gates the composition, through the render.
       */
      show([plainBlunder, confidentAndCostly]);
      expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("בטוח");
      expect(screen.getByRole("heading", { level: 2 }).textContent).not.toContain("Qh5");
    });

    it("says there is nothing to conclude when every event is an engine comparison", () => {
      show([plainBlunder]);
      expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
        "לא מצאתי במשחק הזה לבדו",
      );
    });

    it("still offers the decisions worth seeing when it has nothing to conclude", () => {
      // §24 state A is not an empty state: it names why, and it still opens the list.
      show([plainBlunder]);
      expect(screen.getByText(/הייתה החלטה אחת שכדאי לראות/)).toBeTruthy();
      expect(screen.getByText(/עוד החלטה אחת שכדאי לראות/)).toBeTruthy();
    });

    it("says the engine has not run when the engine has not run", () => {
      /*
       * The distinction that sends a player somewhere useless if it is missing. More games will not
       * add a readable row while the analysis path is broken -- which is R-09's failure, and the
       * screen's answer to it was "0 החלטות נותחו".
       */
      const pending = game({ analysisState: "pending", analysedAt: null, analysis: null });
      show([decision(1, { cpLoss: null, standingCp: null })], pending);
      expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("המנוע עוד לא עבר");
    });
  });

  describe("the count is still here, and it is not the headline", () => {
    it("keeps the analysed count out of everything that is visible without a click", () => {
      show([plainBlunder, confidentAndCostly]);
      const why = document.querySelector(".finding__why") as HTMLDetailsElement;
      expect(why.open).toBe(false);
      /*
       * `textContent` REACHES INSIDE A CLOSED `<details>`, which is what makes this assertion the
       * right shape: the count must be IN the document and NOT in the part that is visible. So the
       * headline and the example are checked directly, rather than searching the whole card.
       */
      expect(screen.getByRole("heading", { level: 2 }).textContent).not.toMatch(/\d+ החלטות/);
    });

    it("puts the count, the engine, the depth and the ask rate behind one disclosure", async () => {
      show([plainBlunder, confidentAndCostly]);
      await userEvent.click(screen.getByText("למה אנחנו אומרים את זה?"));
      const why = document.querySelector(".finding__why") as HTMLDetailsElement;
      expect(why.open).toBe(true);
      const text = why.textContent ?? "";
      expect(text).toContain("2 החלטות");
      expect(text).toContain("18-lite-aaaa");
      expect(text).toContain("עומק 12");
      expect(text).toContain("15 מכל 100");
      expect(text).toContain("220");
    });
  });

  describe("the 1-1-1-1 law", () => {
    it("puts exactly one action inside the card", () => {
      /*
       * §14. A card offering two next steps has asked the reader to choose, which is a decision the
       * product was supposed to have made. "משחק חדש" is navigation and lives outside the card --
       * this assertion is what stops it drifting back in.
       */
      show([confidentAndCostly]);
      const actions = within(card()).getAllByRole("button");
      const outsideDisclosure = actions.filter((b) => !b.closest("details"));
      expect(outsideDisclosure).toHaveLength(1);
      expect(outsideDisclosure[0].textContent).toBe("ראה את העמדה");
    });

    it("says what the action is FOR, not that the product wants the click", () => {
      show([confidentAndCostly]);
      expect(document.querySelector(".finding__because")?.textContent).toBeTruthy();
    });

    it("renders one headline, one example and one evidence mark", () => {
      show([confidentAndCostly]);
      expect(within(card()).getAllByRole("heading", { level: 2 })).toHaveLength(1);
      expect(card().querySelectorAll(".finding__example")).toHaveLength(1);
      expect(card().querySelectorAll(".evidence-mark")).toHaveLength(1);
    });

    it("shows the example BEFORE the evidence level and the action, in the DOM order", () => {
      /*
       * §7: the concrete case before anything aggregate. Asserted on document position rather than
       * on CSS, because a stylesheet can reorder a grid and a screen reader will not follow it.
       */
      show([confidentAndCostly]);
      const example = card().querySelector(".finding__example")!;
      const authority = card().querySelector(".finding__authority")!;
      const action = card().querySelector(".finding__action")!;
      expect(example.compareDocumentPosition(authority)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(authority.compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe("the evidence language", () => {
    it("marks a single game as a single event, whatever it found", () => {
      show([confidentAndCostly]);
      const mark = card().querySelector(".evidence-mark")!;
      expect(mark.getAttribute("data-authority")).toBe("one-event");
      expect(mark.textContent).toContain(AUTHORITY["one-event"].word);
    });

    it("refuses to prescribe anything from one game, and says so out loud", () => {
      show([confidentAndCostly]);
      expect(card().querySelector(".finding__restraint")?.textContent).toContain(
        "לא סיבה לשנות משהו",
      );
    });

    it("takes the WATCHED thing's authority in state C, not the event's", () => {
      /*
       * The whole content of §24's third state. The decision is still one decision; what changed is
       * that it landed inside something the product had already committed to looking at, and how
       * much THAT counts is what the reader needs.
       */
      show([confidentAndCostly], game(), {
        key: "fast-under-45s",
        scope: "החלטות תחת פחות מ-45 שניות",
        authority: "hypothesis",
        soFar: 24,
      });
      const mark = card().querySelector(".evidence-mark")!;
      expect(mark.getAttribute("data-authority")).toBe("hypothesis");
      expect(screen.getByText(/סך הכול 25/)).toBeTruthy();
    });

    it("adds the count itself, so no screen adds two numbers it was handed", () => {
      show([confidentAndCostly, decision(9, { thinkMs: 900, confidence: 3, cpLoss: 5 })], game(), {
        key: "fast-under-45s",
        scope: "החלטות תחת פחות מ-45 שניות",
        authority: "recurred",
        soFar: 10,
      });
      expect(screen.getByText(/2 החלטות חדשות נכנסו/)).toBeTruthy();
      expect(screen.getByText(/סך הכול 12/)).toBeTruthy();
    });
  });

  describe("the buttons do what they say", () => {
    it("opens the position the headline is about", async () => {
      const { seePosition } = show([plainBlunder, confidentAndCostly]);
      await userEvent.click(screen.getByText("ראה את העמדה"));
      expect(seePosition).toHaveBeenCalledTimes(1);
      expect(seePosition.mock.calls[0][0].ply).toBe(confidentAndCostly.ply);
    });

    it("starts a new game from the button outside the card", async () => {
      const { playAgain } = show([confidentAndCostly]);
      await userEvent.click(screen.getByText("משחק חדש"));
      expect(playAgain).toHaveBeenCalledTimes(1);
    });

    it("makes the card's action a new game when there is no position to show", async () => {
      const { playAgain, seePosition } = show([decision(1, { cpLoss: 5, confidence: 4 })]);
      await userEvent.click(screen.getByText("שחק עוד משחק"));
      expect(playAgain).toHaveBeenCalledTimes(1);
      expect(seePosition).not.toHaveBeenCalled();
    });
  });
});
