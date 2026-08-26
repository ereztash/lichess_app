import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  Activity,
  ArrowRight,
  Clipboard,
  FlipVertical2,
  HelpCircle,
  History,
  Link2,
  Moon,
  Plus,
  Stethoscope,
  Sun,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Textarea } from "@/components/ui/textarea";
import { RecordModeNotice } from "@/components/RecordModeNotice";
import { ChessBoard } from "@/components/ChessBoard";
import { EvaluationBar } from "@/components/EvaluationBar";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { RevealPanel } from "@/components/RevealPanel";
import { ClaimPanel } from "@/components/ClaimPanel";
import { DrillRunner, type DrillStage } from "@/components/DrillRunner";
import { RevealFailure, type RevealFailureKind } from "@/components/RevealFailure";
import { ContextRibbon } from "@/components/ContextRibbon";
import { readPosition, writePosition } from "@/lib/session-position";
import { LoopStrip } from "@/components/LoopStrip";
import { LearningQueue } from "@/components/LearningQueue";
import { LearningRuleComposer } from "@/components/LearningRuleComposer";
import {
  LearningTransferRunner,
  type LearningTransferStage,
} from "@/components/LearningTransferRunner";
import type { DrillSpec } from "@shared/claim";
import { transferObservation } from "@shared/learning-record";
import type { LearningTransfer, LearningTransferObservation } from "@shared/learning-record";
import { LichessLayersPanel } from "@/components/LichessLayersPanel";
import { ImportGames } from "@/components/ImportGames";
import { ImportDiagnosticPanel } from "@/components/ImportDiagnostic";
import { NewGameSetup } from "@/components/NewGameSetup";
import {
  POSITION_SOURCES,
  PositionSourceMenu,
  type PositionSourceId,
} from "@/components/PositionSource";
import { SelfCheck } from "@/components/SelfCheck";
import { WhatThisIs } from "@/components/WhatThisIs";
import { Overlay } from "@/components/Overlay";
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
  useCompleteLearningTransfer,
  useDecisionCount,
  useRecordMode,
  useRecordReading,
  useReveal,
  useStartDrill,
  useStartLearningTransfer,
  useImportReading,
  useSaveImportReading,
  useRecordTransferObservation,
} from "@/lib/record-api";
import { VERIFIED_LEARNING_ENABLED } from "@/lib/features";
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
  REVEAL_MULTIPV,
  cpLossFromMultiPv,
  cpLossFromSearches,
  cpLossOfFinalMove,
  engineMayRun,
  type DraftDecision,
  type SessionStage,
} from "@/lib/decision-session";
import type { RevealInputs } from "@shared/reveal";
import {
  commitFailureText,
  readableFailureText,
  type CommitFailureText,
} from "@/lib/commit-error";
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
import {
  comparableCp,
  emptyLine,
  hasEvaluation,
  isStale,
  type EngineLine,
  type EngineStatus,
} from "@/lib/engine-line";
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
  /*
   * The app opens on a GAME, not on someone else's position.
   *
   * It used to open on ply 12 of a canned demo PGN with `source: "imported"` and no opponent.
   * In that state a board click cannot play a move by design -- while deciding, an interaction
   * only PROPOSES -- and the opponent effect is gated on `source === "live"`, which was never
   * true at startup. So the opening screen offered a mid-game position from a game the player
   * had not played, in which nothing they clicked ever moved and nobody ever answered. Measured
   * in a browser against the production build: 32 pieces, 18 half-moves already in the timeline,
   * e2 empty and a pawn already on e4, zero legal-move highlights, no opponent. "I cannot play
   * there" was a literal and accurate description, and it survived every other fix because
   * every other fix was to a screen the player could not reach the game from.
   *
   * The live path itself was never broken -- driving it in a browser plays a move, records the
   * decision, reveals in ~1s and gets an answer from Stockfish. It was only ever behind a
   * button. So it is the default now.
   */
  const [, navigate] = useLocation();
  const [history, setHistory] = useState<GameSnapshot[]>([]);
  const [currentPly, setCurrentPly] = useState(-1);
  const [orientation, setOrientation] = useState<Orientation>("w");
  const [selectedSquare, setSelectedSquare] = useState<string>();
  const [analysis, setAnalysis] = useState<EngineLine | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(INITIAL_STATUS);
  const [pgnInput, setPgnInput] = useState("");
  const [showReading, setShowReading] = useState(false);
  const importReading = useImportReading();
  const saveImportReading = useSaveImportReading();
  const [reviewScores, setReviewScores] = useState<number[] | null>(null);
  const [reviewProgress, setReviewProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [source, setSource] = useState<AnalysisSource>("live");
  const [notice, setNotice] = useState(
    `אתם לבן, ופותחים. היריב הוא Stockfish בעומק ${DEFAULT_OPPONENT_DEPTH}. בחרו מהלך וכתבו את הקריאה שלכם.`,
  );

  // --- R3 state machine ------------------------------------------------------------------
  const [stage, setStage] = useState<SessionStage>("deciding");
  const [candidateMove, setCandidateMove] = useState<string | null>(null);
  const [candidatesConsidered, setCandidatesConsidered] = useState<string[]>([]);
  const [commitError, setCommitError] = useState<CommitFailureText>();
  const [revealInputs, setRevealInputs] = useState<RevealInputs | null>(null);
  /** The engine's second-best line at the analysed position, when one was computed. */
  const [alternative, setAlternative] = useState<EngineLine | null>(null);
  const [committedDraft, setCommittedDraft] = useState<DraftDecision | null>(null);
  const [revealFen, setRevealFen] = useState<string>("");
  const [revealedDecisionId, setRevealedDecisionId] = useState<string>();
  /*
   * Which of the two reveal failures happened, or null. Both used to leave the session in
   * `stage === "revealed"` with no control that advances -- a soft lock whose only escape
   * was abandoning the game.
   */
  const [revealFailure, setRevealFailure] = useState<RevealFailureKind | null>(null);
  const [learningRuleSaved, setLearningRuleSaved] = useState(false);
  const gameId = useRef(`live-${Date.now()}`);

  // --- The opponent ------------------------------------------------------------------------
  /*
   * Present from the first render, so the opening screen is a game. A depth is stated as a
   * depth here and everywhere else: nothing in this build measures which rating a given search
   * depth plays at, so nothing says what level the opponent -- or the player -- is at (R1).
   */
  const [opponent, setOpponent] = useState<Opponent | null>({
    playerColor: "w",
    depth: DEFAULT_OPPONENT_DEPTH,
  });
  const [opponentThinking, setOpponentThinking] = useState(false);
  /*
   * ONE DOOR, and which room is open behind it.
   *
   * These were `showNewGame`, `showPgn` and `showImport` -- three independent booleans for three
   * overlays reached from three permanent rail buttons, each of which had to remember to close
   * the other two (and one of them forgot). They answer one question, so they are one piece of
   * state: is the door open, and which of `POSITION_SOURCES` is showing. `null` is the menu.
   */
  const [showPositionSource, setShowPositionSource] = useState(false);
  const [positionChoice, setPositionChoice] = useState<PositionSourceId | null>(null);
  const [showSelfCheck, setShowSelfCheck] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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

  // --- Player-authored learning and delayed transfer --------------------------------------
  const [learningTransfer, setLearningTransfer] = useState<LearningTransfer | null>(null);
  const [learningTransferIndex, setLearningTransferIndex] = useState(0);
  const [learningTransferStage, setLearningTransferStage] =
    useState<LearningTransferStage>("briefing");
  const [learningTransferRecall, setLearningTransferRecall] = useState("");
  const [learningTransferApplied, setLearningTransferApplied] = useState<boolean | null>(null);
  /** How many positions have been recorded. The observations themselves live on the record. */
  const [learningTransferObservations, setLearningTransferObservations] = useState(0);
  const [learningTransferVerdict, setLearningTransferVerdict] = useState<{
    observed: boolean;
    successes: number;
  } | null>(null);
  const [learningTransferError, setLearningTransferError] = useState<string>();

  const engineRef = useRef<StockfishClient | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyMove = currentPly >= 0 ? history[currentPly] : undefined;
  const inDrill = drill !== null && drillStage === "running";
  const inLearningTransfer = learningTransfer !== null && learningTransferStage === "running";
  // While a drill runs the board shows the drill's position, not the loaded game's.
  const activeMove = inDrill || inLearningTransfer ? undefined : historyMove;
  const activeFen = inLearningTransfer
    ? (learningTransfer.fens[learningTransferIndex] ?? INITIAL_FEN)
    : inDrill
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
  const startLearningTransferMutation = useStartLearningTransfer();
  const completeLearningTransferMutation = useCompleteLearningTransfer();
  const recordTransferObservation = useRecordTransferObservation();
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

  /*
   * WARM THE WORKER WHILE THE PLAYER IS STILL DECIDING. It does not analyse anything.
   *
   * MEASURED, which is the only reason this exists. Six consecutive decisions in a browser,
   * submit -> reveal: 1951ms on the first and a 301ms median on the rest. The whole 1.65s
   * difference is the worker booting -- fetching and instantiating 7MB of wasm and completing the
   * UCI handshake -- and it lands on the FIRST decision a new player ever records, which is the
   * worst moment the product has to spend it.
   *
   * R3 IS UNTOUCHED, and the distinction is the whole point. `start()` posts exactly one message,
   * `uci`, and waits for the engine to say it is ready. `go` is posted only from `search()`, which
   * nothing here calls. No position is sent, no evaluation is computed, and there is therefore no
   * engine output that could reach a screen or a record before the decision is written.
   * GATE-COMMIT still holds on both counts: the pre-commit payload carries no engine output, and
   * this is a dynamic import triggered by a click, so the module stays out of the initial graph.
   *
   * Triggered on the CHOSEN MOVE rather than on page load: a visitor who opens the page and reads
   * it should not pay for 7MB they may never use, and a player who has put a move on the board is
   * seconds from committing. For a person the read chips and the confidence take long enough to
   * cover most of the boot; a script that submits in 90ms will still see it.
   *
   * Failures are swallowed on purpose. This is an optimisation, not a step: if the worker cannot
   * boot here, `analyze` will try again after the commit and report the failure through the path
   * that already handles it.
   */
  /*
   * THE GAME YOU WERE ON, PUT BACK.
   *
   * Closing the tab used to lose it. The record survived and a usage timestamp survived, but the
   * position did not, so every return started at the opening position with five buttons offering
   * to fetch one -- the app forgetting something it had, which is different from not knowing it.
   *
   * Restored ONCE, on mount, and never again: `restored` is a ref rather than state because a
   * second run would fight whatever the player has done since. A stored game that will not replay
   * is dropped silently and the opening position stands -- there is nothing a player could do
   * about a corrupt entry, and a failure notice about a convenience is worse than the convenience.
   *
   * The draft decision is NOT restored. See session-position.ts: the seconds-taken clock starts
   * when a position is presented, so a half-answered commitment resumed an hour later would carry
   * an hour of thinking time into the record (R2).
   */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readPosition();
    if (!saved) return;
    try {
      const loaded = saved.sans.length ? buildHistory(saved.sans.join(" ")) : [];
      // A ply past the end of what replayed is a stored value this build cannot honour.
      const ply = Math.min(saved.ply, loaded.length - 1);
      setHistory(loaded);
      setCurrentPly(ply);
      setSource(saved.source);
      setOrientation(saved.orientation);
      setOpponent(saved.opponent);
      gameId.current = saved.gameId;
      setNotice(
        loaded.length
          ? `חזרתם למשחק שהייתם בו — ${loaded.length} חצאי־מהלכים.`
          : "חזרתם למשחק שהייתם בו.",
      );
    } catch {
      /* Unreplayable. The opening position stands, which is where a fresh visit starts anyway. */
    }
  }, []);

  /*
   * And written back whenever it changes. `sans` rather than the snapshots: chess.js derives the
   * position from the moves, so storing both would create two sources of truth for one board.
   */
  useEffect(() => {
    if (!restored.current) return;
    // A drill and a learning transfer own the board while they run, and neither is a game to
    // come back to -- restoring one from storage would resume a test the record has moved past.
    if (drill || learningTransfer) return;
    writePosition({
      sans: history.map((snapshot) => snapshot.san),
      ply: currentPly,
      source,
      orientation,
      opponent,
      gameId: gameId.current,
    });
  }, [history, currentPly, source, orientation, opponent, drill, learningTransfer]);

  useEffect(() => {
    if (!candidateMove || stage !== "deciding") return;
    void ensureEngine()
      .then((engine) => engine.start())
      .catch(() => {
        /* Reported later by the reveal path, which owns engine failure. */
      });
  }, [candidateMove, stage, ensureEngine]);

  const runAnalysis = useCallback(async () => {
    if (!engineMayRun(stage)) return;
    try {
      const engine = await ensureEngine();
      /*
       * Two lines, not one. The panel's job here is to say why the engine's move beats the one
       * the player was weighing against it, and a single-line search cannot: it only describes
       * what happens AFTER the engine's choice. `engineMayRun` still gates it, so this stays
       * behind the commit -- R3 is unaffected, and the extra cost is paid once, on the reveal,
       * never in the import path.
       */
      const [best, runnerUp] = await engine.analyzeAlternatives(activeFen, 14, 2);
      setAnalysis(best?.pv.length ? best : null);
      setAlternative(runnerUp?.pv.length ? runnerUp : null);
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
    if (!opponent || source !== "live" || inDrill || inLearningTransfer) return;
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
  }, [
    opponent,
    source,
    inDrill,
    inLearningTransfer,
    stage,
    activeFen,
    activeGame,
    ensureEngine,
    playMove,
  ]);

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
      const isLearningTransferDecision =
        learningTransfer !== null && learningTransferStage === "running";
      /*
       * THE GUARD SITS ON THE COMMIT, not on the advance, and the placement is the fix.
       *
       * Blocking the advance instead would leave a player who skipped the question able to answer
       * it only AFTER the reveal -- which is the contamination this change exists to remove,
       * reached by a different route. Refusing here keeps both halves of the observation on the
       * same side of the engine.
       */
      if (isLearningTransferDecision && learningTransferApplied === null) {
        setStage("deciding");
        setLearningTransferError(
          "לפני הרישום, סמנו אם אתם מיישמים את הכלל בהחלטה הזו. התשובה נרשמת לפני החשיפה.",
        );
        return;
      }
      try {
        const event = buildCommitEvent(
          decisionId,
          {
            gameId: isLearningTransferDecision ? learningTransfer.transfer_id : gameId.current,
            fen: activeFen,
            ply: isLearningTransferDecision ? learningTransferIndex : currentPly + 1,
            clockMsRemaining: null,
          },
          draft,
          secondsTaken,
        );
        await commitDecision.mutateAsync(event);
      } catch (error) {
        // R2: a decision that was not stored must never look like one that was. We do not
        // advance to reveal, and we say what happened.
        setStage("deciding");
        // Never the raw message: on the default unauthenticated path this is LocalRecordStore's
        // English invariant text, and it lands on the screen that has to say the decision was not
        // recorded. The original is kept and demoted, not dropped.
        setCommitError(commitFailureText(error));
        return;
      }
      // Only now may the engine run at all.
      const positionFen = activeFen;
      setCommittedDraft(draft);
      setRevealFen(positionFen);
      setCandidateMove(null);
      setCandidatesConsidered([]);
      setRevealFailure(null);
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
        /*
         * TWO SEARCHES OF THE SAME ROOT -- not a root and its child.
         *
         * This used to search the position the player faced and then the position their move
         * produced, and difference the two. Those are not the same measurement: the child at
         * depth d looks d plies ahead from one ply further along, which is a depth d+1 view of
         * the root, and alpha-beta is parity-sensitive. Measured with Stockfish 18 on 110
         * positions, feeding that arithmetic the engine's OWN BEST MOVE: mean loss 10.1cp, and
         * 9.1% came out "inaccurate" against the 30cp threshold. The best move on the board,
         * scored as a mistake, one position in eleven -- and the error is three times more
         * common outside the opening, which is where the detector has a phase bucket to find it.
         *
         * `analyzeMove` restricts a search to one move with UCI `searchmoves` without moving the
         * root, so both scores share a side to move, a depth and a horizon. Same number of
         * searches as before; only the second one's position changes.
         */
        /*
         * ONE search of the root, and line 1 of it IS the best line -- so this replaces the old
         * single-line `analyze` rather than joining it. When the player's move is among the lines
         * that is the whole engine cost of a reveal: one search where there used to be two.
         */
        const rootLines = await engine.analyzeAlternatives(positionFen, 14, REVEAL_MULTIPV);
        const best = rootLines[0] ?? emptyLine(positionFen);
        const after = new Chess(positionFen);
        after.move({ from: move!.from, to: move!.to, promotion: "q" });
        /*
         * WHETHER THERE IS A SECOND POSITION TO SEARCH AT ALL.
         *
         * A move that ends the game leaves nothing to search: no legal reply means no principal
         * variation, so the parser rejects every `info` line and `analyze` RESOLVES -- it does
         * not reject -- with `emptyLine`, whose `scoreCp` is 0. The comparison then read that as
         * a dead-level evaluation and charged the player their whole advantage for winning: mate
         * delivered from +5.00 was scored as a 500-centipawn blunder, on the best move of the
         * game. Asking the rules instead of the engine is both correct and one search cheaper.
         */
        const ended = after.isCheckmate() ? "checkmate" : after.isGameOver() ? "draw" : null;
        /*
         * The chosen move's score, from the SAME search when it can be, and from a second search
         * of the child position when it cannot. Measured on 110 real positions at MultiPV 8: the
         * player's actual move was among the lines 90% of the time. The remaining tenth is a move
         * worse than the eighth-best, which is nowhere near the 30cp threshold -- so falling back
         * there cannot change whether the decision reads as accurate, while the covered 90% is
         * exactly the region where a 10cp instrument error could.
         */
        const fromMultiPv =
          ended === null ? cpLossFromMultiPv(rootLines, draft.chosenMove!) : null;
        const chosen =
          ended === null && fromMultiPv === null ? await engine.analyze(after.fen(), 14) : null;

        /*
         * R2, and the reason this is a throw rather than a fallback. A search can also come back
         * empty because it TIMED OUT -- `analyze` resolves with the same sentinel on its timer --
         * and that is a position nothing measured. The outer catch already owns this case and
         * renders the engine-failure screen; the alternative is a reveal built on zeroes that is
         * indistinguishable from one built on an evaluation.
         */
        if (!hasEvaluation(best) || (chosen !== null && !hasEvaluation(chosen))) {
          throw new Error("engine returned no evaluation for this decision");
        }
        setAnalysis(best);

        const cpLoss =
          ended !== null
            ? cpLossOfFinalMove(best, ended)
            : (fromMultiPv ?? cpLossFromSearches(best, chosen!));
        const bestMove = best.bestMove ?? draft.chosenMove!;
        const inputs: RevealInputs = {
          depth: chosen === null ? best.depth : Math.min(best.depth, chosen.depth),
          cpLoss,
          chosenMove: draft.chosenMove!,
          bestMove,
          chosenWasBest: bestMove === draft.chosenMove,
          confidence: draft.confidence!,
          statedUnknown: draft.unknown,
          decisionsOnRecord: (decisionCount.data?.decisions ?? 0) + 1,
          /*
           * From the draft, not from React state. `setCandidatesConsidered([])` runs above, at
           * the start of the reveal, and the state variable is cleared for the NEXT decision --
           * so anything reading it here gets an empty array and the choice-rule sentence can
           * never fire. The draft is the value CommitmentScreen committed with, captured in this
           * closure, and it is the one that describes the decision being revealed.
           */
          candidatesConsidered: draft.candidatesConsidered,
          /*
           * Carried so the reveal can say which distance the number threw away. A mate on either
           * search means `cpLoss` was measured against MATE_SCORE, a ceiling, and the sentence
           * that says so is the difference between "nothing was better than this" and "this move
           * changed nothing" -- which read identically as "0 ס״פ".
           */
          clampedMate: best.mate !== undefined || chosen?.mate !== undefined,
        };
        setRevealInputs(inputs);

        try {
          await submitReveal.mutateAsync({
            decision_id: decisionId,
            result: {
              // The clamp, not the mate distance: `scoreCp` on a mate line is distance x 10000,
              // and the record is read back as centipawns by anything that reads it at all.
              engine_eval_cp: comparableCp(best),
              engine_best_move: bestMove,
              engine_depth: inputs.depth,
              engine_source: "local_sf18",
              cp_loss: cpLoss,
            },
          });
          setRevealedDecisionId(decisionId);
          if (isLearningTransferDecision) {
            /*
             * WRITTEN DOWN NOW, not held until the end. These used to accumulate in component
             * state for the whole run and reach the server only at completion, and three defects
             * came out of that: a reload lost them and the resume re-served positions whose
             * engine verdict the player had already seen; a failed reveal write stranded the run;
             * and the client was their only holder, so completion had to believe it.
             */
            await recordTransferObservation.mutateAsync({
              transfer_id: learningTransfer.transfer_id,
              /*
               * The player's own answer, frozen here -- not a placeholder patched later. It used
               * to be written `false` and overwritten in `advanceLearningTransfer`, which runs
               * after the reveal, so the value that reached the server had been collected on the
               * wrong side of the engine while every screen looked correct.
               *
               * `transferObservation` throws rather than defaulting a null to `false`. That line
               * used to read `?? false` under a comment saying it could not fire; it could,
               * because this callback did not depend on the value it was reading.
               */
              observation: transferObservation({
                decision_id: decisionId,
                recalled_rule: learningTransferRecall,
                applied_rule: learningTransferApplied,
              }),
            });
            setLearningTransferObservations((current) => current + 1);
          }
        } catch {
          // The decision itself is on the record; only the engine's verdict failed to store.
          // The reveal above is valid and stays: `revealInputs` was set before this write.
          setRevealFailure("write");
          setNotice("ההחלטה נרשמה, אבל תוצאת המנוע לא נשמרה.");
          if (isLearningTransferDecision) {
            setLearningTransferError("תוצאת המנוע לא נשמרה ולכן אי אפשר למדוד את העמדה הזו.");
          }
        }
        void decisionCount.refetch();
      } catch {
        // No evaluation exists, so there is no reveal to render. Without this the screen
        // sat on "המנוע מחשב…" forever, with no control that advances.
        setRevealFailure("engine");
        setEngineStatus({ mode: "error", detail: "המנוע לא סיים את החישוב." });
      }
    },
    [
      activeFen,
      commitDecision,
      currentPly,
      decisionCount,
      drill,
      drillStage,
      ensureEngine,
      learningTransfer,
      learningTransferIndex,
      learningTransferApplied,
      learningTransferRecall,
      learningTransferStage,
      recordTransferObservation,
      submitReveal,
    ],
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
        setDrillError(readableFailureText(error, "הדריל לא התחיל."));
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
      setDrillError(readableFailureText(error, "לא ניתן היה לסגור את הדריל."));
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

  const beginLearningTransfer = useCallback(
    async (ruleId: string) => {
      setLearningTransferError(undefined);
      const candidates = [INITIAL_FEN, ...history.map((item) => item.fen)];
      if (candidates.length < 3) {
        setLearningTransferError(
          "כדי לבנות בדיקת העברה צריך לטעון משחק עם לפחות שלוש עמדות חדשות.",
        );
        return;
      }
      try {
        const response = await startLearningTransferMutation.mutateAsync({
          rule_id: ruleId,
          candidate_fens: candidates,
        });
        if (!response.transfer) {
          setLearningTransferError(response.reason ?? "אין כרגע שלוש עמדות חדשות לבדיקה.");
          return;
        }
        setLearningTransfer(response.transfer);
        setLearningTransferIndex(0);
        setLearningTransferStage("briefing");
        setLearningTransferRecall("");
        setLearningTransferApplied(null);
        setLearningTransferObservations(0);
        setLearningTransferVerdict(null);
      } catch (cause) {
        setLearningTransferError(
          readableFailureText(cause, "בדיקת ההעברה לא התחילה."),
        );
      }
    },
    [history, startLearningTransferMutation],
  );

  const advanceLearningTransfer = useCallback(async () => {
    if (!learningTransfer || learningTransferStage !== "running") return;
    if (learningTransferObservations !== learningTransferIndex + 1) {
      setLearningTransferError("החשיפה לא נשמרה ולכן אי אפשר להתקדם בבדיקה.");
      return;
    }
    setLearningTransferError(undefined);

    const next = learningTransferIndex + 1;
    if (next < learningTransfer.fens.length) {
      setLearningTransferIndex(next);
      setLearningTransferRecall("");
      setLearningTransferApplied(null);
      setStage("deciding");
      setAnalysis(null);
      setRevealInputs(null);
      setCommittedDraft(null);
      setCandidateMove(null);
      setCandidatesConsidered([]);
      setRevealedDecisionId(undefined);
      setNotice(`עמדה ${next + 1} מתוך ${learningTransfer.fens.length} בבדיקת ההעברה.`);
      return;
    }

    setLearningTransferStage("reporting");
    try {
      /*
       * A transfer id and nothing else. The observations were written to the record as each was
       * made, so this asks for the verdict on what is already down rather than posting the
       * evidence and the request for a verdict in one breath.
       */
      const outcome = await completeLearningTransferMutation.mutateAsync({
        transfer_id: learningTransfer.transfer_id,
      });
      setLearningTransferVerdict({
        observed: outcome.result.observed,
        successes: outcome.result.successes,
      });
      setLearningTransferStage("done");
    } catch (cause) {
      setLearningTransferError(
        readableFailureText(cause, "לא ניתן היה למדוד את הבדיקה."),
      );
      // Preserve the completed observations so reporting can be retried. A `done` state without
      // a verdict has no valid next action and would strand the workflow.
      setLearningTransferStage("running");
    }
  }, [
    completeLearningTransferMutation,
    learningTransfer,
    learningTransferApplied,
    learningTransferIndex,
    learningTransferObservations,
    learningTransferStage,
  ]);

  const closeLearningTransfer = () => {
    setLearningTransfer(null);
    setLearningTransferIndex(0);
    setLearningTransferStage("briefing");
    setLearningTransferRecall("");
    setLearningTransferApplied(null);
    setLearningTransferObservations(0);
    setLearningTransferVerdict(null);
    setLearningTransferError(undefined);
    setStage("deciding");
    setAnalysis(null);
    setRevealInputs(null);
    setCommittedDraft(null);
    setRevealedDecisionId(undefined);
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
    setRevealedDecisionId(undefined);
    setRevealFailure(null);
    setLearningRuleSaved(false);
    setNotice(message);
  };

  const nextDecision = () => {
    if (learningTransfer && learningTransferStage === "running") {
      void advanceLearningTransfer();
      return;
    }
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
      closePositionSource();
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
      const scores = await analyzePositions(positions, (fen, depth) => engine.analyze(fen, depth), {
        onProgress: setReviewProgress,
      });
      setReviewScores(scores);
    } catch (error) {
      // A review that failed must not render as a review that found nothing.
      setReviewError(readableFailureText(error, "הניתוח נכשל."));
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
      closePositionSource();
      setSource("finished");
      gameId.current = `lichess-${game.id}`;
      setOpponent(null);
      answeredFen.current = null;
      resetDecision(`נטען ${game.white} מול ${game.black} — ${loaded.length} חצאי־מהלכים.`);
    } catch {
      setNotice(`לא הצלחתי לקרוא את ה־PGN של המשחק ${game.id}.`);
    }
  };

  /*
   * Opening and closing the one door.
   *
   * `openPositionSource` takes the room to show, so a caller that already knows which source it
   * wants -- the ribbon's link, which names one out loud -- lands on it rather than on a menu it
   * would have to click past. Closing always clears the room, so the door never reopens on the
   * panel someone abandoned three games ago.
   */
  const openPositionSource = (choice: PositionSourceId | null = null) => {
    setShowPositionSource(true);
    setPositionChoice(choice);
  };
  const closePositionSource = () => {
    setShowPositionSource(false);
    setPositionChoice(null);
  };
  /*
   * "קובץ" has no panel: it is an OS file dialog, and rendering a room whose only content is a
   * button that opens one would be a second click for nothing. The menu stays put underneath, so
   * cancelling the dialog leaves the player where they were rather than on a blank overlay.
   */
  const choosePositionSource = (choice: PositionSourceId) => {
    if (choice === "file") {
      fileRef.current?.click();
      return;
    }
    setPositionChoice(choice);
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
    closePositionSource();
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
  const learningTransferPanel = learningTransfer ? (
    <LearningTransferRunner
      transfer={learningTransfer}
      stage={learningTransferStage}
      index={learningTransferIndex}
      revealed={stage === "revealed"}
      recall={learningTransferRecall}
      applied={learningTransferApplied}
      verdict={learningTransferVerdict}
      error={learningTransferError}
      onRecall={setLearningTransferRecall}
      onApplied={setLearningTransferApplied}
      onStart={() => {
        setLearningTransferStage("running");
        setStage("deciding");
        setAnalysis(null);
        setRevealInputs(null);
        setCommittedDraft(null);
        setNotice(`עמדה 1 מתוך ${learningTransfer.fens.length} בבדיקת ההעברה.`);
      }}
      onFinish={closeLearningTransfer}
    />
  ) : null;

  return (
    <main className="studio-shell" dir="rtl">
      <header className="studio-header">
        {/*
          * The lockup is the way back to the record, because that is where a brand mark in a
          * header already points on every other site -- and because the alternative was a
          * fifth unlabelled icon in a row that has already been trimmed once for overflowing.
          */}
        <button type="button" className="brand-lockup" onClick={() => navigate("/")}>
          <div className="brand-mark">♞</div>
          <div>
            <p className="brand-name">DECISION LAB</p>
            <span>COMMIT · THEN REVEAL</span>
          </div>
        </button>
        <div className="header-reading">
          <span>תור</span>
          <b>{sideToMove}</b>
        </div>
        <div className="header-actions">
          {stage === "revealed" &&
            revealedDecisionId &&
            (!learningTransfer || learningTransferStage === "running") && (
              <button className="primary-control" onClick={nextDecision}>
                {learningTransfer ? "העמדה הבאה" : "ההחלטה הבאה"}
              </button>
            )}
          {/*
           * Reachable from the header on purpose. A diagnostic behind a menu is a diagnostic
           * nobody runs when the thing is broken.
           */}
          {/*
           * Help lives in the header, not behind a menu, and not as a first-run tour.
           * Nielsen 10: it has to be findable at the moment of confusion, which is not
           * necessarily the first moment.
           */}
          <button
            className="icon-control"
            aria-label="מה נמדד כאן"
            aria-expanded={showHelp}
            onClick={() => setShowHelp((v) => !v)}
          >
            <HelpCircle size={17} />
          </button>
          <button
            className="icon-control"
            aria-label="בדיקה עצמית של הדפדפן"
            aria-expanded={showSelfCheck}
            onClick={() => setShowSelfCheck((v) => !v)}
          >
            <Stethoscope size={17} />
          </button>
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

      {/*
        * The drill's progress travels up here for the same reason it travels to `LoopStrip`: a
        * running drill outranks everything else in the loop, and the state lives in this
        * component. Both surfaces read one hook, so they cannot disagree about the position.
        */}
      <ContextRibbon
        drill={inDrill ? { completed: drillDecisionIds.length, total: drill!.fens.length } : null}
        /*
         * The ribbon names a surface; this page is the one that owns both of them, so this is
         * where the name is turned into an address. It OPENS and stops -- no import is run and
         * no drill is started, because starting one from a sentence would be the ribbon acting
         * on the record it is describing.
         */
        onGoTo={(target) => {
          if (target === "import") {
            openPositionSource("username");
            return;
          }
          /*
           * The claim panel is a section of this same page -- right column on a wide screen,
           * below the board on a phone -- so the address is a scroll, not a navigation. Focus
           * lands on the drill button when there is one, because a scroll alone leaves a
           * keyboard user exactly where they were.
           */
          const panel = document.getElementById("claim-panel");
          panel?.scrollIntoView({ behavior: "smooth", block: "center" });
          panel?.querySelector<HTMLButtonElement>(".claim-run-drill")?.focus();
        }}
      />

      <section className="workbench">
        {/*
          * THREE QUESTIONS, THREE ENTRIES -- not six controls at one weight.
          *
          * The rail held משחק חדש / טעינת PGN / ייבוא לפי שם / קריאה שמורה / Lichess / קובץ, and
          * the first, second, third and sixth of those all answer "give me a different position".
          * They are one door now; see components/PositionSource.tsx. The other two are NOT the
          * same question -- one connects an account, one reopens a measurement already paid for --
          * so collapsing them into the same door would have been a label that lies.
          *
          * NOTHING HERE IS `prominent` ANY MORE. `משחק חדש` was a filled blue button, permanently
          * the loudest thing on the page, and what it offers is discarding the position the
          * product exists to measure. The blue belongs to the commitment panel's submit.
          */}
        <aside className="control-rail">
          <div className="rail-label">כלי עבודה</div>
          <button
            className="rail-button"
            aria-expanded={showPositionSource}
            onClick={() => (showPositionSource ? closePositionSource() : openPositionSource())}
          >
            <Plus size={18} />
            <span>עמדה אחרת</span>
          </button>
          {/*
            * The way back to a reading that has already been paid for.
            *
            * Deliberately NOT promoted: same `rail-button`, same rail. The reading is a set of
            * accuracy rates, and accuracy is precisely what this product argues is not the thing
            * worth measuring -- putting it on the front page would make the app say the opposite
            * of what its own empty calibration column says. What was broken was that a 43-second
            * scan could not be reopened at all; that is a reachability defect, not an argument
            * for a headline.
            *
            * The entry renders only once something is behind it. A button that opens an empty
            * panel is a button that lies about what the record holds.
            */}
          {importReading.reading && (
            <button
              className="rail-button"
              onClick={() => {
                setShowReading((v) => !v);
                closePositionSource();
              }}
            >
              <History size={18} />
              <span>קריאה שמורה</span>
            </button>
          )}
          {/* Not a position source: this connects an account and enables the analysis layers. */}
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

          {/*
           * All three of these are transient panels, and all three used to render as a block
           * above the board -- which pushed the board below the fold by their own height. See
           * components/Overlay.tsx for the measurements.
           */}
          {showHelp && (
            <Overlay label="מה נמדד כאן" onClose={() => setShowHelp(false)}>
              <WhatThisIs onClose={() => setShowHelp(false)} />
            </Overlay>
          )}
          {showSelfCheck && (
            <Overlay label="בדיקה עצמית" onClose={() => setShowSelfCheck(false)}>
              <SelfCheck onClose={() => setShowSelfCheck(false)} />
            </Overlay>
          )}

          {/*
            * ONE OVERLAY, FOUR ROOMS -- not one overlay per source stacked on the last.
            *
            * `showNewGame`, `showPgn` and `showImport` were three sibling overlays, and reaching
            * a second one meant closing the first from a rail button that had to remember to.
            * This is a single surface whose body is either the menu or the chosen source, with a
            * way back that does not close the door. Nothing nests, so nothing has to be unstacked.
            */}
          {showPositionSource && (
            <Overlay
              label={
                POSITION_SOURCES.find((entry) => entry.id === positionChoice)?.label ?? "עמדה אחרת"
              }
              onClose={closePositionSource}
            >
              {positionChoice === null ? (
                <PositionSourceMenu
                  onChoose={choosePositionSource}
                  onClose={closePositionSource}
                />
              ) : (
                <>
                  {/* ArrowRight, not Left: back is towards the start of the line, and the line
                      runs right-to-left. */}
                  <button
                    type="button"
                    className="position-source-back"
                    onClick={() => setPositionChoice(null)}
                  >
                    <ArrowRight size={16} aria-hidden="true" />
                    <span>כל המקורות</span>
                  </button>
                  {positionChoice === "new" && (
                    <NewGameSetup
                      color={setupColor}
                      depth={setupDepth}
                      onColor={setSetupColor}
                      onDepth={setSetupDepth}
                      onStart={() => newGame(setupColor, setupDepth)}
                      onCancel={closePositionSource}
                    />
                  )}
                  {positionChoice === "username" && (
                    <ImportGames
                      keepReading={saveImportReading.mutateAsync}
                      onLoad={loadLichessGame}
                      onClose={closePositionSource}
                      analyze={async (fen, depth) => (await ensureEngine()).analyze(fen, depth)}
                      /* The account the record already knows about, so it is not asked for twice. */
                      lastUsername={importReading.reading?.username}
                    />
                  )}
                  {positionChoice === "pgn" && (
                    <section className="pgn-drawer">
                      <div className="drawer-heading">
                        <div>
                          <span>הדבקת PGN</span>
                          <b>IMPORT</b>
                        </div>
                        <button onClick={closePositionSource}>סגור</button>
                      </div>
                      <Textarea
                        value={pgnInput}
                        onChange={(e) => setPgnInput(e.target.value)}
                        dir="ltr"
                      />
                      <div className="drawer-actions">
                        <button className="drawer-confirm" onClick={() => importPgn(pgnInput)}>
                          טען למשחק
                        </button>
                        {/*
                         * The demo game used to BE the opening screen, which is what made the app
                         * unplayable. It is still worth having -- it is the shortest way to see
                         * the review and timeline against a finished game -- so it lives here,
                         * where loading it is something the player chooses.
                         */}
                        <button
                          className="ghost-control"
                          onClick={() => setPgnInput(DEFAULT_PGN)}
                        >
                          הדביקו משחק לדוגמה
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
            </Overlay>
          )}

          {showReading && importReading.reading && (
            <Overlay label="הקריאה השמורה" onClose={() => setShowReading(false)}>
              {/*
                * The same panel, reopened. Not a summary of it and not a second rendering of the
                * same numbers in a smaller font: section 4.5 says two states must not render
                * alike, and the converse holds too -- the same reading in two places must not
                * render as two different findings. What is added is the provenance, because a
                * rate reopened later with no scan date behind it stops being a measurement.
                */}
              <ImportDiagnosticPanel
                diagnostic={importReading.reading.diagnostic}
                provenance={{
                  username: importReading.reading.username,
                  games: importReading.reading.games,
                  scannedAt: importReading.reading.scanned_at,
                }}
              />
            </Overlay>
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

          <RecordModeNotice {...recordMode} />

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
          <LoopStrip
            drill={
              inDrill ? { completed: drillDecisionIds.length, total: drill!.fens.length } : null
            }
          />
          {deciding && (!learningTransfer || learningTransferStage === "running") ? (
            <CommitmentScreen
              position={{
                gameId: learningTransfer?.transfer_id ?? gameId.current,
                fen: activeFen,
                ply: learningTransfer ? learningTransferIndex : currentPly + 1,
                clockMsRemaining: null,
              }}
              chosenMove={candidateMove}
              candidatesConsidered={candidatesConsidered}
              onCommit={onCommit}
              pending={stage === "committing"}
              error={commitError}
            />
          ) : null}
          {deciding && learningTransfer ? (
            learningTransferPanel
          ) : deciding && drill ? (
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
            <>
              <ClaimPanel onRunDrill={beginDrill} drillError={drillError} />
              {VERIFIED_LEARNING_ENABLED && (
                <LearningQueue
                  onStart={(ruleId) => void beginLearningTransfer(ruleId)}
                  busy={learningTransfer !== null}
                  error={learningTransferError}
                />
              )}
            </>
          ) : (
            <>
              {revealInputs && committedDraft ? (
                <RevealPanel
                  inputs={revealInputs}
                  analysis={analysis}
                  fen={revealFen}
                  statedKnown={committedDraft.known}
                />
              ) : revealFailure === null ? (
                <p className="reveal-waiting">המנוע מחשב את העמדה שהחלטת עליה…</p>
              ) : null}
              {/*
                * Rendered under the reveal on a write failure -- that reveal is valid -- and
                * on its own when the engine never answered. Either way it carries the only
                * control that advances: the header's is gated on a reveal that was stored.
                */}
              {revealFailure && <RevealFailure kind={revealFailure} onNext={nextDecision} />}
              <AnalysisPanel
                analysis={analysis}
                alternative={alternative}
                status={engineStatus}
                fen={activeFen}
                activeMove={activeMove}
                material={material}
                onAnalyze={() => void runAnalysis()}
              />
              {learningTransfer && learningTransferPanel}
              {VERIFIED_LEARNING_ENABLED &&
                !learningTransfer &&
                revealedDecisionId &&
                (!learningRuleSaved ? (
                  <LearningRuleComposer
                    sourceDecisionId={revealedDecisionId}
                    onSaved={() => setLearningRuleSaved(true)}
                  />
                ) : (
                  <p className="learning-loading">הכלל נשמר כהשערה ונוסף לתור הלמידה.</p>
                ))}
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
