/**
 * A real blitz game, played inside the product, measured without changing what is measured.
 *
 * ITS OWN ROUTE AND ITS OWN MODULE, and that is not a style preference. `Home.tsx` is under a
 * committed ratchet at 2,400 lines and 55 `useState` that only ever goes down, so a fifty-sixth
 * piece of state there fails the build. More to the point, the two loops disagree about the thing
 * that matters most: the untimed loop runs the engine after every decision, and this one may not
 * run it at all until the game is over.
 *
 * WHAT THIS SCREEN IS RESPONSIBLE FOR, and it is deliberately little: turning clicks into calls on
 * `shared/blitz-game-core.ts`, painting what that returns, and asking the instrument's question
 * after -- never before -- a commit. Every rule about clocks, flags and think times lives in the
 * core, which has no way to reach a screen, an engine or a record.
 *
 * TWO ENGINES, ONE BINARY (INV-11). The opponent's engine produces a move and never an evaluation;
 * the analysis engine produces evaluations and does not exist until the game is over. They are
 * separate instances so that "did an evaluation exist before the confidence was stated?" has an
 * auditable answer rather than a hopeful one.
 *
 * THE TICK PAINTS, IT DOES NOT KEEP TIME. `setInterval` here does one thing: bump a number so React
 * re-renders. Every clock shown is `remainingMs(game, side, performance.now())` -- a subtraction of
 * two marks -- so a tick that fires late, twice, or not at all changes what is on screen and cannot
 * change what is recorded.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/ChessBoard";
import { chooseOpponentMove, DEFAULT_OPPONENT_DEPTH } from "@/lib/opponent";
import type { StockfishClient } from "@/lib/stockfish";
import { ENGINE_NAME, engineBuildId } from "@/lib/engine-identity";
import {
  commit,
  hasFlagged,
  newGame,
  observe,
  remainingMs,
  resign,
  type BlitzState,
  type RequiredTimeControl,
  type Side,
} from "@shared/blitz-game-core";
import {
  answer,
  awaitingAnswer,
  mayRevealOpponentMove,
  newSession,
  recordCommitted,
  type InstrumentSession,
} from "@shared/blitz-instrument";
import { isFinished } from "@shared/blitz-post-game";
import { toPendingRecord, isRefusal } from "@shared/blitz-record";
import { readBlitzGame, type BlitzEvent } from "@shared/blitz-reading";
import { PostGame } from "@/components/PostGame";
import { useSaveBlitzGame } from "@/lib/record-api";
import { useBlitzAnalysis, useStoredBlitzRecord } from "@/lib/use-blitz-analysis";
import { rememberTimeControl, rememberedTimeControl } from "@/lib/remembered-setup";

/** Two time controls are the same one when both halves agree. Compared, never referenced. */
const sameControl = (a: RequiredTimeControl, b: RequiredTimeControl) =>
  a.initialMs === b.initialMs && a.incrementMs === b.incrementMs;

const CONTROLS: { label: string; tc: RequiredTimeControl }[] = [
  { label: "3+0", tc: { initialMs: 180_000, incrementMs: 0 } },
  { label: "3+2", tc: { initialMs: 180_000, incrementMs: 2_000 } },
  { label: "5+0", tc: { initialMs: 300_000, incrementMs: 0 } },
  { label: "5+5", tc: { initialMs: 300_000, incrementMs: 5_000 } },
];

/** `m:ss`, and never a negative number on screen. */
function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const PLAYER: Side = "w";

/**
 * HOW DEEP THE POST-GAME SEARCH GOES, named because it is now written down as well as used.
 *
 * It was a literal inside the `analyze` call, which was fine while nothing else needed to know it.
 * The stored record now carries the depth that produced its cp-losses, and a record claiming a
 * depth the search did not use is worse than a record claiming nothing: the two would be
 * indistinguishable afterwards, and every comparison across builds would silently pool them.
 * One constant, read by the call and by the provenance, so they cannot drift apart.
 */
const ANALYSIS_DEPTH = 12;

/**
 * Why a played game was not kept, in words rather than in the join's own vocabulary.
 *
 * Every one of these is a bug upstream, not something the player did, so none of them asks them to
 * try anything: they say what happened to the game and stop.
 */
const REFUSAL_NOTICE: Record<string, string> = {
  "counts-disagree":
    "המשחק הסתיים ונותח, אבל לא נשמר: המהלכים, השאלות והניתוח לא הסכימו על כמה החלטות היו.",
  "plies-disagree":
    "המשחק הסתיים ונותח, אבל לא נשמר: השאלות והניתוח לא הצביעו על אותם מהלכים.",
  "moves-disagree":
    "המשחק הסתיים ונותח, אבל לא נשמר: המנוע ניתח מהלך אחר מזה ששוחק.",
  "no-decisions": "לא היו החלטות במשחק הזה, אז אין מה לשמור.",
};

export default function Blitz() {
  const [game, setGame] = useState<BlitzState>({ phase: "idle" });
  const [session, setSession] = useState<InstrumentSession>(newSession());
  const [, setPaint] = useState(0);
  const [selected, setSelected] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  /*
   * WHETHER THE PENDING WRITE HAS GONE OUT, AND NOTHING MORE.
   *
   * The RECORD is read back from the store (`useStoredBlitzRecord` below), not held here. A screen
   * that kept its own copy would be the one thing in the product still able to say `pending` about
   * a game the queue had finished — see the note where the engine used to run.
   */
  const [written, setWritten] = useState(false);
  /** A position the player asked to look at, from the post-game list. Null while none is open. */
  const [reviewing, setReviewing] = useState<BlitzEvent | null>(null);
  /*
   * WHEN THE GAME HAPPENED, IN A REF RATHER THAN STATE. Nothing renders these, so state would only
   * buy re-renders during a timed game -- which is the one place in this product where a wasted
   * render is a measurement error rather than a nuisance.
   *
   * `Date.now()` here and `performance.now()` everywhere the clock is computed: a wall-clock
   * reading is what a timestamp IS, and it is never subtracted from another to make a duration.
   */
  const played = useRef<{
    gameId: string;
    startedAt: string;
    finishedAt: string | null;
    /*
     * `saved` IS THIS TAB'S ANSWER TO "HAS THE PENDING WRITE GONE OUT?", AND ONLY THAT.
     *
     * It is not an idempotency guard -- `saveBlitzGame` owns that, and owns it across reloads, a
     * second tab and a retried request, which a ref cannot see. What it stops is narrower and real:
     * this effect runs on every state change while the game is finished, and without the flag it
     * would fire a second identical mutation before the first response lands. It is also the
     * ordering constraint the analysis write reads -- an `attach` that overtakes its own insert
     * matches zero rows and reports a game that was never stored.
     *
     * It goes back to `false` if the write fails, because then it is again true that no pending
     * record exists, and the notice tells the player exactly that.
     */
    saved: boolean;
  }>({
    gameId: "",
    startedAt: "",
    finishedAt: null,
    saved: false,
  });
  /*
   * THE RECORD AS THE STORE HAS IT, and the queue's progress beside it.
   *
   * Two different facts and the screen needs both: the record says whether the engine has spoken,
   * and the progress says whether it is speaking right now. `analysisState: "pending"` is the same
   * stored value for "the queue has not reached this game" and "the queue is scoring it as we
   * speak", and those are two different sentences to a player.
   */
  const analysis = useBlitzAnalysis();
  const stored = useStoredBlitzRecord(written ? played.current.gameId : null);
  const saveGame = useSaveBlitzGame();

  /* The opponent's engine, and only that: the analysis engine lives in the queue now. */
  const opponentEngine = useRef<StockfishClient | null>(null);

  /* Repaint only. The authoritative reading is computed from marks at render time. */
  useEffect(() => {
    if (game.phase !== "running") return;
    const id = setInterval(() => setPaint((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [game.phase]);

  /* A flag is noticed whenever anybody looks, including when a hidden tab comes back. */
  useEffect(() => {
    if (game.phase !== "running") return;
    if (hasFlagged(game, performance.now())) setGame(observe(game, performance.now()));
  });

  const ensure = useCallback(async (slot: typeof opponentEngine) => {
    if (slot.current) return slot.current;
    const { StockfishClient } = await import("@/lib/stockfish");
    slot.current = new StockfishClient(() => {});
    return slot.current;
  }, []);

  /*
   * THE OPPONENT MOVES ONLY AFTER THE QUESTION IS CLOSED. Computing it while a question is open
   * would be fine -- the player's clock is stopped -- but SHOWING it is not, and the simplest way
   * not to show it early is not to have it early.
   */
  useEffect(() => {
    if (game.phase !== "running" || game.active === PLAYER) return;
    if (!mayRevealOpponentMove(session)) return;
    let cancelled = false;
    void (async () => {
      const engine = await ensure(opponentEngine);
      const move = await chooseOpponentMove(
        game.fen,
        (fen, depth) => engine.analyze(fen, depth),
        DEFAULT_OPPONENT_DEPTH,
      );
      if (cancelled) return;
      if (!move.ok) {
        setNotice("היריב לא הצליח לשחק. אפשר להתחיל משחק חדש.");
        return;
      }
      setGame((current) => commit(current, { from: move.from, to: move.to }, performance.now()).state);
    })();
    return () => {
      cancelled = true;
    };
  }, [game, session, ensure]);

  /*
   * THE GAME IS ON THE RECORD BEFORE THE ENGINE STARTS, and this ordering is the whole point.
   *
   * It used to be the other way round: analyse every position, then write. A player who closed the
   * tab during the analysis lost the entire game -- the moves, both clocks, and the think times,
   * which nothing can reconstruct from anything else, because they were frozen at commit and exist
   * nowhere but in that record.
   *
   * The write is `pending`: no cp-loss, and a state that says so, because a null cp-loss on its own
   * would now mean two different things. `attachBlitzAnalysis` fills the verdict in afterwards.
   *
   * NOT CANCELLABLE, for the reason the second write already gives below: a component unmounting
   * between the game ending and the write is exactly the case this exists to survive.
   */
  useEffect(() => {
    if (!isFinished(game) || played.current.saved) return;
    const { gameId, startedAt } = played.current;
    if (!gameId) return;
    played.current.finishedAt ??= new Date().toISOString();
    const pending = toPendingRecord(game, session.decisions, {
      gameId,
      playedAs: PLAYER,
      startedAt,
      finishedAt: played.current.finishedAt,
      opponent: {
        kind: "engine",
        engine: ENGINE_NAME,
        build: engineBuildId(),
        depth: DEFAULT_OPPONENT_DEPTH,
      },
    });
    if (isRefusal(pending)) {
      setNotice(REFUSAL_NOTICE[pending.refused]);
      return;
    }
    played.current.saved = true;
    setWritten(true);
    void saveGame.mutateAsync(pending).catch(() => {
      played.current.saved = false;
      setNotice("המשחק הסתיים אבל לא נשמר. הוא ייעלם עם הדף.");
    });
  }, [game, session, saveGame]);

  /*
   * THE ENGINE DOES NOT RUN HERE ANY MORE (LAW 4).
   *
   * It used to, in an effect with a `cancelled` flag — so navigating away cancelled the search, and
   * the screen offering the navigation was `PostGame` saying "play another game". What followed was
   * a stored game marked `pending` that nothing would ever finish.
   *
   * `useBlitzAnalysis` owns it now: a page-level queue over the STORED record, which is why a later
   * page load, a second tab or a screen that never saw the game played can all finish it. This
   * screen reports its progress and reads the result back through `useStoredBlitzRecord`, which
   * makes the record — not the component — the answer to "has this been scored".
   */
  const onMove = (from: string, to: string) => {
    if (game.phase !== "running" || game.active !== PLAYER || awaitingAnswer(session)) return;
    const at = performance.now();
    const result = commit(game, { from, to, promotion: "q" }, at);
    setGame(result.state);
    setSelected(undefined);
    if (!result.accepted) return;
    const decisions = "decisions" in result.state ? result.state.decisions : [];
    const latest = decisions[decisions.length - 1];
    if (latest) setSession((s) => recordCommitted(s, latest, at));
  };

  const startGame = (tc: RequiredTimeControl) => {
    /*
     * REMEMBERED AT THE START AND NOT AT THE END, because a game that is abandoned mid-way was
     * still a choice the player made about how they wanted to play. Writing it on the finish would
     * forget every game that did not reach one, which is the set most likely to be a fast retry.
     */
    rememberTimeControl(tc);
    setNotice(null);
    setWritten(false);
    setReviewing(null);
    setSession(newSession());
    played.current = {
      gameId: `blitz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      saved: false,
    };
    setGame({ phase: "running", timeControl: tc, fen: new Chess().fen(), active: "w",
      clocksAtTurnStart: { w: tc.initialMs, b: tc.initialMs }, turnStartedAtMs: performance.now(),
      decisions: [], ply: 0 });
  };

  if (game.phase === "idle") {
    /*
     * READ AT RENDER AND NOT HELD IN STATE. It changes only when this screen writes it, and holding
     * a copy would be the same "the screen is the source of truth" mistake the analysis queue was
     * built to undo -- one browser, one value, read where it is used.
     */
    const remembered = rememberedTimeControl();
    return (
      <main className="blitz-setup">
        <h1>משחק בליץ</h1>
        <p>
          המהלך נרשם ראשון, השעון נעצר, ורק אחר כך נשאלת שאלת הביטחון — אם בכלל. המנוע לא רץ עד סוף
          המשחק.
        </p>
        {/*
          * THE ONE YOU PLAYED LAST TIME IS THE LOUD ONE (P1.10, LAW 2).
          *
          * Three buttons at one weight is the product asking a question whose answer has not
          * changed since the last game. Marking the remembered one removes the decision without
          * removing the choice: all three are still here, in the same place, one tap each.
          *
          * ABSENT ON A FIRST VISIT rather than defaulted to the first entry. "Nothing chosen yet"
          * and "3+0 chosen" are different facts, and painting one as the other would put a weight
          * on a control the player has never picked.
          */}
        <div className="blitz-controls">
          {CONTROLS.map(({ label, tc }) => {
            const again = remembered !== null && sameControl(remembered, tc);
            return (
              <button
                key={label}
                type="button"
                className={again ? "blitz-control blitz-control--again" : "blitz-control"}
                onClick={() => startGame(tc)}
              >
                {/*
                  * `dir="ltr"` ON THE RUN, AND IT IS A CORRECTNESS FIX RATHER THAN A TIDY-UP.
                  *
                  * `3+0` is digits and a plus in a document that runs right to left. On its own it
                  * resolves correctly; beside three more with nothing between them it does not --
                  * the four merge into one numeric run and the bidi algorithm lays its segments out
                  * right to left, so the player was offered `5+55+03+23+0`. `Home.tsx` already
                  * carries this exact fix for `7. Bb3`, which rendered as `Bb3 .7`.
                  *
                  * MARKED HERE RATHER THAN TRUSTED TO THE SPACING. The layout that now separates
                  * these controls would hide the problem; it would not solve it, and the next
                  * element placed beside one of them would bring it straight back.
                  */}
                <span dir="ltr">{label}</span>
                {again && <span className="blitz-control__again">שוב</span>}
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  const now = performance.now();
  /*
   * THE ONE BOARD'S TWO MODES (LAW 11). `final` is the game's own position; `review` is a position
   * from the record the player asked to look at. Same element, same place on the page, one FEN.
   */
  const boardSquares = new Chess(reviewing ? reviewing.fen : game.fen).board();
  const legal =
    selected && game.phase === "running"
      ? new Chess(game.fen).moves({ square: selected as never, verbose: true }).map((m) => m.to)
      : [];

  return (
    <main className="blitz">
      {/* Two clocks side by side, both Latin runs: `3:00` beside `2:47` merges the same way. */}
      <div className="blitz-clocks">
        <span dir="ltr" aria-label="שעון היריב">
          {clockText(remainingMs(game, "b", now))}
        </span>
        <span dir="ltr" aria-label="השעון שלך">
          {clockText(remainingMs(game, "w", now))}
        </span>
      </div>

      {/*
        * ONE BOARD, ONE STORY (LAW 11).
        *
        * It used to be two: the game's final position, and a second `<ChessBoard>` in a review
        * section beneath it showing move 23. The note that justified the second one argued that
        * replacing the first board's FEN would make the outcome sentence disagree with what was on
        * screen — a real problem, solved with the wrong instrument. The board does not need a twin;
        * it needs a MODE, and the sentence above it follows the mode instead of assuming the final
        * position.
        */}
      {reviewing && (
        <p className="blitz-board-mode" role="status">
          {/* The ply and the SAN are one Latin run inside a Hebrew sentence: `23: Nf3`, not `Nf3 :23`. */}
          מהלך <span dir="ltr">{reviewing.ply}: {reviewing.san}</span>
        </p>
      )}
      <ChessBoard
        board={boardSquares}
        orientation={PLAYER}
        selectedSquare={reviewing ? undefined : selected}
        legalTargets={reviewing ? [] : legal}
        onSelect={reviewing ? () => {} : setSelected}
        onMove={reviewing ? () => {} : onMove}
      />
      {reviewing && (
        <button type="button" className="blitz-board-back" onClick={() => setReviewing(null)}>
          חזרה לעמדה הסופית
        </button>
      )}

      {awaitingAnswer(session) && (
        <div className="blitz-confidence" role="group" aria-label="כמה אתה בטוח במהלך">
          <p>כמה אתה בטוח במהלך שעשית?</p>
          {[1, 2, 3, 4, 5, 6, 7].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSession((s) => answer(s, value, performance.now()))}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {notice && <p role="status">{notice}</p>}

      {game.phase === "finished" && !reviewing && (
        <section className="blitz-over">
          <h2>המשחק נגמר</h2>
          <p>{describeOutcome(game.outcome)}</p>
          {/*
            * FINISHED → WAIT_ANALYSIS → RESULT, as three states rather than one screen with holes.
            *
            * `undefined` is the rows still loading, `null` is a game the store does not have, and a
            * record whose `analysisState` is `pending` is a game the queue has not reached. The
            * last of those is the state every game passes through, and the old screen showed it as
            * "מנתח…" whether or not anything was actually running.
            */}
          {stored === undefined ? (
            <p role="status">שומר…</p>
          ) : stored === null ? (
            /*
             * WRITTEN AND NOT READABLE. The pending write refused, and `notice` above already says
             * why in the player's own terms. Repeating it here would be the same sentence twice.
             */
            null
          ) : (
            <>
              {/*
                * THE QUEUE'S PROGRESS, AND ONLY WHILE IT IS THIS GAME. A player watching "3 of 24"
                * against a game they did not just play would be watching somebody else's backlog.
                */}
              {analysis.scoring === stored.game.gameId && (
                <p className="blitz-analysing" role="status">
                  מנתח את המשחק… {analysis.done} מתוך {analysis.of}
                </p>
              )}
              <PostGame
                game={stored.game}
                reading={readBlitzGame(stored.game, stored.decisions)}
                analysed={stored.decisions.length}
                onSeePosition={setReviewing}
                onPlayAgain={() => setGame({ phase: "idle" })}
              />
              {/*
                * LAW 4, SAID OUT LOUD. The old screen could not offer this, because leaving
                * cancelled the search. It can now, and saying so is the difference between a player
                * who waits because they were told to and one who waits because they are guessing.
                */}
              {analysis.scoring === stored.game.gameId && (
                <p className="blitz-analysing-note">אפשר להמשיך. המשחק ינותח גם אם תצא מכאן.</p>
              )}
            </>
          )}
        </section>
      )}

      {game.phase === "running" && (
        /* The way out of a game, at the weight of a way out: the primary action is the board. */
        <button
          type="button"
          className="blitz-resign"
          onClick={() => setGame(resign(game, PLAYER))}
        >
          פרישה
        </button>
      )}
    </main>
  );
}

function describeOutcome(outcome: Extract<BlitzState, { phase: "finished" }>["outcome"]): string {
  switch (outcome.kind) {
    case "flag":
      return outcome.loser === PLAYER ? "נגמר לך הזמן." : "ליריב נגמר הזמן.";
    case "checkmate":
      return outcome.loser === PLAYER ? "מט. הפסדת." : "מט. ניצחת.";
    case "resignation":
      return outcome.loser === PLAYER ? "פרשת." : "היריב פרש.";
    case "draw":
      return "תיקו.";
  }
}
