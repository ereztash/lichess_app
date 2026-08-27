/**
 * How far a visit got, kept so a trial produces data about the TRIAL.
 *
 * The product measures the player. Nothing measured the product: a tester who stops at their
 * twelfth decision, or who fills three of the four steps and leaves, is indistinguishable in
 * every record this app keeps from a tester who never arrived. Five people is one attempt at
 * learning where the loop is too expensive, and "three of five stopped" teaches nothing without
 * knowing where.
 *
 * WHY THIS IS NOT THE TELEMETRY THE PRODUCT REFUSES. The rule (section 4.1, and the header of
 * decision-session.ts) is that the INTERFACE MUST NOT REACT to how fast, how sure, or how far
 * along a player is -- because an interface that reacts enters the measurement, and "under 45
 * seconds" stops being a fact about the player and becomes a fact about the player and what the
 * screen did to them at second forty. Where somebody stopped is not a decision variable. It is
 * not in the record, no bucket reads it, no claim is scoped by it, and nothing here is read back
 * into the running app at all -- `tests/client/a-record-of-the-trial-not-of-the-player.test.ts`
 * holds that as an assertion over the imports rather than as an intention.
 *
 * WHAT IT DELIBERATELY DOES NOT HOLD. No FEN, no move, no confidence value, no typed text, no
 * account. Step IDS, counts and whole seconds. That is enough to answer "where did it get
 * expensive" and not enough to reconstruct a single thing anyone thought.
 *
 * WHERE IT LIVES. This browser, and nowhere else. It is not sent anywhere; the tester copies it
 * out of the self-check panel by hand, which keeps handing it over an act rather than a default.
 */

const KEY = "decision-lab.progress";

/** Visits kept. A ring, because this must never be the write that fills the quota. */
const MAX_VISITS = 20;
/** Attempts kept per visit, for the same reason. */
const MAX_ATTEMPTS = 200;

export type Outcome = "recorded" | "left";

export interface Attempt {
  /** Step ids complete when the attempt ended. From the screen's own STEPS -- not a second list. */
  done: string[];
  /** Which step was open when it ended, or null. */
  open: string | null;
  /** Whole seconds the commitment screen was up. */
  seconds: number;
  /**
   * How many times "record" was pressed while the draft was incomplete.
   *
   * The most informative number here: it is a player who WANTED to finish and was stopped, which
   * reads nothing like a player who wandered off. A refusal does not end the attempt.
   */
  refusals: number;
  /**
   * `recorded` means the player completed every step and submitted.
   *
   * KNOWN LIMIT: it does not mean the write succeeded. This module cannot see that from where it
   * sits, and a failed write leaves the player on the screen to submit again, which shows up here
   * as two attempts. Rare, separately visible in the error state, and not worth a channel from
   * record-api back into a file that is supposed to have no readers.
   */
  outcome: Outcome;
}

export interface Visit {
  /** When the page was loaded, ISO. The only clock reading here, and it is about the visit. */
  startedAt: string;
  attempts: Attempt[];
}

interface Persisted {
  visits: Visit[];
}

const empty = (): Persisted => ({ visits: [] });

/*
 * Memory backing, same shape as local-record-store's and for the same reason: a private window,
 * a blocked origin or a full quota all make localStorage throw, and a progress log that throws is
 * worse than one that forgets.
 */
let session: Persisted | null = null;

function read(): Persisted {
  if (session !== null) return session;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { visits: Array.isArray(parsed.visits) ? parsed.visits : [] };
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
    session = state;
  }
}

/**
 * Start a visit. Called once when the app mounts.
 *
 * Idempotent within a page load is NOT wanted: a remount is a new visit as far as this is
 * concerned, and pretending otherwise would hide a reload -- which is itself a thing worth seeing
 * in a trial.
 */
export function beginVisit(now: Date = new Date()): void {
  const state = read();
  state.visits.push({ startedAt: now.toISOString(), attempts: [] });
  write({ visits: state.visits.slice(-MAX_VISITS) });
}

/** Close one pass through the commitment screen. */
export function recordAttempt(attempt: Attempt): void {
  const state = read();
  const visit = state.visits[state.visits.length - 1];
  if (!visit) {
    // A commitment before any visit was opened means the app mounted without calling beginVisit.
    // Dropping it silently would make the count wrong; a visit with no start is honest about it.
    state.visits.push({ startedAt: "", attempts: [attempt] });
    write({ visits: state.visits.slice(-MAX_VISITS) });
    return;
  }
  visit.attempts = [...visit.attempts, attempt].slice(-MAX_ATTEMPTS);
  write(state);
}

/** Everything kept, oldest visit first. */
export function progress(): readonly Visit[] {
  return read().visits;
}

/**
 * The log as text, for the tester to copy and send.
 *
 * One line per visit and one per attempt, in the order they happened, with nothing derived. No
 * rates, no averages, no "you completed 60%" -- a summary here would be this file claiming
 * something about the person, which is the one thing it is built not to do. Whoever reads it
 * does the arithmetic knowing what they are looking at.
 */
export function progressReport(): string {
  const visits = read().visits;
  if (visits.length === 0) return "אין עדיין ביקורים רשומים.";
  const lines: string[] = [];
  for (const [index, visit] of visits.entries()) {
    lines.push(`ביקור ${index + 1} · ${visit.startedAt || "זמן לא ידוע"}`);
    if (visit.attempts.length === 0) {
      lines.push("  לא נפתח אף מסך החלטה.");
      continue;
    }
    for (const [n, a] of visit.attempts.entries()) {
      const done = a.done.length ? a.done.join("+") : "כלום";
      const open = a.open ?? "-";
      lines.push(
        `  ${n + 1}. ${a.outcome} · הושלם: ${done} · פתוח: ${open} · ${a.seconds}ש · סירובים: ${a.refusals}`,
      );
    }
  }
  return lines.join("\n");
}

/** Test seam, and the tester's way to start a clean run. */
export function clearProgress(): void {
  session = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear in a backing that never took a write.
  }
}
