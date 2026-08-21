import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  Activity,
  Clipboard,
  FileUp,
  FlipVertical2,
  Link2,
  Moon,
  Plus,
  Sun,
  UserSearch,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Textarea } from "@/components/ui/textarea";
import { ChessBoard } from "@/components/ChessBoard";
import { EvaluationBar } from "@/components/EvaluationBar";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { RevealPanel } from "@/components/RevealPanel";
import { ClaimPanel } from "@/components/ClaimPanel";
import { DrillRunner, type DrillStage } from "@/components/DrillRunner";
import type { DrillSpec } from "@shared/claim";
import { LichessLayersPanel } from "@/components/LichessLayersPanel";
import { ImportGames } from "@/components/ImportGames";
/*
 * recharts is ~100KB and only matters once a game is being reviewed. A static import would put
 * it in the initial graph, which is the same weight mistake the engine import was -- the reason
 * engine-line.ts exists at all.
 */
const GameReview = lazy(() =>
  import("@/components/GameReview").then((m) => ({ default: m.GameReview })),
);
const GameReviewProgress = lazy(() =>
  import("@/components/GameReview").then((m) => ({ default: m.GameReviewProgress })),
);
/* Same reason: recharts stays out of the initial graph. */
const RecordDashboard = lazy(() =>
  import("@/components/RecordDashboard").then((m) => ({ default: m.RecordDashboard })),
);
import type { ImportedGame } from "@/lib/lichess-public";
import type { AnalysisSource } from "@shared/analysis-source";
import {
  useCommitDecision,
  useCompleteDrill,
  useDecisionCount,
  useRecordMode,
  useRecordReading,
  useReveal,
  useStartDrill,
} from "@/lib/record-api";
import { MoveTimeline } from "@/components/MoveTimeline";
import {
  buildHistory,
  DEFAULT_PGN,
  INITIAL_FEN,
  type GameSnapshot,
  type Orientation,
  uciToSquares,
} from "@/lib/game-data";
import {
  buildCommitEvent,
  cpLossFromSearches,
  engineMayRun,
  type DraftDecision,
  type SessionStage,
} from "@/lib/decision-session";
import type { RevealInputs } from "@/lib/reveal";
// TYPE-ONLY import: type imports are erased, so this creates no runtime edge to the engine
// module. The implementation is pulled in dynamically at first reveal -- see ensureEngine.
// Values (isStale, EngineLine) come from @/lib/engine-line, which has no asset imports.
import type { StockfishClient } from "@/lib/stockfish";
import { isStale, type EngineLine, type EngineStatus } from "@/lib/engine-line";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";

const INITIAL_STATUS: EngineStatus = { mode: "loading", detail: "המנוע ידלק אחרי ההחלטה" };

function snapshot(
  game: Chess,
  move: { san: string; from: string; to: string; color: "w" | "b" },
  ply: number,
): GameSnapshot {
  return { ply, san: move.san, from: move.from, to: move.to, color: move.color, fen: game.fen() };
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [history, setHistory] = useState<GameSnapshot[]>(() => buildHistory(DEFAULT_PGN));
  const [currentPly, setCurrentPly] = useState(12);
  const [orientation, setOrientation] = useState<Orientation>("w");
  const [selectedSquare, setSelectedSquare] = useState<string>();
  const [analysis, setAnalysis] = useState<EngineLine | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(INITIAL_STATUS);
  const [pgnInput, setPgnInput] = useState(DEFAULT_PGN);
  const [showImport, setShowImport] = useState(false);
  const [reviewScores, setReviewScores] = useState<number[] | null>(null);
  const [reviewProgress, setReviewProgress] = useState<{ done: number; total: number } | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showPgn, setShowPgn] = useState(false);
  const [source, setSource] = useState<AnalysisSource>("imported");
  const [notice, setNotice] = useState("בחרו מהלך וכתבו את הקריאה שלכם.");

  // --- R3 state machine ------------------------------------------------------------------
  const [stage, setStage] = useState<SessionStage>("deciding");
  const [candidateMove, setCandidateMove] = useState<string | null>(null);
  const [candidatesConsidered, setCandidatesConsidered] = useState<string[]>([]);
  const [commitError, setCommitError] = useState<string>();
  const [revealInputs, setRevealInputs] = useState<RevealInputs | null>(null);
  const [committedDraft, setCommittedDraft] = useState<DraftDecision | null>(null);
  const [revealFen, setRevealFen] = useState<string>("");
  const gameId = useRef(`local-${Date.now()}`);

  // --- Drill state ------------------------------------------------------------------------
  // A drill overrides where the board's position comes from. The decision protocol is
  // unchanged: same CommitmentScreen, same commit-before-reveal, same record.
  const [drill, setDrill] = useState<DrillSpec | null>(null);
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillDecisionIds, setDrillDecisionIds] = useState<string[]>([]);
  const [drillStage, setDrillStage] = useState<DrillStage>("briefing");
  const [drillVerdict, setDrillVerdict] = useState<{
    description: string;
    refuted: boolean;
  } | null>(null);
  const [drillError, setDrillError] = useState<string>();

  const engineRef = useRef<StockfishClient | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyMove = currentPly >= 0 ? history[currentPly] : undefined;
  const inDrill = drill !== null && drillStage === "running";
  // While a drill runs the board shows the drill's position, not the loaded game's.
  const activeMove = inDrill ? undefined : historyMove;
  const activeFen = inDrill
    ? (drill.fens[drillIndex] ?? INITIAL_FEN)
    : (historyMove?.fen ?? INITIAL_FEN);
  const activeGame = useMemo(() => new Chess(activeFen), [activeFen]);
  const board = activeGame.board();
  const sideToMove = activeGame.turn() === "w" ? "לבן" : "שחור";

  const material = useMemo(() => {
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    return board.flat().reduce(
      (t, piece) => {
        if (piece) t[piece.color === "w" ? "white" : "black"] += values[piece.type];
        return t;
      },
      { white: 0, black: 0 },
    );
  }, [board]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [];
    try {
      return activeGame.moves({ square: selectedSquare as never, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [activeGame, selectedSquare]);

  /*
   * The record runs on the server when signed in and in this browser when not. Both go through
   * the same shared service, so R3 and append-only hold either way -- see lib/record-api.ts.
   */
  const commitDecision = useCommitDecision();
  const startDrillMutation = useStartDrill();
  const completeDrillMutation = useCompleteDrill();
  const submitReveal = useReveal();
  const decisionCount = useDecisionCount();
  const recordReading = useRecordReading();

  /**
   * The engine is constructed LAZILY, on first reveal. Loading the wasm is network activity, so
   * doing it while the commitment screen is up would put the engine in the network tab before
   * the player has committed -- which R3 forbids just as much as rendering its output.
   */
  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      // Dynamic import: a static one puts stockfish.ts, its ?url asset imports, and the 7MB
      // wasm into the initial module graph, so the engine appears in the network tab while the
      // commitment screen is still up. Verified in a browser: static import fetched
      // stockfish-18-lite-single.wasm before any decision was recorded.
      const { StockfishClient } = await import("@/lib/stockfish");
      engineRef.current = new StockfishClient(setEngineStatus);
    }
    return engineRef.current;
  }, []);

  useEffect(() => () => engineRef.current?.dispose(), []);

  const runAnalysis = useCallback(async () => {
    if (!engineMayRun(stage)) return;
    try {
      const engine = await ensureEngine();
      const line = await engine.analyze(activeFen, 14);
      setAnalysis(line?.pv.length ? line : null);
    } catch (error) {
      if (error instanceof Error && error.message !== "Analysis superseded")
        setEngineStatus({ mode: "error", detail: "Stockfish לא החזיר קו חדש." });
    }
  }, [activeFen, ensureEngine, stage]);

  useEffect(() => {
    setSelectedSquare(undefined);
    // Deliberately NO auto-analysis on navigation. Browsing the timeline during a reveal used to
    // re-run the engine and overwrite the analysis the reveal was about, so the reveal silently
    // started describing a different position. The engine runs on commit, or when explicitly
    // asked. Browsing away simply makes the existing result stale, and it is marked as such.
  }, [activeFen]);

  const playMove = useCallback(
    (from: string, to: string) => {
      const game = new Chess(activeFen);
      try {
        const move = game.move({ from, to, promotion: "q" });
        setHistory((prev) => [
          ...prev.slice(0, currentPly + 1),
          snapshot(game, move, currentPly + 1),
        ]);
        setCurrentPly(currentPly + 1);
        return move.san;
      } catch {
        return null;
      }
    },
    [activeFen, currentPly],
  );

  /**
   * While deciding, a board interaction PROPOSES a move; it does not play it. The proposal and
   * every move looked at on the way to it are the data the record layer exists to capture.
   */
  const handleBoardMove = useCallback(
    (from: string, to: string) => {
      const uci = `${from}${to}`;
      if (stage !== "deciding") {
        if (!playMove(from, to)) setNotice("המהלך אינו חוקי בעמדה זו.");
        return;
      }
      try {
        new Chess(activeFen).move({ from, to, promotion: "q" });
      } catch {
        setNotice("המהלך אינו חוקי בעמדה זו.");
        return;
      }
      setCandidateMove(uci);
      setCandidatesConsidered((prev) => (prev.includes(uci) ? prev : [...prev, uci]));
      setNotice(`${uci} נבחר. אפשר עדיין לשנות עד לרישום.`);
    },
    [activeFen, playMove, stage],
  );

  const onCommit = useCallback(
    async (draft: DraftDecision, secondsTaken: number) => {
      setCommitError(undefined);
      setStage("committing");
      const decisionId = crypto.randomUUID();
      const isDrillDecision = drill !== null && drillStage === "running";
      try {
        const event = buildCommitEvent(
          decisionId,
          { gameId: gameId.current, fen: activeFen, ply: currentPly + 1, clockMsRemaining: null },
          draft,
          secondsTaken,
        );
        await commitDecision.mutateAsync(event);
      } catch (error) {
        // R2: a decision that was not stored must never look like one that was. We do not
        // advance to reveal, and we say what happened.
        setStage("deciding");
        setCommitError(
          error instanceof Error ? error.message : "ההחלטה לא נרשמה. לא נמשיך לחשיפה.",
        );
        return;
      }
      // Only now may the engine run at all.
      const positionFen = activeFen;
      setCommittedDraft(draft);
      setRevealFen(positionFen);
      setCandidateMove(null);
      setCandidatesConsidered([]);
      if (isDrillDecision) setDrillDecisionIds((prev) => [...prev, decisionId]);
      setStage("revealed");
      setNotice("ההחלטה נרשמה. המנוע מחשב עכשיו.");

      // The board deliberately does NOT advance here. The reveal describes the position the
      // player decided on, so that is the position that must stay on screen -- otherwise every
      // number in the reveal refers to something no longer visible and reads as permanently
      // stale. The move is played when the next decision starts.
      const move = uciToSquares(draft.chosenMove!);

      try {
        const engine = await ensureEngine();
        // Two searches: the position as the player faced it, and the position their move
        // produced. The second is scored from the opponent's side and must be flipped.
        const best = await engine.analyze(positionFen, 14);
        const after = new Chess(positionFen);
        after.move({ from: move!.from, to: move!.to, promotion: "q" });
        const chosen = await engine.analyze(after.fen(), 14);
        setAnalysis(best.pv.length ? best : null);

        const cpLoss = cpLossFromSearches(best.scoreCp, chosen.scoreCp);
        const bestMove = best.bestMove ?? draft.chosenMove!;
        const inputs: RevealInputs = {
          depth: Math.min(best.depth, chosen.depth),
          cpLoss,
          chosenMove: draft.chosenMove!,
          bestMove,
          chosenWasBest: bestMove === draft.chosenMove,
          confidence: draft.confidence!,
          statedUnknown: draft.unknown,
          cloudAvailable: false,
          repertoireGames: null,
          decisionsOnRecord: (decisionCount.data?.decisions ?? 0) + 1,
        };
        setRevealInputs(inputs);

        await submitReveal
          .mutateAsync({
            decision_id: decisionId,
            result: {
              engine_eval_cp: best.scoreCp,
              engine_best_move: bestMove,
              engine_depth: inputs.depth,
              engine_source: "local_sf18",
              cp_loss: cpLoss,
            },
          })
          .catch(() => {
            // The decision itself is on the record; only the engine's verdict failed to store.
            setNotice("ההחלטה נרשמה, אבל תוצאת המנוע לא נשמרה.");
          });
        void decisionCount.refetch();
      } catch {
        setEngineStatus({ mode: "error", detail: "המנוע לא סיים את החישוב." });
      }
    },
    [activeFen, commitDecision, currentPly, decisionCount, ensureEngine, playMove, submitReveal],
  );

  /** Ask the server for a drill. The refutation condition is stored there before it returns. */
  const beginDrill = useCallback(
    async (claimId: string) => {
      setDrillError(undefined);
      // Offer every position from the loaded game. The server decides which are usable by
      // excluding the ones already decided -- it holds decisions, not games.
      const candidates = history.map((snapshot) => snapshot.fen);
      if (candidates.length === 0) {
        setDrillError("אין משחק טעון שאפשר לקחת ממנו עמדות. טענו PGN קודם.");
        return;
      }
      try {
        const response = await startDrillMutation.mutateAsync({
          claim_id: claimId,
          candidate_fens: candidates,
        });
        if (!response.drill) {
          setDrillError(response.reason ?? "לא ניתן לבנות דריל כרגע.");
          return;
        }
        setDrill(response.drill);
        setDrillIndex(0);
        setDrillDecisionIds([]);
        setDrillVerdict(null);
        setDrillStage("briefing");
      } catch (error) {
        setDrillError(error instanceof Error ? error.message : "הדריל לא התחיל.");
      }
    },
    [history, startDrillMutation],
  );

  /** Advance to the next drill position, or close the drill and grade the claim. */
  const advanceDrill = useCallback(async () => {
    if (!drill) return;
    const next = drillIndex + 1;
    setAnalysis(null);
    setRevealInputs(null);
    setCommittedDraft(null);
    setCandidateMove(null);
    setCandidatesConsidered([]);
    setCommitError(undefined);

    if (next < drill.fens.length) {
      setDrillIndex(next);
      setStage("deciding");
      setNotice(`עמדה ${next + 1} מתוך ${drill.fens.length} בדריל.`);
      return;
    }

    setDrillStage("reporting");
    try {
      const result = await completeDrillMutation.mutateAsync({
        drill_id: drill.drill_id,
        decision_ids: drillDecisionIds,
      });
      // Reported either way -- a refutation is the result, not a failure to report.
      setDrillVerdict({
        description: result.description,
        refuted: result.claim.grade === "refuted",
      });
      setDrillStage("done");
    } catch (error) {
      setDrillError(error instanceof Error ? error.message : "לא ניתן היה לסגור את הדריל.");
      setDrillStage("done");
    }
  }, [completeDrillMutation, drill, drillDecisionIds, drillIndex]);

  const closeDrill = () => {
    setDrill(null);
    setDrillIndex(0);
    setDrillDecisionIds([]);
    setDrillVerdict(null);
    setDrillStage("briefing");
    setDrillError(undefined);
    setStage("deciding");
    setAnalysis(null);
    setRevealInputs(null);
    setCommittedDraft(null);
    setNotice("בחרו מהלך וכתבו את הקריאה שלכם.");
  };

  const nextDecision = () => {
    if (drill && drillStage === "running") {
      void advanceDrill();
      return;
    }
    // Play the move that was committed, then hand over the next position.
    if (committedDraft?.chosenMove) {
      const move = uciToSquares(committedDraft.chosenMove);
      if (move) playMove(move.from, move.to);
    }
    setStage("deciding");
    setAnalysis(null);
    setRevealInputs(null);
    setCommittedDraft(null);
    setCandidateMove(null);
    setCandidatesConsidered([]);
    setCommitError(undefined);
    setNotice("בחרו מהלך וכתבו את הקריאה שלכם.");
  };

  const importPgn = (pgn: string) => {
    try {
      const loaded = buildHistory(pgn);
      if (!loaded.length) throw new Error("empty");
      setHistory(loaded);
      setCurrentPly(loaded.length - 1);
      setPgnInput(pgn);
      setShowPgn(false);
      setSource("imported");
      gameId.current = `pgn-${Date.now()}`;
      nextDecision();
      setNotice(`נטענו ${loaded.length} חצאי־מהלכים.`);
    } catch {
      setNotice("לא הצלחתי לקרוא את ה־PGN.");
    }
  };

  /**
   * Load a game imported from Lichess by username.
   *
   * Source is "finished", not "imported": these are known-completed Lichess games, and the
   * fair-play guard keys off the source. The decision record keeps the real Lichess game id, so
   * a decision can be traced back to the game it was taken in.
   */
  /**
   * Review the whole game with the local engine.
   *
   * Deliberately NOT automatic. Analysing on load would put the engine's verdict on screen before
   * the player had committed to anything, which is R3 inverted -- the machine speaking first. It
   * is offered only once a decision in this game has been revealed, and it is still a button.
   */
  const runGameReview = useCallback(async () => {
    setReviewError(null);
    setReviewScores(null);
    /*
     * history[i].fen is the position AFTER ply i, and evalScores[0] must be the position before
     * anyone has moved -- that indexing is what makes evalScores[ply] mean what eval-analysis
     * thinks it means. Getting it wrong shifts every CPL by one move and blames the wrong one.
     */
    const positions = history.length ? [INITIAL_FEN, ...history.map((h) => h.fen)] : [];
    if (positions.length < 5) {
      setReviewError("המשחק קצר מכדי למדוד עליו משהו.");
      return;
    }
    setReviewProgress({ done: 0, total: positions.length });
    try {
      const engine = await ensureEngine();
      const { analyzePositions } = await import("@/lib/batch-analysis");
      const scores = await analyzePositions(
        positions,
        (fen, depth) => engine.analyze(fen, depth),
        { onProgress: setReviewProgress },
      );
      setReviewScores(scores);
    } catch (error) {
      // A review that failed must not render as a review that found nothing.
      setReviewError(error instanceof Error ? error.message : "הניתוח נכשל.");
    } finally {
      setReviewProgress(null);
    }
  }, [ensureEngine, history]);

  const loadLichessGame = (game: ImportedGame) => {
    try {
      const loaded = buildHistory(game.pgn);
      if (!loaded.length) throw new Error("empty");
      setHistory(loaded);
      setCurrentPly(loaded.length - 1);
      setPgnInput(game.pgn);
      setShowImport(false);
      setSource("finished");
      gameId.current = `lichess-${game.id}`;
      nextDecision();
      setNotice(`נטען ${game.white} מול ${game.black} — ${loaded.length} חצאי־מהלכים.`);
    } catch {
      setNotice(`לא הצלחתי לקרוא את ה־PGN של המשחק ${game.id}.`);
    }
  };

  const newGame = () => {
    setHistory([]);
    setCurrentPly(-1);
    setPgnInput("");
    setSource("live");
    gameId.current = `live-${Date.now()}`;
    nextDecision();
    setNotice("משחק חדש מוכן. לבן מתחיל.");
  };

  const openLichess = () => {
    if (isAuthenticated) {
      setNotice("Lichess מחובר — שכבות הניתוח זמינות מימין.");
      return;
    }
    const result = startLogin();
    if (!result.started) {
      // Name what is missing. A button that does nothing teaches the user nothing.
      setNotice(
        `ההתחברות אינה מוגדרת בפריסה הזו. חסר: ${result.missing.join(", ")}. ` +
          `שימו לב: משתני VITE_ נצרבים בזמן הבנייה — הוספה שלהם ב-Vercel בלי בנייה מחדש לא תשנה כלום.`,
      );
    }
  };

  /*
   * Where the record is being kept, said out loud.
   *
   * A player writes their reasoning into this thing. They are entitled to know whether it is
   * going to a server or staying on their machine, and whether it can be kept at all -- a private
   * window makes localStorage throw, and a decision that was not stored must never look like one
   * that was.
   */
  const recordMode = useRecordMode();

  const deciding = stage === "deciding" || stage === "committing";

  return (
    <main className="studio-shell" dir="rtl">
      <header className="studio-header">
        <div className="brand-lockup">
          <div className="brand-mark">♞</div>
          <div>
            <p className="brand-name">DECISION LAB</p>
            <span>COMMIT · THEN REVEAL</span>
          </div>
        </div>
        <div className="header-reading">
          <span>תור</span>
          <b>{sideToMove}</b>
        </div>
        <div className="header-actions">
          {stage === "revealed" && (
            <button className="primary-control" onClick={nextDecision}>
              ההחלטה הבאה
            </button>
          )}
          <button
            className="icon-control"
            aria-label="הפוך את הלוח"
            onClick={() => setOrientation((v) => (v === "w" ? "b" : "w"))}
          >
            <FlipVertical2 size={17} />
          </button>
          {toggleTheme && (
            <button
              className="icon-control"
              aria-label={theme === "dark" ? "עברו לתצוגה בהירה" : "עברו לתצוגה כהה"}
              aria-pressed={theme === "dark"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}
        </div>
      </header>

      <section className="workbench">
        <aside className="control-rail">
          <div className="rail-label">כלי עבודה</div>
          <button className="rail-button prominent" onClick={newGame}>
            <Plus size={18} />
            <span>משחק חדש</span>
          </button>
          <button className="rail-button" onClick={() => setShowPgn((v) => !v)}>
            <FileUp size={18} />
            <span>טעינת PGN</span>
          </button>
          <button
            className="rail-button"
            onClick={() => {
              setShowImport((v) => !v);
              setShowPgn(false);
            }}
          >
            <UserSearch size={18} />
            <span>ייבוא לפי שם</span>
          </button>
          <button className="rail-button" onClick={openLichess}>
            <Link2 size={18} />
            <span>Lichess</span>
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".pgn,text/plain"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) importPgn(await f.text());
            }}
          />
          <button className="rail-button" onClick={() => fileRef.current?.click()}>
            <FileUp size={18} />
            <span>קובץ</span>
          </button>
        </aside>

        <section className="board-workspace">
          <div className="workspace-meta">
            <div>
              <p>{deciding ? "DECIDE" : "REVEAL"}</p>
              {/* "7. Bb3" is a Latin run: under the page's RTL direction it rendered "Bb3 .7". */}
              <h1>
                {activeMove ? (
                  <span dir="ltr">{`${Math.ceil((activeMove.ply + 1) / 2)}. ${activeMove.san}`}</span>
                ) : (
                  "עמדת פתיחה"
                )}
              </h1>
            </div>
            <div className="turn-reading">
              <span>תור</span>
              <b>{sideToMove}</b>
            </div>
          </div>

          {showImport && (
            <ImportGames onLoad={loadLichessGame} onClose={() => setShowImport(false)} />
          )}

          {showPgn && (
            <section className="pgn-drawer">
              <div className="drawer-heading">
                <div>
                  <span>טעינת PGN</span>
                  <b>IMPORT</b>
                </div>
                <button onClick={() => setShowPgn(false)}>סגור</button>
              </div>
              <Textarea value={pgnInput} onChange={(e) => setPgnInput(e.target.value)} dir="ltr" />
              <div className="drawer-actions">
                <button className="drawer-confirm" onClick={() => importPgn(pgnInput)}>
                  טען למשחק
                </button>
              </div>
            </section>
          )}

          <div className="board-assembly">
            {/* The evaluation bar does not exist while deciding. Not hidden -- absent. */}
            {stage === "revealed" && <EvaluationBar analysis={analysis} currentFen={activeFen} />}
            <ChessBoard
              board={board}
              orientation={orientation}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              lastMove={activeMove ? { from: activeMove.from, to: activeMove.to } : undefined}
              /* STALE ARTIFACT (section 4.3): a suggested move computed for another position
                 must not remain on the board, where drag-and-drop keeps it actionable. */
              suggestedMove={
                stage === "revealed" && analysis && !isStale(analysis, activeFen)
                  ? uciToSquares(analysis.bestMove)
                  : undefined
              }
              onSelect={setSelectedSquare}
              onMove={handleBoardMove}
            />
          </div>

          {recordMode.local && (
            <p className={`record-mode ${recordMode.storable ? "" : "unstorable"}`}>
              {!recordMode.storable
                ? "הדפדפן חוסם אחסון מקומי (חלון פרטי או חסימת נתוני אתר), ולכן החלטה שתירשם לא תישמר. אל תסתמכו על הרשומה במצב הזה."
                : recordMode.serverBroken
                  ? "אתם מחוברים, אבל בשרת אין מאגר החלטות מוגדר (DATABASE_URL). הרשומה נשמרת בדפדפן הזה במקום — הלולאה עובדת, אבל היא לא תעבור בין מכשירים."
                  : "ההחלטות נשמרות בדפדפן הזה בלבד — לא נדרשת התחברות, והמידע לא עוזב את המחשב שלך."}
            </p>
          )}

          <div className="board-note">
            <i />
            {notice}
            <button
              onClick={async () => {
                await navigator.clipboard?.writeText(activeFen);
                setNotice("FEN הועתק.");
              }}
            >
              <Clipboard size={13} /> העתק FEN
            </button>
          </div>
        </section>

        <aside className="analysis-stack">
          {deciding ? (
            <CommitmentScreen
              position={{
                gameId: gameId.current,
                fen: activeFen,
                ply: currentPly + 1,
                clockMsRemaining: null,
              }}
              chosenMove={candidateMove}
              candidatesConsidered={candidatesConsidered}
              onCommit={onCommit}
              pending={stage === "committing"}
              error={commitError}
            />
          ) : null}
          {deciding && drill ? (
            <DrillRunner
              drill={drill}
              progress={{ completed: drillDecisionIds.length, total: drill.fens.length }}
              stage={drillStage}
              verdict={drillVerdict}
              error={drillError}
              onStart={() => {
                setDrillStage("running");
                setStage("deciding");
                setNotice(`עמדה 1 מתוך ${drill.fens.length} בדריל.`);
              }}
              onFinish={closeDrill}
            />
          ) : deciding ? (
            <ClaimPanel onRunDrill={beginDrill} drillError={drillError} />
          ) : (
            <>
              {revealInputs && committedDraft ? (
                <RevealPanel
                  inputs={revealInputs}
                  analysis={analysis}
                  fen={revealFen}
                  statedKnown={committedDraft.known}
                />
              ) : (
                <p className="reveal-waiting">המנוע מחשב את העמדה שהחלטת עליה…</p>
              )}
              <AnalysisPanel
                analysis={analysis}
                status={engineStatus}
                fen={activeFen}
                activeMove={activeMove}
                material={material}
                onAnalyze={() => void runAnalysis()}
              />
              {drill && drillStage === "running" && (
                <DrillRunner
                  drill={drill}
                  progress={{ completed: drillDecisionIds.length, total: drill.fens.length }}
                  stage={drillStage}
                  verdict={drillVerdict}
                  error={drillError}
                  onStart={() => undefined}
                  onFinish={closeDrill}
                />
              )}
              {/*
                THE GATE. The whole-game review is offered only at reveal -- after a decision in
                this game has been committed and the engine has already spoken about it. Showing
                it on import would put the machine first, which is the one thing this product is
                built not to do.
              */}
              {stage === "revealed" && (
                <>
                  {reviewProgress ? (
                    <Suspense fallback={null}>
                      <GameReviewProgress done={reviewProgress.done} total={reviewProgress.total} />
                    </Suspense>
                  ) : reviewScores ? (
                    <Suspense fallback={null}>
                      <GameReview
                        evalScores={reviewScores}
                        playerColor={orientation}
                        totalPlies={history.length}
                      />
                    </Suspense>
                  ) : (
                    <section className="analysis-section game-review">
                      <div className="section-heading">
                        <span>סקירת משחק</span>
                      </div>
                      <p className="layer-intro">
                        המנוע יעבור על כל העמדות במשחק וימדוד כמה עלה כל מהלך. זה רץ מקומית ולוקח
                        זמן — ולכן זה כפתור, לא משהו שקורה מעצמו.
                      </p>
                      {reviewError && <p className="layer-error">{reviewError}</p>}
                      <button className="layer-action" onClick={() => void runGameReview()}>
                        <Activity size={14} /> נתחו את המשחק כולו
                      </button>
                    </section>
                  )}
                </>
              )}

              {/*
                The record dashboard, next to the game review because both are reflection: this
                one measures the decisions, that one measures the positions. It needs no R3 gate
                -- it reads decisions already committed and revealed, so by construction it
                cannot speak before the player has.
              */}
              {recordReading.data && (
                <Suspense fallback={null}>
                  <RecordDashboard reading={recordReading.data} />
                </Suspense>
              )}

              <LichessLayersPanel
                fen={activeFen}
                source={source}
                enabled={isAuthenticated}
                onConnect={openLichess}
              />
            </>
          )}
        </aside>
      </section>

      <MoveTimeline moves={history} currentPly={currentPly} onNavigate={setCurrentPly} />
    </main>
  );
}
