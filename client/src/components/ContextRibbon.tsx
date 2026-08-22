/**
 * The context layer, on screen.
 *
 * Two jobs, and no third. It writes `data-input` on the document element so the stylesheet can
 * stop offering hover affordances to a device that cannot hover, and it shows one re-orientation
 * line when you come back after a real gap. Both are explainable, and the "למה?" disclosure is
 * where they are explained -- including what this layer deliberately does not look at.
 *
 * It renders nothing at all on an ordinary visit, which is almost every visit.
 */
import { useEffect, useMemo, useState } from "react";
import { useDecisionCount, useRecordReading } from "@/lib/record-api";
import {
  derivePresentation,
  persistUsage,
  readUsage,
  type UsageContext,
} from "@/lib/context-engine";

export function ContextRibbon() {
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

  if (!presentation?.reorientation || dismissed) return null;

  return (
    <aside className="context-ribbon" role="status" aria-label="חזרה לרשומה">
      <p className="context-reorientation">{presentation.reorientation}</p>
      <details className="context-why">
        <summary>למה?</summary>
        <ul>
          {presentation.why.map((fact) => (
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
      <button type="button" className="context-dismiss" onClick={() => setDismissed(true)}>
        הבנתי
      </button>
    </aside>
  );
}
