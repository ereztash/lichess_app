import { Download, LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchGames } from "@/lib/fetch-games";
import {
  GAME_SOURCES,
  preferredSource,
  rememberSource,
  SOURCE_LABEL,
  SOURCE_PLACEHOLDER,
  type GameSource,
  type ImportedGame,
} from "@/lib/game-source";
import type { EngineLine } from "@/lib/engine-line";
import { runImportDiagnostic, type ImportRunProgress } from "@/lib/import-run";
import { ImportDiagnosticPanel } from "./ImportDiagnostic";
import { PreregisterBridge } from "./PreregisterBridge";
import type { ImportDiagnostic } from "@shared/import-diagnostic";
import { MIN_BUCKET_N, PREREGISTERED_THRESHOLDS } from "@shared/detector";
import { readableFailureText } from "@/lib/commit-error";

type Props = {
  onLoad: (game: ImportedGame) => void;
  onClose: () => void;
  /**
   * Injected rather than imported here, for the same reason `analyzePositions` takes it: a static
   * import of stockfish.ts puts 7MB of wasm into the initial module graph and GATE-COMMIT fails.
   */
  analyze: (fen: string, depth: number) => Promise<EngineLine>;
  /**
   * Where a finished reading goes so that closing this overlay stops discarding it.
   *
   * Injected for the same reason `analyze` is, and for the same reason `ImportDiagnosticPanel`
   * takes `bridge` as a slot rather than building it: reaching the record needs a tRPC context or
   * the local store, and calling that hook in here made every test of this screen depend on a
   * provider it has nothing to do with. That regression is what put this prop here -- the first
   * attempt did call the hook, and `import-cost.test.tsx`, which mounts this component with no
   * providers at all, went red on six assertions about text that has no connection to storage.
   *
   * Optional, and its absence means exactly what it says: nowhere to keep the reading, so the
   * reading is not kept and the panel says so rather than implying it will be there tomorrow.
   */
  keepReading?: (input: {
    username: string;
    games: number;
    diagnostic: ImportDiagnostic;
  }) => Promise<unknown>;
  /**
   * The account the last kept reading was scanned from, or undefined.
   *
   * The record already holds this -- `StoredImportDiagnostic.username` -- and this field still
   * opened empty every time, so a returning player retyped an account the app could name. That is
   * memory, not prediction: it fills in what was, and it is an ordinary editable field, so a
   * player scanning a second account types over it exactly as before.
   *
   * Injected rather than read from the record here, for the same reason `analyze` and
   * `keepReading` are: `import-cost.test.tsx` mounts this component with no providers at all.
   */
  lastUsername?: string;
};

const RESULT_LABEL: Record<string, string> = {
  mate: "מט",
  resign: "נכנעה",
  stalemate: "פט",
  timeout: "פסק זמן",
  outoftime: "נגמר הזמן",
  draw: "תיקו",
  cheat: "בוטל",
  variantEnd: "סיום וריאנט",
  unknownFinish: "הסתיים",
};

/**
 * Import a player's own games by username.
 *
 * No API token, no sign-in. Lichess serves this publicly, so the browser reads it directly.
 * Usernames, ratings and dates are Latin/numeric inside an RTL page, so each is marked ltr
 * individually rather than letting the paragraph direction reorder them.
 */
export function ImportGames({ onLoad, onClose, analyze, keepReading, lastUsername }: Props) {
  const [username, setUsername] = useState("");
  /*
   * ONE MECHANISM, and it is this effect rather than the `useState` initialiser.
   *
   * It was both: `useState(lastUsername ?? "")` for the synchronous case and this for the late
   * one. A positive control that removed the initialiser stayed green -- the effect covers that
   * timing too -- which is the definition of the second mechanism being redundant, and two ways
   * to set one field is where they drift apart. The reading is fetched asynchronously, so the
   * late case is the one that must work, and it subsumes the other.
   *
   * It fills in only while the field is UNTOUCHED. A player who has started typing owns the
   * field; having it rewritten under them mid-word would be the interface overriding a person,
   * which is worse than an empty field.
   */
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current && lastUsername) setUsername(lastUsername);
  }, [lastUsername]);
  /*
   * WHICH SITE, and why this is a picker rather than a second screen.
   *
   * Lichess was the only door, and a door only some people have. The import is the bridge over a
   * cold start of 60-90 decisions, so which site a player happens to use decided whether the
   * product worked for them at all. The choice is remembered per browser: a player is on one
   * site, not both, and re-picking every visit would put the cost of the second source on exactly
   * the people it was added for.
   */
  const [source, setSource] = useState<GameSource>(preferredSource);
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ImportRunProgress | null>(null);
  const [diagnostic, setDiagnostic] = useState<ImportDiagnostic | null>(null);
  const [scanFailure, setScanFailure] = useState<string | null>(null);
  /** Whether the reading on screen was persisted. False for a scan the player stopped. */
  const [kept, setKept] = useState(true);
  const abort = useRef<AbortController | null>(null);

  const search = async () => {
    setLoading(true);
    setFailure(null);
    setGames(null);
    setDiagnostic(null);
    setScanFailure(null);
    setKept(true);
    const result = await fetchGames(source, username, 20);
    setLoading(false);
    if (result.ok) setGames(result.games);
    else setFailure(result.failure.message);
  };

  /*
   * The engine over every imported game. Progress arrives already throttled -- analyzePositions
   * limits it to a few a second -- so this setState is not one render per position.
   */
  const scan = async () => {
    if (!games) return;
    const controller = new AbortController();
    abort.current = controller;
    setScanFailure(null);
    setDiagnostic(null);
    setProgress({ done: 0, total: 0, gamesDone: 0, games: games.length });
    try {
      const result = await runImportDiagnostic(games, username, analyze, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setDiagnostic(result.diagnostic);
      /*
       * KEPT ONLY IF IT FINISHED (R2).
       *
       * `aborted` means the player stopped the scan partway, and the diagnostic then covers only
       * the games that got scored. Showing that in the overlay is honest -- the stop just
       * happened and the reader knows why the numbers are thin. Persisting it is not: reopened
       * next week from the rail it would be indistinguishable from a complete reading of the same
       * games, and its rates would be a sample of whatever the scan happened to reach before the
       * click. So a partial scan renders and is not kept, and the panel says as much.
       *
       * The save is deliberately not awaited into the render path and its failure is swallowed:
       * a full localStorage must not turn a finished scan into an error screen. The reading is on
       * screen either way; what is lost is only the ability to reopen it, and the rail simply
       * will not offer an entry that has nothing behind it.
       */
      const keeping = !result.aborted && keepReading !== undefined;
      if (keeping) {
        void keepReading({ username, games: games.length, diagnostic: result.diagnostic })
          .catch(() => {});
      }
      setKept(keeping);
    } catch (error) {
      // R2: a scan that did not finish must not leave a reading on screen that looks finished.
      setDiagnostic(null);
      setScanFailure(readableFailureText(error, "הסריקה נעצרה לפני שהספיקה למדוד משהו."));
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  return (
    <section className="import-games">
      <div className="drawer-heading">
        <div>
          <span>ייבוא לפי שם משתמש</span>
          {/* The site is chosen below, so the badge names the act rather than one of the two. */}
          <b>IMPORT</b>
        </div>
        <button onClick={onClose}>סגור</button>
      </div>

      <p className="import-hint">
        המשחקים הציבוריים שלכם ב-{SOURCE_LABEL[source]}. לא נדרש מפתח API ולא נדרשת התחברות.
      </p>

      {/*
        * BOTH SITES VISIBLE AT ONCE, not a menu.
        *
        * Two options is the case where a menu costs a tap to learn what the alternatives even
        * are, and someone who does not have a Lichess account needs to see that the other one
        * exists without opening anything. Nothing is preselected in the sense that matters: the
        * highlighted one is what THIS browser used last, not a recommendation.
        */}
      <div className="import-sources" role="group" aria-label="מאיזה אתר לייבא">
        {GAME_SOURCES.map((option) => (
          <button
            key={option}
            className={`ghost-control import-source${option === source ? " selected" : ""}`}
            aria-pressed={option === source}
            onClick={() => {
              setSource(option);
              rememberSource(option);
              setGames(null);
              setFailure(null);
            }}
          >
            {SOURCE_LABEL[option]}
          </button>
        ))}
      </div>

      <div className="import-row">
        <input
          className="import-input"
          dir="ltr"
          /* An English phrase inside `lang="he"`. Without this a screen reader reads "lichess
             username" with Hebrew phonetics. SC 3.1.2 exempts proper names and technical terms --
             "username" is neither. The placeholder now names the chosen site, and both are
             English, so the attribute is as necessary as it was. */
          lang="en"
          placeholder={SOURCE_PLACEHOLDER[source]}
          value={username}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            edited.current = true;
            setUsername(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        />
        <button className="import-search" onClick={() => void search()} disabled={loading}>
          {loading ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />}
          <span>{loading ? "מחפש…" : "חפש"}</span>
        </button>
      </div>

      {failure && <p className="import-failure">{failure}</p>}

      {games && !progress && !diagnostic && (
        <>
          {/*
            * WHAT IT COSTS AND WHAT IT BUYS, BEFORE THE BUTTON.
            *
            * Both facts existed and both arrived too late to inform the decision: the duration
            * note rendered only inside the progress block -- after the wait had already started --
            * and what a scan buys was never stated here at all, only on the diagnostic screen at
            * the end. Someone deciding whether to spend the time had neither number.
            *
            * The duration is the one measurement in docs/MEASUREMENTS.md, quoted rather than
            * extrapolated into a per-game estimate for THIS run: 971 positions in 43.4 seconds on
            * one laptop. A phone is slower and by how much is not measured, so it says that
            * instead of guessing a multiplier.
            *
            * The benefit is stated as a condition. An import narrows the live search only when one
            * of its buckets separates from the next by two standard errors, and most will not.
            */}
          <p className="import-cost">
            הסריקה מריצה מנוע על כל עמדה בכל משחק. במדידה על מחשב נייד: 971 עמדות ב-43 שניות. בטלפון
            זה איטי יותר, ולא נמדד כמה. אפשר לעצור באמצע.
          </p>
          <p className="import-buys">
            מה זה קונה: אם יימצא דלי אחד שנבדל מהשאר, אפשר לרשום אותו מראש — ואז הגלאי בודק אותו
            לבדו במקום שישה דליים, וצריך {PREREGISTERED_THRESHOLDS.minBucketN * 2} החלטות חשופות
            במקום {MIN_BUCKET_N * 2}. אם שום דלי לא נבדל, נשארת עם קריאה על המשחקים שלך ובלי קיצור.
          </p>
          <button className="import-scan" onClick={() => void scan()}>
            נתחו את {games.length} המשחקים ומדדו את הדליים
          </button>
        </>
      )}

      {progress && (
        <div className="import-progress">
          <p>
            {/*
              * Counts, never a percentage: this is "k of n", and the n is the point. A bare
              * percent here would be exactly the shape GATE-DENOM scans for.
              */}
            נסרקו {progress.done} עמדות מתוך {progress.total} — משחק {progress.gamesDone} מתוך{" "}
            {progress.games}
          </p>
          <span className="import-progress-track" aria-hidden="true">
            <i style={{ transform: `scaleX(${progress.total ? progress.done / progress.total : 0})` }} />
          </span>
          <button onClick={() => abort.current?.abort()}>עצור</button>
          <p className="import-progress-note">
            הזמן תלוי במכשיר. במדידה על מחשב נייד: 971 עמדות ב-43 שניות. בטלפון זה איטי יותר, ולא
            נמדד כמה.
          </p>
        </div>
      )}

      {scanFailure && <p className="import-failure">{scanFailure}</p>}

      {diagnostic && (
        <ImportDiagnosticPanel
          diagnostic={diagnostic}
          kept={kept}
          bridge={<PreregisterBridge diagnostic={diagnostic} games={games?.length ?? 0} />}
        />
      )}

      {games && (
        <ul className="import-list">
          {games.map((game) => (
            <li key={game.id}>
              <button onClick={() => onLoad(game)}>
                <span className="import-players" dir="ltr">
                  {game.white} <i>vs</i> {game.black}
                </span>
                <span className="import-meta">
                  <b>{RESULT_LABEL[game.status] ?? game.status}</b>
                  {/* Lichess returns the speed as an English word -- bullet, blitz, rapid,
                      classical -- and it is rendered raw. A word, not a code: declared as English
                      rather than left for a Hebrew voice to sound out. */}
                  <span dir="ltr" lang="en">
                    {game.speed}
                  </span>
                  {game.playedAt > 0 && (
                    <time dir="ltr">
                      {new Date(game.playedAt).toLocaleDateString("he-IL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </time>
                  )}
                </span>
                {game.opening && <span className="import-opening">{game.opening}</span>}
                <Download size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
