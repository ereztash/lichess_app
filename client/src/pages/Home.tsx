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
import { NewGameSetup } from "@/components/NewGameSetup";
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
/*
 * Imported statically, and that is correct here: opponent.ts reaches chess.js and nothing else.
 * It does NOT import the engine -- it takes the search in as an argument -- so it adds no edge
 * to stockfish.ts and cannot pull the wasm into the initial graph. (It was briefly behind a
 * dynamic import as well, which bought nothing: a module imported both ways lands in the static
 * chunk anyway, so the dynamic form only made the code claim a split the build did not make.)
 */
import {
  chooseOpponentMove,
  DEFAULT_OPPONENT_DEPTH,
  OPPONENT_DEPTHS,
  OPPONENT_FAILURE_TEXT,
  type OpponentDepth,
} from "@/lib/opponent";
import { isStale, type EngineLine, type EngineStatus } from "@/lib/engine-line";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";

const INITIAL_STATUS: EngineStatus = { mode: "loading", detail: "המנוע ידלק אחרי ההחלטה" };

/**
 * Who is playing the other side, if anyone.
 *
 * null is the original behaviour and stays the default for an imported or finished game: there
 * the other side's moves are already in the PGN and an opponent would be inventing a different
 * game. It is only a live game that needs someone across the board.
 */
type Opponent = { playerColor: "w" | "b"; depth: OpponentDepth };

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

  // --- The opponent ------------------------------------------------------------------------
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [opponentThinking, setOpponentThinking] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);
  const [setupColor, setSetupColor] = useState<"w" | "b">("w");
  const [setupDepth, setSetupDepth] = useState<OpponentDepth>(DEFAULT_OPPONENT_DEPTH);
  /** The position the opponent has already been asked about, so it is asked exactly once. */
  const answeredFen = useRef<string | null>(null);

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
   * The engine is constructed LAZILY, at the point it is first needed.
   *
   * This comment used to say the engine must never load before a decision is recorded, because
   * loading the wasm is network activity and R3 forbids the engine appearing in the network tab
   * while the commitment screen is up. That claim was too wide, and the opponent is what showed
   * it: someone has to play the other side, and a player who takes black must be answered
   * before they have decided anything at all.
   *
   * The narrower rule, which is the one R3 actually needs: no engine output ABOUT THE PLAYER'S
   * PENDING DECISION reaches the player before they commit. That still holds, structurally --
   * chooseOpponentMove is handed the search and returns a move, so nothing downstream is ever
   * holding a score or a principal variation to render, and `analysis`, which the reveal reads,
   * is untouched by the opponent. GATE-COMMIT's two conditions are unchanged.
   *
   * So the engine can now be in the network tab before the first commit of a game with an
   * opponent, and that is a deliberate narrowing rather than an oversight.
   */
  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      // Dynamic import, still: a static one puts stockfish.ts, its ?url asset imports and the
      // 7MB wasm into the INITIAL module graph, so the engine loads on page open whether or not
      // a game is being played. Verified in a browser: a static import fetched
      // stockfish-18-lite-single.wasm before any decision was recorded. GATE-COMMIT enforces it.
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
   * The opponent replies.
   *
   * Keyed on the POSITION, not on the commit, so one rule covers both cases: the reply after the
   * player's committed move is played, and the opening move of a game the player took as black.
   *
   * On R3. This is the one path that loads the engine before a decision has been recorded, and
   * that is deliberate: an opponent has to move, and a game where nobody moves is what this
   * whole change exists to fix. What R3 forbids is the machine answering the player's decision
   * before the player has made it, and that stays enforced structurally -- chooseOpponentMove
   * returns a move and nothing else, so the search's score, depth and principal variation are
   * discarded at the boundary and no part of the UI is ever handed them. `analysis`, which is
   * what the reveal renders, is not touched here. GATE-COMMIT's two conditions are unchanged:
   * the engine is still absent from the initial module graph, and the pre-commit reveal payload
   * still carries no engine output.
   */
  useEffect(() => {
    if (!opponent || source !== "live" || inDrill) return;
    // Never while a reveal is on screen: the opponent moving then would change the position the
    // reveal is describing, out from under it.
    if (stage !== "deciding") return;
    if (activeGame.turn() === opponent.playerColor) return;
    if (activeGame.isGameOver()) return;
    if (answeredFen.current === activeFen) return;
    answeredFen.current = activeFen;

    let cancelled = false;
    void (async () => {
      setOpponentThinking(true);
      try {
        const engine = await ensureEngine();
        const move = await chooseOpponentMove(
          activeFen,
          (fen, depth) => engine.analyze(fen, depth),
          opponent.depth,
        );
        if (cancelled) return;
        if (!move.ok) {
          // Four different causes, four different sentences. "The opponent did not move" would
          // have said the same thing for a finished game and a broken engine.
          setNotice(OPPONENT_FAILURE_TEXT[move.reason]);
          return;
        }
        playMove(move.from, move.to);
        setNotice("היריב שיחק. תורכם: בחרו מהלך וכתבו את הקריאה שלכם.");
      } finally {
        if (!cancelled) setOpponentThinking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opponent, source, inDrill, stage, activeFen, activeGame, ensureEngine, playMove]);

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

  /**
   * Back to deciding, carrying nothing forward from the decision just finished.
   *
   * Loading a game must NOT replay the move committed in the previous one. nextDecision plays
   * committedDraft.chosenMove, and importPgn / loadLichessGame / newGame all called it while a
   * committed draft from the old game was still in state -- so the first thing that happened to
   * a freshly loaded game was a move from a game that had already ended.
   */
  const resetDecision = (message: string) => {
    setStage("deciding");
    setAnalysis(null);
    setRevealInputs(null);
    setCommittedDraft(null);
    setCandidateMove(null);
    setCandidatesConsidered([]);
    setCommitError(undefined);
    setNotice(message);
  };

  const nextDecision = () => {
    if (drill && drillStage === "running") {
      void advanceDrill();
      return;
    }
    // Play the move that was committed, then hand over the next position. If an opponent is
    // configured it answers from the effect below, which watches the position rather than this
    // call -- that way the opening move of a game the player takes as black is covered too.
    if (committedDraft?.chosenMove) {
      const move = uciToSquares(committedDraft.chosenMove);
      if (move) playMove(move.from, move.to);
    }
    resetDecision("בחרו מהלך וכתבו את הקריאה שלכם.");
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
      // No opponent for a loaded game: the other side's moves are already in the PGN.
      setOpponent(null);
      answeredFen.current = null;
      resetDecision(`נטענו ${loaded.length} חצאי־מהלכים.`);
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
      setOpponent(null);
      answeredFen.current = null;
      resetDecision(`נטען ${game.white} מול ${game.black} — ${loaded.length} חצאי־מהלכים.`);
    } catch {
      setNotice(`לא הצלחתי לקרוא את ה־PGN של המשחק ${game.id}.`);
    }
  };

  /**
   * Start a game that can actually be played.
   *
   * Before this took arguments there was no opponent at all: "new game" laid out the starting
   * position and then asked the player to decide for both colours, one commit-and-reveal cycle
   * per half-move. Choosing a colour is what makes the other side someone else's.
   */
  const newGame = (playerColor: "w" | "b", depth: OpponentDepth) => {
    setHistory([]);
    setCurrentPly(-1);
    setPgnInput("");
    setSource("live");
    gameId.current = `live-${Date.now()}`;
    setOpponent({ playerColor, depth });
    setOrientation(playerColor);
    answeredFen.current = null;
    setShowNewGame(false);
    resetDecision(
      playerColor === "w"
        ? `משחק חדש. אתם משחקים לבן ופותחים. היריב הוא Stockfish בעומק ${depth}.`
        : `משחק חדש. אתם משחקים שחור; היריב פותח. הוא Stockfish בעומק ${depth}.`,
    );
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
          <button
            className="rail-button prominent"
            aria-expanded={showNewGame}
            onClick={() => {
              setShowNewGame((v) => !v);
              setShowPgn(false);
              setShowImport(false);
            }}
          >
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

          {showNewGame && (
            <NewGameSetup
              color={setupColor}
              depth={setupDepth}
              onColor={setSetupColor}
              onDepth={setSetupDepth}
              onStart={() => newGame(setupColor, setupDepth)}
              onCancel={() => setShowNewGame(false)}
            />
          )}

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
              /* The player's own proposal, while deciding. Not the same mark as the engine's
                 arrow above: one is a guess, the other is an answer. */
              chosenMove={
                stage === "deciding" && candidateMove ? uciToSquares(candidateMove) : undefined
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

          {/*
            * The opponent thinking, said out loud. The whole defect this replaces was a board
            * that changed nothing while something was happening, so a silent search would put
            * it straight back.
            */}
          {opponentThinking && (
            <p className="opponent-thinking" role="status">
              היריב חושב…
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
