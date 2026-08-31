/**
 * What actually works in THIS browser.
 *
 * Every fix in this application so far was verified in a browser that was not the player's, and
 * the reports that came back -- "it does not work", "I still cannot play" -- named a symptom
 * rather than a step. Some of those reports had one cause (the opening screen was not a game),
 * but several plausible causes remained untestable from here: an engine wasm blocked by a
 * corporate proxy, Workers disabled by policy, localStorage refused by a privacy extension, a
 * server route that 500s only in production. Each produces a different failure and none of them
 * can be told apart from "it does not work".
 *
 * So the checks run where the problem is. Each one is a single observable fact with its own
 * failure text, and the report is copyable, because the point is to end a guessing loop rather
 * than to reassure anyone.
 *
 * Two rules this file keeps:
 *
 * R2 -- an unrun check must never render like a passing one. A check that could not run reports
 * "skipped" and says what it was waiting on; it does not silently count as fine.
 * R1 -- no check claims more than it observed. `bestmove` proves the engine answered once at
 * depth 8; it is not evidence about analysis quality, and nothing here says it is.
 */

/** A check that could not run is its own outcome. It is not a pass and it is not a failure. */
export type CheckStatus = "pass" | "fail" | "skip";

// The application's own parser, not a second copy. A private reimplementation here could pass
// while the real one fails, which would make this check worse than useless.
import { parseInfo } from "./engine-line";
/*
 * THE SAME NINE CODES THE ENGINE AND THE SCAN USE. A private list here would drift from theirs, and
 * a self-check whose vocabulary differs from the product's is a report nobody can act on.
 */
import { ENGINE_REMEDY, type EngineFailure } from "@shared/engine-failure";

const WORKER_UNSUPPORTED: EngineFailure = "worker-unsupported";
const WORKER_REFUSED: EngineFailure = "worker-refused";
const WASM_UNSUPPORTED: EngineFailure = "wasm-unsupported";
const WASM_REFUSED: EngineFailure = "wasm-refused";
const ASSET_MISSING: EngineFailure = "asset-missing";
const ASSET_MISTYPED: EngineFailure = "asset-mistyped";

export type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  /** What was actually observed, in the player's language. Always populated. */
  detail: string;
};

/** Everything the checks need from the outside, so they can be driven in a test. */
export type CheckEnv = {
  fetch: typeof fetch;
  /** Resolves the built engine asset URLs. Dynamic, so the 7MB wasm stays out of this module. */
  engineUrls: () => Promise<{ js: string; wasm: string }>;
  /** Whether this browser has Workers at all. Separate from creating one: policy can allow the
   *  constructor to exist and still refuse the construction. */
  hasWorker: () => boolean;
  createWorker: (url: string) => Worker;
  /**
   * Start a throwaway worker from one of the two sources and report whether it SPOKE.
   *
   * Not `createWorker` plus a `try`: a worker the browser refuses is constructed successfully and
   * fails asynchronously with an empty message, so only a round trip distinguishes the two. The
   * caller owns the timeout and the teardown; this hands back one observation.
   */
  probeWorker: (from: "same-origin" | "blob") => Promise<{ spoke: boolean; observed: string }>;
  storage: () => { available: boolean; durability: "persistent" | "session-only" };
  now: () => number;
};

const ok = (id: string, label: string, detail: string): CheckResult => ({
  id,
  label,
  status: "pass",
  detail,
});
const bad = (id: string, label: string, detail: string): CheckResult => ({
  id,
  label,
  status: "fail",
  detail,
});
const skip = (id: string, label: string, detail: string): CheckResult => ({
  id,
  label,
  status: "skip",
  detail,
});

function reason(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** The position every engine check searches, so a parsed line has a FEN to belong to. */
const STARTPOS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * The content types a browser will execute as a classic script.
 *
 * Not a nicety: `x-content-type-options: nosniff` is set on this deployment, so a script served as
 * `text/plain` is refused rather than sniffed, and the refusal reaches the app as an engine that
 * never started.
 */
const EXECUTABLE_JS = /^(application|text)\/(javascript|ecmascript)|^text\/jscript/i;

/** The smallest valid WebAssembly module: header plus version, nothing else. */
const EMPTY_WASM = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);

async function checkWasm(): Promise<CheckResult> {
  const label = "WebAssembly";
  if (typeof WebAssembly === "undefined") {
    return bad("wasm", label, `${WASM_UNSUPPORTED} — ${ENGINE_REMEDY[WASM_UNSUPPORTED]}`);
  }
  try {
    await WebAssembly.instantiate(EMPTY_WASM);
    return ok("wasm", label, "נתמך, ומודול בדיקה נטען בהצלחה.");
  } catch (error) {
    // Present but refused: a Content-Security-Policy without 'wasm-unsafe-eval' does exactly this.
    return bad("wasm", label, `${WASM_REFUSED} — ${reason(error)}. ${ENGINE_REMEDY[WASM_REFUSED]}`);
  }
}

/**
 * Whether a worker can be started, ASKED BY STARTING ONE AND WAITING FOR IT TO SPEAK.
 *
 * THIS CHECK REPORTED A PASS ON A BROWSER THAT HAD JUST REFUSED THE WORKER, and it took running it
 * on the deployed origin to see. It was `env.createWorker(url).terminate()` inside a `try`, and
 * that cannot observe the failure it exists for: under a `worker-src` that excludes the URL's
 * scheme Chromium **does not throw**. Measured on the deployment: the constructor returns a Worker,
 * the console logs *"Refused to create a worker from 'blob:…'"*, and an `error` event with an EMPTY
 * message arrives afterwards. The synchronous path sees a success and says so.
 *
 * The probe therefore waits for the worker to POST BACK. Construction proves nothing; speaking does.
 *
 * AND IT PROBES THE SOURCE THE ENGINE USES. The old probe built a `blob:` script, to isolate "can a
 * worker be created at all" from "can the engine's script be fetched" — but that isolation is what
 * made the answer wrong on this deployment. Its CSP is `worker-src 'self'`, which forbids `blob:`
 * and allows the engine's own same-origin script, so the probe was asking about a scheme the
 * product never uses and reporting the answer as if it were about the product. Both are now asked,
 * separately, and the same-origin one is the one that decides the check: `blob:` is reported for
 * what it is, a fact about the policy that no engine path depends on.
 */
async function checkWorker(env: CheckEnv): Promise<CheckResult> {
  const label = "Web Worker";
  if (!env.hasWorker()) {
    return bad("worker", label, `${WORKER_UNSUPPORTED} — ${ENGINE_REMEDY[WORKER_UNSUPPORTED]}`);
  }

  const sameOrigin = await env.probeWorker("same-origin");
  const blob = await env.probeWorker("blob");
  const blobNote = blob.spoke ? "blob: מותר גם" : "blob: חסום במדיניות (לא בשימוש כאן)";

  if (sameOrigin.spoke) return ok("worker", label, `Worker מאותו מקור ענה. ${blobNote}.`);
  return bad(
    "worker",
    label,
    `${WORKER_REFUSED} — ${sameOrigin.observed}. ${ENGINE_REMEDY[WORKER_REFUSED]} ${blobNote}.`,
  );
}

/** The engine's two files, fetched from this origin exactly as the engine fetches them. */
async function checkAssets(env: CheckEnv): Promise<CheckResult[]> {
  let urls: { js: string; wasm: string };
  try {
    urls = await env.engineUrls();
  } catch (error) {
    const detail = `לא הצלחתי לטעון את מודול המנוע — ${reason(error)}.`;
    return [
      bad("engine-js", "קובץ המנוע (JS)", detail),
      skip("engine-wasm", "קובץ המנוע (wasm)", "לא נבדק: כתובות הקבצים לא נטענו."),
    ];
  }

  const results: CheckResult[] = [];
  try {
    const res = await env.fetch(urls.js);
    const body = await res.text();
    const type = res.headers.get("content-type") ?? "<none>";
    if (!res.ok || body.length === 0) {
      results.push(
        bad("engine-js", "קובץ המנוע (JS)", `${ASSET_MISSING} — סטטוס ${res.status} עבור ${urls.js}. ${ENGINE_REMEDY[ASSET_MISSING]}`),
      );
    } else if (!EXECUTABLE_JS.test(type)) {
      /*
       * A SEPARATE CODE BECAUSE IT IS INVISIBLE FROM HERE. The bytes arrive, the status is 200, and
       * the browser refuses to execute them anyway -- `x-content-type-options: nosniff` is set on
       * this deployment, which turns the content type from advice into a requirement. Nothing in
       * the app can tell that apart from "the engine did not start" without being told the type.
       */
      results.push(
        bad("engine-js", "קובץ המנוע (JS)", `${ASSET_MISTYPED} — הוגש כ-${type}. ${ENGINE_REMEDY[ASSET_MISTYPED]}`),
      );
    } else {
      results.push(ok("engine-js", "קובץ המנוע (JS)", `${res.status}, ${body.length} בתים, ${type}, ${urls.js}`));
    }
  } catch (error) {
    results.push(bad("engine-js", "קובץ המנוע (JS)", `${ASSET_MISSING} — ההורדה נכשלה: ${reason(error)}.`));
  }

  try {
    const res = await env.fetch(urls.wasm);
    const buf = await res.arrayBuffer();
    const head = new Uint8Array(buf.slice(0, 4));
    const magic = [...head].map((b) => b.toString(16).padStart(2, "0")).join("");
    const type = res.headers.get("content-type") ?? "<none>";
    if (!res.ok) {
      results.push(
        bad("engine-wasm", "קובץ המנוע (wasm)", `${ASSET_MISSING} — סטטוס ${res.status} עבור ${urls.wasm}. ${ENGINE_REMEDY[ASSET_MISSING]}`),
      );
    } else if (magic === "0061736d" && !type.startsWith("application/wasm")) {
      /*
       * REAL WASM, WRONG TYPE, and the order matters: the magic bytes are checked first so a proxy
       * that swapped the body is not reported as a header problem. Streaming instantiation refuses
       * anything but `application/wasm`, and under `nosniff` there is no fallback to sniffing.
       */
      results.push(
        bad("engine-wasm", "קובץ המנוע (wasm)", `${ASSET_MISTYPED} — הוגש כ-${type}. ${ENGINE_REMEDY[ASSET_MISTYPED]}`),
      );
    } else if (magic !== "0061736d") {
      // A proxy or captive portal that answers with an HTML error page produces exactly this:
      // status 200, the right length, and content that is not WebAssembly.
      results.push(
        bad(
          "engine-wasm",
          "קובץ המנוע (wasm)",
          `הקובץ ירד (${buf.byteLength} בתים, ${type}) אבל אינו wasm — ארבעת הבתים הראשונים ${magic} במקום 0061736d. בדרך כלל פרוקסי או סינון רשת שהחליף את התוכן.`,
        ),
      );
    } else {
      results.push(
        ok("engine-wasm", "קובץ המנוע (wasm)", `${buf.byteLength} בתים, ${type}, חתימה תקינה.`),
      );
    }
  } catch (error) {
    results.push(bad("engine-wasm", "קובץ המנוע (wasm)", `ההורדה נכשלה — ${reason(error)}.`));
  }
  return results;
}

/**
 * The engine, end to end: it greets, it reports ready, and it returns a move.
 *
 * Deliberately three separate results from one worker. "The engine does not work" covered a
 * loader that never initialised, a wasm that never arrived and a search that never terminated,
 * and those need three different fixes.
 */
async function checkEngine(env: CheckEnv, timeoutMs: number): Promise<CheckResult[]> {
  const ids = [
    ["engine-greet", "המנוע עונה (uciok)"],
    ["engine-ready", "המנוע מוכן (readyok)"],
    ["engine-move", "המנוע מחזיר מהלך (bestmove)"],
    ["engine-eval", "המנוע מחזיר הערכה (info score)"],
  ] as const;
  const notRun = (from: number, why: string) =>
    ids.slice(from).map(([id, label]) => skip(id, label, why));

  let urls: { js: string; wasm: string };
  try {
    urls = await env.engineUrls();
  } catch (error) {
    return notRun(0, `לא נבדק: מודול המנוע לא נטען — ${reason(error)}.`);
  }

  let worker: Worker;
  try {
    worker = env.createWorker(`${urls.js}#${encodeURIComponent(urls.wasm)}`);
  } catch (error) {
    return notRun(0, `לא נבדק: יצירת ה-Worker נכשלה — ${reason(error)}.`);
  }

  const results: CheckResult[] = [];
  const started = env.now();
  try {
    const waitFor = (token: string, send: string, ms: number) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`לא התקבל "${token}" תוך ${Math.round(ms / 1000)} שניות`)),
          ms,
        );
        const onMessage = (event: MessageEvent) => {
          const line = typeof event.data === "string" ? event.data : "";
          if (!line.includes(token)) return;
          clearTimeout(timer);
          worker.removeEventListener("message", onMessage);
          resolve(line);
        };
        worker.addEventListener("message", onMessage);
        if (send) worker.postMessage(send);
      });

    try {
      await waitFor("uciok", "uci", timeoutMs);
      results.push(
        ok("engine-greet", ids[0][1], `ענה תוך ${((env.now() - started) / 1000).toFixed(1)} שניות.`),
      );
    } catch (error) {
      // The historical failure mode: worker alive, wasm never fetched, no message and no error.
      results.push(
        bad(
          "engine-greet",
          ids[0][1],
          `${reason(error)}. ה-Worker נוצר אך לא ענה — בדרך כלל ה-wasm לא נטען.`,
        ),
      );
      return [...results, ...notRun(1, "לא נבדק: המנוע לא ענה בשלב הראשון.")];
    }

    try {
      await waitFor("readyok", "isready", timeoutMs);
      results.push(ok("engine-ready", ids[1][1], "דיווח מוכנות."));
    } catch (error) {
      results.push(bad("engine-ready", ids[1][1], reason(error)));
      return [...results, ...notRun(2, "לא נבדק: המנוע לא דיווח מוכנות.")];
    }

    /*
     * The search, and what the application actually needs OUT of the search.
     *
     * `bestmove` alone used to be the whole of this check, and it was too narrow to support the
     * claim it was being used for. An engine can return a move while the line that carries the
     * evaluation -- `info ... score cp ... pv ...` -- never arrives or never parses, and the
     * evaluation is what the reveal renders. So every `info` line is collected during the search
     * and run through the application's own parseInfo, reported as its own result.
     */
    const infoLines: string[] = [];
    const collect = (event: MessageEvent) => {
      const line = typeof event.data === "string" ? event.data : "";
      if (line.startsWith("info ")) infoLines.push(line);
    };
    worker.addEventListener("message", collect);
    try {
      worker.postMessage("position startpos");
      const line = await waitFor("bestmove", "go depth 8", timeoutMs);
      const move = line.split(/\s+/)[1] ?? "?";
      // R1: this is one search at depth 8 from the initial position. It says the engine answers,
      // and nothing about how well it plays.
      results.push(
        ok("engine-move", ids[2][1], `החזיר ${move} בעומק 8 מעמדת הפתיחה (בדיקת תקינות בלבד).`),
      );
    } catch (error) {
      results.push(bad("engine-move", ids[2][1], reason(error)));
      worker.removeEventListener("message", collect);
      return [...results, ...notRun(3, "לא נבדק: החיפוש לא הסתיים.")];
    } finally {
      worker.removeEventListener("message", collect);
    }

    const parsed = infoLines.map((raw) => parseInfo(raw, STARTPOS)).filter((l) => l !== undefined);
    const best = parsed[parsed.length - 1];
    results.push(
      best
        ? // R1 again: a number that exists, not a number that is right.
          ok(
            "engine-eval",
            ids[3][1],
            `נקראה הערכה: ${best.scoreCp} סנטי-פונים בעומק ${best.depth}, קו באורך ${best.pv.length} (קיום בלבד, לא איכות).`,
          )
        : bad(
            "engine-eval",
            ids[3][1],
            infoLines.length === 0
              ? "החיפוש הסתיים אבל לא הגיעה אף שורת info — אין מאיפה לקרוא הערכה."
              : `הגיעו ${infoLines.length} שורות info, ואף אחת לא נקראה כהערכה תקפה.`,
          ),
    );
    return results;
  } finally {
    worker.terminate();
  }
}

function checkStorage(env: CheckEnv): CheckResult {
  const label = "שמירת הרשומה";
  const { available, durability } = env.storage();
  if (!available) return bad("storage", label, "אי אפשר לשמור החלטות בדפדפן הזה כלל.");
  return durability === "persistent"
    ? ok("storage", label, "ההחלטות נשמרות בדפדפן הזה וישרדו סגירת כרטיסייה.")
    : // Not a failure any more -- the loop runs -- but it is not a pass either, because the
      // record does not survive the tab and the player has to know that before relying on it.
      skip(
        "storage",
        label,
        "אחסון קבוע חסום (חלון פרטי, חסימת נתוני אתר, תוסף פרטיות או מכסה מלאה). הלולאה עובדת, אבל הרשומה נמחקת עם סגירת הכרטיסייה.",
      );
}

async function checkApi(env: CheckEnv): Promise<CheckResult> {
  const label = "שרת האפליקציה";
  try {
    const res = await env.fetch("/api/trpc/record.storageAvailable?input=%7B%7D", {
      headers: { accept: "application/json" },
    });
    const body = await res.text();
    if (res.status >= 500) {
      // The production outage this project already had: every /api route returned
      // FUNCTION_INVOCATION_FAILED while the client loaded perfectly.
      return bad("api", label, `סטטוס ${res.status}. הפונקציה בשרת נופלת. ${body.slice(0, 120)}`);
    }
    // 401 is the correct answer for a protected procedure without a session, and it proves the
    // route is alive -- so it is a pass, and says why.
    return ok("api", label, `סטטוס ${res.status} — הנתיב חי (401 תקין ללא התחברות).`);
  } catch (error) {
    return bad("api", label, `לא ניתן להגיע לשרת — ${reason(error)}.`);
  }
}

function checkContext(): CheckResult {
  const label = "הקשר הדפדפן";
  const bits = [
    `origin=${typeof location === "undefined" ? "?" : location.origin}`,
    `secure=${typeof isSecureContext === "undefined" ? "?" : isSecureContext}`,
    `crossOriginIsolated=${typeof crossOriginIsolated === "undefined" ? "?" : crossOriginIsolated}`,
    `viewport=${typeof innerWidth === "undefined" ? "?" : `${innerWidth}x${innerHeight}`}`,
    `ua=${typeof navigator === "undefined" ? "?" : navigator.userAgent}`,
  ];
  // Reported, never judged. This build uses the single-threaded engine, so crossOriginIsolated
  // being false is expected and is NOT a finding -- saying otherwise would send the next person
  // chasing COOP/COEP headers the engine does not need.
  return ok("context", label, bits.join(" · "));
}

/** Every check, in the order a failure cascades. */
export async function runSelfCheck(
  env: CheckEnv,
  options: { engineTimeoutMs?: number } = {},
): Promise<CheckResult[]> {
  const timeout = options.engineTimeoutMs ?? 45_000;
  const results: CheckResult[] = [checkContext(), checkStorage(env)];
  results.push(await checkApi(env));
  results.push(await checkWasm());
  results.push(await checkWorker(env));
  results.push(...(await checkAssets(env)));
  results.push(...(await checkEngine(env, timeout)));
  return results;
}

/** The report, as text, so it can be pasted somewhere useful. */
export function formatReport(results: CheckResult[], stamp: string): string {
  const mark = { pass: "PASS", fail: "FAIL", skip: "SKIP" };
  const lines = results.map((r) => `${mark[r.status].padEnd(4)} ${r.label}: ${r.detail}`);
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  return [
    `DECISION LAB self-check — ${stamp}`,
    `${results.length} בדיקות · ${failed} נכשלו · ${skipped} לא רצו`,
    "",
    ...lines,
  ].join("\n");
}
