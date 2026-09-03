import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { retryOnce } from "@/lib/retry-once";
import { reportEngineFailure, reportFailure } from "@/lib/error-sink";
import { Chess } from "chess.js";
import {
  Activity,
  Clipboard,
  FlipVertical2,
  HelpCircle,
  Moon,
  Stethoscope,
  Sun,
} from "lucide-react";
import { useLocation } from "wouter";
import { lazyChunk } from "@/lib/lazy-chunk";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { RecordModeNotice } from "@/components/RecordModeNotice";
import { ChessBoard } from "@/components/ChessBoard";
import { EvaluationBar } from "@/components/EvaluationBar";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { isAnchorFen } from "@shared/anchor-set";
import { decisionPurposeFor, type DecisionPurpose } from "@shared/confidence-asked";
import { CounterfactualProbe } from "@/components/CounterfactualProbe";
import { SilentGame } from "@/components/SilentGame";
import { BrandLockup } from "@/components/BrandLockup";
import { ControlRail } from "@/components/ControlRail";
import { RevealPanel } from "@/components/RevealPanel";
import { recordTrialEvent, revealsPresented, trialEventSeen } from "@/lib/progress-record";
import { continuationStarted } from "@/lib/acquisition-evidence";
import { ClaimPanel } from "@/components/ClaimPanel";
import { DrillRunner, type DrillStage } from "@/components/DrillRunner";
import { RevealFailure, type RevealFailureKind } from "@/components/RevealFailure";
import { RevealNoContinuation } from "@/components/RevealNoContinuation";
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
import { boardAuthorityFor } from "@shared/board-authority";
import { PROBE_STAGE } from "@shared/counterfactual-stage";
import { continuationAfter } from "@/lib/continuation";
import { effectiveTiming, mayShowVerdictNow, type RevealTiming } from "@shared/reveal-timing";
import type { LearningTransfer, LearningTransferObservation } from "@shared/learning-record";
import { LichessLayersPanel } from "@/components/LichessLayersPanel";
import { ImportGames } from "@/components/ImportGames";
import { SavedReadingOverlay } from "@/components/ImportDiagnostic";
import { NewGameSetup } from "@/components/NewGameSetup";
import {
  PgnDrawer,
  PositionSourceOverlay,
  type PositionSourceId,
} from "@/components/PositionSource";
import { ExplainerOverlays } from "@/components/ExplainerOverlays";
import { useNewGameSetup } from "@/lib/use-new-game-setup";
import { Overlay } from "@/components/Overlay";
/*
 * recharts is ~100KB and only matters once a game is being reviewed. A static import would put
 * it in the initial graph, which is the same weight mistake the engine import was -- the reason
 * engine-line.ts exists at all.
 */
/*
 * LAZY, LIKE THE GAME REVIEW AND FOR THE SAME REASON. This renders on the second reveal of a
 * browser's whole history and never again -- so in the overwhelmingly common visit it is code
 * downloaded and not run. Static, it put the entry chunk over budget on its own.
 */
const ValueReconstruction = lazyChunk(() =>
  import("@/components/ValueReconstruction").then((m) => ({ default: m.ValueReconstruction })),
);

/*
 * THE TOOLBOX IS NOT ON THE PATH, SO IT IS NOT IN THE BUNDLE EITHER (P1.7). It renders when a
 * player presses a control and never otherwise -- exactly the condition this file already applies
 * to the dashboard and the game review -- and it carries four panels with it (the engine's, the
 * claim panel, the learning queue, the Lichess layers) that the entry chunk was shipping to
 * arrivals who never open one. Measured: 19.2 kB raw off the entry.
 */
const RecordExplorer = lazyChunk(() =>
  import("@/components/RecordExplorer").then((m) => ({ default: m.RecordExplorer })),
);

const GameReview = lazyChunk(() =>
  import("@/components/GameReview").then((m) => ({ default: m.GameReview })),
);
const GameReviewProgress = lazyChunk(() =>
  import("@/components/GameReview").then((m) => ({ default: m.GameReviewProgress })),
);
/* Same reason: recharts stays out of the initial graph. */
const RecordDashboard = lazyChunk(() =>
  import("@/components/RecordDashboard").then((m) => ({ default: m.RecordDashboard })),
);
import type { ImportedGame } from "@/lib/lichess-public";
import type { AnalysisSource } from "@shared/analysis-source";
import {
  useCommitDecision,
  useRecordCounterfactual,
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
import { EXPERIMENTAL_LEARNING_ENABLED } from "@/lib/features";
import { MoveTimeline } from "@/components/MoveTimeline";
import {
  buildHistory,
  DEFAULT_PGN,
  INITIAL_FEN,
  type GameSnapshot,
  type Orientation,
  uciToSquares,
  applyMoveAt,
} from "@/lib/game-data";
import {
  buildCommitEvent,
  REVEAL_MULTIPV,
  cpLossFromMultiPv,
  cpLossFromSearches,
  cpLossOfFinalMove,
  engineMayRun,
  makingEvidence,
  namedTest,
  type DraftDecision,
  type CommitEvent,
  type SessionStage,
} from "@/lib/decision-session";
import { type RevealInputs } from "@shared/reveal";
import { primaryAction } from "@shared/primary-action";
import {
  commitFailureText,
  readableFailureText,
  type CommitFailureText,
} from "@/lib/commit-error";
// TYPE-ONLY import: type imports are erased, so this creates no runtime edge to the engine
// module. The implementation is pulled in dynamically at first reveal -- see ensureEngine.
// Values (isStale, EngineLine) come from @/lib/engine-line, which has no asset imports.
import type { StockfishClient } from "@/lib/stockfish";
import { engineBuildId } from "@/lib/engine-identity";
/*
 * Imported statically, and that is correct here: opponent.ts reaches chess.js and nothing else.
 * It does NOT import the engine -- it takes the search in as an argument -- so it adds no edge
 * to stockfish.ts and cannot pull the wasm into the initial graph. (It was briefly behind a
 * dynamic import as well, which bought nothing: a module imported both ways lands in the static
 * chunk anyway, so the dynamic form only made the code claim a split the build did not make.)
 */
import {
  chooseOpponentMove,
  searchWithVariety,
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
import { CONFIDENCE_LEVELS } from "@shared/confidence";

const INITIAL_STATUS: EngineStatus = { mode: "loading", detail: "המנוע ידלק אחרי ההחלטה" };

/**
 * Who is playing the other side, if anyone.
 *
 * null is the original behaviour and stays the default for an imported or finished game: there
 * the other side's moves are already in the PGN and an opponent would be inventing a different
 * game. It is only a live game that needs someone across the board.
 */
type Opponent = { playerColor: "w" | "b"; depth: OpponentDepth };

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
  /*
   * Whether the handoff has been read, so nothing describes the board before it is the board.
   *
   * THE DEFECT THIS FIXES, caught in a browser walk rather than by a test. `first_position_presented`
   * fired on the first render where a position was actionable -- and on a visit arriving through a
   * handoff, that render is the component's own default board, one tick before the restore
   * replaces it. The event went into the trial log with `purpose: "first"` while the decision that
   * followed committed as `purpose: "anchor"`, so the funnel's second stage described a position
   * the player never decided on.
   *
   * State rather than the `restored` ref, because a ref does not re-render and the emitter has to
   * run again once the real position is on the board.
   */
  const [restoreSettled, setRestoreSettled] = useState(false);
  const [currentPly, setCurrentPly] = useState(-1);
  /*
   * The decision ply the front door handed this board over to produce, restored and written back
   * like `revealTiming` and for the same reason: the write-back effect below runs on every board
   * change, so a field it does not carry is erased on the first render after the restore -- here,
   * before the player has made the decision the handoff exists for.
   */
  /*
   * ZERO, NOT NULL, AND THE DEFAULT IS THE WHOLE DEFECT THIS FIXES.
   *
   * `newGame` sets this to 0 and says why; the front door's handoff sets it to the ply it means.
   * But the board this component renders before either of them runs is ALSO a live game at the
   * opening position -- it is what `/play` shows anyone who arrives without pressing anything --
   * and it was the one live game whose opening decision was not a first decision. Walked in
   * Chromium from an empty profile: the atom came back `purpose: "play"`, `confidence: null`,
   * because `currentPly + 1 === firstDecisionPly` compared `0 === null`.
   *
   * What that cost is not a tap. `first` is in `ALWAYS`, so the question is put and the decision
   * is scoreable; drawn as `play` it goes to `ASK_RATE` and six arrivals in seven record a
   * decision nothing can read -- on a screen the front door reached having promised "תבחרו מהלך
   * ותגידו כמה אתם בטוחים", and with `scored` left at zero, which is the state the front door
   * shows `FirstDecision` for. The newcomer is returned to the door they just came through.
   *
   * The default board and `newGame`'s board are the same board, so they carry the same value. A
   * loaded game is not -- see `importPgn` and `loadLichessGame`, which clear it.
   */
  const [firstDecisionPly, setFirstDecisionPly] = useState<number | null>(0);
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
  /**
   * The decision waiting on the counterfactual question, with everything the reveal will need.
   *
   * Held as one object rather than five state variables because they are one fact: a decision is
   * either mid-probe with all of this, or it is not. Five variables can disagree.
   */
  const [probe, setProbe] = useState<{
    decisionId: string;
    draft: DraftDecision;
    positionFen: string;
    /** The ply `positionFen` is, carried for the same reason it is. */
    positionPly: number;
    isDrillDecision: boolean;
    /** The transfer run this decision belongs to, frozen at commit. See `runReveal`. */
    transfer: LearningTransfer | null;
    /** Frozen with the decision, for the same reason: the setting can change while the probe is up. */
    timing: RevealTiming;
  } | null>(null);
  /** What the player has put on the board as the alternative, before they confirm it. */
  const [probeAlternative, setProbeAlternative] = useState<string | null>(null);
  const [probePending, setProbePending] = useState(false);
  const [probeError, setProbeError] = useState<string | undefined>(undefined);
  const [candidateMove, setCandidateMove] = useState<string | null>(null);
  const [candidatesConsidered, setCandidatesConsidered] = useState<string[]>([]);
  const [commitError, setCommitError] = useState<CommitFailureText>();
  const [revealInputs, setRevealInputs] = useState<RevealInputs | null>(null);
  /** The engine's second-best line at the analysed position, when one was computed. */
  const [alternative, setAlternative] = useState<EngineLine | null>(null);
  const [committedDraft, setCommittedDraft] = useState<DraftDecision | null>(null);
  /** The position the open reveal is about, and its ply: two fields that must agree are one. */
  const [revealAt, setRevealAt] = useState<{ fen: string; ply: number }>({ fen: "", ply: -1 });
  const [revealedDecisionId, setRevealedDecisionId] = useState<string>();
  /*
   * `EXPLORE`: the player asked to see the rest of the record (P1.7).
   *
   * RESET WHENEVER A NEW REVEAL ARRIVES, in the effect below, and not in the six places that put
   * the stage back to `deciding`. A player who explored after one decision should meet the NEXT
   * reveal as a reveal -- the mode is a thing they are in, not a preference they set.
   */
  const [exploring, setExploring] = useState(false);
  /*
   * Which of the two reveal failures happened, or null. Both used to leave the session in
   * `stage === "revealed"` with no control that advances -- a soft lock whose only escape
   * was abandoning the game.
   */
  const [revealFailure, setRevealFailure] = useState<RevealFailureKind | null>(null);
  const [learningRuleSaved, setLearningRuleSaved] = useState(false);
  const gameId = useRef(`live-${Date.now()}`);
  /*
   * How many decisions this SESSION has committed, for the trial's ordinal.
   *
   * A ref rather than state: nothing renders from it, and a state update here would re-render the
   * board on every commit for a number no player ever sees. Not `decisionsThisGame`, which resets
   * with each new game -- a session that plays two games is still one arrival, and the ordinal
   * has to keep counting across them or "did they make a second decision" becomes unanswerable.
   */
  const decisionsThisVisit = useRef(0);

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
  /**
   * When the engine is allowed to speak: after every decision, or after the whole game.
   *
   * Defaults to the coached loop, which is what every existing record was made under and what a
   * single position wants. The deferred game is chosen deliberately, at "משחק חדש", because over
   * forty moves the coached loop measures a player who has been coached mid-game -- a different
   * condition, and the record stores which was in force.
   */
  const [revealTiming, setRevealTiming] = useState<RevealTiming>("per-decision");
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
  /* The three answers a new game needs, remembered between games (P1.11). */
  const setup = useNewGameSetup();
  /**
   * Decisions committed in the current game, counted here rather than read from the record.
   *
   * The record's own count is every decision ever made, across every game and every mode; what a
   * silent game has to show is how many it holds. Reset by `newGame`, which is the only thing
   * that starts one.
   */
  const [decisionsThisGame, setDecisionsThisGame] = useState(0);
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
  /**
   * Why this position is in front of the player, and therefore whether the confidence question is
   * put -- see shared/confidence-asked.ts.
   *
   * Derived once, here, beside the position it describes. Two call sites need it (the screen that
   * asks and the event that gets written) and a second derivation is a second chance to disagree
   * about whether a decision was measured, which is the kind of disagreement that only shows up
   * in the record weeks later.
   *
   * An anchor is recognised by its POSITION, not by the route that served it: the shared bank is
   * handed into the ordinary board, so `gameId` says "a game" while the FEN is a bank position.
   *
   * THE ORDERING LIVES IN `decisionPurposeFor` RATHER THAN HERE, because the purpose is written to
   * the record now and a five-branch conditional buried in this component could only be checked by
   * reading it. This screen answers the four questions it has the answers to; which answer wins is
   * the rule module's.
   */
  const decisionPurpose: DecisionPurpose = decisionPurposeFor({
    inLearningTransfer,
    inDrill,
    isAnchor: isAnchorFen(activeFen),
    isFirstDecision: currentPly + 1 === firstDecisionPly,
    /*
     * `live` is the game being played against the engine. Everything else -- a pasted PGN, a
     * finished Lichess game, a study -- is a position from a game that is already over, which is
     * what `import` names on the other side of this call.
     */
    isLiveGame: source === "live",
  });
  const activeGame = useMemo(() => new Chess(activeFen), [activeFen]);
  const board = activeGame.board();
  const sideToMove = activeGame.turn() === "w" ? "לבן" : "שחור";

  /*
   * THE SECOND STAGE OF THE ACQUISITION FUNNEL, AND WHY IT IS NOT "the page loaded".
   *
   * A stage every arrival clears measures nothing. What has to be true for the acquisition
   * experience to be possible is that a position is ON the board, it is the player's move, there
   * is a legal move to make, and the board will accept one -- so an arrival that landed on a
   * finished game, on the opponent's turn, or mid-reveal has not reached it. The difference
   * between this and a route is the difference between "they could have decided" and "they were
   * somewhere near a board".
   */
  const positionIsActionable =
    stage === "deciding" &&
    activeGame.moves().length > 0 &&
    (opponent === null || activeGame.turn() === opponent.playerColor);

  /*
   * A NEW REVEAL CLOSES `EXPLORE` (P1.7).
   *
   * KEYED ON THE REVEALED DECISION AND NOT ON THE STAGE, because the stage goes back to `deciding`
   * from six different places and this would have had to be added to all of them -- which is the
   * kind of thing that gets added to five. A reveal is identified by the decision it is about, so
   * a new id is exactly the event "there is something new to read".
   */
  useEffect(() => setExploring(false), [revealedDecisionId]);

  useEffect(() => {
    // Not before the handoff has been read: see `restoreSettled`.
    if (!restoreSettled || !positionIsActionable) return;
    if (trialEventSeen("first_position_presented")) return;
    recordTrialEvent({
      name: "first_position_presented",
      at: new Date().toISOString(),
      purpose: decisionPurpose,
    });
  }, [restoreSettled, positionIsActionable, decisionPurpose]);

  /*
   * CONTINUATION, DEFINED AS AN ACT RATHER THAN AS A LOCATION.
   *
   * "Still on /play" is not continuation and neither is a re-render: both are true of a player
   * who read the reveal and stopped. Putting a move on the board after having seen one is
   * something a person did, knowing what the product had to say -- which is the behaviour the
   * question "was that worth another decision" is actually about.
   *
   * Once per visit, because what the trial needs is whether they went on at all. The count of
   * decisions is already in the ledger under `decision_committed`, with an ordinal.
   */
  useEffect(() => {
    const reveals = revealsPresented();
    const started = continuationStarted({
      movePlaced: candidateMove !== null,
      revealsPresented: reveals,
      alreadyRecorded: trialEventSeen("next_decision_started"),
    });
    if (!started) return;
    recordTrialEvent({
      name: "next_decision_started",
      at: new Date().toISOString(),
      afterReveals: reveals,
    });
  }, [candidateMove]);

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
  const recordCounterfactual = useRecordCounterfactual();
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
    if (!saved) {
      setRestoreSettled(true);
      return;
    }
    try {
      const loaded = saved.sans.length ? buildHistory(saved.sans.join(" ")) : [];
      // A ply past the end of what replayed is a stored value this build cannot honour.
      const ply = Math.min(saved.ply, loaded.length - 1);
      setHistory(loaded);
      setCurrentPly(ply);
      setSource(saved.source);
      setFirstDecisionPly(saved.firstDecisionPly);
      setOrientation(saved.orientation);
      setOpponent(saved.opponent);
      /*
       * The arm, restored like everything else. This was the one field the handoff did not carry,
       * so a resumed deferred game silently continued as a coached one and the record ended up
       * holding a single game played under two conditions.
       */
      setRevealTiming(saved.revealTiming);
      gameId.current = saved.gameId;
      setNotice(
        loaded.length
          ? `חזרתם למשחק שהייתם בו — ${loaded.length} חצאי־מהלכים.`
          : "חזרתם למשחק שהייתם בו.",
      );
    } catch {
      /* Unreplayable. The opening position stands, which is where a fresh visit starts anyway. */
    } finally {
      setRestoreSettled(true);
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
      // The arm the game is being played under, so a reload does not move a deferred game into
      // the coached one. It is a condition, not a preference.
      revealTiming,
      firstDecisionPly,
      gameId: gameId.current,
    });
  }, [
    history,
    currentPly,
    source,
    orientation,
    opponent,
    revealTiming,
    firstDecisionPly,
    drill,
    learningTransfer,
  ]);

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

  /** `at` names the position played from and defaults to the one on screen; LAW 11 is why. */
  const playMove = useCallback(
    (from: string, to: string, at = { ply: currentPly, fen: activeFen }) => {
      const played = applyMoveAt(history, at, from, to);
      if (!played) return null;
      setHistory(played.history);
      setCurrentPly(played.ply);
      return played.san;
    },
    [activeFen, currentPly, history],
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
          searchWithVariety((fen, depth, count) => engine.analyzeAlternatives(fen, depth, count)),
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
      /*
       * DURING THE PROBE A BOARD INTERACTION NAMES THE ALTERNATIVE, and does not play it. The
       * board still shows the position the decision was made in -- it deliberately does not
       * advance at commit -- so the same gesture that chose the move is the one that names what
       * would have been played instead. Playing it here would move the board out from under the
       * reveal that is about to describe that position.
       */
      if (stage === PROBE_STAGE) {
        try {
          /* Against the position the PROBE asked about, not the one the timeline is showing. */
          new Chess(probe?.positionFen ?? activeFen).move({ from, to, promotion: "q" });
        } catch {
          setNotice("המהלך אינו חוקי בעמדה שעליה נשאלתם.");
          return;
        }
        setProbeAlternative(uci);
        setProbeError(undefined);
        return;
      }
      /* Every other stage refuses: `shared/board-authority.ts`, enforced in `ChessBoard`. */
      if (stage !== "deciding") return;
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
    [activeFen, playMove, probe, stage],
  );

  /**
   * Everything after the decision is stored: the engine runs, the reveal renders, the verdict is
   * written back.
   *
   * EXTRACTED FROM `onCommit`, and the extraction is what makes the counterfactual probe
   * possible. The probe has to sit between the commitment and the engine, so the engine half had
   * to become something a second caller could start. Nothing in here changed; it takes as
   * arguments the four values it used to close over.
   */
  const runReveal = useCallback(
    async (
      draft: DraftDecision,
      decisionId: string,
      positionFen: string,
      /** The ply `positionFen` is; passed in for the reason `transfer` above is. */
      positionPly: number,
      isDrillDecision: boolean,
      /**
       * The transfer run this decision belongs to, or null.
       *
       * PASSED IN RATHER THAN READ FROM STATE. It used to be a boolean beside a `learningTransfer`
       * this function closed over -- which types as possibly-null and, worse, could have MOVED ON
       * by the time this runs: the counterfactual probe now sits between the commit and here, so
       * "the transfer that was active when the decision was committed" and "the transfer that is
       * active now" are no longer the same value by construction.
       */
      transfer: LearningTransfer | null,
      /** The alternative the player named, or null. Scored off the same root search below. */
      alternative: string | null,
      /** Which timing was in force. Everything the player is SHOWN below is gated on it. */
      timing: RevealTiming,
    ) => {
      /*
       * THE ENGINE RUNS IN BOTH MODES; ONLY THE TELLING DIFFERS. The record needs the verdict on
       * every decision either way -- a deferred game that stored no evaluations would be forty
       * decisions nothing ever scored, which is not a measurement, it is a diary.
       */
      const speak = mayShowVerdictNow(timing);
      setCandidateMove(null);
      setCandidatesConsidered([]);
      setRevealFailure(null);
      if (isDrillDecision) setDrillDecisionIds((prev) => [...prev, decisionId]);
      if (speak) {
        setCommittedDraft(draft);
        setRevealAt({ fen: positionFen, ply: positionPly });
        setStage("revealed");
        setNotice("ההחלטה נרשמה. המנוע מחשב עכשיו.");
      } else {
        setNotice("ההחלטה נרשמה. המנוע שותק עד סוף המשחק.");
      }

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
        /*
         * THE ALTERNATIVE IS SCORED OUT OF THE SAME SEARCH, at no extra engine cost.
         *
         * `analyzeAlternatives` already returned the top `REVEAL_MULTIPV` root lines, and the
         * named alternative is very often one of them. Reading it from there rather than running
         * a second search is not only cheaper: both moves then come off one tree, one window and
         * one iteration, which is the same property that stopped the chosen move's own loss
         * charging the engine's best move nine centipawns for nothing.
         *
         * NULL WHEN THE MOVE IS NOT AMONG THE LINES, and null it stays. A move outside the top
         * eight is worse than the eighth-best -- the record could carry "at least this bad" and
         * the reading would still be honest -- but a bound is not a measurement, and every
         * consumer of `alternative_cp_loss` treats it as one. An unscored alternative reads as no
         * reading, which is what it is.
         */
        const alternativeCpLoss =
          alternative !== null && ended === null
            ? cpLossFromMultiPv(rootLines, alternative)
            : null;
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
        /*
         * `analysis` drives the evaluation bar. Setting it in a deferred game would put the
         * engine's number on the board's edge while the panel below it says nothing -- which is
         * the whole condition leaking through the one surface that is not a panel.
         */
        if (speak) setAnalysis(best);

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
          // The scale this level was pressed on, not a constant read later. It is the same value
          // the decision is committed with, so the reveal grades the number the record stores.
          confidenceScale: CONFIDENCE_LEVELS,
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
        if (speak) {
          setRevealInputs(inputs);
          /*
           * IT SAYS WHAT THE BOARD DOES, NOT WHERE IT IS. This ended "...נעול על העמדה שהחלטתם בה"
           * for one release, and the timeline is live at `revealed` -- so one press had this
           * `role="status"` asserting what `.reveal-elsewhere` denied. Where the board is belongs
           * to the banner, which derives it.
           */
          setNotice("ההחלטה נרשמה והמנוע ענה. הלוח כבר לא מקבל מהלכים.");
        }

        /*
         * ONE RETRY, WITH THE SAME OBJECT rather than a recomputed one.
         *
         * `reveal` writes the engine's verdict and then the alternative's price, and the two are
         * not atomic. Losing the second left the record holding a chosen-move score and no
         * alternative score -- which `readCounterfactuals` drops silently, so a row of the probe's
         * treatment arm left the denominator with no trace. Nothing retried, because this catch
         * only offers "next".
         *
         * THE PAYLOAD IS BUILT ONCE AND SENT TWICE. The price has to come out of the same search
         * that scored the chosen move -- that is why it travels on the reveal at all -- so a retry
         * that re-ran the engine would be storing two numbers from two trees under one decision.
         * It also lets the server tell a replay from a second, different reveal: the verdict is
         * compared field by field, and only an identical one is allowed to complete a null price.
         */
        const revealPayload = {
          decision_id: decisionId,
          result: {
            // The clamp, not the mate distance: `scoreCp` on a mate line is distance x 10000,
            // and the record is read back as centipawns by anything that reads it at all.
            engine_eval_cp: comparableCp(best),
            engine_best_move: bestMove,
            engine_depth: inputs.depth,
            engine_source: "local_sf18" as const,
            /*
             * WHICH BINARY, not just which family. `local_sf18` was the whole answer until now, and
             * ACTION_PLAN B1 measured 13.61% of decisions flipping verdict between two engines that
             * would both have written it.
             */
            engine_build: engineBuildId(),
            cp_loss: cpLoss,
          },
          alternative_cp_loss: alternativeCpLoss,
        };
        try {
          await retryOnce(() => submitReveal.mutateAsync(revealPayload));
          setRevealedDecisionId(decisionId);
          if (transfer) {
            /*
             * WRITTEN DOWN NOW, not held until the end. These used to accumulate in component
             * state for the whole run and reach the server only at completion, and three defects
             * came out of that: a reload lost them and the resume re-served positions whose
             * engine verdict the player had already seen; a failed reveal write stranded the run;
             * and the client was their only holder, so completion had to believe it.
             */
            await recordTransferObservation.mutateAsync({
              transfer_id: transfer.transfer_id,
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
          reportFailure("reveal-write-failed", "board");
          setRevealFailure("write");
          setNotice("ההחלטה נרשמה, אבל תוצאת המנוע לא נשמרה.");
          if (transfer) {
            setLearningTransferError("תוצאת המנוע לא נשמרה ולכן אי אפשר למדוד את העמדה הזו.");
          }
        }
        void decisionCount.refetch();
        /*
         * A DEFERRED GAME MOVES ON BY ITSELF. There is no reveal panel to read and therefore no
         * "next decision" button to press -- leaving the player on a screen with no control that
         * advances is the soft lock this codebase has already fixed once.
         *
         * The move is played HERE rather than before the search, so the engine is never running
         * against a position the board has already left, and two searches can never overlap on
         * one worker. The player waits for the search either way; the difference is that in this
         * mode the wait ends in the next position instead of a verdict.
         */
        if (!speak) {
          const played = uciToSquares(draft.chosenMove!);
          /* On the position it was taken in, like `nextDecision`: the timeline is live in the
             deferred wait, and `playMove` truncates from wherever it is told. */
          if (played) playMove(played.from, played.to, { ply: positionPly, fen: positionFen });
          setStage("deciding");
          setNotice("ההחלטה נרשמה. העמדה הבאה.");
        }
      } catch (error) {
        // No evaluation exists, so there is no reveal to render. Without this the screen
        // sat on "המנוע מחשב…" forever, with no control that advances.
        reportEngineFailure(error, "board");
        setRevealFailure("engine");
        setEngineStatus({ mode: "error", detail: "המנוע לא סיים את החישוב." });
        /* The commit's note said the engine was computing, and here it never will be again. */
        setNotice("ההחלטה נרשמה. המנוע לא סיים, והלוח כבר לא מקבל מהלכים.");
      }
    },
    [
      decisionCount,
      ensureEngine,
      learningTransferApplied,
      learningTransferRecall,
      playMove,
      recordTransferObservation,
      submitReveal,
    ],
  );

  /**
   * The answer, stored before the engine runs, and then the engine runs.
   *
   * BOTH ANSWERS GO DOWN THIS PATH. "I had nothing else" sends `null`, which the record stores as
   * an ANSWERED probe carrying no move -- a fact about the player, and on the four readings
   * arguably the most informative one available. It is not a skip and there is no skip: a
   * dismissable question fills the probed arm with the decisions where the player happened to
   * have an answer ready, which is the population most likely to differ from the control on
   * exactly the thing being measured.
   *
   * A FAILED WRITE DOES NOT COST THE PLAYER THEIR REVEAL. The decision is already on the record;
   * only the answer failed. The probe row stays absent, which reads as attrition in the probed
   * arm -- visible and countable -- and the reveal proceeds with no alternative to score, because
   * a reading built on an alternative the record does not hold would be a reading of nothing.
   */
  const onAnswerProbe = useCallback(
    async (alternative: string | null) => {
      if (!probe) return;
      setProbePending(true);
      setProbeError(undefined);
      let stored: string | null = alternative;
      try {
        await recordCounterfactual.mutateAsync({
          decision_id: probe.decisionId,
          alternative,
        });
      } catch {
        stored = null;
        setProbeError("התשובה לא נשמרה. ההחלטה עצמה רשומה, והמנוע ממשיך.");
      }
      setProbePending(false);
      setProbe(null);
      setProbeAlternative(null);
      await runReveal(
        probe.draft,
        probe.decisionId,
        probe.positionFen,
        probe.positionPly,
        probe.isDrillDecision,
        probe.transfer,
        stored,
        probe.timing,
      );
    },
    [probe, recordCounterfactual, runReveal],
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
       * The player's choice governs a live game and nothing else. `effectiveTiming` is where that
       * is decided, rather than here and at each of the two other places that would otherwise get
       * to have an opinion about it.
       */
      const timing = effectiveTiming(
        revealTiming,
        isDrillDecision ? "drill" : isLearningTransferDecision ? "transfer" : "game",
      );
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
      let event: CommitEvent;
      try {
        event = buildCommitEvent(
          decisionId,
          {
            gameId: isLearningTransferDecision ? learningTransfer.transfer_id : gameId.current,
            fen: activeFen,
            ply: isLearningTransferDecision ? learningTransferIndex : currentPly + 1,
            clockMsRemaining: null,
            purpose: decisionPurpose,
            /* What makes the line above checkable. One rule for both ids -- see `namedTest`. */
            ...namedTest(decisionPurpose, {
              drillId: drill?.drill_id,
              transferId: learningTransfer?.transfer_id,
            }),
          },
          draft,
          secondsTaken,
          timing,
        );
        await commitDecision.mutateAsync(event);
      } catch (error) {
        // R2: a decision that was not stored must never look like one that was. We do not
        // advance to reveal, and we say what happened.
        reportFailure("commit-failed", "board");
        setStage("deciding");
        // Never the raw message: on the default unauthenticated path this is LocalRecordStore's
        // English invariant text, and it lands on the screen that has to say the decision was not
        // recorded. The original is kept and demoted, not dropped.
        setCommitError(commitFailureText(error));
        return;
      }
      /*
       * THE COMMIT BOUNDARY, AND THE EVENT IS ON THE FAR SIDE OF IT.
       *
       * Above this line every path still returns: a missing field, a refused rule, a failed
       * write. `decision_committed` fires only where the decision is actually on the record, so
       * the funnel stage means "a decision exists" rather than "a button was pressed" -- and a
       * write failure shows up as an arrival that never committed, which is exactly what it is.
       *
       * `confidenceAsked` is the protocol's answer, not the player's: whether the question was
       * put. The value they gave is in the record and has no business in a trial log.
       */
      recordTrialEvent({
        name: "decision_committed",
        at: new Date().toISOString(),
        decisionId,
        ordinal: decisionsThisVisit.current + 1,
        purpose: decisionPurpose,
        confidenceAsked: event.bounded_action.confidence !== null,
      });
      decisionsThisVisit.current += 1;

      // Only now may the engine run at all.
      const positionFen = activeFen;
      const positionPly = currentPly;
      setDecisionsThisGame((n) => n + 1);

      /*
       * THE PROBE SITS HERE, AND NOWHERE ELSE IS AVAILABLE. The move is locked -- naming an
       * alternative can no longer turn into choosing one -- and the engine has not run, so the
       * answer is the player's own candidate rather than a reading of the engine's. `PROBE_STAGE`
       * is a stage `engineMayRun` refuses, which is what keeps the second half true.
       *
       * The arm was drawn inside `buildCommitEvent` and is already stored on the decision, so a
       * player who closes the tab here leaves an answered=false row in the probed arm: attrition
       * that is visible and countable, rather than a decision that quietly leaves the experiment.
       */
      if (event.probe?.assignment === "probed") {
        setProbe({
          decisionId,
          draft,
          positionFen,
          positionPly,
          isDrillDecision,
          transfer: isLearningTransferDecision ? learningTransfer : null,
          timing,
        });
        setProbeAlternative(null);
        setStage(PROBE_STAGE);
        setNotice("ההחלטה נרשמה. שאלה אחת לפני שהמנוע מדבר.");
        return;
      }

      await runReveal(
        draft,
        decisionId,
        positionFen,
        positionPly,
        isDrillDecision,
        isLearningTransferDecision ? learningTransfer : null,
        null,
        timing,
      );
    },
    [
      activeFen,
      commitDecision,
      currentPly,
      /* The purpose decides whether a stated confidence is written at all. A stale one here would
         record a decision as measured that was not, or the reverse -- silently, and forever. */
      decisionPurpose,
      drill,
      drillStage,
      learningTransfer,
      learningTransferIndex,
      learningTransferApplied,
      learningTransferStage,
      revealTiming,
      runReveal,
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
    /*
     * THE SAME PAYLOAD, TWICE, for the same reason the reveal does it.
     *
     * `finishDrill` gained an idempotent replay branch that repairs a claim whose grade write was
     * lost -- and it was unreachable from here. This catch sets the stage to "done", not back to
     * "running" the way the transfer runner does, and at "done" with no verdict `DrillRunner`
     * renders an error paragraph and no control at all: the verdict block is gated on `verdict`
     * and the abandon button on briefing|running. The drill id lives only in React state, so a
     * reload discards it. Nothing would ever have called `completeDrill` with it again.
     *
     * A server-side repair branch nothing retries is worth nothing. One retry, with the object
     * already built -- the decision ids are the record's, not recomputed, so the second attempt
     * asks the identical question and the replay branch answers it.
     */
    const drillPayload = { drill_id: drill.drill_id, decision_ids: drillDecisionIds };
    try {
      const result = await retryOnce(() => completeDrillMutation.mutateAsync(drillPayload));
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
        /*
         * RESUME WHERE THE RECORD IS, not at zero.
         *
         * This reset the index unconditionally, and a resumed run was therefore served a board the
         * player had already decided and already seen the engine's verdict for -- the exact thing
         * per-position writes were introduced to prevent. Worse, the server derived the slot being
         * answered by counting rows, so the mismatch refused the write and the transfer could
         * never be completed: the rule was left with a due date and no path that could test it.
         *
         * `observed` comes back with the resumed transfer now. A fresh start returns 0, so this is
         * the same line for both cases.
         */
        setLearningTransfer(response.transfer);
        setLearningTransferIndex(response.observed);
        setLearningTransferStage("briefing");
        setLearningTransferRecall("");
        setLearningTransferApplied(null);
        setLearningTransferObservations(response.observed);
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

  /** Where the next decision comes from, or null: `lib/continuation.ts`. */
  const continuation = useMemo(
    () => continuationAfter({ source, history, revealPly: revealAt.ply }),
    [history, revealAt.ply, source],
  );
  /** A run has its own way forward; otherwise the game the board came from decides. */
  const canContinue = inDrill || inLearningTransfer || continuation !== null;

  const nextDecision = () => {
    if (learningTransfer && learningTransferStage === "running") {
      void advanceLearningTransfer();
      return;
    }
    if (drill && drillStage === "running") {
      void advanceDrill();
      return;
    }
    /* `canContinue` gates every caller, so `continuation` is non-null here by construction. */
    if (!continuation) return;
    /* A loaded game continues along itself rather than being forked (LAW 4). */
    if (continuation.kind === "advance") {
      setCurrentPly(continuation.ply);
      resetDecision("בחרו מהלך וכתבו את הקריאה שלכם.");
      return;
    }
    // Play the move that was committed, then hand over the next position. If an opponent is
    // configured it answers from the effect below, which watches the position rather than this
    // call -- that way the opening move of a game the player takes as black is covered too.
    if (committedDraft?.chosenMove) {
      const move = uciToSquares(committedDraft.chosenMove);
      if (move) playMove(move.from, move.to, revealAt); // the position it was taken in
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
      /*
       * CLEARED, because a loaded game has no first decision of its own.
       *
       * `first` names the one position a handoff put in front of the player to produce their
       * first scoreable decision, and `Record` sets it to the ply it means when it means it.
       * Loading a PGN over the default board would otherwise leave the board's own 0 standing,
       * and a player who rewound to the start of someone else's game would have that decision
       * stamped as the front door's handoff. Null is the honest value: this game was not handed
       * over, so no ply in it is the first decision.
       */
      setFirstDecisionPly(null);
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
      // Cleared for the reason `importPgn` gives: a game loaded here was not handed over.
      setFirstDecisionPly(null);
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
  const newGame = (playerColor: "w" | "b", depth: OpponentDepth, timing: RevealTiming) => {
    setRevealTiming(timing);
    setDecisionsThisGame(0);
    setHistory([]);
    setCurrentPly(-1);
    /*
     * A NEW GAME'S OPENING DECISION IS A FIRST DECISION TOO, and it is the one the player actually
     * complained about: the front door was not the only way in, so exempting only the handoff
     * would have left a fresh game against the engine asking for everything on move one.
     *
     * Ply 0, because `currentPly` starts at -1 and the board records at `currentPly + 1`. A PLY
     * rather than a flag for the reason `firstDecisionPly` exists: a flag would need clearing once
     * used, a reload would undo the clearing, and the record would hold two decisions each
     * claiming to be the first of the game.
     */
    setFirstDecisionPly(0);
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
  /*
   * DECISION FOCUS (LAW 1). True in every stage except the reveal -- deciding, the write in
   * flight, and the counterfactual question in between.
   *
   * WHAT IT TURNS OFF, and why each one is not a nicety. `ClaimPanel` and `LearningQueue` are
   * readings of the record, shown while the player states how sure they are about a move; the
   * control rail is four ways to abandon the position under decision, at the same weight as each
   * other; and at `committed` -- the counterfactual stage -- the whole reveal column used to
   * render, dashboard and all, because the chain below branched on `deciding` and `deciding` is
   * false there. So the product asked "what would you have played instead?" with a panel of the
   * player's own accuracy rates beside the question.
   *
   * The argument was already in this file, one branch down, for the one condition where a player
   * had explicitly asked for silence:
   *
   *   REPLACES the claim panel and the learning queue for the duration, rather than joining them.
   *
   * It is every decision this product measures, not just that one.
   */
  const focus = makingEvidence(stage);
  /*
   * A PRE-REGISTERED RUN IS UNDER WAY, which makes the mode `TEST` rather than `REVEAL` (P1.12).
   * What the screen may show between two positions of a set chosen in advance is what it may show
   * while evidence is being produced, not what it may show once a decision is finished.
   */
  const runInProgress = learningTransfer !== null || (drill !== null && drillStage === "running");
  /**
   * A live game the player chose to have the engine stay quiet through.
   *
   * Narrowed to `source === "live"` and to neither a drill nor a transfer, because
   * `effectiveTiming` already forces those back to per-decision -- and a panel announcing silence
   * over a run that is about to show a verdict would be saying something false.
   */
  const silentGame =
    source === "live" &&
    !inDrill &&
    !inLearningTransfer &&
    !mayShowVerdictNow(effectiveTiming(revealTiming, "game"));
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
        <BrandLockup onNavigate={() => navigate("/")} />
        {/* `תור / לבן` was read here AND in `.workspace-meta` beside the board -- one fact at one
            rank, 400px apart, both competing with the task heading. The one next to the board is
            where the fact is used; nothing moved behind a disclosure. */}
        <div className="header-actions">
          {/*
            * THE CONTINUATION CONTROL IS `RevealPanel`'s, AND NOT ALSO THE HEADER'S (LAW 2).
            *
            * Both used to render, both `primary-control`, both calling `nextDecision`, under
            * identical conditions -- one act, two buttons. See `shared/primary-action.ts`. The
            * panel's survives because it sits under the sentence that says what taking it is for.
            * A transfer run keeps its own forward control here: it names a different experiment.
            */}
          {stage === "revealed" &&
            revealedDecisionId &&
            learningTransfer &&
            learningTransferStage === "running" && (
              <button
                className="primary-control"
                {...primaryAction("continue-run")}
                onClick={nextDecision}
              >
                העמדה הבאה
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
            <HelpCircle size={16} />
          </button>
          <button
            className="icon-control"
            aria-label="בדיקה עצמית של הדפדפן"
            aria-expanded={showSelfCheck}
            onClick={() => setShowSelfCheck((v) => !v)}
          >
            <Stethoscope size={16} />
          </button>
          <button
            className="icon-control"
            aria-label="הפוך את הלוח"
            onClick={() => setOrientation((v) => (v === "w" ? "b" : "w"))}
          >
            <FlipVertical2 size={16} />
          </button>
          {toggleTheme && (
            <button
              className="icon-control"
              aria-label={theme === "dark" ? "עברו לתצוגה בהירה" : "עברו לתצוגה כהה"}
              aria-pressed={theme === "dark"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
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
        onGoTo={focus ? undefined : (target) => {
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

      {/* One track per child that exists, off the same `focus` the rail is gated on. Gating only
          the rail left the board in the toolbox's 132px track: see `.workbench` in index.css. */}
      <section className={focus ? "workbench workbench-focus" : "workbench"}>
        {/*
          * THE ORDER OF THESE THREE IS THE READING ORDER, AND IT USED TO BE THE OTHER WAY ROUND.
          *
          * `.workbench` names its tracks and each child names its own, so what decides which
          * column a player meets FIRST is the direction the document runs in: on a right-to-left
          * page track 1 is the right edge. The task column was declared last, so on a Hebrew page
          * the surface the player WRITES INTO sat at the far left. Measured at 1440x900:
          * `.commitment-screen` at x=24..354, `.board-workspace` at x=382..1416.
          *
          * The task goes first now, which puts it at the reading start in either direction, and
          * the DOM order is the visual order so the tab order does not have to be repaired with
          * `order` or `tabindex`. `docs/INTERACTION_GEOMETRY.md`'s keyboard walk asserted the old
          * sequence and asserts this one.
          */}
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
                purpose: decisionPurpose,
              }}
              chosenMove={candidateMove}
              candidatesConsidered={candidatesConsidered}
              onCommit={onCommit}
              pending={stage === "committing"}
              error={commitError}
            />
          ) : null}
          {/*
            * Between the commitment and the engine, and rendered only in that stage. The board
            * above still shows the position the decision was made in, so the alternative is named
            * with the same gesture that chose the move.
            */}
          {stage === PROBE_STAGE && probe ? (
            <>
              <CounterfactualProbe
                chosenMove={probe.draft.chosenMove!}
                alternative={probeAlternative}
                pending={probePending}
                onAnswer={onAnswerProbe}
              />
              {probeError ? <p className="counterfactual-probe__error">{probeError}</p> : null}
            </>
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
          ) : deciding && silentGame ? (
            /*
             * REPLACES the claim panel and the learning queue for the duration, rather than
             * joining them. Both of those are readings of the record, and a screen that offers
             * readings while promising the engine is silent is offering the player a way around
             * the condition they chose.
             */
            <SilentGame
              decisions={decisionsThisGame}
              over={activeGame.isGameOver()}
              onSeeRecord={() => navigate("/")}
            />
          ) : focus ? (
            /*
             * THE INSTRUMENT AND NOTHING ELSE (LAW 1).
             *
             * Two states end up here and both used to render a reading of the record. `deciding`
             * showed the claim panel and the learning queue -- findings about the player's own
             * decisions, on screen while they state how sure they are about this one. `committed`,
             * the counterfactual stage, fell through to the reveal column below and got the whole
             * of it: the analysis panel, the record dashboard, the Lichess layers.
             *
             * Both readings are still reachable, at the reveal, which is the stage where the
             * engine has already spoken and a reading can no longer change what is recorded.
             */
            null
          ) : (
            <>
              {revealInputs && committedDraft ? (
                <RevealPanel
                  inputs={revealInputs}
                  analysis={analysis}
                  fen={revealAt.fen}
                  boardFen={activeFen}
                  statedKnown={committedDraft.known}
                  /* Null until the reveal is written: an unrecorded reveal is not a funnel stage,
                     and an id naming no committed decision cannot be joined to one. */
                  decisionId={revealedDecisionId}
                  /* A transfer keeps its own control; and not offered where it cannot be honoured. */
                  onContinue={
                    revealedDecisionId &&
                    (!learningTransfer || learningTransferStage === "running") &&
                    canContinue
                      ? nextDecision
                      : undefined
                  }
                />
              ) : revealFailure === null ? (
                <p className="reveal-waiting">המנוע מחשב את העמדה שהחלטת עליה…</p>
              ) : null}
              {/* Not beside a failure panel, which owns the way out. */}
              {revealInputs && !canContinue && !revealFailure && (
                <RevealNoContinuation onReturnToRecord={() => navigate("/")} />
              )}
              {/*
                * DIRECTLY UNDER THE REVEAL, and only from the second one onward.
                *
                * Attribution wants it as close to the reveal as it can get; the continuation
                * measurement wants it nowhere near the first one. The component owns that rule
                * and the reason for it -- what is decided here is only the position on the page,
                * which is under the thing the question is about and above everything that is not.
                *
                * `revealedDecisionId` gates it for the same reason it gates the panel: a reveal
                * that was never written is not one anybody was shown.
                */}
              {revealedDecisionId && (
                <Suspense fallback={null}>
                  <ValueReconstruction />
                </Suspense>
              )}
              {/*
                * Rendered under the reveal on a write failure -- that reveal is valid -- and
                * on its own when the engine never answered. Either way it carries the only
                * control that advances: the header's is gated on a reveal that was stored.
                */}
              {/* The way on after a failure has to be one that works, so it obeys the same rule. */}
              {revealFailure && (
                <RevealFailure
                  kind={revealFailure}
                  next={
                    canContinue
                      ? { label: "להחלטה הבאה", act: "next-decision", go: nextDecision }
                      : { label: "חזרה לרשומה", act: "return-record", go: () => navigate("/") }
                  }
                />
              )}
              {learningTransfer && learningTransferPanel}
              {EXPERIMENTAL_LEARNING_ENABLED &&
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
                * THE REVEAL IS A PATH, AND THIS IS THE ONE STEP OFF IT (LAW 2, P1.7).
                *
                * Above this line is what the decision just made turned out to be, and the two
                * things that act on it. Below it was everything else the product knows -- the
                * engine's lines, the whole-game review, the claim panel, the learning queue, the
                * record dashboard, the Lichess layers -- rendered at the same time, in the same
                * column, at the same weight. A column of nine sections does not offer nine things;
                * it offers a search.
                *
                * SECONDARY, AND IT SAYS WHAT IS BEHIND IT. The primary action of a reveal is the
                * next decision, and it is in the header. This is a way to look at the record, and
                * `EXPLORE` is the one mode with nothing at stake -- the decision is committed,
                * revealed and stored, so nothing on the far side of this button can change what
                * any of it said.
                */}
              {/*
                * NOT DURING A RUN (P1.12). A drill or a transfer in progress is `TEST`, not
                * `REVEAL` -- and `MODE_CONTRACT.TEST` forbids prior evidence for the same reason
                * `DECIDE` does: the positions in a run are pre-registered to test one thing, and a
                * player who reads the record dashboard between position three and position four
                * has been shown their own measurements in the middle of producing more.
                *
                * `EXPLORE` is safe at an ordinary reveal precisely because nothing is at stake
                * there. In a run something is: the run's own verdict.
                */}
              {!runInProgress && (
                <button
                  type="button"
                  className="explore-toggle"
                  aria-expanded={exploring}
                  onClick={() => setExploring((open) => !open)}
                >
                  {exploring ? "חזרה לתוצאה" : "מה עוד יש כאן"}
                </button>
              )}
              {exploring && !runInProgress && (
                <Suspense fallback={<p role="status">טוען…</p>}>
                <RecordExplorer
                  position={{ fen: activeFen, activeMove, material }}
                  engine={{
                    analysis,
                    alternative,
                    status: engineStatus,
                    onAnalyze: () => void runAnalysis(),
                  }}
                  review={{
                    progress: reviewProgress,
                    scores: reviewScores,
                    error: reviewError,
                    orientation,
                    totalPlies: history.length,
                    onRun: () => void runGameReview(),
                  }}
                  record={recordReading.data}
                  lichess={{ source, enabled: isAuthenticated, onConnect: openLichess }}
                  claims={{ onRunDrill: beginDrill, drillError: drillError ?? undefined }}
                  learning={{
                    onStart: (ruleId) => void beginLearningTransfer(ruleId),
                    busy: learningTransfer !== null,
                    error: learningTransferError ?? undefined,
                  }}
                />
                </Suspense>
              )}
            </>
          )}
        </aside>

        <section className="board-workspace">
          <div className="workspace-meta">
            <div>
              {/* `focus`, not `deciding`: the narrower reading said REVEAL at `committed`, where
                  the counterfactual is open and the engine has not run, and at `blocked`, where the
                  write failed. `MODE_OF_STAGE` calls all four DECIDE. Measured in a browser. */}
              <p>{focus ? "DECIDE" : "REVEAL"}</p>
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
          <ExplainerOverlays
            help={showHelp}
            selfCheck={showSelfCheck}
            onCloseHelp={() => setShowHelp(false)}
            onCloseSelfCheck={() => setShowSelfCheck(false)}
          />

          {/*
            * ONE OVERLAY, FOUR ROOMS -- not one overlay per source stacked on the last.
            *
            * `showNewGame`, `showPgn` and `showImport` were three sibling overlays, and reaching
            * a second one meant closing the first from a rail button that had to remember to.
            * This is a single surface whose body is either the menu or the chosen source, with a
            * way back that does not close the door. Nothing nests, so nothing has to be unstacked.
            */}
          {showPositionSource && (
            <PositionSourceOverlay
              choice={positionChoice}
              onChoose={choosePositionSource}
              onBack={() => setPositionChoice(null)}
              onClose={closePositionSource}
            >
              {positionChoice === "new" && (
                <NewGameSetup
                  color={setup.color}
                  depth={setup.depth}
                  revealTiming={setup.revealTiming}
                  onColor={setup.setColor}
                  onDepth={setup.setDepth}
                  onRevealTiming={setup.setRevealTiming}
                  onStart={() => {
                    setup.remember();
                    newGame(setup.color, setup.depth, setup.revealTiming);
                  }}
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
                <PgnDrawer
                  value={pgnInput}
                  onChange={setPgnInput}
                  onLoad={() => importPgn(pgnInput)}
                  onSample={() => setPgnInput(DEFAULT_PGN)}
                  onClose={closePositionSource}
                />
              )}
            </PositionSourceOverlay>
          )}

          {showReading && importReading.reading && (
            <SavedReadingOverlay
              reading={importReading.reading}
              onClose={() => setShowReading(false)}
            />
          )}

          <div className="board-assembly">
            {/* The evaluation bar does not exist while deciding. Not hidden -- absent. */}
            {stage === "revealed" && <EvaluationBar analysis={analysis} currentFen={activeFen} />}
            <ChessBoard
              board={board}
              orientation={orientation}
              /* The stage, and whether the board is on the position the probe asked about. */
              authority={boardAuthorityFor({ stage, onTheQuestionsPosition: !probe || activeFen === probe.positionFen })}
              sideToMove={activeGame.turn()}
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
              <Clipboard size={14} /> העתק FEN
            </button>
          </div>
        </section>

        {/*
          * NOT ON SCREEN WHILE A DECISION IS OPEN (LAW 1, LAW 2).
          *
          * Every control in this rail answers "give me something else": another position, another
          * account, a reading from another day. Offered beside an open decision they are four
          * equal-weight ways to discard the thing being measured -- and the panel's submit, which
          * is the one primary action of this state, has to compete with them for the eye.
          *
          * ABSENT RATHER THAN DISABLED. A disabled control still says "there is a thing here you
          * could be doing", which is the cost this removes. It comes back at the reveal, where
          * choosing what to do next is exactly what the player is there for.
          */}
        {!focus && (
          <ControlRail
            showPositionSource={showPositionSource}
            onTogglePositionSource={() =>
              showPositionSource ? closePositionSource() : openPositionSource()
            }
            savedReading={Boolean(importReading.reading)}
            onOpenSavedReading={() => {
              setShowReading((v) => !v);
              closePositionSource();
            }}
            onOpenLichess={openLichess}
            fileRef={fileRef}
            onImportPgn={importPgn}
          />
        )}
      </section>

      <MoveTimeline moves={history} currentPly={currentPly} onNavigate={setCurrentPly} />
    </main>
  );
}
