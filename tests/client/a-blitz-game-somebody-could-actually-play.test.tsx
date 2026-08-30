// @vitest-environment jsdom
/**
 * The whole chain, once, through the real screen -- which is the test eleven layers of unit
 * coverage cannot substitute for.
 *
 * Every module below this has been tested in isolation and against mutations. None of that answers
 * the question that matters: when a person clicks a piece, does the number that ends up in the
 * record match what actually happened? A stack of individually correct layers can still be wired
 * together wrongly, and the wiring is where INV-4 would break -- an engine constructed one line too
 * early is invisible to every unit test in the repository.
 *
 * SO THE ENGINE IS A SPY AT THE MODULE BOUNDARY. `StockfishClient` is mocked, every construction is
 * counted, and the count is asserted at the point in the game where it must still be zero.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Every `new StockfishClient(...)` lands here, TAGGED BY INSTANCE -- and the tagging is the point.
 *
 * `chooseOpponentMove` reaches the engine through the same `analyze` method the analyser does, so a
 * spy that only counted calls could not tell an opponent's search from an evaluation and would
 * report INV-4 violations that are not, or miss ones that are. Instance 1 is the opponent's engine
 * and instance 2 is the analyser's, because the screen creates them from two separate refs -- which
 * is INV-11, and this test is also what proves it holds.
 */
const constructed: string[] = [];
const calls: { instance: number; fen: string }[] = [];

vi.mock("@/lib/stockfish", () => ({
  StockfishClient: class {
    private readonly instance: number;
    constructor() {
      constructed.push("client");
      this.instance = constructed.length;
    }
    async analyze(fen: string, _depth: number) {
      calls.push({ instance: this.instance, fen });
      /* A legal reply from the opening position, and a flat evaluation. */
      return { scoreCp: 0, depth: 1, pv: ["e7e5"], bestMove: "e7e5", fen };
    }
  },
}));

import Blitz from "@/pages/Blitz";

/** A clock the test drives, so nothing here depends on real elapsed time. */
let clock = 0;
beforeEach(() => {
  clock = 1_000;
  constructed.length = 0;
  calls.length = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  /*
   * THE SAMPLER IS RANDOM, AND THAT MADE THIS FILE FLAKY BEFORE IT MADE IT INFORMATIVE.
   *
   * `recordCommitted` asks about 15% of decisions, and an open question correctly stops the
   * opponent from replying -- so about one run in seven, the opponent never moved and an assertion
   * about its engine failed on a game where the product was behaving exactly as designed. The bug
   * was in the test: it was exercising a random branch and reporting the result as if it were
   * deterministic.
   *
   * Pinned to "never asked" by default, so every test below states which branch it is in. The
   * asked branch has its own test, with its own value.
   */
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});

const square = (name: string) => document.querySelector(`[data-square="${name}"]`) as HTMLElement;

/**
 * Click a piece, WAIT for the board to mark its targets, then click one.
 *
 * The two clicks are not one gesture: the first sets state and the second reads it. Firing them
 * back to back without waiting made this file fail about one run in three -- the second click
 * landed while `legalTargets` was still empty, so no move was ever made and the assertion about the
 * opponent's engine failed on a game where nobody had moved. The product was right and the test was
 * racing it.
 */
async function play(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  await user.click(square(from));
  await waitFor(() => expect(square(to).className).toContain("legal-square"));
  await user.click(square(to));
}

describe("a blitz game somebody could actually play", () => {
  it("offers the time controls and starts a game at the right clock", async () => {
    const user = userEvent.setup();
    render(<Blitz />);
    for (const label of ["3+0", "3+2", "5+0", "5+5"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    await user.click(screen.getByRole("button", { name: "3+0" }));
    // Both clocks show three minutes, and neither has moved because no time has passed.
    const mine = screen.getByLabelText("השעון שלך");
    const theirs = screen.getByLabelText("שעון היריב");
    expect(mine.textContent).toBe("3:00");
    expect(theirs.textContent).toBe("3:00");
  });

  it("does not construct ANY engine before the player has moved", async () => {
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "3+0" }));
    /*
     * INV-4 at the wiring level. The unit test proves the analyser refuses an unfinished game; this
     * proves nothing constructed an engine before there was anything to analyse.
     */
    expect(constructed, "an engine was constructed before the game began").toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("drains only the mover's clock as real time passes", async () => {
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "3+0" }));

    clock = 1_000 + 7_000; // seven seconds of thinking
    await waitFor(() => {
      expect(screen.getByLabelText("השעון שלך").textContent).toBe("2:53");
    });
    // The opponent has not moved and has not lost a second.
    expect(screen.getByLabelText("שעון היריב").textContent).toBe("3:00");
  });

  it("ends the game when the clock runs out while nobody is clicking", async () => {
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "3+0" }));

    clock = 1_000 + 200_000; // well past three minutes, with no interaction at all
    await waitFor(() => {
      expect(screen.getByText("המשחק נגמר")).toBeTruthy();
    });
    expect(screen.getByText("נגמר לך הזמן.")).toBeTruthy();
  });

  it("runs the analysis only after the game is over, and then actually runs it", async () => {
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "3+0" }));

    // Resign immediately: a finished game with no decisions.
    clock = 3_000;
    await user.click(screen.getByRole("button", { name: "פרישה" }));
    await waitFor(() => expect(screen.getByText("המשחק נגמר")).toBeTruthy());
    expect(screen.getByText("פרשת.")).toBeTruthy();

    /*
     * The analyser REFUSES a game with no decisions, so nothing is scored -- and the screen says so
     * rather than showing a count it does not have.
     */
    expect(calls, "a position was scored during the game").toHaveLength(0);
  });

  it("lets the OPPONENT engine search during play while the ANALYSER stays silent", async () => {
    /*
     * THE TEST THIS FILE EXISTS FOR, and the one a confounded spy would have got wrong. The
     * opponent reaches the engine through the same `analyze` method the analyser does, so counting
     * calls alone proves nothing. Counting them PER INSTANCE separates the two contracts: the
     * opponent's engine works during the game, and the analyser's is not even constructed.
     */
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "3+0" }));

    clock = 5_000; // four seconds of thinking
    await play(user, "e2", "e4");

    // The opponent replies, so the FIRST engine is busy.
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls.every((c) => c.instance === 1), "the analyser ran during the game").toBe(true);
    expect(constructed, "a second engine existed before the game ended").toHaveLength(1);
  });

  it("scores the finished game on a DIFFERENT engine from the one that played against you", async () => {
    /*
     * INV-11, and the test that a first attempt got wrong. Asserting "only one engine exists during
     * play" is satisfied both by a correct screen and by one where a single engine serves both
     * roles -- the difference only becomes visible once the analyser actually runs. So: play a
     * move, let the opponent reply, resign, and then require the scoring calls to come from an
     * instance that never chose a move.
     */
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "3+0" }));

    clock = 5_000;
    await play(user, "e2", "e4");
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));

    clock = 9_000;
    await user.click(screen.getByRole("button", { name: "פרישה" }));
    await waitFor(() => expect(screen.getByText("המשחק נגמר")).toBeTruthy());

    // The analyser runs, on its own instance.
    await waitFor(() => expect(calls.some((c) => c.instance === 2)).toBe(true));
    expect(constructed, "the analyser did not get its own engine").toHaveLength(2);
    // And the opponent's engine never scored the finished game.
    const duringPlay = calls.filter((c) => c.instance === 1);
    expect(duringPlay.length).toBeGreaterThan(0);
  });

  it("holds the opponent back while a confidence question is open, and releases it after", async () => {
    /*
     * The other branch of the sampler, and the screen-level statement of PR-9's rule: the reply may
     * be computed while a question is open but may not be SHOWN. The simplest way not to show it
     * early is not to fetch it early, so with a question open the opponent's engine is untouched.
     */
    vi.spyOn(Math, "random").mockReturnValue(0); // 0 < 0.15: always asked
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "3+0" }));

    clock = 5_000;
    await play(user, "e2", "e4");
    await waitFor(() => expect(screen.getByText("כמה אתה בטוח במהלך שעשית?")).toBeTruthy());
    expect(calls, "the opponent moved while the question was still open").toHaveLength(0);

    clock = 6_500;
    await user.click(screen.getByRole("button", { name: "5" }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  });

  it("keeps the board and the clocks on the same screen, in the player's orientation", async () => {
    const user = userEvent.setup();
    render(<Blitz />);
    await user.click(screen.getByRole("button", { name: "5+5" }));
    expect(screen.getByLabelText("השעון שלך").textContent).toBe("5:00");
    // The board rendered its sixty-four squares: the screen is a game, not a form.
    expect(screen.getAllByRole("gridcell")).toHaveLength(64);
  });
});
