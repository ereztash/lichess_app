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
import {
  deleteLocalRecord,
  exportLocalRecord,
  importLocalRecord,
  localRecordAvailable,
  localRecordDurability,
  type LocalRecordImport,
} from "@/lib/local-record-store";
import {
  blobProbeUrl,
  probeWorkerWith,
  sameOriginProbeUrl,
  WORKER_PROBE_TIMEOUT_MS,
} from "@/lib/worker-probe";
import { clearProgress, progressReport } from "@/lib/progress-record";

const ICON: Record<CheckStatus, typeof Check> = { pass: Check, fail: X, skip: Minus };
const WORD: Record<CheckStatus, string> = { pass: "עבר", fail: "נכשל", skip: "לא רץ" };

/**
 * What came of the file, widened by the one cause the record store has no business knowing about.
 *
 * `file-unreadable` is the browser failing to hand over the bytes -- a file moved or removed
 * between the picker and the read. Folding it into `not-json` would tell the player their file is
 * malformed when nothing has looked at it, and send them to find another one instead of retrying.
 */
type Took = LocalRecordImport | { kind: "refused"; because: "file-unreadable" };

/**
 * The file's text, through `FileReader` rather than `Blob.text()`.
 *
 * NOT A TEST ACCOMMODATION, THOUGH IT IS ALSO THAT. `Blob.text()` returns a promise this component
 * would have to reject-handle anyway, and `FileReader` is the surface that reports the failure as
 * an event with an error on it. It is also what jsdom implements, so the drawer's control is
 * exercised by a test at the same boundary a person touches it.
 */
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Why a file was not taken, one sentence per cause. A shared sentence would describe four. */
const TOOK_NOTHING: Record<Extract<Took, { kind: "refused" }>["because"], string> = {
  "not-json": "הקובץ הזה אינו JSON תקין, ולכן אין בו רשומה לקרוא.",
  "not-an-object": "הקובץ נקרא, אבל אין בו רשומה של המוצר הזה.",
  "written-by-a-newer-build":
    "הקובץ נכתב בגרסה חדשה יותר של המוצר, והגרסה שרצה כאן לא יודעת לקרוא אותו. לא נגענו בו.",
  "already-holds-a-record":
    "בדפדפן הזה כבר יש רשומה, ואין מיזוג בין שתיים. כדי לטעון את הקובץ צריך למחוק אותה קודם, בכפתור שלידו.",
  "file-unreadable": "הדפדפן לא הצליח לקרוא את הקובץ שנבחר. נסו לבחור אותו שוב.",
};

export function SelfCheck({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  /** `armed` is the first press; the second erases. No `window.confirm`: it reads as the browser's, not ours. */
  const [erase, setErase] = useState<"idle" | "armed" | "done" | "nothing">("idle");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progressCopied, setProgressCopied] = useState(false);
  /** What the last file the player handed over came to. `null` before they have handed one over. */
  const [taken, setTaken] = useState<Took | null>(null);

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
            <Copy size={14} /> {copied ? "הועתק" : "העתיקו את הדוח"}
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
          נשמר גם מהלך הביקורים בדפדפן הזה — כמה החלטות נפתחו, אילו שלבים הושלמו, איפה נעצרתם ואילו
          תקלות נראו. בלי מהלכים ובלי רמות ביטחון. הטקסט היחיד שבו הוא התשובה החופשית לשאלת הערך, אם
          עניתם עליה, והוא לא נשלח לשום מקום מעצמו.
        </p>
        <div className="self-check-actions">
          <button
            className="ghost-control"
            onClick={async () => {
              await navigator.clipboard?.writeText(progressReport());
              setProgressCopied(true);
            }}
          >
            <Copy size={14} /> {progressCopied ? "הועתק" : "העתיקו את מהלך הביקורים"}
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

      {/*
        * THE RECORD ITSELF: TAKE IT, OR ERASE IT. "The record stays in this browser" was a promise
        * with no door in it -- nothing let a player see what was kept or remove it. The export is
        * the stored JSON verbatim (nothing summarised on the way out); the erase is two presses,
        * says what it will and will not remove, and reports what it did. docs/RETENTION.md is the
        * inventory these two act on.
        */}
      <div className="self-check-record">
        <p className="self-check-note" dir="rtl">
          הרשומה שלכם — ההחלטות, הקריאות שכתבתם, משחקי הבליץ — נשמרת בדפדפן הזה. אפשר להוריד אותה
          כקובץ, בדיוק כפי שהיא שמורה, או למחוק אותה מהדפדפן הזה. המחיקה לא נוגעת בהעדפות ובמהלך
          הביקורים, ולא ברשומה של חשבון אחר.
        </p>
        {/*
         * SAID BESIDE THE DOWNLOAD, because it is the sentence that decides whether the file is
         * worth taking. The refusal is stated BEFORE the press rather than only after it: a player
         * who has decisions here needs to know the file will not be merged in before they go and
         * find it, not after.
         */}
        <p className="self-check-note" dir="rtl">
          קובץ שהורדתם אפשר להעלות בחזרה כאן, לדפדפן אחר או לדפדפן הזה אחרי מחיקה. הרשומה נטענת רק
          לדפדפן שאין בו רשומה: אין מיזוג בין שתי רשומות, ולכן העלאה לא תדרוס החלטות שכבר נרשמו כאן.
        </p>
        <div className="self-check-actions">
          <a
            className="ghost-control"
            download="decision-lab-record.json"
            href="#record"
            onClick={(event) => {
              /*
               * BUILT ON THE PRESS. A `data:` URL computed at render time re-encoded the whole
               * record on every render and, past Chromium's URL ceiling, failed silently on a large
               * one (adversarial review, attack 13). A Blob has no such ceiling; the `data:` form
               * is the fallback where `createObjectURL` is missing.
               */
              const exported = exportLocalRecord();
              if (exported === null) {
                event.preventDefault();
                setErase("nothing");
                return;
              }
              const anchor = event.currentTarget;
              if (typeof URL.createObjectURL === "function") {
                if (anchor.dataset.blob) URL.revokeObjectURL(anchor.dataset.blob);
                const url = URL.createObjectURL(new Blob([exported.json], { type: "application/json" }));
                anchor.dataset.blob = url;
                anchor.href = url;
              } else {
                anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(exported.json)}`;
              }
            }}
          >
            הורידו את הרשומה
          </a>
          {/*
           * A LABEL WRAPPING A HIDDEN INPUT, not a button that clicks one. The file picker opens
           * only from a real user gesture on the input itself, and a synthetic click from a button
           * handler is the version of this that works in a test and is refused in a browser.
           */}
          <label className="ghost-control self-check-take">
            העלו רשומה מקובץ
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                /* Cleared before awaiting: the same file picked twice must fire `change` twice. */
                event.currentTarget.value = "";
                if (!file) return;
                const text = await readText(file).catch(() => null);
                setTaken(
                  text === null
                    ? { kind: "refused", because: "file-unreadable" }
                    : await importLocalRecord(text),
                );
              }}
            />
          </label>
          <button
            className="ghost-control"
            aria-pressed={erase === "armed"}
            onClick={() => {
              if (erase !== "armed") {
                setErase(exportLocalRecord() === null ? "nothing" : "armed");
                return;
              }
              void deleteLocalRecord().then(() => setErase("done"));
            }}
          >
            {erase === "armed" ? "לחצו שוב כדי למחוק את הרשומה מהדפדפן הזה" : "מחקו את הרשומה מהדפדפן הזה"}
          </button>
        </div>
        {erase === "done" && (
          <p className="self-check-note" role="status" dir="rtl">
            הרשומה נמחקה מהדפדפן הזה. מה שנשמר בשרת, אם התחברתם, לא נמחק כאן — ראו docs/RETENTION.md.
          </p>
        )}
        {erase === "nothing" && (
          <p className="self-check-note" role="status" dir="rtl">
            אין רשומה בדפדפן הזה למחוק או להוריד.
          </p>
        )}
        {/*
         * WHAT THE FILE CAME TO, IN THE WORDS OF THE CAUSE. Four outcomes and they are not one
         * message: a file that is not ours, a file a newer build wrote, a browser that already
         * holds a record, and a record that landed. The last one reads the durability back rather
         * than promising persistence, because a private window takes the import into memory and
         * loses it on the next refresh -- which is the same sentence the record-mode notice says
         * about every other write, and it would be a strange place to stop saying it.
         */}
        {taken && (
          <p className="self-check-note" role="status" dir="rtl">
            {taken.kind === "imported"
              ? `הרשומה נטענה: ${taken.decisions} החלטות. ${
                  localRecordDurability() === "persistent"
                    ? "היא שמורה בדפדפן הזה."
                    : "הדפדפן חוסם אחסון קבוע, ולכן היא תישמר לכרטיסייה הזו בלבד."
                }`
              : TOOK_NOTHING[taken.because]}
          </p>
        )}
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
