/**
 * The context layer, on screen -- and the slot that was empty on almost every visit.
 *
 * IT USED TO RENDER NOTHING unless you had been away for RETURN_GAP_DAYS, and its own comment
 * said so: "It renders nothing at all on an ordinary visit, which is almost every visit." So the
 * app had a place at the top of the page reserved for telling you something before you asked, and
 * it was blank essentially always -- while `loopPosition()` was computing, on every render, the
 * one sentence that says which of record/detect/drill/grade is live and what stands between here
 * and the next one. That sentence rendered inside `LoopStrip`, beside the record, which on a
 * 390x844 phone is y=1368: five hundred pixels below the fold.
 *
 * So the slot carries it now. Three jobs:
 *
 *   1. `data-input` on the document element, so the stylesheet stops offering hover affordances
 *      to a device that cannot hover;
 *   2. THE LOOP POSITION, always, with the basis it was derived from;
 *   3. one re-orientation line when you come back after a real gap, which is a different fact and
 *      sits beside the first rather than replacing it.
 *
 * WHAT THIS IS NOT, and the line is worth writing down because the shape is close to it. This
 * ROUTES to a state the record already holds: the same record produces the same sentence, every
 * time, from counts that are on screen elsewhere anyway. It does not rank options by predicted
 * value, it does not say what to work on, and it does not read anything the detector measures --
 * the "למה?" disclosure says that out loud. A layer that recommended would be measuring the
 * player and then changing what they see, which changes what is being measured.
 */
import { useEffect, useMemo, useState } from "react";
import { useDecisionCount, useRecordReading } from "@/lib/record-api";
import {
  derivePresentation,
  persistUsage,
  readUsage,
  type UsageContext,
} from "@/lib/context-engine";
import { useLoopPosition, type DrillProgress } from "@/lib/use-loop-position";

export function ContextRibbon({ drill = null }: { drill?: DrillProgress }) {
  const [usage, setUsage] = useState<UsageContext | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const count = useDecisionCount();
  const reading = useRecordReading();

  useEffect(() => {
    const now = new Date();
    const current = readUsage(now);
    setUsage(current);
    // Stamped on arrival rather than on leave: a tab closed by the OS never runs an unload
    // handler, and a visit that is not recorded makes the NEXT return look like a longer gap
    // than it was.
    persistUsage(current, now);
  }, []);

  useEffect(() => {
    if (!usage) return;
    const root = document.documentElement;
    root.dataset.input = usage.input;
    root.dataset.device = usage.device;
    return () => {
      delete root.dataset.input;
      delete root.dataset.device;
    };
  }, [usage]);

  const presentation = useMemo(() => {
    if (!usage) return null;
    const recorded = count.data?.decisions ?? 0;
    const scored = reading.data?.scored ?? 0;
    return derivePresentation(
      usage,
      recorded > 0 ? { recorded, awaitingReveal: Math.max(0, recorded - scored) } : null,
    );
  }, [usage, count.data?.decisions, reading.data?.scored]);

  const loop = useLoopPosition(drill);
  /*
   * The gap line is dismissible and the loop position is not, which is the difference between a
   * notice and standing orientation. "הבנתי" used to close the whole ribbon; closing the one line
   * that says what the record is waiting for would be closing the thing this slot is now for.
   */
  const reorientation = dismissed ? null : (presentation?.reorientation ?? null);
  if (!loop.position && !reorientation) return null;

  return (
    <aside className="context-ribbon" role="status" aria-label="איפה הרשומה עומדת">
      {loop.position && (
        <>
          <p className="context-loop">{loop.position.headline}</p>
          {/* R1: never the sentence without what produced it. */}
          <p className="context-loop-basis">{loop.position.basis}</p>
        </>
      )}
      {reorientation && <p className="context-reorientation">{reorientation}</p>}
      <details className="context-why">
        <summary>למה?</summary>
        <ul>
          {(presentation?.why ?? []).map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        {/*
         * The refusal, stated to the player and not only in the source. An app that measures
         * how you decide under time pressure has to be able to say that it is not adjusting
         * itself to that measurement.
         */}
        <small>
          המסך לא מסתכל על מהירות ההחלטה, על שלב המשחק ועל השעון — אלה הדברים שהגלאי מודד, וממשק
          שמגיב עליהם היה משנה את מה שנמדד.
        </small>
      </details>
      {reorientation && (
        <button type="button" className="context-dismiss" onClick={() => setDismissed(true)}>
          הבנתי
        </button>
      )}
    </aside>
  );
}
