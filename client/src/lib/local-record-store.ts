/**
 * The record, kept in this browser.
 *
 * Every record procedure on the server is `protectedProcedure`, and sign-in needs an OAuth portal
 * that a deployment may simply not have. That made the whole loop -- commit, reveal, claim, drill
 * -- unreachable: the board accepted a move and then refused to record the decision, so the
 * product could not be used at all.
 *
 * This implements the SAME `RecordStore` contract the server does, so `shared/record-service.ts`
 * runs unchanged against it. R3, R5 and append-only are enforced by that shared code, not
 * re-implemented here; this file is storage and nothing else.
 *
 * The record holds a player's reasoning in their own words. Here it does not merely stay inside
 * the deployment -- it never leaves the machine.
 */
import type { PreregisteredHypothesis } from "@shared/prereg";
import type { StoredImportDiagnostic } from "@shared/import-diagnostic";
import type { Claim, ProspectiveDrillResult } from "@shared/claim";
import type { DecisionAtom, DecisionResult, ProbeAssignment } from "@shared/decision-atom";
import { assembleProbe } from "@shared/counterfactual";
import type { RevealTiming } from "@shared/reveal-timing";
import type {
  LearningRule,
  LearningTransfer,
  LearningTransferObservation,
  LearningTransferResult,
} from "@shared/learning-record";
import type {
  CommitDecisionInput,
  FeedbackInput,
  RecordStore,
  StoredDrill,
} from "@shared/record-store";

const KEY = "decision-lab.record.v1";

type Persisted = {
  decisions: StoredDecision[];
  reveals: Record<string, DecisionResult>;
  feedbacks: Record<string, FeedbackInput>;
  /**
   * Keyed by decision id, and PRESENCE IS THE MEASUREMENT: a key means the question was put and
   * answered. `alternative: null` inside one means asked and unable to name a move, which is a
   * different fact from never having been asked and has to stay distinguishable.
   *
   * Optional on the type because this store reads JSON an earlier build wrote, and those saves
   * have no such key at all.
   */
  counterfactuals?: Record<string, { alternative: string | null; cpLoss: number | null }>;
  claims: Record<string, Claim>;
  drills: Record<string, StoredDrill>;
  drillResults: ProspectiveDrillResult[];
  learningRules: Record<string, LearningRule>;
  learningTransfers: Record<string, LearningTransfer>;
  /** Keyed `transferId#position`, mirroring the composite primary key in the database. */
  learningTransferObservations: Record<string, LearningTransferObservation>;
  learningTransferResults: LearningTransferResult[];
  /** Append-only, newest last. See shared/prereg.ts. */
  preregs: PreregisteredHypothesis[];
  /** Append-only, newest last. See shared/import-diagnostic.ts. */
  importReadings: StoredImportDiagnostic[];
};

const empty = (): Persisted => ({
  decisions: [],
  reveals: {},
  feedbacks: {},
  counterfactuals: {},
  claims: {},
  drills: {},
  drillResults: [],
  learningRules: {},
  learningTransfers: {},
  learningTransferObservations: {},
  learningTransferResults: [],
  preregs: [],
  importReadings: [],
});

/**
 * How long what we write survives.
 *
 * "persistent" means localStorage took it and it is still there after the tab closes.
 * "session-only" means localStorage refused and the record lives in this page's memory until
 * the tab is closed or reloaded.
 */
export type RecordDurability = "persistent" | "session-only";

/**
 * Storage that is present but unusable must not look like storage that is empty, and it must
 * not end the loop either.
 *
 * A private window, disabled site data, a privacy extension, an enterprise policy or a full
 * quota all make localStorage throw. This file used to let that throw escape: `write` was
 * deliberately unguarded so a lost decision could not be mistaken for a stored one. That was
 * right about R2 and wrong about everything else -- the commit failed, the reveal never
 * happened, and the product was not degraded but unusable, in a browser configuration the
 * player may not be able to change.
 *
 * So the fallback is memory, and the honest part is moved to the label rather than the failure:
 * the decision IS kept, for this session, and `durability()` says so out loud so the screen can
 * too. R2 is satisfied by naming the scope, not by refusing to store. What must never happen is
 * a session-only record rendering exactly like a persistent one, and that is now a difference
 * the UI can see.
 *
 * `session` is module-level on purpose: record-api.ts constructs a LocalRecordStore per hook, so
 * a per-instance fallback would give each hook its own private record.
 */
let session: Persisted | null = null;

function probeWritable(): boolean {
  try {
    const probe = `${KEY}.probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Where the record is being kept right now. */
export function localRecordDurability(): RecordDurability {
  if (session !== null) return "session-only";
  return probeWritable() ? "persistent" : "session-only";
}

function read(): Persisted {
  if (session !== null) return session;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return empty();
  }
}

function write(state: Persisted): void {
  if (session !== null) {
    session = state;
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Downgrade in place, carrying this write. A quota that fills mid-session must not lose the
    // decision that filled it, and from here on every read comes from memory -- so what the
    // player sees stays consistent with what was actually kept.
    session = state;
  }
}

/**
 * Whether a record can be kept here at all.
 *
 * Always true now: memory is a backing. The question the screen has to ask is not whether the
 * decision will be kept but for how long, and that is `localRecordDurability`.
 */
export function localRecordAvailable(): boolean {
  return true;
}

/** Test seam. Clears the in-memory fallback so a case can start from a known backing. */
export function resetSessionFallbackForTests(): void {
  session = null;
}

export class LocalRecordStore implements RecordStore {
  /** Whether this browser will keep what we write at all. See localRecordDurability for how long. */
  async isAvailable(): Promise<boolean> {
    return localRecordAvailable();
  }

  async commitDecision(input: CommitDecisionInput): Promise<void> {
    const state = read();
    if (state.decisions.some((d) => d.decisionId === input.decisionId)) {
      throw new Error("append-only: decision_id already exists");
    }
    state.decisions.push(input);
    write(state);
  }

  async recordReveal(decisionId: string, result: DecisionResult): Promise<void> {
    const state = read();
    if (!state.decisions.some((d) => d.decisionId === decisionId)) {
      throw new Error("no such decision");
    }
    if (state.reveals[decisionId]) throw new Error("append-only: already revealed");
    state.reveals[decisionId] = result;
    write(state);
  }

  async recordFeedback(decisionId: string, input: FeedbackInput): Promise<void> {
    const state = read();
    if (!state.decisions.some((d) => d.decisionId === decisionId)) {
      throw new Error("no such decision");
    }
    if (state.feedbacks[decisionId]) throw new Error("append-only: feedback already exists");
    state.feedbacks[decisionId] = input;
    write(state);
  }

  async recordCounterfactual(decisionId: string, alternative: string | null): Promise<void> {
    const state = read();
    const row = state.decisions.find((d) => d.decisionId === decisionId);
    if (!row) throw new Error("no such decision");
    if (row.probeAssignment !== "probed") throw new Error("this decision was never asked");
    /*
     * R3 in the direction it is usually not written: an alternative named once the evaluation is
     * on screen is a reading of the engine's candidate, not a self-generated one, and storage
     * cannot tell the two apart afterwards.
     */
    if (state.reveals[decisionId]) throw new Error("the engine has already spoken");
    const answers = (state.counterfactuals ??= {});
    if (answers[decisionId]) throw new Error("append-only: already answered");
    answers[decisionId] = { alternative, cpLoss: null };
    write(state);
  }

  async scoreCounterfactual(decisionId: string, cpLoss: number): Promise<void> {
    const state = read();
    const answer = state.counterfactuals?.[decisionId];
    if (!answer) throw new Error("no answer to score");
    if (answer.alternative === null) throw new Error("no alternative was named");
    answer.cpLoss = cpLoss;
    write(state);
  }

  async hasReveal(decisionId: string): Promise<boolean> {
    return Boolean(read().reveals[decisionId]);
  }

  async getAtom(decisionId: string): Promise<DecisionAtom | null> {
    const state = read();
    const row = state.decisions.find((d) => d.decisionId === decisionId);
    return row ? assemble(state, row) : null;
  }

  async listAtoms(gameId?: string): Promise<DecisionAtom[]> {
    const state = read();
    return rowsFor(state, gameId).map((row) => assemble(state, row));
  }

  /** Ids in the SAME ORDER as listAtoms, so a scored row can name its decision. */
  async listDecisionIds(gameId?: string): Promise<string[]> {
    return rowsFor(read(), gameId).map((row) => row.decisionId);
  }

  async countDecisions(): Promise<number> {
    return read().decisions.length;
  }

  async saveClaim(claim: Claim): Promise<void> {
    const state = read();
    state.claims[claim.claim_id] = { ...claim };
    write(state);
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    const state = read();
    const claim = state.claims[claimId];
    if (!claim) return null;
    return {
      ...claim,
      prospective_tests: state.drillResults.filter((r) => r.claim_id === claimId),
    };
  }

  async saveDrill(started: StoredDrill): Promise<void> {
    const state = read();
    if (state.drills[started.spec.drill_id]) {
      throw new Error("append-only: drill already started");
    }
    state.drills[started.spec.drill_id] = started;
    write(state);
  }

  async getDrill(drillId: string): Promise<StoredDrill | null> {
    return read().drills[drillId] ?? null;
  }

  async saveDrillResult(result: ProspectiveDrillResult): Promise<void> {
    const state = read();
    if (state.drillResults.some((r) => r.drill_id === result.drill_id)) {
      throw new Error("append-only: drill already reported");
    }
    state.drillResults.push(result);
    write(state);
  }

  async saveLearningRule(rule: LearningRule): Promise<void> {
    const state = read();
    const existing = state.learningRules[rule.rule_id];
    if (existing && !sameLearningRuleAuthorship(existing, rule)) {
      throw new Error("append-only: authored learning rule cannot change");
    }
    state.learningRules[rule.rule_id] = structuredClone(rule);
    write(state);
  }

  async getLearningRule(ruleId: string): Promise<LearningRule | null> {
    const rule = read().learningRules[ruleId];
    return rule ? structuredClone(rule) : null;
  }

  async listLearningRules(): Promise<LearningRule[]> {
    return Object.values(read().learningRules).map((rule) => structuredClone(rule));
  }

  async saveLearningTransfer(transfer: LearningTransfer): Promise<void> {
    const state = read();
    if (state.learningTransfers[transfer.transfer_id]) {
      throw new Error("append-only: learning transfer already started");
    }
    state.learningTransfers[transfer.transfer_id] = structuredClone(transfer);
    write(state);
  }

  async getLearningTransfer(transferId: string): Promise<LearningTransfer | null> {
    const transfer = read().learningTransfers[transferId];
    return transfer ? structuredClone(transfer) : null;
  }

  /**
   * Preregistered and not yet reported, oldest first.
   *
   * THIS ONE MATTERS MOST IN THE BROWSER, because this is the store a signed-out player uses and
   * a reload is the ordinary way their session ends. The transfer survived in localStorage while
   * the knowledge that one was running did not, so refreshing lost the test and offered a new one.
   */
  async getOpenLearningTransfer(ruleId: string): Promise<LearningTransfer | null> {
    const state = read();
    const reported = new Set(state.learningTransferResults.map((row) => row.transfer_id));
    const open = Object.values(state.learningTransfers)
      .filter((row) => row.rule_id === ruleId && !reported.has(row.transfer_id))
      .sort((a, b) => a.started_at.localeCompare(b.started_at));
    return open[0] ? structuredClone(open[0]) : null;
  }

  async saveLearningTransferObservation(
    transferId: string,
    position: number,
    observation: LearningTransferObservation,
  ): Promise<void> {
    const state = read();
    const key = `${transferId}#${position}`;
    // Matters most here: this is the store a signed-out player uses, and a reload is the ordinary
    // way their session ends. Held in memory, these were exactly what a reload lost.
    if (state.learningTransferObservations?.[key]) {
      throw new Error("append-only: transfer observation already recorded for that position");
    }
    state.learningTransferObservations = {
      ...(state.learningTransferObservations ?? {}),
      [key]: structuredClone(observation),
    };
    write(state);
  }

  async listLearningTransferObservations(
    transferId: string,
  ): Promise<LearningTransferObservation[]> {
    const rows = read().learningTransferObservations ?? {};
    return Object.entries(rows)
      .filter(([key]) => key.startsWith(`${transferId}#`))
      .sort((a, b) => Number(a[0].split("#")[1]) - Number(b[0].split("#")[1]))
      .map(([, observation]) => structuredClone(observation));
  }

  async saveLearningTransferResult(result: LearningTransferResult): Promise<void> {
    const state = read();
    if (state.learningTransferResults.some((row) => row.transfer_id === result.transfer_id)) {
      throw new Error("append-only: learning transfer already reported");
    }
    state.learningTransferResults.push(structuredClone(result));
    write(state);
  }

  async listLearningTransferResults(ruleId: string): Promise<LearningTransferResult[]> {
    return read()
      .learningTransferResults.filter((result) => result.rule_id === ruleId)
      .map((result) => structuredClone(result));
  }

  /*
   * The bridge from an import to the live loop, kept in the same store as the decisions it will
   * narrow the search over. A hypothesis registered in one browser is not portable, which is the
   * same limit the record itself has -- see the durability note at the top of this file.
   */
  async savePreregisteredHypothesis(hypothesis: PreregisteredHypothesis): Promise<void> {
    const state = read();
    state.preregs = [...state.preregs, structuredClone(hypothesis)];
    write(state);
  }

  /*
   * The scan's reading, kept so that closing the overlay stops discarding it. Same append-only
   * shape as the hypothesis above and for the same reason: a second import must not erase which
   * rates were on screen when the first one was registered.
   */
  async saveImportDiagnostic(reading: StoredImportDiagnostic): Promise<void> {
    const state = read();
    state.importReadings = [...state.importReadings, structuredClone(reading)];
    write(state);
  }

  async getImportDiagnostic(): Promise<StoredImportDiagnostic | null> {
    const rows = read().importReadings;
    const newest = rows[rows.length - 1];
    return newest ? structuredClone(newest) : null;
  }

  async getPreregisteredHypothesis(): Promise<PreregisteredHypothesis | null> {
    const rows = read().preregs;
    const newest = rows[rows.length - 1];
    return newest ? structuredClone(newest) : null;
  }
}

function sameLearningRuleAuthorship(left: LearningRule, right: LearningRule): boolean {
  const mutable = new Set(["grade", "retrieval_step", "next_due_at", "last_evaluated_at"]);
  return Object.entries(left).every(
    ([key, value]) =>
      mutable.has(key) ||
      JSON.stringify(value) === JSON.stringify(right[key as keyof LearningRule]),
  );
}

function rowsFor(state: Persisted, gameId?: string): StoredDecision[] {
  return gameId ? state.decisions.filter((d) => d.gameId === gameId) : state.decisions;
}

function assemble(state: Persisted, row: StoredDecision): DecisionAtom {
  const feedback = state.feedbacks[row.decisionId];
  return {
    entry_state: {
      game_id: row.gameId,
      fen: row.fen,
      ply: row.ply,
      phase: row.phase,
      clock_ms_remaining: row.clockMsRemaining,
    },
    known: row.statedRead,
    unknown: row.statedUnknown,
    decision: row.chosenMove,
    bounded_action: {
      seconds_taken: row.secondsTaken,
      confidence: row.confidence,
      ...(row.confidenceScale === undefined ? {} : { confidence_scale: row.confidenceScale }),
      candidate_moves_considered: row.candidateMovesConsidered,
    },
    probe: assembleProbe(
      { probeAssignment: row.probeAssignment ?? null, legalMoves: row.legalMoves ?? null },
      state.counterfactuals?.[row.decisionId],
    ),
    reveal_timing: row.revealTiming ?? null,
    result: state.reveals[row.decisionId] ?? null,
    feedback: feedback
      ? { revised_read: feedback.revisedRead, would_choose_again: feedback.wouldChooseAgain }
      : null,
  };
}/**
 * A decision as it comes back OUT of storage, which is not the same shape as one going in.
 *
 * `confidenceScale` is required on the wire -- a live client always knows which scale its player
 * answered on. But this store reads JSON that an EARLIER BUILD wrote, and those rows predate the
 * field entirely. Typing them as if the field were always there would make the absence
 * unrepresentable and the `?? LEGACY` below dead code that no test could reach.
 */
type StoredDecision = Omit<
  CommitDecisionInput,
  "confidenceScale" | "probeAssignment" | "legalMoves" | "revealTiming"
> & {
  confidenceScale?: number;
  /**
   * Absent on rows an earlier build wrote, and absent is a FOURTH STATE rather than a control
   * arm: those decisions were never randomised into anything.
   */
  probeAssignment?: ProbeAssignment | null;
  legalMoves?: number | null;
  /** Absent on rows written before the deferred game existed. Absent is not `per-decision`. */
  revealTiming?: RevealTiming | null;
};


