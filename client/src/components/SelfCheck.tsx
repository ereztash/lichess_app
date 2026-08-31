/**
 * The self-check, on screen.
 *
 * This exists so a report about this application can name a step instead of a symptom. It runs
 * where the problem is -- the player's browser, on the deployed origin -- and hands back text
 * that can be pasted into a message.
 */
import { useCallback, useState } from "react";
import { Check, Copy, Minus, X } from "lucide-react";
import {
  formatReport,
  runSelfCheck,
  type CheckResult,
  type CheckStatus,
} from "@/lib/self-check";
import { localRecordAvailable, localRecordDurability } from "@/lib/local-record-store";
import {
  blobProbeUrl,
  probeWorkerWith,
  sameOriginProbeUrl,
  WORKER_PROBE_TIMEOUT_MS,
} from "@/lib/worker-probe";
import { clearProgress, progressReport } from "@/lib/progress-record";

const ICON: Record<CheckStatus, typeof Check> = { pass: Check, fail: X, skip: Minus };
const WORD: Record<CheckStatus, string> = { pass: "עבר", fail: "נכשל", skip: "לא רץ" };

export function SelfCheck({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progressCopied, setProgressCopied] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setResults(null);
    try {
      const out = await runSelfCheck({
        fetch: (...args) => fetch(...args),
        // Dynamic: importing the engine module statically would put the 7MB wasm in the initial
        // graph, which is the weight mistake ensureEngine exists to avoid.
        engineUrls: async () => {
          const [js, wasm] = await Promise.all([
            import("stockfish/bin/stockfish-18-lite-single.js?url"),
            import("stockfish/bin/stockfish-18-lite-single.wasm?url"),
          ]);
          return { js: js.default, wasm: wasm.default };
        },
        hasWorker: () => typeof Worker !== "undefined",
        createWorker: (url) => new Worker(url),
        /*
         * Both sources, and the same-origin one is the one the check turns on -- see
         * `worker-probe.ts` for why a `try`/`catch` around `new Worker` could not see a refusal.
         */
        probeWorker: probeWorkerWith(
          (url) => new Worker(url),
          (from) => (from === "blob" ? blobProbeUrl() : sameOriginProbeUrl()),
          WORKER_PROBE_TIMEOUT_MS,
        ),
        storage: () => ({
          available: localRecordAvailable(),
          durability: localRecordDurability(),
        }),
        now: () => Date.now(),
      });
      setResults(out);
    } finally {
      setRunning(false);
    }
  }, []);

  const failed = results?.filter((r) => r.status === "fail").length ?? 0;

  return (
    <section className="self-check">
      <div className="drawer-heading">
        <div>
          <span>בדיקה עצמית</span>
          <b>SELF-CHECK</b>
        </div>
        <button onClick={onClose}>סגור</button>
      </div>

      <p className="self-check-intro">
        הבדיקה רצה בדפדפן שלכם ובודקת כל שלב בנפרד: אחסון, שרת, WebAssembly, Worker, קבצי המנוע
        והמנוע עצמו. אם משהו לא עובד — העתיקו את הדוח ושלחו אותו. הוא לא כולל שום דבר שכתבתם.
      </p>

      <div className="self-check-actions">
        <button className="primary-control" onClick={() => void run()} disabled={running}>
          {running ? "רצה…" : results ? "הריצו שוב" : "הריצו בדיקה"}
        </button>
        {results && (
          <button
            className="ghost-control"
            onClick={async () => {
              await navigator.clipboard?.writeText(formatReport(results, new Date().toISOString()));
              setCopied(true);
            }}
          >
            <Copy size={13} /> {copied ? "הועתק" : "העתיקו את הדוח"}
          </button>
        )}
      </div>

      {running && !results && (
        <p className="self-check-note" role="status">
          בדיקת המנוע לוקחת עד דקה — הוא מוריד קובץ של 7MB.
        </p>
      )}

      {/*
        * HOW FAR THE VISITS GOT, and why it is behind this button rather than on a screen.
        *
        * The trial needs to know where people stopped, and the product must not react to it --
        * so it is written by the commitment screen, read by nobody, and handed over only when a
        * person presses this. It sits in the self-check drawer because that is already the
        * "copy this and send it" surface, and it is kept OUT of `formatReport` so the ten checks
        * keep meaning exactly what they meant.
        *
        * Deliberately not summarised into a completion rate. A rate here would be this panel
        * making a claim about the person, in a drawer built for claims about the software.
        */}
      <div className="self-check-progress">
        <p className="self-check-note" dir="rtl">
          נשמר גם מהלך הביקורים בדפדפן הזה — כמה החלטות נפתחו, אילו שלבים הושלמו ואיפה נעצרתם.
          בלי מהלכים, בלי טקסט שכתבתם ובלי רמות ביטחון, והוא לא נשלח לשום מקום מעצמו.
        </p>
        <div className="self-check-actions">
          <button
            className="ghost-control"
            onClick={async () => {
              await navigator.clipboard?.writeText(progressReport());
              setProgressCopied(true);
            }}
          >
            <Copy size={13} /> {progressCopied ? "הועתק" : "העתיקו את מהלך הביקורים"}
          </button>
          <button
            className="ghost-control"
            onClick={() => {
              clearProgress();
              setProgressCopied(false);
            }}
          >
            מחקו את מהלך הביקורים
          </button>
        </div>
      </div>

      {results && (
        <>
          <p className={`self-check-verdict ${failed ? "has-failure" : ""}`} role="status">
            {failed
              ? `${failed} בדיקות נכשלו. השורות המסומנות הן מה ששבור.`
              : "כל הבדיקות שרצו עברו. אם עדיין משהו לא עובד — זה לא אחד מהשלבים האלה."}
          </p>
          <ul className="self-check-list">
            {results.map((r) => {
              const Icon = ICON[r.status];
              return (
                <li key={r.id} className={`self-check-row ${r.status}`}>
                  <Icon size={14} aria-hidden="true" />
                  <div>
                    <b>
                      {r.label} — {WORD[r.status]}
                    </b>
                    {/* Latin identifiers and URLs inside an RTL paragraph reorder without this. */}
                    <span dir="auto">{r.detail}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
