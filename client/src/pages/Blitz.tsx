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
import { analyseFinishedGame, isFinished, type AnalysedDecision } from "@shared/blitz-post-game";
import {
  toPendingRecord,
  attachAnalysis,
  isRefusal,
  type StoredBlitzRecord,
} from "@shared/blitz-record";
import { readBlitzGame, type BlitzEvent } from "@shared/blitz-reading";
import { PostGame } from "@/components/PostGame";
import { useAttachBlitzAnalysis, useSaveBlitzGame } from "@/lib/record-api";

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
  const [analysis, setAnalysis] = useState<AnalysedDecision[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /*
   * THE RECORD THIS SCREEN JUST WROTE, HELD SO THE POST-GAME CAN READ IT.
   *
   * NOT REFETCHED FROM THE SERVER, and the reason is not latency. The reading must describe the
   * game the player just finished, and a refetch would describe whatever the store returns --
   * which, if the write failed, is the previous game or nothing, presented as this one. Holding the
   * object that was actually assembled means the screen and the write agree by construction.
   *
   * IT IS SET TWICE ON PURPOSE: once `pending`, so a player whose engine never answers still gets
   * a screen that says the engine never answered, and once `complete` when the analysis lands.
   */
  const [stored, setStored] = useState<StoredBlitzRecord | null>(null);
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
  const saveGame = useSaveBlitzGame();
  const attachGameAnalysis = useAttachBlitzAnalysis();

  /* Two clients, never one. See the module note. */
  const opponentEngine = useRef<StockfishClient | null>(null);
  const analysisEngine = useRef<StockfishClient | null>(null);

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
    setStored(pending);
    void saveGame.mutateAsync(pending).catch(() => {
      played.current.saved = false;
      setNotice("המשחק הסתיים אבל לא נשמר. הוא ייעלם עם הדף.");
    });
  }, [game, session, saveGame]);

  /* The engine speaks for the first time here, and not one moment earlier. */
  useEffect(() => {
    if (!isFinished(game) || analysis !== null) return;
    // Stamped before the search starts, so a slow engine does not lengthen the game it analysed.
    played.current.finishedAt ??= new Date().toISOString();
    let cancelled = false;
    void (async () => {
      const engine = await ensure(analysisEngine);
      const scored = await analyseFinishedGame(game, async (fen) => {
        const line = await engine.analyze(fen, ANALYSIS_DEPTH);
        return line.scoreCp ?? null;
      });
      if (!cancelled && Array.isArray(scored)) setAnalysis(scored);
    })();
    return () => {
      cancelled = true;
    };
  }, [game, analysis, ensure]);

  /*
   * THE GAME IS KEPT, ONCE, AFTER THE ENGINE HAS SPOKEN.
   *
   * Separate from the effect above rather than tacked onto its end, because that one is cancellable
   * and this must not be: a component unmounting between the analysis arriving and the write would
   * silently discard a played game.
   *
   * ONCE IS THE SERVICE'S JOB, NOT A REF HERE, and this had a component-level guard until a
   * mutation showed it did nothing. `saveBlitzGame` reads the record before writing and reports a
   * repeat as the no-op it is, which is the guarantee that actually holds -- across a reload, a
   * second tab, and a retry after a lost response, none of which a ref in this component survives.
   * A second mechanism that no test could distinguish from its own absence is not defence in depth,
   * it is a line nobody can ever safely delete.
   */
  useEffect(() => {
    if (!isFinished(game) || analysis === null || !played.current.saved) return;
    const { gameId, startedAt, finishedAt } = played.current;
    if (!gameId || !finishedAt) return;
    const pending = toPendingRecord(game, session.decisions, {
      gameId,
      playedAs: PLAYER,
      startedAt,
      finishedAt,
    });
    if (isRefusal(pending)) return;
    const record = attachAnalysis(pending, analysis, PLAYER, {
      engine: ENGINE_NAME,
      build: engineBuildId(),
      depth: ANALYSIS_DEPTH,
    }, new Date().toISOString());
    if (isRefusal(record)) {
      /*
       * A REFUSAL IS A BUG UPSTREAM, AND IT IS SAID OUT LOUD. The sources disagreed about which
       * plies happened, and storing a best-effort join would produce rows where a confidence
       * belongs to one move and a cp-loss to another -- undetectable afterwards, because every row
       * would look complete.
       *
       * WHAT IT COSTS IS NO LONGER THE GAME. The record was written before the engine ran, so a
       * refusal here leaves it stored and `pending` -- complete in everything the player did, and
       * honest about not having been scored. It used to mean the game was never written at all.
       */
      setNotice(REFUSAL_NOTICE[record.refused]);
      return;
    }
    /*
     * THE EXCEPTION'S OWN MESSAGE DOES NOT GO ON SCREEN. It is English, it names internals, and a
     * player reading it learns nothing they can act on.
     */
    setStored(record);
    void attachGameAnalysis.mutateAsync(record).catch(() => {
      setNotice("הניתוח לא נשמר. המשחק עצמו נשמר, והניתוח שלמעלה עדיין נכון.");
    });
  }, [game, analysis, session, attachGameAnalysis]);

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
    setNotice(null);
    setAnalysis(null);
    setStored(null);
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
    return (
      <main className="blitz-setup">
        <h1>משחק בליץ</h1>
        <p>
          המהלך נרשם ראשון, השעון נעצר, ורק אחר כך נשאלת שאלת הביטחון — אם בכלל. המנוע לא רץ עד סוף
          המשחק.
        </p>
        <div className="blitz-controls">
          {CONTROLS.map(({ label, tc }) => (
            <button key={label} type="button" onClick={() => startGame(tc)}>
              {label}
            </button>
          ))}
        </div>
      </main>
    );
  }

  const now = performance.now();
  const board = new Chess(game.fen).board();
  const legal =
    selected && game.phase === "running"
      ? new Chess(game.fen).moves({ square: selected as never, verbose: true }).map((m) => m.to)
      : [];

  return (
    <main className="blitz">
      <div className="blitz-clocks">
        <span aria-label="שעון היריב">{clockText(remainingMs(game, "b", now))}</span>
        <span aria-label="השעון שלך">{clockText(remainingMs(game, "w", now))}</span>
      </div>

      <ChessBoard
        board={board}
        orientation={PLAYER}
        selectedSquare={selected}
        legalTargets={legal}
        onSelect={setSelected}
        onMove={onMove}
      />

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

      {game.phase === "finished" && (
        <section className="blitz-over">
          <h2>המשחק נגמר</h2>
          <p>{describeOutcome(game.outcome)}</p>
          {/*
            * THE COUNT USED TO BE THE WHOLE SCREEN. It is now one row inside the disclosure, and
            * what stands in its place is a reading -- see `PostGame`. While the engine is still
            * running there is genuinely nothing to read, and saying "מנתח…" is the honest state
            * rather than a placeholder: the record already exists and is already safe.
            */}
          {stored === null ? (
            <p role="status">שומר…</p>
          ) : (
            <PostGame
              game={stored.game}
              reading={readBlitzGame(stored.game, stored.decisions)}
              analysed={stored.decisions.length}
              onSeePosition={setReviewing}
              onPlayAgain={() => setGame({ phase: "idle" })}
            />
          )}
          {analysis === null && stored !== null && <p role="status">מנתח…</p>}
        </section>
      )}

      {/*
        * THE POSITION THE PLAYER ASKED TO SEE, on its own board rather than by rewinding the game's.
        *
        * A SEPARATE BOARD, AND THAT IS NOT WASTE. The game's board shows the final position and is
        * what the outcome sentence refers to; replacing its FEN to show a mid-game position would
        * make the two disagree, and a player who then pressed "new game" would have been looking at
        * something the screen no longer described.
        */}
      {reviewing && (
        <section className="blitz-review" aria-label="העמדה שביקשת לראות" dir="rtl">
          <h3>
            מהלך {reviewing.ply}: {reviewing.san}
          </h3>
          <ChessBoard
            board={new Chess(reviewing.fen).board()}
            orientation={PLAYER}
            legalTargets={[]}
            onSelect={() => {}}
            onMove={() => {}}
          />
          <button type="button" onClick={() => setReviewing(null)}>
            סגור
          </button>
        </section>
      )}

      {game.phase === "running" && (
        <button type="button" onClick={() => setGame(resign(game, PLAYER))}>
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
