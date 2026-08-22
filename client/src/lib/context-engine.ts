/**
 * What the interface is allowed to notice about how you are using it.
 *
 * Ported from MATI's context layer -- signals with a strength, a derived presentation, and a
 * "why?" the user can open -- with one constraint that does not exist there and dominates the
 * design here.
 *
 * THE THING THIS MUST NOT DO. `shared/detector.ts` buckets decisions on time-to-decide, game
 * phase and clock remaining, and scores stated confidence against realised loss. If the
 * interface adapted on any of those -- nudged you when you were deciding quickly, went quiet
 * when you had been at it a while, softened after a bad reveal -- then the intervention would be
 * inside the measurement. The "under 45 seconds" bucket would no longer be a fact about the
 * player; it would be a fact about the player plus whatever the interface did to them at second
 * forty. MATI has no measurement to contaminate and can adapt on pace freely. This one cannot,
 * and the refusal is the interesting part of the port.
 *
 * So the signals below are drawn only from things the detector never reads: the device, whether
 * it is a touch device, and how long it has been since the last visit. Nothing here is derived
 * from a decision, and nothing here changes what is recorded.
 *
 * The second rule is MATI's, kept: every adaptation is explainable. Whatever this changes, the
 * ribbon can say why it changed, in the words of the signal that caused it.
 */

export type DeviceClass = "phone" | "tablet" | "desktop";
export type InputClass = "touch" | "pointer";
export type SignalStrength = "strong" | "weak";

const USAGE_KEY = "decision-lab-usage-v1";
const DAY_MS = 86_400_000;
/** Below this many days, a return is just the next sitting and needs no re-orientation. */
export const RETURN_GAP_DAYS = 3;

export interface UsageContext {
  sessionStartedAt: string;
  lastVisitAt?: string;
  visitCount: number;
  device: DeviceClass;
  input: InputClass;
  width?: number;
}

export interface ContextSignal {
  id: string;
  strength: SignalStrength;
  /** Stated as an observation, in the words the ribbon will show. */
  fact: string;
}

export interface Presentation {
  input: InputClass;
  device: DeviceClass;
  /** A line shown on return after a real gap, or null. */
  reorientation: string | null;
  /** What produced the above. Rendered under "למה?", never hidden. */
  why: string[];
}

export function deviceFromWidth(width: number): DeviceClass {
  if (width < 680) return "phone";
  if (width < 1050) return "tablet";
  return "desktop";
}

/**
 * The visit, read and counted.
 *
 * Nothing here is sent anywhere. It is one localStorage key holding a timestamp and a count, in
 * the same browser that already holds the decisions on the local path.
 */
export function readUsage(now = new Date()): UsageContext {
  const width = typeof window === "undefined" ? undefined : window.innerWidth;
  let previous: Partial<UsageContext> = {};
  try {
    previous = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}");
  } catch {
    // A browser that refuses storage is the blocked-storage case the record layer already
    // handles by name. Here it just means no history, which is the first-visit reading.
    previous = {};
  }
  return {
    sessionStartedAt: now.toISOString(),
    lastVisitAt: typeof previous.lastVisitAt === "string" ? previous.lastVisitAt : undefined,
    visitCount: Math.max(0, Number(previous.visitCount) || 0) + 1,
    device: width === undefined ? "desktop" : deviceFromWidth(width),
    input: typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 ? "touch" : "pointer",
    width,
  };
}

export function persistUsage(usage: UsageContext, now = new Date()): void {
  try {
    localStorage.setItem(
      USAGE_KEY,
      JSON.stringify({ visitCount: usage.visitCount, lastVisitAt: now.toISOString() }),
    );
  } catch {
    // Same as above: nothing here is worth failing a page load over.
  }
}

export function daysSince(iso: string | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / DAY_MS));
}

/** What the record looked like when they left it. Only counts -- never a decision's content. */
export interface RecordShape {
  recorded: number;
  awaitingReveal: number;
}

export function contextSignals(usage: UsageContext, now = new Date()): ContextSignal[] {
  const signals: ContextSignal[] = [];
  const gap = daysSince(usage.lastVisitAt, now);

  if (gap !== null && gap >= RETURN_GAP_DAYS) {
    signals.push({
      id: "return-gap",
      strength: "strong",
      fact: `הכניסה הקודמת הייתה לפני כ־${gap} ימים.`,
    });
  }
  if (usage.input === "touch") {
    signals.push({
      id: "touch-input",
      strength: "weak",
      fact: "המכשיר הזה מדווח על קלט מגע, ולכן אין מצב ריחוף.",
    });
  }
  if (usage.device === "phone") {
    signals.push({ id: "narrow-viewport", strength: "weak", fact: "המסך צר." });
  }
  return signals;
}

/**
 * The signals, turned into the two things the interface actually does with them.
 *
 * Short, and meant to stay short. Every entry here is a place the interface behaves differently
 * for reasons the player did not ask for, and each one has to earn that.
 */
export function derivePresentation(
  usage: UsageContext,
  record: RecordShape | null,
  now = new Date(),
): Presentation {
  const signals = contextSignals(usage, now);
  const gap = daysSince(usage.lastVisitAt, now);
  let reorientation: string | null = null;

  if (gap !== null && gap >= RETURN_GAP_DAYS && record && record.recorded > 0) {
    // Counts only, and only ones already on screen elsewhere. The point is to save the return
    // visit from starting at zero, not to summarise the record.
    reorientation =
      record.awaitingReveal > 0
        ? `חזרת אחרי כ־${gap} ימים. יש ${record.recorded} החלטות ברשומה, מתוכן ${record.awaitingReveal} ממתינות לחשיפה.`
        : `חזרת אחרי כ־${gap} ימים. יש ${record.recorded} החלטות ברשומה.`;
  }

  return {
    input: usage.input,
    device: usage.device,
    reorientation,
    why: signals.map((signal) => signal.fact),
  };
}
