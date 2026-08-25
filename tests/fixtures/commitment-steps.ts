/**
 * Reaching a step of the commitment panel the way a player does.
 *
 * The four requirements used to be open at once, so a test could click any chip the moment the
 * panel rendered. They are an accordion now -- one open, the rest collapsed to a header carrying
 * the step's name and its answer -- because measured in a browser the open version was a 952px
 * panel inside a 900px window, and on a 390x844 phone the first thing the player is asked to do
 * sat 241px below the fold.
 *
 * Every assertion in the tests that use this is unchanged. Only the route to it moved, and it
 * moved to exactly one tap: this helper does what a finger does.
 */
import { fireEvent, screen } from "@testing-library/react";

export const STEP = {
  move: "המהלך שבחרתם",
  known: "מה אתם קוראים בעמדה",
  unknown: "מה אתם לא יכולים להעריך",
  confidence: "כמה אתם בטוחים",
} as const;

/**
 * Tap a step's header. A no-op when it is already open, so a test can call it defensively
 * without depending on which step the panel happened to open by itself.
 */
export function openStep(step: keyof typeof STEP): HTMLElement {
  /*
   * Scoped to the headers rather than matched by name alone. The record button carries the same
   * words while a step is unanswered -- "חסר: סמנו מה אתם קוראים בעמדה" -- so a name query finds
   * two controls, and the one a player taps to open a step is the header.
   */
  const heads = [...document.querySelectorAll<HTMLElement>(".step-head")];
  const head = heads.find((h) => h.textContent?.includes(STEP[step]));
  if (!head) throw new Error(`no step header for "${STEP[step]}" (found ${heads.length} headers)`);
  if (head.getAttribute("aria-expanded") !== "true") fireEvent.click(head);
  return head;
}

/** The four requirements, answered in order, leaving the panel ready to record. */
export function answerEveryStep(options: { known: string; unknown: string; confidence: number }) {
  openStep("known");
  fireEvent.click(screen.getByRole("button", { name: options.known }));
  openStep("unknown");
  fireEvent.click(screen.getByRole("button", { name: options.unknown }));
  openStep("confidence");
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`ביטחון ${options.confidence}`) }));
}
