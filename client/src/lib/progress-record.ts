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

import {
  prohibitedContent,
  type TrialEvent,
  type TrialEventName,
} from "./acquisition-evidence";

const KEY = "decision-lab.progress";

/** Visits kept. A ring, because this must never be the write that fills the quota. */
const MAX_VISITS = 20;
/** Attempts kept per visit, for the same reason. */
const MAX_ATTEMPTS = 200;
/** Events kept per visit. A first session produces well under twenty. */
const MAX_EVENTS = 400;

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
  /**
   * An opaque id for this session, so a row can be related to the session it came from.
   *
   * NOT AN IDENTITY. It is random per page load, it is not a person, and two people sharing a
   * browser produce two visits that nothing here can tell apart. That limit is kept rather than
   * worked around: there is no fingerprinting in this file and there will not be.
   *
   * Optional because visits written before this existed do not have one, and a stored shape that
   * changed must not make an older log unreadable.
   */
  visitId?: string;
  attempts: Attempt[];
  /**
   * The acquisition-evidence events for this session, in the order they happened.
   *
   * IN THIS FILE RATHER THAN A SECOND STORE, and that is a decision rather than convenience. A
   * second append-only local ledger would be a second answer to "what happened in this session",
   * with its own key, its own ring, its own quota failure mode and its own copy-out -- and the
   * two would disagree the first time one of them was cleared. What this file already has is
   * exactly what acquisition evidence needs: append-only, per-visit, local, never read back, and
   * handed over by a person rather than sent.
   *
   * Optional for the same reason `visitId` is.
   */
  events?: TrialEvent[];
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
  state.visits.push({ startedAt: now.toISOString(), visitId: newVisitId(), attempts: [], events: [] });
  write({ visits: state.visits.slice(-MAX_VISITS) });
}

/**
 * A random id for a session. `crypto.randomUUID` where it exists, and a fallback that does not
 * pretend to be one -- a browser without it gets a shorter random string rather than a value
 * derived from anything about the machine.
 */
function newVisitId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `v-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * How many visits are already on record, so the app can tell a return from a first arrival.
 *
 * THE ONE READ THIS FILE OFFERS THE RUNNING APP, and it is deliberately the narrowest possible
 * one: a count of page loads, which the detector does not bucket on, no claim is scoped by, and
 * no reveal depends on. It exists because `return_session_started` is otherwise unobservable --
 * a session cannot know it is a return without knowing an earlier one happened.
 *
 * It is NOT a route to the rest of the log. It returns a number, not visits, and it cannot be
 * used to find out how far anybody got.
 */
export function visitsOnRecord(): number {
  return read().visits.length;
}

/** When the visit before the current one started, or null on a first arrival. */
export function previousVisitStartedAt(): string | null {
  const visits = read().visits;
  const previous = visits[visits.length - 2];
  return previous?.startedAt || null;
}

/**
 * Append one acquisition-evidence event to the current visit.
 *
 * THROWS on a prohibited field rather than dropping it. A guard that silently discarded the row
 * would leave the ledger looking complete while a stage was missing from every funnel computed
 * off it; a guard that silently KEPT it would put a username or a board position into a log a
 * participant is asked to paste into a message. The only safe failure here is a loud one, in
 * development, where the caller that reached past the type is standing.
 */
export function recordTrialEvent(event: TrialEvent): void {
  const problem = prohibitedContent(event);
  if (problem) throw new Error(`acquisition evidence refused: ${problem}`);
  const state = read();
  const visit = state.visits[state.visits.length - 1];
  if (!visit) {
    state.visits.push({ startedAt: "", visitId: newVisitId(), attempts: [], events: [event] });
    write({ visits: state.visits.slice(-MAX_VISITS) });
    return;
  }
  visit.events = [...(visit.events ?? []), event].slice(-MAX_EVENTS);
  write(state);
}

/**
 * Whether an event of this name has already been recorded in the current visit.
 *
 * IDEMPOTENCY IS THE CALLER'S, and this is what the caller uses to have it. React effects run
 * twice under StrictMode, components remount, and a reveal panel re-renders on every parent
 * update -- so `reveal_presented` fired from an effect would otherwise count one reveal three
 * times and inflate every rate computed against it.
 */
export function trialEventSeen(name: TrialEventName, decisionId?: string): boolean {
  const visit = read().visits[read().visits.length - 1];
  return (visit?.events ?? []).some(
    (event) =>
      event.name === name &&
      (decisionId === undefined ||
        ("decisionId" in event ? event.decisionId === decisionId : false)),
  );
}

/**
 * Whether an event of this name has ever been recorded, in any visit still on file.
 *
 * THE ONE CROSS-VISIT READ, and it exists for exactly one caller: the value-reconstruction
 * question is asked once per browser, and a question cannot know it has already been asked
 * without looking. This is a fact about the TRIAL PROTOCOL -- was this instrument administered --
 * and not about the player: the detector buckets on none of it, no claim is scoped by it, and
 * nothing about the chess changes.
 *
 * KNOWN LIMIT, stated rather than engineered around: `MAX_VISITS` is a ring, so a browser past
 * twenty page loads can be asked a second time. For a trial of eight to thirty people over a
 * handful of sittings that will not happen, and the alternative -- a separate permanent flag
 * outside this file -- would be a second store holding a fact this one already holds.
 */
export function trialEventEverSeen(name: TrialEventName): boolean {
  return read().visits.some((visit) => (visit.events ?? []).some((event) => event.name === name));
}

/** How many reveals have been presented in the current visit. */
export function revealsPresented(): number {
  const visit = read().visits[read().visits.length - 1];
  return (visit?.events ?? []).filter((event) => event.name === "reveal_presented").length;
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
    lines.push(
      `ביקור ${index + 1} · ${visit.startedAt || "זמן לא ידוע"}${visit.visitId ? ` · ${visit.visitId}` : ""}`,
    );
    /*
     * The events verbatim, one per line, in order, with nothing derived.
     *
     * NO FUNNEL, NO RATES, NO "reached stage 4 of 5". Every one of those is an analysis with a
     * denominator somebody has to choose and defend, and printing one here would hand whoever
     * reads this log a conclusion it did not compute. The rows are the evidence; the arithmetic
     * is done by a person who knows what they are looking at.
     */
    for (const event of visit.events ?? []) {
      lines.push(`  · ${event.at} ${event.name} ${eventDetail(event)}`.trimEnd());
    }
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

/** One event's properties, flattened for the report. The answer is quoted, never summarised. */
function eventDetail(event: TrialEvent): string {
  switch (event.name) {
    case "acquisition_entry":
      return `angle=${event.context.angle} src=${event.context.source} v=${event.context.variant}${event.returning ? " returning" : ""}`;
    case "return_session_started":
      return `after=${event.hoursSincePrevious}h`;
    case "first_position_presented":
      return `purpose=${event.purpose ?? "-"}`;
    case "decision_committed":
      return `#${event.ordinal} ${event.decisionId} purpose=${event.purpose ?? "-"} asked=${event.confidenceAsked}`;
    case "reveal_presented":
      return event.decisionId;
    case "reveal_kind_presented":
      return `${event.decisionId} kind=${event.kind}`;
    case "next_decision_started":
      return `afterReveals=${event.afterReveals}`;
    case "value_reconstruction_prompted":
      return `afterReveals=${event.afterReveals}`;
    case "value_reconstruction_submitted":
      return event.outcome === "answered" ? `answered: „${event.answer ?? ""}”` : "dismissed";
  }
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
