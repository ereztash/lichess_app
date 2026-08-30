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
import type {
  StoredBlitzDecision,
  StoredBlitzGame,
  StoredBlitzRecord,
} from "@shared/blitz-record";
import type { DecisionAtom, DecisionResult, ProbeAssignment } from "@shared/decision-atom";
import { assembleProbe } from "@shared/counterfactual";
import { MissingClaimDirection } from "@shared/drill";
import type { RevealTiming } from "@shared/reveal-timing";
import type {
  AnalysisTiming,
  MeasurementProtocol,
} from "@shared/measurement-protocol";
import type { DecisionPurpose } from "@shared/confidence-asked";
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

/**
 * WHOSE RECORD THIS IS, and until now the answer was "this browser's".
 *
 * One key held every decision anyone made here. `record-api.ts` already reasons about "the next
 * person at this keyboard" -- it keys its two server/local latches by account for exactly that
 * case -- and then wrote both people's decisions into the same store. Two harms at once, and the
 * second is the worse one for a trial:
 *
 *   PRIVACY. This record holds what somebody thought they could read in a position, what they
 *   said they could not evaluate, and free text in their own words. It is not a game history.
 *
 *   THE MEASUREMENT. Decisions from two people become one record, and every reading in the
 *   product -- the calibration gap, its six splits, the discrimination area, the stability check
 *   -- is computed over it as if it described one mind. Nothing downstream can tell, because
 *   nothing downstream is told.
 *
 * SIGNED OUT KEEPS THE BARE KEY, deliberately. A record already written by this build lives
 * there, and moving it would either lose it or hand it to whichever account signed in first --
 * a guess about whose it is, which is the defect again in the other direction.
 *
 * WHAT THIS DOES NOT FIX, AND IT IS SAID RATHER THAN IMPLIED: two people who both use this
 * browser WITHOUT signing in still share one record, because nothing distinguishes them. The
 * product cannot separate identities it was never given. What it can do is stop merging the ones
 * it WAS given, which is what this does.
 */
const KEY_ROOT = "decision-lab.record.v1";

/** The account whose record this browser is keeping, or null when nobody has signed in. */
let identity: string | null = null;

/**
 * Point the store at an account's record. Called from `record-api` as the session resolves.
 *
 * SWITCHING CLEARS THE MEMORY FALLBACK, and that is not tidying: `session` is a whole record held
 * in a module variable, so leaving it in place would serve the previous account's decisions to
 * the next one from RAM even though the persistent keys are correctly separate.
 */
export function setLocalRecordIdentity(openId: string | null | undefined): void {
  const next = openId ?? null;
  if (next === identity) return;
  identity = next;
  session = null;
}

/** Test seam, and the reset every test that touches identity needs. */
export function currentLocalRecordIdentity(): string | null {
  return identity;
}

function storageKey(): string {
  return identity === null ? KEY_ROOT : `${KEY_ROOT}:${identity}`;
}

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
  /**
   * Blitz games and their decisions, kept apart from `decisions` (docs/blitz/ADR-004).
   *
   * OPTIONAL ON THE TYPE for the same reason `counterfactuals` is: this store reads JSON an
   * earlier build wrote, and those saves have no such key. Absent is read as empty, which is
   * true -- that build never played a blitz game it could keep.
   */
  blitzGames?: StoredBlitzGame[];
  blitzDecisions?: StoredBlitzDecision[];
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
  blitzGames: [],
  blitzDecisions: [],
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
    const probe = `${storageKey()}.probe`;
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
    const raw = localStorage.getItem(storageKey());
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
    localStorage.setItem(storageKey(), JSON.stringify(state));
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

/**
 * One read-modify-write, atomic against the other tabs of this browser.
 *
 * THE DEFECT, AND IT MADE AN APPEND-ONLY RECORD LOSE APPENDS. Every mutator below is
 * `read(); check; mutate; write()`, and `localStorage` gives no atomicity across that span. Two
 * tabs open on the same record:
 *
 *   tab A reads S          tab B reads S
 *   tab A writes S+a       tab B writes S+b     -> the store holds S+b, and `a` is gone
 *
 * Nothing throws, nothing is marked, and the decision is simply not there. Each function was
 * append-only and the SYSTEM was not -- the same shape as every other finding in this project,
 * where the parts are right and the composition is not. It is not exotic either: this product
 * builds multi-step loops that invite a second tab, and a reload is the ordinary way a session
 * ends.
 *
 * WEB LOCKS, WHICH ARE THE ONLY REAL MUTUAL EXCLUSION A BROWSER OFFERS. `navigator.locks` is
 * origin-scoped and cross-tab, so the critical section below genuinely serialises. The fallback
 * for a browser without it is a per-tab promise chain: that closes the common case -- two
 * concurrent writes from one tab's own async code -- and narrows the cross-tab window to the
 * span of one synchronous read-and-write. It does not close it, and pretending otherwise with a
 * hand-rolled lease in `localStorage` would add a second unsynchronised read-modify-write to fix
 * the first one.
 *
 * THE READ IS INSIDE THE LOCK. Hoisting it out would leave exactly the race this exists to close,
 * with a lock held around the harmless half.
 */
let tail: Promise<unknown> = Promise.resolve();

async function update<T>(mutate: (state: Persisted) => T): Promise<T> {
  const critical = (): T => {
    const state = read();
    const result = mutate(state);
    write(state);
    return result;
  };
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks) return locks.request(`${storageKey()}.write`, critical);
  // No Web Locks: serialise this tab's own writes, which is strictly better than nothing.
  const run = tail.then(critical, critical);
  tail = run.catch(() => undefined);
  return run;
}

export class LocalRecordStore implements RecordStore {
  /** Whether this browser will keep what we write at all. See localRecordDurability for how long. */
  async isAvailable(): Promise<boolean> {
    return localRecordAvailable();
  }

  async commitDecision(input: CommitDecisionInput): Promise<void> {
    return update((state) => {
      if (state.decisions.some((d) => d.decisionId === input.decisionId)) {
        throw new Error("append-only: decision_id already exists");
      }
      state.decisions.push(input);
    });
  }

  async recordReveal(decisionId: string, result: DecisionResult): Promise<void> {
    return update((state) => {
      if (!state.decisions.some((d) => d.decisionId === decisionId)) {
        throw new Error("no such decision");
      }
      if (state.reveals[decisionId]) throw new Error("append-only: already revealed");
      state.reveals[decisionId] = result;
    });
  }

  async recordFeedback(decisionId: string, input: FeedbackInput): Promise<void> {
    return update((state) => {
      if (!state.decisions.some((d) => d.decisionId === decisionId)) {
        throw new Error("no such decision");
      }
      if (state.feedbacks[decisionId]) throw new Error("append-only: feedback already exists");
      state.feedbacks[decisionId] = input;
    });
  }

  async recordCounterfactual(decisionId: string, alternative: string | null): Promise<void> {
    return update((state) => {
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
    });
  }

  async scoreCounterfactual(decisionId: string, cpLoss: number): Promise<void> {
    return update((state) => {
      const answer = state.counterfactuals?.[decisionId];
      if (!answer) throw new Error("no answer to score");
      if (answer.alternative === null) throw new Error("no alternative was named");
      answer.cpLoss = cpLoss;
    });
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
    return update((state) => {
      state.claims[claim.claim_id] = { ...claim };
    });
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    const state = read();
    const claim = state.claims[claimId];
    if (!claim) return null;
    return {
      ...claim,
      /*
       * A claim stored before the direction was recorded parses back with the key ABSENT, not
       * null. Normalised here so the three stores agree on one shape for "not recorded": the
       * MySQL column is nullable and returns null, and a caller that has to tell `undefined` from
       * `null` to know which store it is talking to has two contracts, not one.
       */
      predicts_overconfidence: claim.predicts_overconfidence ?? null,
      prospective_tests: state.drillResults.filter((r) => r.claim_id === claimId),
    };
  }

  async saveDrill(started: StoredDrill): Promise<void> {
    return update((state) => {
      if (state.drills[started.spec.drill_id]) {
        throw new Error("append-only: drill already started");
      }
      state.drills[started.spec.drill_id] = started;
    });
  }

  async getDrill(drillId: string): Promise<StoredDrill | null> {
    const started = read().drills[drillId] ?? null;
    if (started && typeof started.spec.predicts_overconfidence !== "boolean") {
      /*
       * A drill registered before the direction was recorded, read back out of localStorage with
       * the key missing. It matters MORE here than in MySQL, because `undefined` does not throw
       * on the way to `evaluateRefutation` -- it is falsy, so the one-sided test would quietly
       * run on the opposite side and report a confident verdict about the wrong hypothesis.
       * Same refusal as the Drizzle store: this drill cannot be graded, and a refuted claim
       * cannot be un-refuted.
       */
      throw new MissingClaimDirection(started.spec.claim_id);
    }
    return started;
  }

  async saveDrillResult(result: ProspectiveDrillResult): Promise<void> {
    return update((state) => {
      if (state.drillResults.some((r) => r.drill_id === result.drill_id)) {
        throw new Error("append-only: drill already reported");
      }
      state.drillResults.push(result);
    });
  }

  async saveBlitzRecord(record: StoredBlitzRecord): Promise<void> {
    return update((state) => {
      const games = (state.blitzGames ??= []);
      const decisions = (state.blitzDecisions ??= []);
      if (games.some((g) => g.gameId === record.game.gameId)) {
        throw new Error("append-only: blitz game already stored");
      }
      /*
       * BOTH PUSHES INSIDE ONE `update`, so the write that persists them is one write. A game
       * stored without its decisions would put the conditions on record with nothing they describe,
       * and a later count of games would include it.
       */
      games.push(record.game);
      decisions.push(...record.decisions);
    });
  }

  /** The same narrow update the two server stores perform. One `update`, so it is one write. */
  async attachBlitzAnalysis(record: StoredBlitzRecord): Promise<void> {
    return update((state) => {
      const game = (state.blitzGames ??= []).find((g) => g.gameId === record.game.gameId);
      if (!game || game.analysisState !== "pending") return;
      game.analysisState = record.game.analysisState;
      game.analysedAt = record.game.analysedAt;
      game.analysis = record.game.analysis;
      for (const d of record.decisions) {
        const row = (state.blitzDecisions ??= []).find(
          (r) => r.gameId === d.gameId && r.ply === d.ply,
        );
        if (row) {
          row.cpLoss = d.cpLoss;
          row.standingCp = d.standingCp;
        }
      }
    });
  }

  async listBlitzGames(): Promise<StoredBlitzGame[]> {
    return read().blitzGames ?? [];
  }

  async listBlitzDecisions(): Promise<StoredBlitzDecision[]> {
    return read().blitzDecisions ?? [];
  }

  async saveLearningRule(rule: LearningRule): Promise<void> {
    return update((state) => {
      const existing = state.learningRules[rule.rule_id];
      if (existing && !sameLearningRuleAuthorship(existing, rule)) {
        throw new Error("append-only: authored learning rule cannot change");
      }
      // The same terminal guard the two server stores carry: retirement is the player's act and
      // nothing re-derives it, so no write may take a rule off `retired`.
      if (existing && existing.grade === "retired" && rule.grade !== "retired") {
        throw new Error("retired: a rule the player took out of the queue cannot be graded back in");
      }
      state.learningRules[rule.rule_id] = structuredClone(rule);
    });
  }

  async getLearningRule(ruleId: string): Promise<LearningRule | null> {
    const rule = read().learningRules[ruleId];
    return rule ? structuredClone(rule) : null;
  }

  async listLearningRules(): Promise<LearningRule[]> {
    return Object.values(read().learningRules).map((rule) => structuredClone(rule));
  }

  async saveLearningTransfer(transfer: LearningTransfer): Promise<void> {
    return update((state) => {
      if (state.learningTransfers[transfer.transfer_id]) {
        throw new Error("append-only: learning transfer already started");
      }
      state.learningTransfers[transfer.transfer_id] = structuredClone(transfer);
    });
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
      // Newest first, matching the two server stores: the oldest open transfer after a lost race
      // is the orphan, and re-serving its already-decided boards replicated a rule on one sitting.
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    return open[0] ? structuredClone(open[0]) : null;
  }

  async saveLearningTransferObservation(
    transferId: string,
    position: number,
    observation: LearningTransferObservation,
  ): Promise<void> {
    return update((state) => {
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
    });
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
    return update((state) => {
      if (state.learningTransferResults.some((row) => row.transfer_id === result.transfer_id)) {
        throw new Error("append-only: learning transfer already reported");
      }
      state.learningTransferResults.push(structuredClone(result));
    });
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
    return update((state) => {
      state.preregs = [...state.preregs, structuredClone(hypothesis)];
    });
  }

  /*
   * The scan's reading, kept so that closing the overlay stops discarding it. Same append-only
   * shape as the hypothesis above and for the same reason: a second import must not erase which
   * rates were on screen when the first one was registered.
   */
  async saveImportDiagnostic(reading: StoredImportDiagnostic): Promise<void> {
    return update((state) => {
      state.importReadings = [...state.importReadings, structuredClone(reading)];
    });
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
    // `?? null` for the same reason as every other field below: a row this build did not write.
    purpose: row.purpose ?? null,
    known: row.statedRead,
    unknown: row.statedUnknown,
    known_parts: row.statedReadParts ?? null,
    unknown_parts: row.statedUnknownParts ?? null,
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
    measurement_protocol: row.measurementProtocol ?? null,
    protocol_version: row.protocolVersion ?? null,
    analysis_timing: row.analysisTiming ?? null,
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
  "confidenceScale" | "probeAssignment" | "legalMoves" | "revealTiming" | "purpose"
> & {
  confidenceScale?: number;
  /**
   * Absent on rows written before the purpose was recorded, and absent is not `play`.
   *
   * This store is the one that has such rows in the wild: the browser record is written by
   * whatever build the player last loaded, and it is never migrated. A row from the era when the
   * purpose was derived at render time and thrown away has no purpose, and reading it as an
   * ordinary move would invent the one fact it does not hold.
   */
  purpose?: DecisionPurpose | null;
  /**
   * Absent on rows an earlier build wrote, and absent is a FOURTH STATE rather than a control
   * arm: those decisions were never randomised into anything.
   */
  probeAssignment?: ProbeAssignment | null;
  legalMoves?: number | null;
  /** Absent on rows written before the deferred game existed. Absent is not `per-decision`. */
  revealTiming?: RevealTiming | null;
  /* Optional on the STORED shape, because rows written by an older build genuinely lack them. */
  measurementProtocol?: MeasurementProtocol | null;
  protocolVersion?: number | null;
  analysisTiming?: AnalysisTiming | null;
};


