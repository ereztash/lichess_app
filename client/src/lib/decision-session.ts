/**
 * The client-side decision state machine (R3).
 *
 * The engine is a RESULT, never a teacher. It is not permitted to render -- or to be started,
 * or to appear in the DOM or the network tab -- before the player has committed a move and a
 * stated reason. This machine is what makes that structural rather than a matter of discipline:
 * `engineMayRun` is false in every state except `revealed`, and the reveal state cannot be
 * reached except through a recorded commit.
 *
 * Time-to-decide is captured here. It is a predictor, not telemetry (section 4.1).
 */
import { CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION } from "@shared/confidence";
import type { DecisionAtom, StatedParts } from "@shared/decision-atom";
import { assignProbe } from "@shared/counterfactual";
import type { RevealTiming } from "@shared/reveal-timing";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import { comparableCp, hasEvaluation, type EngineLine } from "@/lib/engine-line";
import { classifyPhase } from "@shared/phase";
import { composeStatement } from "./read-options";
import { confidenceIsAsked, readsAreAsked, type DecisionPurpose } from "@shared/confidence-asked";

export type SessionStage = "deciding" | "committing" | "committed" | "revealed" | "blocked";

export interface PositionUnderDecision {
  gameId: string;
  fen: string;
  ply: number;
  clockMsRemaining: number | null;
  /**
   * Why this position is in front of the player, which decides whether the confidence question is
   * put at all -- see shared/confidence-asked.ts.
   *
   * It travels ON THE POSITION rather than as a prop of its own, because it is a fact about the
   * position and it has to reach every place the position already reaches: the screen that asks,
   * the check that says what is still missing, and the event that gets written.
   */
  purpose: DecisionPurpose;
  /**
   * The drill this position was drawn for, when `purpose` is `drill`.
   *
   * OPTIONAL HERE AND NULLABLE ON THE WIRE, which is the one place the two differ on purpose: a
   * caller for a position that is not a drill should not have to write `drillId: null`, and the
   * event that leaves this function must say `null` rather than omit the key, because the boundary
   * distinguishes "not a drill" from "a drill that named nothing".
   */
  drillId?: string | null;
}

export interface DraftDecision {
  chosenMove: string | null;
  /**
   * The read, tapped. Labels rather than ids: the label is what goes on the record, in the
   * player's own language, and an id would make the record unreadable without this table.
   */
  knownTags: string[];
  /** The read, typed. Optional, and additive to the tags -- not an alternative to them. */
  known: string;
  unknownTags: string[];
  unknown: string;
  confidence: number | null;
  candidatesConsidered: string[];
}

export const emptyDraft = (): DraftDecision => ({
  chosenMove: null,
  // Nothing preselected, deliberately. A default read is the machine stating one on the player's
  // behalf and then measuring them against it.
  knownTags: [],
  known: "",
  unknownTags: [],
  unknown: "",
  confidence: null,
  candidatesConsidered: [],
});

/** What this draft actually asserts for one field: what was tapped plus what was typed. */
export const statedKnown = (draft: DraftDecision) => composeStatement(draft.knownTags, draft.known);

/**
 * The parts of one read field, or null when the player said nothing at all.
 *
 * NULL AND `{ tapped: [], typed: "" }` ARE DIFFERENT FACTS and the reading depends on telling them
 * apart: one is "nobody recorded this", the other is "the menu was put and refused". Only the
 * second says anything about the words.
 */
const statedParts = (tapped: string[], typed: string): StatedParts | null => {
  const text = typed.trim();
  if (tapped.length === 0 && text.length === 0) return null;
  return { tapped, typed: text };
};
export const statedUnknown = (draft: DraftDecision) =>
  composeStatement(draft.unknownTags, draft.unknown);

export interface DraftProblem {
  field: keyof DraftDecision;
  message: string;
}

/**
 * What is still missing before this decision can be recorded. Returned as a list rather than a
 * boolean so the interface can say WHICH part is absent -- "incomplete" and "invalid" are
 * different states and must not render the same (R2).
 */
export function draftProblems(
  draft: DraftDecision,
  /* The whole position, not just its purpose: the draw that decides an ordinary decision needs the
     game, the FEN and the ply, and passing four loose arguments is four chances to pass the wrong
     one. */
  position: Pick<PositionUnderDecision, "purpose" | "gameId" | "fen" | "ply">,
): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.chosenMove) {
    problems.push({ field: "chosenMove", message: "לא נבחר מהלך." });
  }
  /*
   * REQUIRED EVERYWHERE EXCEPT THE FIRST DECISION OF A GAME.
   *
   * They are the ordering rule, not a measurement: R3 says the player states what they can read
   * BEFORE the engine speaks, and nothing downstream reads these two -- the detector never looks
   * at them, and `vocabulary-reading` reads the PARTS to measure the menu rather than the answer.
   * So the cost of requiring them is paid on every decision and the benefit is the discipline.
   *
   * On the opening decision that trade is the wrong way round. It is the one moment the player
   * has not yet seen what the loop asks, so the wall of questions IS their first impression of
   * the product, and a rule nobody has been taught yet is not discipline -- it is a toll. One
   * decision per game is a bounded exemption, and the record can say which one it was: a first
   * decision is exactly the one whose ply the handoff named.
   *
   * NOT MADE OPTIONAL EVERYWHERE, for the reason the confidence question is not: a field somebody
   * may skip is filled by whoever felt like filling it. Across the whole record that would curate
   * the vocabulary measurement on how articulate the player was feeling, which is the thing it
   * exists to read.
   *
   * AND ON A FIRST DECISION IT IS EXACTLY THAT, WHICH IS THE COST. Optional here means the first
   * decisions that DO carry words are the ones whose player felt like typing, so the words on
   * them are a self-selected sample and the escape rate over them is not comparable to the rest
   * of the record. What keeps this bounded rather than corrosive: it is one decision per game,
   * and `known_parts: null` makes the omission COUNTABLE -- `readVocabulary` reports `unrecorded`
   * beside `recorded`, so the size of the self-selected hole is on the page rather than averaged
   * into the finding. An analysis that wants a clean vocabulary reading drops them, and it can do
   * that from the record alone now: the purpose is stamped on the decision, so a first decision is
   * identifiable afterwards rather than only at the moment it was taken.
   */
  if (readsAreAsked(position)) {
    if (statedKnown(draft).length === 0) {
      problems.push({ field: "known", message: "לא נאמר מה אתם קוראים בעמדה." });
    }
    if (statedUnknown(draft).length === 0) {
      problems.push({ field: "unknown", message: "לא נאמר מה אי אפשר להעריך כאן." });
    }
  }
  /*
   * ASKED ONLY WHERE SOMETHING READS IT. On every other position the question is not on the
   * screen at all, so it cannot be missing -- requiring it here would refuse a decision for
   * failing to answer something nobody asked.
   */
  if (confidenceIsAsked(position) && draft.confidence === null) {
    problems.push({ field: "confidence", message: "לא נבחרה רמת ביטחון." });
  }
  return problems;
}

export const isCommittable = (
  draft: DraftDecision,
  position: Pick<PositionUnderDecision, "purpose" | "gameId" | "fen" | "ply">,
) => draftProblems(draft, position).length === 0;

/**
 * The engine may only run once the decision is on the record. Every other stage returns false,
 * including `committing` -- a write in flight is not a completed write.
 */
export const engineMayRun = (stage: SessionStage): boolean => stage === "revealed";

/**
 * LAW 1: the player is producing evidence right now, so nothing may show them prior evidence.
 *
 * WHILE THIS IS TRUE, no reading of the record may be on screen -- not the claim panel, not the
 * learning queue, not the record dashboard, not a pattern already found. A calibration gap is
 * `confidence - accuracy`, and the confidence is STATED on this screen. Stating it beside a panel
 * describing the player's calibration does not measure what they believed; it measures what they
 * believed after being told, and nothing downstream can separate the two afterwards.
 *
 * WRITTEN AS A NEGATION, WHICH IS THE WHOLE POINT. An allowlist of the stages that hide prior
 * evidence would let a stage added later show it by default, and the cost of that default is a
 * contaminated measurement that looks exactly like a clean one. A new stage is mid-evidence until
 * somebody says otherwise, in this function, deliberately.
 *
 * THE SAME BOUNDARY AS `engineMayRun`, AND THAT IS NOT A COINCIDENCE: the moment the engine is
 * allowed to speak is the moment the record is allowed to. Before it, both are things the product
 * would be saying to a player whose answer it has not finished collecting. They are two rules
 * rather than one alias because they could legitimately diverge -- and if they ever do, somebody
 * has to write it down. `tests/client/nothing-to-read-while-you-decide.test.tsx` holds the
 * partition, so the divergence cannot happen quietly.
 */
export const makingEvidence = (stage: SessionStage): boolean => stage !== "revealed";

/**
 * The commit event. Field names are the atom's, unchanged (section 3.1, GATE-ISO).
 *
 * `result` and `feedback` are typed as exactly `null`, not as nullable: at commit time the
 * engine has not spoken (R3) and the player has not revised anything. Widening these to the
 * atom's nullable types would make an event carrying an evaluation constructible here, which
 * is precisely what R3 forbids. The narrowing is the enforcement.
 */
export type CommitEvent = Omit<DecisionAtom, "result" | "feedback"> & {
  decision_id: string;
  result: null;
  feedback: null;
};

/**
 * THE ARM IS DRAWN HERE, AT COMMIT, AND NOT WHEN THE POSITION IS ENTERED.
 *
 * The two are statistically identical -- `assignProbe` cannot see the position, which is the
 * property its test pins -- but they are not identical in what they make possible. An arm that
 * exists while the player is still deciding is an arm that some future pre-commit screen could
 * read, and the moment anything before the commitment differs between arms, the comparison
 * between them stops being about the question and starts being about the interface. Drawing at
 * commit makes that leak unwritable rather than discouraged.
 *
 * `draw` is a parameter so a test can drive it; production passes nothing.
 */
export function buildCommitEvent(
  decisionId: string,
  position: PositionUnderDecision,
  draft: DraftDecision,
  secondsTaken: number,
  /**
   * Which reveal timing this decision was made under. Required from a live client, because the
   * client is the only thing that knows -- and a decision whose condition nothing recorded is one
   * that can never be pooled with either mode afterwards.
   */
  revealTiming: RevealTiming,
  draw: () => number = Math.random,
): CommitEvent {
  const problems = draftProblems(draft, position);
  if (problems.length) {
    throw new Error(`decision is not committable: ${problems.map((p) => p.message).join(" ")}`);
  }
  const arm = assignProbe(position.fen, draw);
  return {
    decision_id: decisionId,
    entry_state: {
      game_id: position.gameId,
      fen: position.fen,
      ply: position.ply,
      phase: classifyPhase(position.fen, position.ply),
      clock_ms_remaining: position.clockMsRemaining,
    },
    /*
     * STAMPED, NOT DERIVED AND DISCARDED. The purpose already decided two things about this
     * decision -- whether the confidence question was put, and whether the two read fields were
     * required -- and until it was written down neither of those was answerable from the row
     * afterwards. Sending it is what lets the boundary check the exemption it is exercising.
     */
    purpose: position.purpose,
    /*
     * WHAT MAKES THE LINE ABOVE CHECKABLE. `purpose` is the one atom field the server cannot
     * re-derive, and `drill` is the value where that matters most -- it is the label that keeps a
     * decision out of discovery. Sending the drill's id lets the boundary resolve it against a
     * drill that was written down before the decision was made and confirm the position is one of
     * the ones that drill registered.
     */
    drill_id: position.drillId ?? null,
    known: statedKnown(draft),
    unknown: statedUnknown(draft),
    /*
     * The same answer, unjoined. `statedKnown` above runs the two through `composeStatement`,
     * which is the only thing the record used to keep -- and the join is exactly where the
     * product's one measurement about its own vocabulary was being thrown away. Both are written:
     * `known` is what the player asserted and every reader already reads it; these say how it was
     * said. A test holds the two consistent, so the redundancy is a checked invariant rather than
     * two sources that can drift apart.
     */
    /*
     * NULL WHEN NOTHING WAS SAID, and this is the whole reason the exemption above is safe.
     *
     * Writing `{ tapped: [], typed: "" }` for a first decision nobody was required to answer
     * would put it in `vocabulary-reading`'s `recorded` count as a decision where the menu was
     * offered and the player picked nothing -- which reads as the list failing. It did not fail;
     * it was not put. `readVocabulary` counts nulls separately as `unrecorded` and prints the
     * size of what cannot be read, so a null here is the difference between a hole the reading
     * declares and a zero it quietly averages in.
     */
    known_parts: statedParts(draft.knownTags, draft.known),
    unknown_parts: statedParts(draft.unknownTags, draft.unknown),
    decision: draft.chosenMove!,
    bounded_action: {
      seconds_taken: secondsTaken,
      /*
       * Null where the question was never put. NOT `draft.confidence!` with a fallback: a default
       * here would be the machine stating a belief on the player's behalf and then measuring them
       * against it, and `scoreDecisions` is built to exclude the null rather than read one.
       */
      confidence: confidenceIsAsked(position) ? draft.confidence : null,
      /*
       * Sent with every commit, never inferred server-side. A stated level is meaningless without
       * the scale it was stated on: "בטוח" was 4 of 5 and is 6 of 7, so the same integer asserts
       * two different probabilities depending only on which build a player was using.
       */
      confidence_scale: CONFIDENCE_LEVELS,
      /*
       * AND WHICH GRID THAT SCALE IS. Sent from the constant rather than left absent, so the row
       * says what it was stated on instead of being dated by inference. Absence is only readable
       * while exactly one version has shipped; a stamp stays readable afterwards.
       */
      confidence_grid_version: CONFIDENCE_GRID_VERSION,
      /*
       * TOUCH ORDER IS THE DATA, and this line used to destroy it.
       *
       * `handleBoardMove` appends each distinct move in the order it was put on the board, and
       * the chosen move is in there at its own position -- choosing is touching. The old write
       * was `new Set([chosenMove, ...touched])`, which prepends; `Set` keeps the FIRST
       * occurrence, so the chosen move was forced to index 0 and its real position was lost.
       *
       * What that erased: whether the engine's move was touched FIRST and then abandoned, or
       * touched LAST and rejected. Those are opposite events. One is "you had it and talked
       * yourself out of it"; the other is "you weighed it and decided against it" -- and the two
       * bodies of literature on move choice prescribe opposite remedies for them. The product
       * currently asserts the second reading in as many words. It cannot tell which it has.
       *
       * Appending instead of prepending keeps the guarantee (the chosen move is always present)
       * and costs the player nothing: no new field, no new interaction, same array type.
       */
      candidate_moves_considered: keepTouchOrder(
        draft.candidatesConsidered,
        draft.chosenMove!,
      ),
    },
    probe: {
      assignment: arm.assignment,
      legal_moves: arm.legalMoves,
      /*
       * Empty at commit, and refused by the service if they are not. The question is put AFTER
       * this event is sent -- an answer riding along means the client asked first, and naming an
       * alternative before committing to a move is how naming one turns into choosing it.
       */
      alternative: null,
      answered: false,
      alternative_cp_loss: null,
    },
    reveal_timing: revealTiming,
    /*
     * THIS PATH IS THE UNTIMED COMMITMENT LOOP, and it says so rather than leaving the field for
     * somebody downstream to infer. It is the only protocol this function can produce: there is no
     * clock here, and the engine runs after every decision in both reveal modes -- which is why
     * `analysis_timing` is `during-play` even when the verdict is withheld until the end.
     *
     * A blitz decision will not come through here. When it has its own path, it stamps its own
     * protocol, and a row that came from this function can never be mistaken for one that did not.
     */
    measurement_protocol: "instrumented-standard",
    protocol_version: CURRENT_PROTOCOL_VERSION,
    analysis_timing: "during-play",
    result: null,
    feedback: null,
  };
}

/**
 * The moves that were on the board, in the order they got there, capped at what the atom holds.
 *
 * The cap is the reason this is not one expression. Truncation must never drop the move actually
 * played -- an atom whose `decision` is absent from its own candidate list is incoherent, and it
 * would silently break the one branch that reads this field. So the first `MAX` are kept in touch
 * order, and if the chosen move fell outside that window it takes the last slot: the record then
 * says "this was touched, late" rather than losing it, which is true and is the least it can say.
 */
const MAX_CANDIDATES = 8;

export function keepTouchOrder(touched: string[], chosenMove: string): string[] {
  const ordered = [...new Set([...touched, chosenMove])];
  const kept = ordered.slice(0, MAX_CANDIDATES);
  if (!kept.includes(chosenMove)) kept[kept.length - 1] = chosenMove;
  return kept;
}

/** Centipawn loss from the mover's perspective. Never negative: choosing better than the
 *  engine's line at this depth means the depth was insufficient, not that loss was negative. */
export function centipawnLoss(bestEvalCp: number, chosenEvalCp: number): number {
  return Math.max(0, bestEvalCp - chosenEvalCp);
}

/**
 * Centipawn loss read out of ONE MultiPV search of the root.
 *
 * THE DEFECT THIS REMOVES, and it is structural rather than statistical. Loss used to be a root
 * search minus a search of the position the move PRODUCED. Those are not the same measurement:
 * the child at depth d looks d plies ahead from one ply further along, and alpha-beta is
 * parity-sensitive, so the two scores come off different horizons. Measured against Stockfish 18
 * on 110 real positions by feeding that arithmetic the engine's OWN BEST MOVE -- which a sound
 * oracle charges nothing -- it returned a mean of 9.0cp and scored 7.3% of them "inaccurate"
 * against the 30cp threshold. The best move on the board, called a mistake.
 *
 * Here both scores come out of the SAME search: same tree, same window, same iteration. So the
 * best move is charged exactly zero BY CONSTRUCTION, not by luck -- 110 of 110 in the same run --
 * and the defect cannot recur without the arithmetic changing.
 *
 * A ROUTE NOT TAKEN, because it was measured and it was worse. Restricting a second root search
 * to the one move with UCI `searchmoves` looks equivalent and is not: with no sibling moves there
 * are no cutoffs from them, so the window differs. Same control, same positions: mean 12.0cp and
 * 12.7% "inaccurate" -- worse than the method it was meant to replace, on every statistic.
 *
 * RETURNS NULL WHEN THE MOVE IS NOT IN THE LINES, which happened for 10% of real played moves at
 * MultiPV 8. That is not a gap to paper over: a move outside the top eight is far worse than the
 * eighth-best, so it is nowhere near the 30cp threshold, and the caller can fall back to the old
 * arithmetic without risking the classification. The instrument error matters where the threshold
 * is, and that is exactly the region this covers.
 */
/** How many root lines the reveal asks for. Measured: covers 90% of real played moves. */
export const REVEAL_MULTIPV = 8;

export function cpLossFromMultiPv(lines: EngineLine[], chosenMove: string): number | null {
  const best = lines[0];
  if (!best || !hasEvaluation(best)) return null;
  const chosen = lines.find((line) => (line.bestMove ?? line.pv[0]) === chosenMove);
  if (!chosen || !hasEvaluation(chosen)) return null;
  return centipawnLoss(comparableCp(best), comparableCp(chosen));
}

/**
 * Centipawn loss computed from two engine searches, handling the perspective flip.
 *
 * NO LONGER THE LIVE REVEAL'S PATH -- see `cpLossAtRoot` above, which searches one root twice
 * instead of a root and its child. This remains for the import path, which analyses a whole game
 * as a sequence of positions and has no root to restrict a search on. The perspective note below
 * is exactly why the root version is safer: the negation is only necessary because the second
 * search moved the root, and a negation that is only sometimes necessary is a hazard.
 *
 * UCI `score cp` is always from the side-to-move's point of view. The first search runs with the
 * PLAYER to move, so its score is already theirs. The second runs on the position after their
 * move, where the OPPONENT is to move -- so that score must be negated before comparing.
 *
 * Getting this backwards produces a plausible number with the wrong sign, which is exactly the
 * kind of error that survives review and then feeds a claim.
 *
 * IT TAKES LINES AND NOT NUMBERS, and that is the fix rather than a tidying. It used to take two
 * `scoreCp` values, and `scoreCp` on a mate line is the mate distance times ten thousand -- so
 * the caller handed it a quantity that is not centipawns and it had no way to know. Measured
 * against the shipped code, on positions the engine reports as mate:
 *
 *     delivering mate in 9, playing the FASTEST mate   -> cp_loss 10000 -> "inaccurate"
 *     delivering mate in 2, playing the FASTEST mate   -> cp_loss 10000 -> "inaccurate"
 *     being mated in 4, ACCELERATING it to mate in 1   -> cp_loss     0 -> "ACCURATE"
 *
 * Both errors push the calibration gap the same way -- the first lands on decisions stated at
 * full confidence and marks them wrong, the second lands on hopeless positions and marks them
 * right -- and both concentrate in the endgame, where the detector has a phase bucket. Taking
 * the line means `comparableCp` is unavoidable and a caller cannot reintroduce this by passing
 * the wrong field.
 */
export function cpLossFromSearches(best: EngineLine, afterChosen: EngineLine): number {
  const chosenFromPlayersView = -comparableCp(afterChosen);
  return centipawnLoss(comparableCp(best), chosenFromPlayersView);
}

/**
 * The cost of a move that ENDED the game, where there is no second search to compare against.
 *
 * A terminal position has no legal reply, so the engine emits no principal variation and
 * `analyze` resolves with `emptyLine` -- `scoreCp: 0`. Fed to the comparison above, that reads as
 * a dead-level evaluation, and the arithmetic then charges the player their entire advantage for
 * winning: a mate delivered from a +5.00 position scored as a 500-centipawn blunder, on the best
 * move of the game.
 *
 * Neither outcome needs the engine, because both are facts of the rules rather than evaluations:
 *
 *   - Checkmate is the best available move by definition. Nothing scores higher, so the loss is
 *     zero. This is not the clamp and not a convention; there is no better move to have played.
 *   - A draw by stalemate, repetition, the fifty-move rule or insufficient material really is
 *     0.00, so the loss is whatever the player was giving up by drawing -- which is the ordinary
 *     comparison against a genuine zero.
 */
export function cpLossOfFinalMove(best: EngineLine, outcome: "checkmate" | "draw"): number {
  return outcome === "checkmate" ? 0 : centipawnLoss(comparableCp(best), 0);
}
