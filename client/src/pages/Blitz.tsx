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

export default function Blitz() {
  const [game, setGame] = useState<BlitzState>({ phase: "idle" });
  const [session, setSession] = useState<InstrumentSession>(newSession());
  const [, setPaint] = useState(0);
  const [selected, setSelected] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<AnalysedDecision[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  /* The engine speaks for the first time here, and not one moment earlier. */
  useEffect(() => {
    if (!isFinished(game) || analysis !== null) return;
    let cancelled = false;
    void (async () => {
      const engine = await ensure(analysisEngine);
      const scored = await analyseFinishedGame(game, async (fen) => {
        const line = await engine.analyze(fen, 12);
        return line.scoreCp ?? null;
      });
      if (!cancelled && Array.isArray(scored)) setAnalysis(scored);
    })();
    return () => {
      cancelled = true;
    };
  }, [game, analysis, ensure]);

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
    setSession(newSession());
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
          <p>{analysis ? `${analysis.length} החלטות נותחו אחרי המשחק.` : "מנתח…"}</p>
          <button type="button" onClick={() => setGame({ phase: "idle" })}>
            משחק חדש
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
