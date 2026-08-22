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
import type {
  Claim,
  ProspectiveDrillResult,
} from "@shared/claim";
import type { DecisionAtom, DecisionResult } from "@shared/decision-atom";
import type {
  CommitDecisionInput,
  FeedbackInput,
  RecordStore,
  StoredDrill,
} from "@shared/record-store";

const KEY = "decision-lab.record.v1";

type Persisted = {
  decisions: CommitDecisionInput[];
  reveals: Record<string, DecisionResult>;
  feedbacks: Record<string, FeedbackInput>;
  claims: Record<string, Claim>;
  drills: Record<string, StoredDrill>;
  drillResults: ProspectiveDrillResult[];
};

const empty = (): Persisted => ({
  decisions: [],
  reveals: {},
  feedbacks: {},
  claims: {},
  drills: {},
  drillResults: [],
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
    state.feedbacks[decisionId] = input;
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
}

function rowsFor(state: Persisted, gameId?: string): CommitDecisionInput[] {
  return gameId ? state.decisions.filter((d) => d.gameId === gameId) : state.decisions;
}

function assemble(state: Persisted, row: CommitDecisionInput): DecisionAtom {
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
      candidate_moves_considered: row.candidateMovesConsidered,
    },
    result: state.reveals[row.decisionId] ?? null,
    feedback: feedback
      ? { revised_read: feedback.revisedRead, would_choose_again: feedback.wouldChooseAgain }
      : null,
  };
}
