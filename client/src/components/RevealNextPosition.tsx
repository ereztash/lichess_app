/**
 * THE WAY ON FROM A REVEAL WHOSE OWN GAME HOLDS NO FURTHER POSITION.
 *
 * WHAT THIS REPLACED, and why. This file was `RevealNoContinuation`, and it said *"the loaded game
 * has no further position, the record keeps this decision, and from there you can pick another"*
 * over a `return-record` control. That was two presses to the next decision: reveal, record, find
 * *"העמדה הבאה"*, land, decide.
 *
 * OWNER DECISION `O-1` = A, DIRECT ROUTE. The first trial measures whether the reveal created
 * enough value for the player to take another decision. Two presses put navigation friction inside
 * that measurement, and navigation friction is not part of what is being valued. So the reveal now
 * hands over the anchor set's next unanswered position itself, in one press.
 *
 * WHAT DID NOT CHANGE, AND MUST NOT. The route is not the continuation. `next_decision_started`
 * still fires only when the player places a legal move on their own side in the position they
 * arrive at -- `O-2`, enforced in `lib/acquisition-evidence.ts`. Removing the navigation confound
 * lowers no bar: it makes the bar measure the thing it names.
 *
 * WHY THE ACT IS `next-decision` AND NO LONGER `return-record`. The old file argued for
 * `return-record` because *"`docs/ACQUISITION_EVIDENCE.md` defines the continuation step as 'board
 * accepts the next move', and this is not that"*. Under `O-1` it now is that: the press lands the
 * player on a board that will accept their move. The vocabulary in `shared/primary-action.ts`
 * already carries `next-decision` for exactly this act, so nothing new was invented.
 *
 * THE SET-COMPLETE CASE IS STILL REAL, and it is the one place the record remains the answer. A
 * player who has answered all sixty bank positions has nowhere further to be routed, and
 * `nextAnchor` returning null is a first-class state rather than an error. That branch keeps the
 * old sentence and the old control, because for that player the old sentence is true.
 */
import { useState } from "react";

import { primaryAction } from "@shared/primary-action";
import { serveNextBankPosition } from "@/lib/bank-handover";
import type { StoredPosition } from "@/lib/session-position";

/** Shown only once the bank is exhausted: at that point the record really is the way on. */
export const NO_FURTHER_POSITION =
  "עניתם על כל העמדות בסט המשותף. הרשומה שומרת את ההחלטה הזאת, ושם נמצאת הקריאה המלאה.";

/** The invitation on the direct route. It names a position, not a page. */
export const NEXT_POSITION_CTA = "לעמדה הבאה";

export function RevealNextPosition({
  /** The bank ids this record has already answered. Drives which position is served next. */
  answered,
  /**
   * Put the served position on the board.
   *
   * A CALLBACK AND NOT A ROUTE, and the end-to-end walk is what settled it. The reveal is already
   * on `/play`, so `navigate("/play")` moves nothing: measured in Chromium, the handoff store was
   * written, the url stayed put, `Home` never remounted, and the player was left on the old reveal
   * with a board that refused every move. The component that OWNS the board has to take the
   * position; nothing else can.
   */
  onServed,
  /** Only for the exhausted-bank branch, where the record genuinely is the destination. */
  navigate,
}: {
  answered: readonly string[];
  onServed: (position: StoredPosition) => void;
  navigate: (to: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [setComplete, setSetComplete] = useState(false);

  async function go() {
    setBusy(true);
    /*
     * NAVIGATION ONLY. Nothing is recorded here. The trial's continuation event belongs to the
     * move the player makes after landing, and a press counted as continuation would be the
     * product measuring its own button.
     */
    const served = await serveNextBankPosition(answered);
    if (served === "set-complete") {
      setSetComplete(true);
      setBusy(false);
      return;
    }
    onServed(served);
    setBusy(false);
  }

  if (setComplete) {
    return (
      <>
        <p className="reveal-no-continuation" role="status">
          {NO_FURTHER_POSITION}
        </p>
        <button
          type="button"
          className="primary-control"
          {...primaryAction("return-record")}
          onClick={() => navigate("/")}
        >
          חזרה לרשומה
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      className="primary-control"
      {...primaryAction("next-decision")}
      onClick={() => void go()}
      disabled={busy}
    >
      {busy ? "טוען…" : NEXT_POSITION_CTA}
    </button>
  );
}
